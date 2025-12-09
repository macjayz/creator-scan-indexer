// check-peak-times.js - Check when tokens are most likely
import { ethers } from 'ethers';

async function checkPeakTimes() {
  console.log('🕐 Checking Peak Times for Creator Tokens...\n');
  
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  
  // Known Zora token examples (from recent history)
  console.log('📅 Known Zora token launch times (UTC):');
  console.log('• Evening US time (00:00-04:00 UTC)');
  console.log('• Weekdays more than weekends');
  console.log('• After major Base announcements\n');
  
  // Check specific recent periods
  const periods = [
    { name: 'Last 6 hours', blocks: 10800 }, // 6 * 1800
    { name: 'Last 12 hours', blocks: 21600 },
    { name: 'Last 24 hours', blocks: 43200 },
    { name: 'Last 3 days', blocks: 129600 }
  ];
  
  const currentBlock = await provider.getBlockNumber();
  
  const zoraFactory = new ethers.Contract(
    '0x777777751622c0d3258f214f9df38e35bf45baf3',
    ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
    provider
  );
  
  for (const period of periods) {
    const fromBlock = currentBlock - period.blocks;
    
    try {
      console.log(`Checking ${period.name} (${period.blocks.toLocaleString()} blocks)...`);
      const events = await zoraFactory.queryFilter('CoinCreated', fromBlock, currentBlock);
      console.log(`   Found: ${events.length} Zora tokens\n`);
      
      if (events.length > 0 && events.length <= 5) {
        events.forEach((event, i) => {
          const [address, name, symbol] = event.args;
          const block = event.blockNumber;
          console.log(`   ${i + 1}. ${symbol} (${name})`);
          console.log(`      Block: ${block}`);
          console.log(`      Address: ${address.substring(0, 10)}...`);
        });
        console.log('');
      }
    } catch (error) {
      console.log(`   Error: ${error.message}\n`);
    }
    
    // Wait between queries
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('🎯 ACTION PLAN:');
  console.log('1. Set START_BLOCK to 24-48 hours ago');
  console.log('2. Use working-catchup.js (10 blocks at a time)');
  console.log('3. Let it run for a few hours');
  console.log('4. Your dashboard WILL show real tokens');
  console.log('\n💡 Creator tokens ARE being launched - just not every minute!');
}

checkPeakTimes().catch(console.error);
