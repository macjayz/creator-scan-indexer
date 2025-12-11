import { config } from './config.js';
import { analyzer } from './analyzer.js';
import { ethers } from 'ethers';
import { Pool } from 'pg';
import pkg from 'pg';
const { Pool: PgPool } = pkg;

class BytecodeScanner {
    constructor() {
        // Initialize provider
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        // Initialize database pool
        this.dbPool = new PgPool({
            connectionString: config.databaseUrl
        });
        
        // State
        this.lastScannedBlock = null;
        this.isScanning = false;
        this.scanStats = {
            totalScanned: 0,
            erc20Detected: 0,
            errors: 0,
            lastScanTime: null
        };
        
        // Initialize database
        this.initDatabase();
    }
    
    async initDatabase() {
        try {
            // Create bytecode scans table if not exists
            await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS bytecode_scans (
                    id SERIAL PRIMARY KEY,
                    contract_address VARCHAR(42) UNIQUE,
                    creator_address VARCHAR(42),
                    transaction_hash VARCHAR(66),
                    block_number BIGINT,
                    bytecode_hash VARCHAR(66),
                    bytecode_length INTEGER,
                    is_erc20 BOOLEAN,
                    confidence_score DECIMAL(3,2),
                    implementation_type VARCHAR(50),
                    features JSONB,
                    constructor_args JSONB,
                    warnings TEXT[],
                    scan_timestamp TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_bytecode_scans_address ON bytecode_scans(contract_address);
                CREATE INDEX IF NOT EXISTS idx_bytecode_scans_erc20 ON bytecode_scans(is_erc20);
                CREATE INDEX IF NOT EXISTS idx_bytecode_scans_creator ON bytecode_scans(creator_address);
                CREATE INDEX IF NOT EXISTS idx_bytecode_scans_block ON bytecode_scans(block_number);
            `);
            
            console.log('✅ Bytecode scanner database initialized');
            
        } catch (error) {
            console.error('❌ Database initialization error:', error);
            throw error;
        }
    }
    
    async getLastScannedBlock() {
        try {
            const result = await this.dbPool.query(`
                SELECT MAX(block_number) as last_block FROM bytecode_scans
            `);
            
            const lastBlock = result.rows[0]?.last_block;
            
            // If no scans yet, start from current block - 1000
            if (!lastBlock) {
                const currentBlock = await this.provider.getBlockNumber();
                return currentBlock - 1000; // Start scanning from 1000 blocks ago
            }
            
            return lastBlock;
            
        } catch (error) {
            console.error('Error getting last scanned block:', error);
            return null;
        }
    }
    
    async scanNewBlocks() {
        if (this.isScanning) {
            console.log('⚠️  Scan already in progress, skipping...');
            return;
        }
        
        this.isScanning = true;
        
        try {
            console.log('🔍 Starting bytecode scan...');
            
            // Get current block and last scanned block
            const currentBlock = await this.provider.getBlockNumber();
            const lastScannedBlock = await this.getLastScannedBlock() || (currentBlock - 1000);
            
            // Don't scan too far back
            const startBlock = Math.max(lastScannedBlock + 1, currentBlock - 5000);
            
            if (startBlock > currentBlock) {
                console.log('✅ Already up to date');
                this.isScanning = false;
                return;
            }
            
            const endBlock = Math.min(startBlock + config.scanBatchSize - 1, currentBlock);
            
            console.log(`📦 Scanning blocks ${startBlock} to ${endBlock} (${endBlock - startBlock + 1} blocks)`);
            
            // Scan for contract creations
            const contracts = await this.scanBlocksForCreations(startBlock, endBlock);
            
            console.log(`📄 Found ${contracts.length} contract creations`);
            
            // Process each contract
            let processed = 0;
            let erc20Count = 0;
            
            for (const contract of contracts) {
                try {
                    const result = await this.processContract(contract);
                    if (result?.isERC20) {
                        erc20Count++;
                    }
                    processed++;
                    
                    // Log progress
                    if (processed % 10 === 0 || processed === contracts.length) {
                        console.log(`   Processed ${processed}/${contracts.length} contracts`);
                    }
                    
                    // Delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, config.requestDelay));
                    
                } catch (error) {
                    console.error(`Error processing contract ${contract.address}:`, error.message);
                    this.scanStats.errors++;
                }
            }
            
            // Update stats
            this.scanStats.totalScanned += processed;
            this.scanStats.erc20Detected += erc20Count;
            this.scanStats.lastScanTime = new Date();
            this.lastScannedBlock = endBlock;
            
            console.log(`✅ Scan completed!`);
            console.log(`   📊 Processed: ${processed} contracts`);
            console.log(`   🎯 ERC-20 detected: ${erc20Count}`);
            console.log(`   ⚠️  Errors: ${this.scanStats.errors}`);
            console.log(`   ⏱️  Last scan: ${this.scanStats.lastScanTime.toLocaleTimeString()}`);
            
            // Save ERC-20 tokens to main tokens table
            if (erc20Count > 0) {
                await this.saveERC20TokensToMainTable();
            }
            
        } catch (error) {
            console.error('❌ Scan error:', error);
        } finally {
            this.isScanning = false;
        }
    }
    
    async scanBlocksForCreations(startBlock, endBlock) {
        const contracts = [];
        
        try {
            // Get all blocks in range
            for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
                try {
                    const block = await this.provider.getBlock(blockNumber, true);
                    
                    if (!block || !block.transactions) continue;
                    
                    // Check each transaction for contract creations
                    for (const tx of block.transactions) {
                        // Check if this is a contract creation (to is null/undefined and creates contract)
                        if (!tx.to && tx.creates) {
                            contracts.push({
                                address: tx.creates,
                                creator: tx.from,
                                transactionHash: tx.hash,
                                blockNumber: blockNumber,
                                timestamp: new Date(block.timestamp * 1000)
                            });
                        }
                        
                        // Also check internal contract creations via CREATE opcode
                        // This requires trace calls which might not be available in free tier
                    }
                    
                    // Small delay to respect rate limits
                    if (blockNumber % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                } catch (blockError) {
                    console.error(`Error fetching block ${blockNumber}:`, blockError.message);
                    continue;
                }
            }
            
        } catch (error) {
            console.error('Error scanning blocks:', error);
        }
        
        return contracts;
    }
    
    async processContract(contract) {
        try {
            // Check if already scanned
            const existing = await this.dbPool.query(
                'SELECT 1 FROM bytecode_scans WHERE contract_address = $1',
                [contract.address.toLowerCase()]
            );
            
            if (existing.rows.length > 0) {
                console.log(`   ⏩ Already scanned: ${contract.address.substring(0, 10)}...`);
                return null;
            }
            
            // Get contract bytecode
            const bytecode = await this.provider.getCode(contract.address);
            
            if (!bytecode || bytecode === '0x' || bytecode === '0x0') {
                console.log(`   ⏩ No bytecode: ${contract.address.substring(0, 10)}...`);
                return null;
            }
            
            // Analyze bytecode
            const analysis = analyzer.analyzeBytecode(bytecode, {
                address: contract.address,
                creator: contract.creator,
                transactionHash: contract.transactionHash,
                blockNumber: contract.blockNumber,
                timestamp: contract.timestamp
            });
            
            // Save scan result
            await this.saveScanResult(contract, analysis, bytecode);
            
            // Log detection
            if (analysis.isERC20) {
                console.log(`   🎯 ERC-20 detected: ${contract.address.substring(0, 10)}... (confidence: ${analysis.confidence})`);
            }
            
            return analysis;
            
        } catch (error) {
            console.error(`Error processing contract ${contract.address}:`, error.message);
            throw error;
        }
    }
    
    async saveScanResult(contract, analysis, bytecode) {
        try {
            await this.dbPool.query(`
                INSERT INTO bytecode_scans (
                    contract_address,
                    creator_address,
                    transaction_hash,
                    block_number,
                    bytecode_hash,
                    bytecode_length,
                    is_erc20,
                    confidence_score,
                    implementation_type,
                    features,
                    constructor_args,
                    warnings,
                    scan_timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (contract_address) DO NOTHING
            `, [
                contract.address.toLowerCase(),
                contract.creator.toLowerCase(),
                contract.transactionHash,
                contract.blockNumber,
                analysis.bytecodeHash,
                analysis.bytecodeLength,
                analysis.isERC20,
                analysis.confidence,
                analysis.implementationType,
                JSON.stringify(analysis.features),
                JSON.stringify(analysis.constructorArgs),
                analysis.warnings
            ]);
            
        } catch (error) {
            console.error('Error saving scan result:', error);
            throw error;
        }
    }
    
    async saveERC20TokensToMainTable() {
        try {
            // Get ERC-20 tokens from bytecode scans that aren't in main tokens table
            const result = await this.dbPool.query(`
                SELECT 
                    bs.contract_address as address,
                    bs.creator_address as creator_address,
                    bs.transaction_hash as transaction_hash,
                    bs.block_number as block_number,
                    bs.bytecode_hash as bytecode_hash,
                    bs.features->>'selectors' as selectors_data,
                    bs.constructor_args
                FROM bytecode_scans bs
                LEFT JOIN tokens t ON LOWER(t.address) = LOWER(bs.contract_address)
                WHERE bs.is_erc20 = true
                AND t.address IS NULL
                LIMIT 50
            `);
            
            if (result.rows.length === 0) {
                return;
            }
            
            console.log(`💾 Saving ${result.rows.length} ERC-20 tokens to main table...`);
            
            for (const row of result.rows) {
                try {
                    // Try to get token metadata
                    let name = 'Unnamed Token';
                    let symbol = 'TOKEN';
                    let decimals = 18;
                    let totalSupply = '0';
                    
                    // Try to extract from constructor args if available
                    if (row.constructor_args && Array.isArray(row.constructor_args)) {
                        const args = row.constructor_args;
                        if (args[0]?.type === 'string') name = args[0].value;
                        if (args[1]?.type === 'string') symbol = args[1].value;
                    }
                    
                    // Insert into main tokens table
                    await this.dbPool.query(`
                        INSERT INTO tokens (
                            address,
                            name,
                            symbol,
                            decimals,
                            total_supply,
                            creator_address,
                            factory_address,
                            platform,
                            block_number,
                            transaction_hash,
                            detection_timestamp,
                            detection_method,
                            ui_deployer,
                            status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, 'active')
                        ON CONFLICT (address) DO NOTHING
                    `, [
                        row.address,
                        name,
                        symbol,
                        decimals,
                        totalSupply,
                        row.creator_address,
                        null, // No factory for bytecode-scanned tokens
                        'erc20',
                        row.block_number,
                        row.transaction_hash,
                        'bytecode_scan',
                        row.creator_address // UI deployer = creator for now
                    ]);
                    
                    console.log(`   💾 Saved: ${symbol} (${row.address.substring(0, 10)}...)`);
                    
                } catch (tokenError) {
                    console.error(`Error saving token ${row.address}:`, tokenError.message);
                }
            }
            
        } catch (error) {
            console.error('Error saving ERC-20 tokens to main table:', error);
        }
    }
    
    async getStats() {
        try {
            const stats = await this.dbPool.query(`
                SELECT 
                    COUNT(*) as total_scans,
                    COUNT(CASE WHEN is_erc20 = true THEN 1 END) as erc20_detected,
                    COUNT(CASE WHEN is_erc20 = false THEN 1 END) as non_erc20,
                    MIN(block_number) as earliest_block,
                    MAX(block_number) as latest_block,
                    MAX(scan_timestamp) as last_scan
                FROM bytecode_scans
            `);
            
            return {
                ...stats.rows[0],
                scannerStats: this.scanStats
            };
            
        } catch (error) {
            console.error('Error getting scanner stats:', error);
            return null;
        }
    }
    
    async startContinuousScan(intervalMinutes = 5) {
        console.log(`🚀 Starting continuous bytecode scanner (interval: ${intervalMinutes} minutes)`);
        
        // Initial scan
        await this.scanNewBlocks();
        
        // Set up interval
        setInterval(async () => {
            await this.scanNewBlocks();
        }, intervalMinutes * 60 * 1000);
        
        // Also scan on startup after a delay
        setTimeout(async () => {
            await this.scanNewBlocks();
        }, 30000); // 30 seconds
        
        return this;
    }
    
    async stop() {
        console.log('🛑 Stopping bytecode scanner...');
        this.isScanning = false;
        await this.dbPool.end();
    }
}

// Export the scanner class
export { BytecodeScanner };

// If this file is run directly, start the scanner
if (import.meta.url === `file://${process.argv[1]}`) {
    const scanner = new BytecodeScanner();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down...');
        await scanner.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down...');
        await scanner.stop();
        process.exit(0);
    });
    
    // Start scanning
    scanner.startContinuousScan(5).catch(console.error);
}
