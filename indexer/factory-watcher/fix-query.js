// Test the correct syntax
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function testQuery() {
  console.log('Testing correct queryFilter syntax...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  const zoraFactory = '0x777777751622c0d3258f214f9df38e35bf45baf3';
  
  // Method 1: Using provider directly
  console.log('Method 1: Using provider.getLogs');
  try {
    const logs = await provider.getLogs({
      address: zoraFactory,
      topics: ['0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81'],
      fromBlock: 39248795,
      toBlock: 39248805
    });
    console.log(`✅ Found ${logs.length} events using provider.getLogs\n`);
    
    if (logs.length > 0) {
      console.log('Success! Use provider.getLogs in factory watcher.');
      return;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
  
  // Method 2: Using contract with proper filter
  console.log('Method 2: Using contract with filter');
  const contract = new ethers.Contract(
    zoraFactory,
    ['event Anonymous()'], // Dummy ABI
    provider
  );
  
  try {
    const filter = {
      address: zoraFactory,
      topics: ['0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81']
    };
    const events = await contract.queryFilter(filter, 39248795, 39248805);
    console.log(`✅ Found ${events.length} events using contract.queryFilter\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

testQuery().catch(console.error);
