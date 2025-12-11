const { ethers } = require('ethers');
const { Pool } = require('pg');

console.log('🔍 Starting Historical ERC-20 Scan');
console.log('==================================\n');

const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/WP_xuEGBgpHNNkxTHjcTK');
const dbPool = new Pool({
    connectionString: "postgresql://creator_scan:local_password@localhost:5433/creator_scan"
});

// ERC-20 selectors
const ERC20_SELECTORS = [
    '0x70a08231', // balanceOf(address)
    '0xa9059cbb', // transfer(address,uint256)
    '0xdd62ed3e', // allowance(address,address)
];

async function scanHistoricalBlocks(startBlock, endBlock, batchSize = 100) {
    console.log(`Scanning blocks ${startBlock} to ${endBlock} (${endBlock - startBlock + 1} blocks)`);
    console.log(`Batch size: ${batchSize} blocks\n`);
    
    let totalCreations = 0;
    let totalERC20 = 0;
    
    for (let batchStart = startBlock; batchStart <= endBlock; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, endBlock);
        
        console.log(`Processing blocks ${batchStart} to ${batchEnd}...`);
        
        let batchCreations = 0;
        let batchERC20 = 0;
        
        for (let blockNumber = batchStart; blockNumber <= batchEnd; blockNumber++) {
            try {
                const block = await provider.getBlock(blockNumber, true);
                
                for (const tx of block.transactions) {
                    if (!tx.to && tx.creates) {
                        batchCreations++;
                        totalCreations++;
                        
                        // Check if it's ERC-20
                        const bytecode = await provider.getCode(tx.creates);
                        if (bytecode && bytecode !== '0x') {
                            const isERC20 = ERC20_SELECTORS.every(selector => 
                                bytecode.includes(selector.substring(2))
                            );
                            
                            if (isERC20) {
                                batchERC20++;
                                totalERC20++;
                                
                                // Check if already in database
                                const existing = await dbPool.query(
                                    'SELECT 1 FROM tokens WHERE address = $1',
                                    [tx.creates.toLowerCase()]
                                );
                                
                                if (existing.rows.length === 0) {
                                    // Also check bytecode scans table
                                    const existingScan = await dbPool.query(
                                        'SELECT 1 FROM bytecode_scans WHERE contract_address = $1',
                                        [tx.creates.toLowerCase()]
                                    );
                                    
                                    if (existingScan.rows.length === 0) {
                                        console.log(`   🎯 NEW ERC-20: ${tx.creates.substring(0, 10)}... (block ${blockNumber})`);
                                        
                                        // Save to bytecode_scans
                                        await dbPool.query(`
                                            INSERT INTO bytecode_scans (
                                                contract_address, creator_address, transaction_hash,
                                                block_number, bytecode_hash, bytecode_length,
                                                is_erc20, confidence_score, implementation_type,
                                                scan_timestamp
                                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                                            ON CONFLICT (contract_address) DO NOTHING
                                        `, [
                                            tx.creates.toLowerCase(),
                                            tx.from.toLowerCase(),
                                            tx.hash,
                                            blockNumber,
                                            '0x' + bytecode.substring(2, 34), // Simple hash
                                            bytecode.length - 2,
                                            true,
                                            0.9,
                                            'historical_scan'
                                        ]);
                                        
                                        // Save to tokens table
                                        await dbPool.query(`
                                            INSERT INTO tokens (
                                                address, name, symbol, decimals, total_supply,
                                                creator_address, factory_address, platform,
                                                block_number, transaction_hash, detection_timestamp,
                                                detection_method, ui_deployer, status
                                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, 'active')
                                            ON CONFLICT (address) DO NOTHING
                                        `, [
                                            tx.creates.toLowerCase(),
                                            'Unnamed Token',
                                            'TOKEN',
                                            18,
                                            '0',
                                            tx.from.toLowerCase(),
                                            null,
                                            'erc20',
                                            blockNumber,
                                            tx.hash,
                                            'bytecode_scan',
                                            tx.from.toLowerCase()
                                        ]);
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Progress indicator
                if ((blockNumber - batchStart + 1) % 20 === 0) {
                    console.log(`   ...processed ${blockNumber - batchStart + 1}/${batchSize} blocks in batch`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
                
            } catch (error) {
                console.log(`   Error in block ${blockNumber}: ${error.message}`);
                continue;
            }
        }
        
        console.log(`   Batch results: ${batchCreations} creations, ${batchERC20} ERC-20\n`);
        
        // Wait between batches
        if (batchEnd < endBlock) {
            console.log('Waiting 2 seconds before next batch...\n');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log(`\n✅ Historical scan complete!`);
    console.log(`📊 Total: ${totalCreations} contract creations`);
    console.log(`🎯 ERC-20 detected: ${totalERC20}`);
    
    return { totalCreations, totalERC20 };
}

async function main() {
    try {
        // Get current block
        const currentBlock = await provider.getBlockNumber();
        console.log(`Current block: ${currentBlock}\n`);
        
        // Ask user for range
        console.log('How many blocks to scan back from current?');
        console.log('Recommended: 5000 blocks (~1 day) or 20000 blocks (~4 days)');
        console.log('Enter number of blocks (or press Enter for 5000):');
        
        // For now, hardcode 5000 blocks
        const blocksBack = 5000;
        const startBlock = currentBlock - blocksBack;
        
        console.log(`\nWill scan ${blocksBack} blocks (${startBlock} to ${currentBlock})\n`);
        
        // Start scanning
        await scanHistoricalBlocks(startBlock, currentBlock, 100);
        
        console.log('\n🎉 Historical scan completed!');
        console.log('Check results with:');
        console.log('  psql "postgresql://creator_scan:local_password@localhost:5433/creator_scan" -c "SELECT COUNT(*) FROM bytecode_scans WHERE is_erc20 = true;"');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await dbPool.end();
    }
}

main().catch(console.error);
