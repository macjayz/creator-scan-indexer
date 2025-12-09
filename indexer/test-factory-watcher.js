// indexer/test-factory-watcher.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function testFactoryWatcher() {
  console.log('🧪 Testing Factory Watcher Setup...\n');
  
  try {
    // Test 1: Check required environment variables
    console.log('1. Checking environment variables...');
    const requiredVars = ['BASE_HTTP_URL', 'ZORA_FACTORY_ADDRESS', 'CLANKER_FACTORY_ADDRESS'];
    let allVarsPresent = true;
    
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 30)}...`);
      } else {
        console.log(`   ❌ ${varName} - MISSING`);
        allVarsPresent = false;
      }
    }
    
    // Check optional WebSocket URL
    if (process.env.BASE_WS_URL) {
      console.log(`   ✅ BASE_WS_URL: ${process.env.BASE_WS_URL.substring(0, 30)}...`);
    } else {
      console.log(`   ⚠️  BASE_WS_URL - OPTIONAL (needed for real-time events)`);
    }
    
    if (!allVarsPresent) {
      console.log('\n❌ Missing required environment variables.');
      console.log('   Please check your .env file');
      return;
    }
    
    // Test 2: Test HTTP connection
    console.log('\n2. Testing HTTP connection to Base...');
    try {
      const httpProvider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
      const blockNumber = await httpProvider.getBlockNumber();
      console.log(`   ✅ Current block: ${blockNumber}`);
    } catch (error) {
      console.log(`   ❌ Failed to connect: ${error.message}`);
      console.log('   Make sure you have a valid RPC URL in BASE_HTTP_URL');
      return;
    }
    
    // Test 3: Verify factory addresses
    console.log('\n3. Verifying factory addresses...');
    const httpProvider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
    
    const factories = [
      { name: 'Zora', address: process.env.ZORA_FACTORY_ADDRESS },
      { name: 'Clanker', address: process.env.CLANKER_FACTORY_ADDRESS }
    ];
    
    for (const factory of factories) {
      try {
        const code = await httpProvider.getCode(factory.address);
        if (code && code !== '0x') {
          console.log(`   ✅ ${factory.name}: Contract exists`);
        } else {
          console.log(`   ❌ ${factory.name}: No contract at address`);
        }
      } catch (error) {
        console.log(`   ❌ ${factory.name}: ${error.message}`);
      }
    }
    
    // Test 4: Check database connection
    console.log('\n4. Testing database connection...');
    try {
      // Try to import database module
      const { db } = await import('./utils/database.js');
      const result = await db.query('SELECT COUNT(*) as count FROM tokens');
      console.log(`   ✅ Database connected. Tokens in DB: ${result.rows[0].count}`);
    } catch (error) {
      console.log(`   ❌ Database connection failed: ${error.message}`);
      console.log('   Make sure PostgreSQL is running on port 5433');
    }
    
    console.log('\n🎉 All basic tests passed!');
    console.log('\nNext steps:');
    console.log('1. Get WebSocket URL from Alchemy for real-time events');
    console.log('2. Run: npm run factory-watcher');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFactoryWatcher();
