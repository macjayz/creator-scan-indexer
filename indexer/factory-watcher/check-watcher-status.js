const Web3 = require('web3');
const { Pool } = require('pg');

const web3 = new Web3(process.env.RPC_URL || 'https://eth.merkle.io');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://creator_scan:local_password@localhost:5433/creator_scan'
});

async function checkWatcherStatus() {
    console.log('🔍 Checking Factory Watcher Status...\n');
    
    // 1. Get current block number
    try {
        const currentBlock = await web3.eth.getBlockNumber();
        console.log(`1. Current Ethereum block: ${currentBlock}`);
    } catch (error) {
        console.log(`1. RPC Error: ${error.message}`);
    }
    
    // 2. Check the last processed event in database
    try {
        const result = await pool.query(`
            SELECT 
                MAX(block_number) as last_processed_block,
                COUNT(DISTINCT block_number) as unique_blocks_processed,
                COUNT(*) as total_events
            FROM token_events
        `);
        
        const row = result.rows[0];
        console.log(`\n2. Database events status:`);
        console.log(`   Last processed block: ${row.last_processed_block || 'None'}`);
        console.log(`   Unique blocks processed: ${row.unique_blocks_processed || 0}`);
        console.log(`   Total events stored: ${row.total_events || 0}`);
    } catch (error) {
        console.log(`\n2. Database query error (token_events table might not exist): ${error.message}`);
    }
    
    // 3. Check latest token timestamps
    try {
        const result = await pool.query(`
            SELECT 
                platform,
                MAX(created_at) as latest_token,
                MAX(block_number) as latest_block
            FROM tokens
            WHERE platform IN ('zora', 'clanker')
            GROUP BY platform
        `);
        
        console.log(`\n3. Latest token detections:`);
        if (result.rows.length === 0) {
            console.log('   No factory tokens found');
        } else {
            result.rows.forEach(row => {
                console.log(`   ${row.platform}: ${row.latest_token || 'Never'} (block: ${row.latest_block || 'N/A'})`);
            });
        }
    } catch (error) {
        console.log(`\n3. Database query error: ${error.message}`);
    }
    
    // 4. Check for any errors in factory watcher logs
    console.log(`\n4. Checking for recent errors (last 10 minutes)...`);
    
    // 5. Check what block the factory watcher script is monitoring
    console.log(`\n5. Let's look at the factory watcher code to see its logic...`);
    
    await pool.end();
}

checkWatcherStatus().catch(console.error);
