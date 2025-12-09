// indexer/test-insert-token.js
import { db } from './utils/database.js';

async function testTokenInsertion() {
  console.log('🧪 Testing Token Insertion Logic...\n');
  
  try {
    // Test 1: Insert a mock token
    const mockToken = {
      address: '0x' + '1234567890abcdef1234567890abcdef12345678',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalSupply: '1000000000000000000000000',
      creatorAddress: '0x' + 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      detectionMethod: 'zora_factory',
      detectionBlockNumber: 39243395,
      detectionTransactionHash: '0x' + '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      platform: 'zora',
      factoryAddress: '0x777777751622c0d3258f214f9df38e35bf45baf3',
      status: 'detected'
    };
    
    console.log('1. Inserting mock token...');
    const result = await db.insertToken(mockToken);
    console.log(`   ✅ Token inserted with ID: ${result.rows[0].id}`);
    
    // Test 2: Insert detection event
    console.log('\n2. Inserting detection event...');
    await db.insertDetectionEvent({
      eventType: 'zora_factory',
      contractAddress: mockToken.factoryAddress,
      blockNumber: mockToken.detectionBlockNumber,
      transactionHash: mockToken.detectionTransactionHash,
      logIndex: 0,
      rawData: mockToken
    });
    console.log('   ✅ Detection event logged');
    
    // Test 3: Verify data was inserted
    console.log('\n3. Verifying database state...');
    
    const tokenCount = await db.query('SELECT COUNT(*) as count FROM tokens');
    console.log(`   Total tokens in DB: ${tokenCount.rows[0].count}`);
    
    const eventCount = await db.query('SELECT COUNT(*) as count FROM detection_events');
    console.log(`   Total detection events: ${eventCount.rows[0].count}`);
    
    const latestTokens = await db.query(`
      SELECT address, name, symbol, platform, detection_method 
      FROM tokens 
      ORDER BY detection_timestamp DESC 
      LIMIT 5
    `);
    
    console.log('\n4. Latest 5 tokens in database:');
    latestTokens.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.symbol} (${row.name}): ${row.address.substring(0, 10)}... [${row.platform}]`);
    });
    
    console.log('\n🎉 Token insertion test completed successfully!');
    console.log('\nThe system is ready to detect real tokens.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await db.close();
  }
}

testTokenInsertion();
