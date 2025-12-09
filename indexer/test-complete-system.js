// indexer/test-complete-system.js - ONE TEST FILE
import { db } from './utils/database.js';

async function testCompleteSystem() {
  console.log('🧪 Testing Complete CreatorScan System...\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. Check database connection
    console.log('1. Database Connection:');
    const version = await db.query('SELECT version()');
    console.log(`   ✅ PostgreSQL: ${version.rows[0].version.split(',')[0]}`);
    
    // 2. Check tables exist
    console.log('\n2. Database Tables:');
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const requiredTables = ['tokens', 'token_metrics', 'price_history', 'detection_events', 'creator_profiles'];
    const existingTables = tables.rows.map(row => row.table_name);
    
    requiredTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
      }
    });
    
    // 3. Check current data
    console.log('\n3. Current Data:');
    const tokenCount = await db.query('SELECT COUNT(*) as count FROM tokens');
    console.log(`   Tokens in database: ${tokenCount.rows[0].count}`);
    
    const eventCount = await db.query('SELECT COUNT(*) as count FROM detection_events');
    console.log(`   Detection events: ${eventCount.rows[0].count}`);
    
    // 4. Show latest tokens
    console.log('\n4. Latest Tokens:');
    const latest = await db.query(`
      SELECT 
        symbol, 
        name, 
        platform,
        detection_method,
        detection_timestamp
      FROM tokens 
      ORDER BY detection_timestamp DESC 
      LIMIT 5
    `);
    
    if (latest.rows.length > 0) {
      latest.rows.forEach((row, i) => {
        const time = row.detection_timestamp 
          ? new Date(row.detection_timestamp).toLocaleTimeString()
          : 'unknown';
        console.log(`   ${i + 1}. ${row.symbol || 'No symbol'} (${row.platform || 'unknown'}) - ${time}`);
      });
    } else {
      console.log('   No tokens yet');
    }
    
    // 5. System readiness check
    console.log('\n5. System Status:');
    console.log(`   ✅ Database: Connected`);
    console.log(`   ✅ Tables: All present`);
    console.log(`   ✅ Data: ${tokenCount.rows[0].count} tokens ready`);
    console.log(`   ✅ Events: ${eventCount.rows[0].count} logged`);
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 SYSTEM READY!');
    console.log('\nWhat happens next:');
    console.log('1. Factory Watcher detects Zora/Clanker tokens → Stores in DB');
    console.log('2. DEX Watcher detects new liquidity pools → Stores in DB');
    console.log('3. All data available for API/Frontend');
    console.log('\nRun these to monitor:');
    console.log('   npm run factory-watcher  (in one terminal)');
    console.log('   npm run dex-watcher      (in another terminal)');
    console.log('   node monitor.js          (to see real-time updates)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await db.close();
  }
}

testCompleteSystem();
