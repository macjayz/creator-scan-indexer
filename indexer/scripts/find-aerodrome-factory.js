import { ethers } from 'ethers';
import { config } from '../config/index.js';

async function findAerodromeFactory() {
  console.log('🔍 Finding correct Aerodrome factory address on Base...\n');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  
  // Known Aerodrome addresses from documentation
  const possibleAddresses = [
    '0x420DD381b31AeF6683d6B759fb781c6eDB62A7e3', // Original (might be wrong)
    '0x420dd381b31aef6683d6b759fb781c6edb62a7e3', // Lowercase
    '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // Uniswap V2 style factory
    '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB', // Another possible
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH address (not factory)
  ];
  
  for (const addr of possibleAddresses) {
    try {
      const code = await provider.getCode(addr);
      console.log(`${addr}:`);
      
      if (code === '0x') {
        console.log('   ❌ No contract');
      } else {
        const size = (code.length - 2) / 2;
        console.log(`   ✅ Contract found (${size} bytes)`);
        
        // Try to see if it has PoolCreated event
        const simpleAbi = ['event PoolCreated(address indexed token0, address indexed token1, address pool)'];
        try {
          const contract = new ethers.Contract(addr, simpleAbi, provider);
          const currentBlock = await provider.getBlockNumber();
          const events = await contract.queryFilter('PoolCreated', currentBlock - 100, currentBlock);
          console.log(`   📊 Recent PoolCreated events: ${events.length}`);
          
          if (events.length > 0) {
            console.log(`   🎯 LIKELY CORRECT FACTORY!`);
            return addr;
          }
        } catch (e) {
          console.log(`   📭 No PoolCreated events or error: ${e.message.substring(0, 50)}`);
        }
      }
    } catch (error) {
      console.log(`${addr}: ❌ Error: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('💡 Try searching for Aerodrome V2 factory on:');
  console.log('   - https://docs.aerodrome.finance/aerodrome/contracts');
  console.log('   - https://basescan.org/address/0x420dd381b31aef6683d6b759fb781c6edb62a7e3');
  console.log('   - https://github.com/aerodrome-finance/aerodrome-contracts');
  
  return null;
}

async function main() {
  const factory = await findAerodromeFactory();
  if (factory) {
    console.log(`\n🎉 Use this address in config: ${factory}`);
  }
}

main().catch(console.error);
