// indexer/test-db-only.js
import pg from 'pg';
const { Client } = pg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function testDatabase() {
  console.log('🧪 Testing Database Connection...\n');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not set in .env file');
    return;
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Test 1: Check version
    const version = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', version.rows[0].version.split(',')[0]);
    
    // Test 2: List tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Tables found: ${tables.rows.length}`);
    tables.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    
    // Test 3: Count test tokens
    const tokens = await client.query('SELECT COUNT(*) as count FROM tokens');
    console.log(`\n🎯 Test tokens in database: ${tokens.rows[0].count}`);
    
    if (tokens.rows[0].count > 0) {
      const sample = await client.query('SELECT address, name, symbol FROM tokens LIMIT 3');
      sample.rows.forEach(row => {
        console.log(`  - ${row.symbol || 'No symbol'}: ${row.address.substring(0, 10)}...`);
      });
    }
    
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Docker is running: docker-compose ps');
    console.log('2. Check PostgreSQL port: should be 5433');
    console.log('3. Verify DATABASE_URL in .env file');
  } finally {
    await client.end();
  }
}

testDatabase();
