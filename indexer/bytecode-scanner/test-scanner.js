import { BytecodeScanner } from './index.js';
import { analyzer } from './analyzer.js';

async function testScanner() {
    console.log('🧪 Testing Bytecode Scanner...\n');
    
    try {
        // Test 1: Create scanner instance
        console.log('1. Creating scanner instance...');
        const scanner = new BytecodeScanner();
        console.log('   ✅ Scanner created successfully\n');
        
        // Test 2: Check database connection
        console.log('2. Testing database connection...');
        const stats = await scanner.getStats();
        console.log(`   ✅ Database connected`);
        console.log(`   📊 Current stats:`, stats || 'No data yet\n');
        
        // Test 3: Test analyzer with sample bytecode
        console.log('3. Testing bytecode analyzer...');
        const sampleBytecode = '0x6080604052348015600f57600080fd5b506004361060325760003560e01c806306fdde0314603757806318160ddd146053575b600080fd5b603d607f565b6040518082815260200191505060405180910390f35b6069608d565b6040518082815260200191505060405180910390f35b60008054905090565b6000548156fea2646970667358221220123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef64736f6c634300060c0033';
        
        const analysis = analyzer.analyzeBytecode(sampleBytecode, {
            test: true,
            address: '0x1234567890123456789012345678901234567890'
        });
        
        console.log(`   ✅ Analyzer working`);
        console.log(`   📋 Analysis result:`);
        console.log(`      - Is ERC-20: ${analysis.isERC20}`);
        console.log(`      - Confidence: ${analysis.confidence}`);
        console.log(`      - Implementation: ${analysis.implementationType}`);
        console.log(`      - Warnings: ${analysis.warnings.length ? analysis.warnings.join(', ') : 'None'}\n`);
        
        // Test 4: Scan a small range (just 1 block for testing)
        console.log('4. Testing block scanning (1 block)...');
        
        // Get current block
        const provider = scanner.provider;
        const currentBlock = await provider.getBlockNumber();
        const testBlock = Math.max(currentBlock - 100, 0); // 100 blocks ago
        
        console.log(`   📦 Testing block ${testBlock}...`);
        
        // Manually scan one block
        const contracts = await scanner.scanBlocksForCreations(testBlock, testBlock);
        console.log(`   📄 Found ${contracts.length} contract creations in block ${testBlock}`);
        
        if (contracts.length > 0) {
            console.log(`   🔍 Sample contract: ${contracts[0].address.substring(0, 10)}...`);
        }
        
        // Test 5: Clean shutdown
        console.log('\n5. Testing clean shutdown...');
        await scanner.stop();
        console.log('   ✅ Scanner stopped cleanly\n');
        
        console.log('🎉 All tests passed! The bytecode scanner is ready to use.\n');
        console.log('To start the scanner:');
        console.log('  cd indexer');
        console.log('  npm run bytecode-scanner');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('\n💡 Debug tips:');
        console.error('1. Make sure database is running: docker-compose up');
        console.error('2. Check database connection in .env file');
        console.error('3. Verify Alchemy RPC URL is correct');
        process.exit(1);
    }
}

// Run tests
testScanner().catch(console.error);
