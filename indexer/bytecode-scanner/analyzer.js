import { config } from './config.js';
import {
    ERC20_FUNCTION_SELECTORS,
    ERC20_EVENT_SIGNATURES,
    BYTECODE_PATTERNS,
    REQUIRED_ERC20_SELECTORS,
    COMMON_ERC20_SELECTORS,
    calculateERC20Confidence,
    isProxyBytecode,
    extractConstructorArgs,
    selectorInBytecode,
    patternInBytecode
} from './signatures.js';

export class BytecodeAnalyzer {
    constructor() {
        this.minConfidence = config.minERC20Confidence;
    }
    
    /**
     * Analyze contract bytecode for ERC-20 characteristics
     * @param {string} bytecode - Raw contract bytecode (with 0x prefix)
     * @param {Object} metadata - Optional metadata (creator, tx hash, etc.)
     * @returns {Object} Analysis results
     */
    analyzeBytecode(bytecode, metadata = {}) {
        try {
            // Basic validation
            if (!bytecode || typeof bytecode !== 'string') {
                return this.createResult(false, 'Invalid bytecode', 0);
            }
            
            // Clean and validate bytecode
            const cleanBytecode = this.cleanBytecode(bytecode);
            if (!cleanBytecode) {
                return this.createResult(false, 'Empty or invalid bytecode', 0);
            }
            
            // Check if it's a proxy contract
            const isProxy = isProxyBytecode(cleanBytecode);
            
            // Calculate ERC-20 confidence score
            const confidence = calculateERC20Confidence(cleanBytecode);
            
            // Check if it meets minimum confidence threshold
            const isERC20 = confidence >= this.minConfidence;
            
            // Extract detected features
            const features = this.extractFeatures(cleanBytecode);
            
            // Try to extract constructor arguments (name, symbol, decimals)
            const constructorArgs = extractConstructorArgs(cleanBytecode);
            
            // Determine implementation type
            const implementationType = this.determineImplementationType(cleanBytecode, features);
            
            // Build analysis result
            const result = {
                isERC20,
                confidence: parseFloat(confidence.toFixed(3)),
                isProxy,
                bytecodeHash: this.calculateBytecodeHash(cleanBytecode),
                bytecodeLength: cleanBytecode.length,
                features,
                constructorArgs,
                implementationType,
                metadata: {
                    ...metadata,
                    analyzedAt: new Date().toISOString()
                },
                warnings: this.generateWarnings(cleanBytecode, features, isProxy)
            };
            
            return result;
            
        } catch (error) {
            console.error('Bytecode analysis error:', error);
            return this.createResult(false, `Analysis error: ${error.message}`, 0);
        }
    }
    
    /**
     * Clean and validate bytecode
     */
    cleanBytecode(bytecode) {
        if (!bytecode) return '';
        
        let clean = bytecode.trim().toLowerCase();
        
        // Remove 0x prefix if present
        if (clean.startsWith('0x')) {
            clean = clean.substring(2);
        }
        
        // Validate hex characters
        if (!/^[0-9a-f]+$/.test(clean)) {
            return '';
        }
        
        // Check size constraints
        if (clean.length < config.minContractSize * 2) { // *2 because hex
            return '';
        }
        
        if (clean.length > config.maxBytecodeSize * 2) {
            return '';
        }
        
        return clean;
    }
    
