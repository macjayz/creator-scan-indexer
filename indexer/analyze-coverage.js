// analyze-coverage.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function analyzeCoverage() {
  console.log('📊 Analyzing Indexer Coverage...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock.toLocaleString()}`);
  console.log(`Your START_BLOCK: ${process.env.START_BLOCK || '20000000'}`);
  
  const blocksProcessed = currentBlock - parseInt(process.env.START_BLOCK || '20000000');
  const blocksPerRequest = 10;
  const requestsNeeded = Math.ceil(blocksProcessed / blocksPerRequest);
  const timePerRequest = 30; // seconds (15 factory + 45 dex)
  const totalTimeHours = (requestsNeeded * timePerRequest) / 3600;
  
  console.log(`\n📈 COVERAGE ANALYSIS:`);
  console.log(`• Blocks to process: ${blocksProcessed.toLocaleString()}`);
  console.log(`• Blocks per request: ${blocksPerRequest} (free tier limit)`);
  console.log(`• Requests needed: ${requestsNeeded.toLocaleString()}`);
  console.log(`• Time per cycle: ${timePerRequest} seconds`);
  console.log(`• Total time to catch up: ${totalTimeHours.toFixed(1)} hours`);
  
  console.log(`\n🎯 WHAT THIS MEANS:`);
  console.log(`1. You're checking 10 blocks every ${timePerRequest} seconds`);
  console.log(`2. At 2 sec/block, that's 20 seconds of chain time`);
  console.log(`3. To catch up from block ${process.env.START_BLOCK}, you need ${totalTimeHours.toFixed(1)} hours`);
  console.log(`4. Most creator tokens launch in bursts (not every block)`);
  
  // Check actual recent activity
  console.log(`\n🔍 Checking recent REAL activity (last 500 blocks)...`);
  
  const zoraFactory = new ethers.Contract(
    '0x777777751622c0d3258f214f9df38e35bf45baf3',
    ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
    provider
  );
  
  try {
    const recentEvents = await zoraFactory.queryFilter('CoinCreated', currentBlock - 500, currentBlock);
    console.log(`• Zora tokens in last 500 blocks: ${recentEvents.length}`);
    
    if (recentEvents.length > 0) {
      console.log(`\n🎉 FOUND REAL TOKENS!`);
      recentEvents.forEach((event, i) => {
        const [address, name, symbol] = event.args;
        console.log(`${i + 1}. ${symbol} (${name}) - ${address.substring(0, 10)}...`);
      });
    }
  } catch (error) {
    console.log(`• Zora query failed: ${error.message}`);
  }
  
  console.log(`\n💡 SOLUTION: Upgrade to catch up faster or start from recent block`);
}

analyzeCoverage().catch(console.error);
