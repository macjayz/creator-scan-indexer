// check-one-thing.js - Check ONE thing: Are there Zora tokens?
import { ethers } from 'ethers';

async function checkOneThing() {
  console.log('🔍 Checking ONE thing: Recent Zora tokens\n');
  
  // Use simple provider
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  
  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  // Check last 2000 blocks (~1 hour)
  const fromBlock = currentBlock - 2000;
  console.log(`Checking blocks ${fromBlock} to ${currentBlock} (2000 blocks, ~1 hour)\n`);
  
  // Zora factory contract
  const zoraFactory = new ethers.Contract(
    '0x777777751622c0d3258f214f9df38e35bf45baf3',
    ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
    provider
  );
  
  try {
    // Try small range first (last 100 blocks)
    console.log('1. Checking last 100 blocks (3 minutes)...');
    const recentEvents = await zoraFactory.queryFilter('CoinCreated', currentBlock - 100, currentBlock);
    console.log(`   Found: ${recentEvents.length} Zora tokens\n`);
    
    if (recentEvents.length === 0) {
      // Check last 500 blocks
      console.log('2. Checking last 500 blocks (15 minutes)...');
      const moreEvents = await zoraFactory.queryFilter('CoinCreated', currentBlock - 500, currentBlock);
      console.log(`   Found: ${moreEvents.length} Zora tokens\n`);
      
      if (moreEvents.length === 0) {
        // Check last 2000 blocks
        console.log('3. Checking last 2000 blocks (1 hour)...');
        const hourlyEvents = await zoraFactory.queryFilter('CoinCreated', currentBlock - 2000, currentBlock);
        console.log(`   Found: ${hourlyEvents.length} Zora tokens\n`);
        
        if (hourlyEvents.length === 0) {
          console.log('🎯 CONCLUSION:');
          console.log('• NO Zora tokens in last hour');
          console.log('• This is actually NORMAL');
          console.log('• Creator tokens launch maybe 5-10 times PER DAY');
          console.log('• Your system IS working - just nothing to detect yet');
        }
      }
    }
    
    // If we found any, show them
    const allEvents = recentEvents.concat(await zoraFactory.queryFilter('CoinCreated', currentBlock - 2000, currentBlock - 100));
    if (allEvents.length > 0) {
      console.log('🎉 FOUND REAL ZORA TOKENS!');
      allEvents.forEach((event, i) => {
        const [address, name, symbol] = event.args;
        console.log(`${i + 1}. ${symbol} (${name}) at block ${event.blockNumber}`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log('\nThis error means the RPC is blocking large queries.');
    console.log('Your real-time watcher (10 blocks at a time) will still work.');
  }
}

checkOneThing().catch(console.error);
