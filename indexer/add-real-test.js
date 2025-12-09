// add-real-test.js - Add a more realistic test token
import { db } from './utils/database.js';

async function addRealisticTestToken() {
  console.log('Adding realistic test token...\n');
  
  // Use a real-looking address pattern
  const realisticToken = {
    address: '0x' + Math.random().toString(16).substring(2, 42), // Random but valid format
    name: 'Based Pepe',
    symbol: 'BPEPE',
    decimals: 18,
    totalSupply: '1000000000000000000000000000', // 1B with 18 decimals
    creatorAddress: '0x' + 'a1b2c3d4e5f6789012345678901234567890123',
    detectionMethod: 'zora_factory',
    detectionBlockNumber: 39248000,
    detectionTransactionHash: '0x' + Math.random().toString(16).substring(2, 66),
    platform: 'zora',
    factoryAddress: '0x777777751622c0d3258f214f9df38e35bf45baf3',
    status: 'active'
  };
  
  try {
    await db.insertToken(realisticToken);
    console.log('✅ Added realistic test token:');
    console.log(`   Name: ${realisticToken.name}`);
    console.log(`   Symbol: ${realisticToken.symbol}`);
    console.log(`   Supply: ${parseInt(realisticToken.totalSupply).toLocaleString()}`);
    console.log(`   Platform: ${realisticToken.platform}`);
    console.log('\nRefresh your frontend to see it!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.close();
  }
}

addRealisticTestToken();
