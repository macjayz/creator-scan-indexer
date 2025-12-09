// Test correct data extraction
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function testExtraction() {
  console.log('Testing correct data extraction from Zora logs...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  
  // Get recent logs
  const logs = await provider.getLogs({
    address: '0x777777751622c0d3258f214f9df38e35bf45baf3',
    topics: ['0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81'],
    fromBlock: 39248795,
    toBlock: 39248805
  });
  
  if (logs.length === 0) {
    console.log('No logs found');
    return;
  }
  
  console.log(`Found ${logs.length} logs, examining first one:\n`);
  const log = logs[0];
  
  console.log('Raw log data:', log.data);
  console.log('Data length:', log.data.length);
  console.log('Data (no 0x):', log.data.substring(2));
  
  // Zora event data structure:
  // 0-31: currency (address)
  // 32-63: uri offset
  // 64-95: name offset  
  // 96-127: symbol offset
  // 128-159: coin (token address) offset
  // etc...
  
  // The actual data starts after dynamic types offsets
  // coin (token address) should be at bytes 128-159
  
  const dataWithout0x = log.data.substring(2);
  
  // Try to extract token address
  console.log('\nAttempting extraction:');
  
  // Method 1: Simple offset (might be wrong)
  const tokenAddressSimple = '0x' + dataWithout0x.substring(128, 128 + 40);
  console.log('Simple extraction (bytes 128-167):', tokenAddressSimple);
  
  // Method 2: Look for address pattern in data
  // Addresses are 40 hex chars (20 bytes)
  const addressRegex = /000000000000000000000000([a-f0-9]{40})/g;
  const matches = [...dataWithout0x.matchAll(addressRegex)];
  console.log('\nAll address patterns in data:');
  matches.forEach((match, i) => {
    console.log(`${i + 1}. 0x${match[1]}`);
  });
  
  // Usually the token address appears multiple times
  if (matches.length >= 4) {
    console.log('\nLikely token address (4th address pattern): 0x' + matches[3][1]);
  }
}

testExtraction().catch(console.error);
