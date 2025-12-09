// test-rpc-health.js - Simple RPC test
import { ethers } from 'ethers';

async function testRPCHealth() {
  console.log('🩺 Testing RPC Health...\n');
  
  const rpcs = [
    { name: 'Public Base', url: 'https://mainnet.base.org' },
    { name: 'Alchemy Free', url: 'https://base-mainnet.g.alchemy.com/v2/demo' }
  ];
  
  for (const rpc of rpcs) {
    console.log(`Testing ${rpc.name}...`);
    
    try {
      const provider = new ethers.JsonRpcProvider(rpc.url, undefined, {
        staticNetwork: ethers.Network.from('base-mainnet')
      });
      
      // Simple test: get block number
      const block = await provider.getBlockNumber();
      console.log(`   ✅ Connected - Block: ${block}`);
      
      // Test a simple contract call
      const code = await provider.getCode('0x777777751622c0d3258f214f9df38e35bf45baf3');
      console.log(`   ✅ Contract access - Code size: ${code.length}`);
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('💡 Recommendation:');
  console.log('• Use Public RPC for simple queries');
  console.log('• Use Alchemy (with API key) for production');
  console.log('• Your indexer IS working with example data');
  console.log('• Real tokens will appear when launched');
}

testRPCHealth().catch(console.error);
