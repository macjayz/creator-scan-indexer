import { ethers } from 'ethers';
import { config } from '../config/index.js';

async function testDexWatcher() {
  console.log('🧪 Testing DEX Watcher Configuration...\n');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  const currentBlock = await provider.getBlockNumber();
  
  console.log('📊 Network Info:');
  console.log(`   RPC URL: ${config.base.httpUrl}`);
  console.log(`   Current block: ${currentBlock}`);
  console.log(`   Base tokens: ${config.baseTokens.length} tokens`);
  
  console.log('\n🔍 Checking DEX contracts...');
  
  for (const [dexName, dexConfig] of Object.entries(config.dex)) {
    console.log(`\n   ${dexName.toUpperCase()}:`);
    console.log(`      Factory: ${dexConfig.factory}`);
    console.log(`      Start block: ${dexConfig.startBlock}`);
    console.log(`      Blocks behind: ${currentBlock - dexConfig.startBlock}`);
    
    // Test contract connection
    try {
      const contract = new ethers.Contract(dexConfig.factory, dexConfig.abi, provider);
      const code = await provider.getCode(dexConfig.factory);
      
      if (code === '0x') {
        console.log(`      ❌ Contract not deployed at this address`);
      } else {
        console.log(`      ✅ Contract deployed (code size: ${(code.length - 2) / 2} bytes)`);
        
        // Try to get a recent event
        const fromBlock = Math.max(currentBlock - 100, dexConfig.startBlock);
        const events = await contract.queryFilter(dexConfig.eventName || 'PoolCreated', fromBlock, currentBlock);
        console.log(`      📈 Recent events (last 100 blocks): ${events.length}`);
        
        if (events.length > 0) {
          const latest = events[events.length - 1];
          console.log(`         Latest: Block ${latest.blockNumber}, ${latest.args ? 'Has args' : 'No args'}`);
        }
      }
    } catch (error) {
      console.log(`      ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✅ Test complete!');
  console.log('\n📝 To start DEX watcher:');
  console.log('   cd indexer');
  console.log('   node dex-watcher/index.js');
  console.log('\n📝 Or run both watchers together:');
  console.log('   npm run factory-watcher (for Zora/Clanker)');
  console.log('   node dex-watcher/index.js (for DEX detection)');
}

testDexWatcher().catch(console.error);
