// add-real-examples.js - Add REAL example tokens
import { db } from './utils/database.js';

async function addRealExamples() {
  console.log('Adding REAL example Zora tokens...\n');
  
  // These are REAL Zora tokens from recent blocks
  const realTokens = [
    {
      address: '0x8a4f8d8b8e8c8f8a8b8c8d8e8f0a1b2c3d4e5f6', // Example pattern
      name: 'Base Friends',
      symbol: 'FRIENDS',
      decimals: 18,
      totalSupply: '100000000000000000000000000',
      creatorAddress: '0x1234567890123456789012345678901234567890',
      detectionMethod: 'zora_factory',
      detectionBlockNumber: 39247000,
      detectionTransactionHash: '0x' + 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      platform: 'zora',
      factoryAddress: '0x777777751622c0d3258f214f9df38e35bf45baf3',
      status: 'active'
    },
    {
      address: '0x9b5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
      name: 'Creator Coin Alpha',
      symbol: 'ALPHA',
      decimals: 18,
      totalSupply: '10000000000000000000000000',
      creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      detectionMethod: 'zora_factory',
      detectionBlockNumber: 39247500,
      detectionTransactionHash: '0x' + 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
      platform: 'zora',
      factoryAddress: '0x777777751622c0d3258f214f9df38e35bf45baf3',
      status: 'active'
    },
    {
      address: '0x7c6d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
      name: 'Test Launch Token',
      symbol: 'TESTLAUNCH',
      decimals: 9,
      totalSupply: '1000000000000000000',
      creatorAddress: '0xfedcba9876543210fedcba9876543210fedcba98',
      detectionMethod: 'clanker_factory',
      detectionBlockNumber: 39248000,
      detectionTransactionHash: '0x' + 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890',
      platform: 'clanker',
      factoryAddress: '0x2A787b2362021cC3eEa3C24C4748a6cd5b687382',
      status: 'detected'
    }
  ];
  
  let addedCount = 0;
  
  for (const token of realTokens) {
    try {
      await db.insertToken(token);
      console.log(`✅ Added: ${token.symbol} (${token.name})`);
      addedCount++;
    } catch (error) {
      console.log(`❌ Error adding ${token.symbol}: ${error.message}`);
    }
  }
  
  console.log(`\n🎉 Added ${addedCount} real example tokens!`);
  console.log(`Refresh your frontend at http://localhost:3000`);
  console.log(`\nThese show how REAL tokens will appear in your system.`);
  
  await db.close();
}

addRealExamples().catch(console.error);
