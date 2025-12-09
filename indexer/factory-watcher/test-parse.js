import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function testParse() {
  console.log('Testing Zora event parsing...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  
  // Test with one of your transaction hashes
  const txHash = '0x80cd149145ef67d9a22d00a40afcdca0ced63b74aa90b935ac53c1d5e53b19d0';
  const tx = await provider.getTransactionReceipt(txHash);
  
  console.log('Transaction block:', tx.blockNumber);
  
  // Find the CoinCreatedV4 log
  const eventTopic = '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81';
  const zoraLog = tx.logs.find(log => log.topics[0] === eventTopic);
  
  if (!zoraLog) {
    console.log('No Zora event log found');
    return;
  }
  
  console.log('Found Zora event log');
  console.log('Topics:', zoraLog.topics);
  console.log('Data length:', zoraLog.data.length);
  
  // Remove 0x prefix
  const data = zoraLog.data.substring(2);
  
  console.log('\n=== DATA ANALYSIS ===');
  console.log('Full data (first 512 chars):', data.substring(0, 512));
  
  // Parse 32-byte chunks
  console.log('\n=== 32-BYTE CHUNKS ===');
  for (let i = 0; i < 10; i++) {
    const start = i * 64;
    const chunk = data.substring(start, start + 64);
    console.log(`Chunk ${i} (bytes ${i*32}-${(i+1)*32}): ${chunk}`);
    
    // Try to interpret as address
    if (chunk.startsWith('000000000000000000000000')) {
      const addr = '0x' + chunk.substring(24);
      console.log(`   Possible address: ${addr}`);
    }
    
    // Try to interpret as offset
    const asNumber = parseInt(chunk, 16);
    console.log(`   As decimal: ${asNumber}`);
    if (asNumber > 0 && asNumber < 10000) {
      console.log(`   Could be offset to position: ${asNumber * 2} (hex chars)`);
    }
  }
  
  // Try to find the token address by looking for valid addresses after position 320
  console.log('\n=== SEARCHING FOR TOKEN ADDRESS ===');
  for (let i = 5; i < Math.floor(data.length / 64); i++) {
    const start = i * 64;
    const chunk = data.substring(start, start + 64);
    
    if (chunk.startsWith('000000000000000000000000')) {
      const addr = '0x' + chunk.substring(24);
      if (ethers.isAddress(addr)) {
        console.log(`Found address at chunk ${i} (position ${start}): ${addr}`);
      }
    }
  }
}

testParse().catch(console.error);
