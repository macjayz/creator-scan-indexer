// test-correct-event.js - Test with correct event signature
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function testCorrectEvent() {
  console.log('Testing with correct event signature...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  
  // Try BOTH event signatures
  const events = [
    { name: 'CoinCreated', sig: 'event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)' },
    { name: 'CoinCreatedV4', sig: 'event CoinCreatedV4(address indexed caller, address indexed payoutRecipient, address indexed platformReferrer, address currency, string uri, string name, string symbol, address coin, tuple poolKey, bytes32 poolKeyHash, string version)' }
  ];
  
  for (const event of events) {
    console.log(`Checking ${event.name}...`);
    
    const contract = new ethers.Contract(
      '0x777777751622c0d3258f214f9df38e35bf45baf3',
      [event.sig],
      provider
    );
    
    try {
      // Check blocks around where token was created
      const found = await contract.queryFilter(event.name, 39248795, 39248805);
      console.log(`   Found ${found.length} events\n`);
      
      if (found.length > 0) {
        console.log('✅ SUCCESS! The correct event is:', event.name);
        console.log('   Update factory watcher to use this event signature');
        return;
      }
    } catch (error) {
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  console.log('❌ Neither event signature worked');
  console.log('Need to check actual Zora contract ABI');
}

testCorrectEvent().catch(console.error);
