const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/WP_xuEGBgpHNNkxTHjcTK');

async function checkRecentCreations() {
    console.log('Checking recent blocks for contract creations...\n');
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}\n`);
    
    // Check last 20 blocks
    for (let i = 0; i < 20; i++) {
        const blockNumber = currentBlock - i;
        try {
            const block = await provider.getBlock(blockNumber, true);
            
            let creations = 0;
            for (const tx of block.transactions) {
                if (!tx.to && tx.creates) {
                    creations++;
                }
            }
            
            if (creations > 0) {
                console.log(`Block ${blockNumber}: ${creations} contract creation(s)`);
                
                // Show details for first creation
                for (const tx of block.transactions) {
                    if (!tx.to && tx.creates) {
                        console.log(`  → ${tx.creates.substring(0, 10)}... by ${tx.from.substring(0, 10)}...`);
                        break;
                    }
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.log(`Error checking block ${blockNumber}: ${error.message}`);
        }
    }
    
    console.log('\n✅ Check complete');
}

checkRecentCreations().catch(console.error);
