// check-indexer-status.js - ONE thing: Check indexer status
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkIndexerStatus() {
  console.log('🔍 Checking why indexer missed the token...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock}`);
  console.log(`Token was at block: 39248799`);
  console.log(`Difference: ${currentBlock - 39248799} blocks ago\n`);
  
  // Check if indexer is checking recent blocks
  const startBlock = parseInt(process.env.START_BLOCK || '39246500');
  console.log(`Your START_BLOCK in .env: ${startBlock}`);
  console.log(`Indexer should be checking blocks from: ${startBlock}\n`);
  
  if (39248799 < startBlock) {
    console.log('❌ PROBLEM: Token block (39248799) is BEFORE your START_BLOCK');
    console.log('   Indexer is checking newer blocks, missed this older token');
  } else {
    console.log('✅ Token block is within indexer range');
    console.log('   Indexer should have detected it...');
  }
  
  // Check if factory watcher is actually running
  console.log('\n📡 Check if Factory Watcher is running:');
  console.log('   Run: ps aux | grep "factory-watcher"');
  console.log('   Should show node factory-watcher/index.js');
}

checkIndexerStatus().catch(console.error);
