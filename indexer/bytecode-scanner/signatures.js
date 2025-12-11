// ERC-20 Bytecode Signatures and Patterns
// Function selectors (first 4 bytes of keccak256(function signature))

export const ERC20_FUNCTION_SELECTORS = {
    // ERC-20 Standard Functions
    'totalSupply()': '0x18160ddd',
    'balanceOf(address)': '0x70a08231',
    'transfer(address,uint256)': '0xa9059cbb',
    'transferFrom(address,address,uint256)': '0x23b872dd',
    'approve(address,uint256)': '0x095ea7b3',
    'allowance(address,address)': '0xdd62ed3e',
    
    // Optional ERC-20 Functions
    'name()': '0x06fdde03',
    'symbol()': '0x95d89b41',
    'decimals()': '0x313ce567',
    
    // Common Extensions
    'mint(address,uint256)': '0x40c10f19',
    'burn(uint256)': '0x42966c68',
    'burnFrom(address,uint256)': '0x79cc6790',
    'pause()': '0x8456cb59',
    'unpause()': '0x3f4ba83a',
    'owner()': '0x8da5cb5b',
    'renounceOwnership()': '0x715018a6',
    'transferOwnership(address)': '0xf2fde38b',
    
    // Tax/Reflection Functions (common in meme tokens)
    'setTax(uint256)': '0x...', // Varies by implementation
    'setMarketingWallet(address)': '0x...',
    'excludeFromFee(address)': '0x...',
    'includeInFee(address)': '0x...',
};

// Event signatures (full keccak256)
export const ERC20_EVENT_SIGNATURES = {
    'Transfer(address,address,uint256)': '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    'Approval(address,address,uint256)': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
    'Mint(address,uint256)': '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885',
    'Burn(address,uint256)': '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5',
    'OwnershipTransferred(address,address)': '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
};

// Common bytecode patterns from popular implementations
export const BYTECODE_PATTERNS = {
    // OpenZeppelin ERC-20 patterns (partial matches)
    'OPENZEPPELIN_ERC20': [
        '6080604052', // Common startup pattern
        '34',         // CALLVALUE
        '80',         // DUP1
        '15',         // ISZERO
    ],
    
    // Solmate ERC-20 patterns
    'SOLMATE_ERC20': [
        '6080604052',
        '600a',       // Common in Solmate
        '600e',       // Another Solmate pattern
    ],
    
    // Common constructor patterns
    'CONSTRUCTOR_NAME_SYMBOL': [
        '0000000000000000000000000000000000000000000000000000000000000040', // String offset
        '0000000000000000000000000000000000000000000000000000000000000080', // Another string offset
    ],
    
    // Proxy patterns (common in upgradeable tokens)
    'PROXY_PATTERN': [
        '363d3d373d3d3d363d73', // EIP-1967 proxy pattern
        '5af43d82803e903d91602b57fd5bf3', // Minimal proxy pattern
    ],
};

// Minimum required selectors for ERC-20 detection
export const REQUIRED_ERC20_SELECTORS = [
    '0x70a08231', // balanceOf(address)
    '0xa9059cbb', // transfer(address,uint256)
    '0xdd62ed3e', // allowance(address,address)
];

// Optional but common selectors (increase confidence)
export const COMMON_ERC20_SELECTORS = [
    '0x18160ddd', // totalSupply()
    '0x095ea7b3', // approve(address,uint256)
    '0x23b872dd', // transferFrom(address,address,uint256)
];

// Factory deployment patterns (common in token generators)
export const FACTORY_PATTERNS = {
    'CREATE2_PATTERN': '5b5e139f', // Often used in CREATE2 deployments
    'MINIMAL_PROXY': '3d602d80600a3d3981f3', // EIP-1167 minimal proxy
    'CLONE_PATTERN': '36603057343d52307f830d2d700a97af574b186c80d40429385d24241565b08a7c559ba283a964d9b160203da23d3df35b3d3d3d3d363d3d37363d73', // Clone pattern
};

// Confidence weights for different detection methods
export const CONFIDENCE_WEIGHTS = {
    requiredSelector: 0.4,      // Each required selector found
    commonSelector: 0.15,       // Each common selector found
    transferEvent: 0.2,         // Transfer event signature found
    knownPattern: 0.25,         // Known bytecode pattern match
    completeERC20: 0.5,         // Has all standard ERC-20 functions
};

// Utility function to check if a selector is present in bytecode
export function selectorInBytecode(bytecode, selector) {
    return bytecode.includes(selector.toLowerCase().replace('0x', ''));
}

// Utility function to check if a pattern is present
export function patternInBytecode(bytecode, pattern) {
    const cleanBytecode = bytecode.toLowerCase().replace('0x', '');
    const cleanPattern = pattern.toLowerCase().replace('0x', '');
    return cleanBytecode.includes(cleanPattern);
}

// Calculate confidence score for ERC-20 detection
export function calculateERC20Confidence(bytecode) {
    let score = 0;
    const cleanBytecode = bytecode.toLowerCase().replace('0x', '');
    
    // Check required selectors
    REQUIRED_ERC20_SELECTORS.forEach(selector => {
        if (cleanBytecode.includes(selector.replace('0x', ''))) {
            score += CONFIDENCE_WEIGHTS.requiredSelector;
        }
    });
    
    // Check common selectors
    COMMON_ERC20_SELECTORS.forEach(selector => {
        if (cleanBytecode.includes(selector.replace('0x', ''))) {
            score += CONFIDENCE_WEIGHTS.commonSelector;
        }
    });
    
    // Check for Transfer event
    if (cleanBytecode.includes(ERC20_EVENT_SIGNATURES['Transfer(address,address,uint256)'].replace('0x', ''))) {
        score += CONFIDENCE_WEIGHTS.transferEvent;
    }
    
    // Check for known patterns
    Object.values(BYTECODE_PATTERNS).forEach(patterns => {
        patterns.forEach(pattern => {
            if (cleanBytecode.includes(pattern.toLowerCase())) {
                score += CONFIDENCE_WEIGHTS.knownPattern;
                return;
            }
        });
    });
    
    // Cap at 1.0
    return Math.min(score, 1.0);
}

// Check if bytecode looks like a proxy
export function isProxyBytecode(bytecode) {
    const cleanBytecode = bytecode.toLowerCase().replace('0x', '');
    
    for (const pattern of Object.values(FACTORY_PATTERNS)) {
        if (cleanBytecode.includes(pattern.toLowerCase().replace('0x', ''))) {
            return true;
        }
    }
    
    return false;
}

// Extract potential constructor arguments (simplified)
export function extractConstructorArgs(bytecode) {
    const cleanBytecode = bytecode.toLowerCase().replace('0x', '');
    const args = [];
    
    // Look for common string patterns in constructor (simplified)
    // This is a basic implementation - can be enhanced
    const stringPattern = /646576656c6f7065642062797c7c([a-f0-9]{40,80})/;
    const match = cleanBytecode.match(stringPattern);
    
    if (match && match[1]) {
        args.push({
            type: 'string',
            value: Buffer.from(match[1], 'hex').toString('utf8').replace(/\0/g, ''),
            position: match.index
        });
    }
    
    return args;
}