    /**
     * Extract features from bytecode
     */
    extractFeatures(bytecode) {
        const features = {
            selectors: {},
            events: {},
            patterns: {},
            hasAllRequired: true,
            missingSelectors: []
        };
        
        // Check required selectors
        REQUIRED_ERC20_SELECTORS.forEach(selector => {
            const hasSelector = selectorInBytecode(bytecode, selector);
            features.selectors[selector] = hasSelector;
            if (!hasSelector) {
                features.hasAllRequired = false;
                features.missingSelectors.push(selector);
            }
        });
        
        // Check common selectors
        COMMON_ERC20_SELECTORS.forEach(selector => {
            features.selectors[selector] = selectorInBytecode(bytecode, selector);
        });
        
        // Check for Transfer event (important for ERC-20)
        const transferEventSig = ERC20_EVENT_SIGNATURES['Transfer(address,address,uint256)'];
        features.events['Transfer'] = selectorInBytecode(bytecode, transferEventSig);
        
        // Check for other events
        Object.entries(ERC20_EVENT_SIGNATURES).forEach(([eventName, signature]) => {
            if (eventName !== 'Transfer(address,address,uint256)') {
                features.events[eventName.split('(')[0]] = selectorInBytecode(bytecode, signature);
            }
        });
        
        // Check for known patterns
        Object.entries(BYTECODE_PATTERNS).forEach(([patternName, patterns]) => {
            patterns.forEach(pattern => {
                if (patternInBytecode(bytecode, pattern)) {
                    features.patterns[patternName] = true;
                }
            });
        });
        
        // Count total selectors found
        features.totalSelectorsFound = Object.values(features.selectors).filter(Boolean).length;
        features.totalEventsFound = Object.values(features.events).filter(Boolean).length;
        features.totalPatternsFound = Object.values(features.patterns).filter(Boolean).length;
        
        return features;
    }
    
    /**
     * Determine implementation type based on patterns
     */
    determineImplementationType(bytecode, features) {
        // Check for proxy
        if (features.patterns['PROXY_PATTERN'] || isProxyBytecode(bytecode)) {
            return 'proxy';
        }
        
        // Check for OpenZeppelin patterns
        if (features.patterns['OPENZEPPELIN_ERC20']) {
            return 'openzeppelin';
        }
        
        // Check for Solmate patterns
        if (features.patterns['SOLMATE_ERC20']) {
            return 'solmate';
        }
        
        // Check for factory/clone patterns
        if (features.patterns['CLONE_PATTERN'] || features.patterns['MINIMAL_PROXY']) {
            return 'factory_clone';
        }
        
        // Default to custom
        return 'custom';
    }
    
    /**
     * Generate warnings based on analysis
     */
    generateWarnings(bytecode, features, isProxy) {
        const warnings = [];
        
        // Missing required selectors
        if (!features.hasAllRequired) {
            warnings.push(`Missing required ERC-20 selectors: ${features.missingSelectors.join(', ')}`);
        }
        
        // No Transfer event
        if (config.requireTransferEvent && !features.events['Transfer']) {
            warnings.push('Missing Transfer event (required for ERC-20)');
        }
        
        // Very low selector count
        if (features.totalSelectorsFound < 3) {
            warnings.push(`Low function selector count: ${features.totalSelectorsFound}`);
        }
        
        // Proxy warning
        if (isProxy) {
            warnings.push('Contract appears to be a proxy - implementation bytecode not available');
        }
        
        // Very short bytecode
        if (bytecode.length < 1000) { // ~500 bytes
            warnings.push('Very short bytecode - may be minimal or incomplete');
        }
        
        return warnings;
    }
    
    /**
     * Calculate simple bytecode hash for deduplication
     */
    calculateBytecodeHash(bytecode) {
        // Simple hash for now - could use keccak256 for better uniqueness
        const shortHash = bytecode.substring(0, 64); // First 32 bytes
        return `0x${shortHash}`;
    }
    
    /**
     * Create standardized result object
     */
    createResult(isERC20, message, confidence) {
        return {
            isERC20,
            confidence: parseFloat(confidence.toFixed(3)),
            message,
            bytecodeHash: null,
            bytecodeLength: 0,
            features: {},
            constructorArgs: [],
            implementationType: 'unknown',
            metadata: { analyzedAt: new Date().toISOString() },
            warnings: [message]
        };
    }
    
    /**
     * Batch analyze multiple bytecodes
     */
    async analyzeBatch(bytecodes, metadatas = []) {
        const results = [];
        
        for (let i = 0; i < bytecodes.length; i++) {
            const bytecode = bytecodes[i];
            const metadata = metadatas[i] || {};
            
            try {
                const result = this.analyzeBytecode(bytecode, metadata);
                results.push(result);
                
                // Small delay to prevent CPU overload
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            } catch (error) {
                console.error(`Error analyzing bytecode ${i}:`, error);
                results.push(this.createResult(false, `Analysis error: ${error.message}`, 0));
            }
        }
        
        return results;
    }
}

// Export singleton instance
export const analyzer = new BytecodeAnalyzer();
