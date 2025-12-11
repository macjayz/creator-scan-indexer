const { ethers } = require('ethers');

console.log('🎯 Enhanced ERC-20 Scanner');
console.log('==========================\n');

const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/WP_xuEGBgpHNNkxTHjcTK');

// Known CREATE2 factory addresses on Base
const KNOWN_FACTORIES = [
    '0x4e59b44847b379578588920ca78fbf26c0b4956c', // CREATE2 factory
    '0xce0042b868300000d44a59004da54a005ffdcf9f', // Another common factory
];

async function scanForCustomTokens() {
    console.log('Scanning for custom ERC-20 tokens...\n');
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}\n`);
    
    // Scan last 1000 blocks
    const startBlock = currentBlock - 1000;
    let foundTokens = 0;
    
    console.log(`Scanning blocks ${startBlock} to ${currentBlock}\n`);
    
    for (let blockNumber = startBlock; blockNumber <= currentBlock; blockNumber++) {
        try {
            const block = await provider.getBlock(blockNumber, true);
            let blockTokens = 0;
            
            for (const tx of block.transactions) {
                // Look for transactions to known factories
                if (tx.to && KNOWN_FACTORIES.includes(tx.to.toLowerCase())) {
                    console.log(`🔍 Factory tx in block ${blockNumber}: ${tx.hash.substring(0, 10)}...`);
                    
                    // Try to get transaction receipt to see created contract
                    try {
                        const receipt = await provider.getTransactionReceipt(tx.hash);
                        if (receipt && receipt.contractAddress) {
                            console.log(`   🏭 Contract created: ${receipt.contractAddress.substring(0, 10)}...`);
                            
                            // Check if it's ERC-20
                            const bytecode = await provider.getCode(receipt.contractAddress);
                            if (isERC20(bytecode)) {
                                console.log(`   🎯 ERC-20 detected!`);
                                foundTokens++;
                                blockTokens++;
                                
                                // You would save this to database here
                            }
                        }
                    } catch (e) {
                        // Skip if can't get receipt
                    }
                }
                
                // Also check direct contract creations
                if (!tx.to && tx.creates) {
                    const bytecode = await provider.getCode(tx.creates);
                    if (isERC20(bytecode)) {
                        console.log(`🎯 Direct ERC-20 creation in block ${blockNumber}: ${tx.creates.substring(0, 10)}...`);
                        foundTokens++;
                        blockTokens++;
                    }
                }
            }
            
            if (blockTokens > 0) {
                console.log(`   Block ${blockNumber}: ${blockTokens} token(s) found\n`);
            }
            
            // Progress indicator
            if ((blockNumber - startBlock) % 100 === 0) {
                console.log(`   ...scanned ${blockNumber - startBlock}/1000 blocks`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
        } catch (error) {
            console.log(`   Error in block ${blockNumber}: ${error.message}`);
            continue;
        }
    }
    
    console.log(`\n✅ Scan complete! Found ${foundTokens} custom ERC-20 tokens`);
}

function isERC20(bytecode) {
    if (!bytecode || bytecode === '0x') return false;
    
    const ERC20_SELECTORS = [
        '0x70a08231', // balanceOf(address)
        '0xa9059cbb', // transfer(address,uint256)
        '0xdd62ed3e', // allowance(address,address)
    ];
    
    // Check if all required selectors are present
    return ERC20_SELECTORS.every(selector => 
        bytecode.includes(selector.substring(2))
    );
}

scanForCustomTokens().catch(console.error);
