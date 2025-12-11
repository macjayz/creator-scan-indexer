import { ethers } from 'ethers';
import { config } from '../config/index.js';

async function findRecentTokenCreations() {
  console.log('🔍 Searching for recent token creation patterns...');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 2000; // Last 2000 blocks
  
  console.log(`📊 Scanning blocks ${fromBlock} to ${currentBlock} (recent ~${currentBlock - fromBlock} blocks)`);
  
  // Look for contract creations (create/create2)
  const createTopic = '0x4db17dd5e4732fb6da34a148104a592783ca119a1e7bb8829eba6cbadef0b511'; // keccak256("ContractCreation(address)")
  const create2Topic = '0x68c0c1255e8d5a0a6c0f9b4c0b8c0a8c0f9b4c0b8c0a8c0f9b4c0b8c0a8c0f9b4'; // Placeholder
  
  console.log('\n💡 Research strategy:');
  console.log('1. Check Farcaster/Flaunch social media for deployment addresses');
  console.log('2. Look at BaseScan for transactions with "flaunch" or "mintclub" in input data');
  console.log('3. Check if Flaunch has a registry or proxy contract');
  console.log('4. Look for common patterns in token names');
  
  console.log('\n📋 Known addresses to check:');
  console.log('- Uniswap V4 PoolManager: 0xf03d5b1864d5c5ffcec0a1832aea55c7d5543fc5');
  console.log('- Uniswap V3 Factory: 0x33128a8fc17869897dce68ed026d694621f6fdfd');
  console.log('- Aerodrome Factory: 0x420dd381b31aef6683d6b759fb781c6edb62a7e3');
  
  console.log('\n🔧 Manual research needed:');
  console.log('1. Visit https://flaunch.io or Flaunch documentation');
  console.log('2. Check https://mintclub.io for Base deployment');
  console.log('3. Search BaseScan for "Flaunch" or "Mint Club"');
  console.log('4. Check Farcaster channels #flaunch or #mintclub');
  
  // Try to find Flaunch by looking at recent pools with hooks
  try {
    console.log('\n🎯 Looking for Uniswap V4 pools with hooks...');
    
    // Get logs from PoolManager
    const logs = await provider.getLogs({
      address: config.dex.uniswapV4.poolManager,
      fromBlock,
      toBlock: currentBlock,
      topics: ['0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c'] // PoolInitialized(bytes32,address,address,uint24,int24,address)
    });
    
    console.log(`Found ${logs.length} Uniswap V4 pool initializations`);
    
    if (logs.length > 0) {
      console.log('\nRecent pools with hooks:');
      for (const log of logs.slice(0, 5)) { // Show first 5
        const topics = log.topics;
        const data = log.data;
        
        // Decode basic info
        const poolId = topics[1];
        const token0 = '0x' + topics[2].slice(26);
        const token1 = '0x' + topics[3].slice(26);
        
        // Hook is in the data (last 20 bytes)
        const hook = '0x' + data.slice(data.length - 40);
        
        console.log(`\nPool ID: ${poolId.substring(0, 16)}...`);
        console.log(`  Token0: ${token0}`);
        console.log(`  Token1: ${token1}`);
        console.log(`  Hook:   ${hook}`);
        console.log(`  Tx:     ${log.transactionHash}`);
        
        // Check if hook is not zero address
        if (hook !== '0x0000000000000000000000000000000000000000') {
          console.log(`  🔥 Non-zero hook detected! This could be Flaunch!`);
          
          // Get transaction details
          const tx = await provider.getTransaction(log.transactionHash);
          if (tx && tx.data) {
            // Check for flaunch in input data
            const inputData = tx.data.toLowerCase();
            if (inputData.includes('666c61756e6368') || inputData.includes('flaunch')) { // 'flaunch' in hex
              console.log(`  🎉 FOUND FLAUNCH TRANSACTION!`);
              console.log(`     Hook address: ${hook}`);
              console.log(`     Save this to .env as FLAUNCH_HOOK_ADDRESS`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('Error scanning Uniswap V4:', error.message);
  }
  
  // Try to find Mint Club
  console.log('\n🔍 Looking for Mint Club patterns...');
  
  // Common Mint Club function signatures
  const mintClubFunctions = [
    'createToken', // Mint Club's createToken function
    'buy',         // Bonding curve buy
    'sell'         // Bonding curve sell
  ];
  
  console.log('Checking recent transactions for bonding curve patterns...');
  
  // Get recent blocks and look for specific patterns
  for (let i = 0; i < 3; i++) {
    const blockNum = currentBlock - i;
    try {
      const block = await provider.getBlock(blockNum, true);
      if (block && block.transactions) {
        for (const tx of block.transactions.slice(0, 3)) { // Check first 3 tx per block
          if (tx.to && tx.data) {
            const data = tx.data.toLowerCase();
            // Look for mint club patterns in function calls
            if (data.includes('6d696e74') || data.includes('637265617465')) { // 'mint' or 'create' in hex
              console.log(`\nPossible bonding curve transaction:`);
              console.log(`  To:    ${tx.to}`);
              console.log(`  From:  ${tx.from}`);
              console.log(`  Tx:    ${tx.hash}`);
              console.log(`  Block: ${blockNum}`);
            }
          }
        }
      }
    } catch (error) {
      // Continue on error
    }
  }
}

async function main() {
  try {
    await findRecentTokenCreations();
    
    console.log('\n\n📝 NEXT STEPS:');
    console.log('1. Manually research these addresses:');
    console.log('   - Flaunch hook: Search BaseScan for "flaunch" transactions');
    console.log('   - Mint Club: Visit https://mintclub.io/docs for contract addresses');
    console.log('');
    console.log('2. Update .env file with found addresses:');
    console.log('   FLAUNCH_HOOK_ADDRESS=0x...');
    console.log('   MINT_CLUB_BONDING_CURVE=0x...');
    console.log('');
    console.log('3. Once addresses are found, run:');
    console.log('   node scripts/test-dex-watcher.js');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
