import Web3 from 'web3';
import pkg from 'pg';
const { Pool } = pkg;

const web3 = new Web3('https://eth.merkle.io');
const pool = new Pool({
    connectionString: 'postgresql://creator_scan:local_password@localhost:5433/creator_scan'
});

async function checkWatcherStatus() {
    console.log('🔍 Checking Factory Watcher Status...\n');
    
    // 1. Get current block number
    try {
        const currentBlock = await web3.eth.getBlockNumber();
        console.log(`1. Current Ethereum block: ${currentBlock}`);
        console.log(`   (This is about ${Math.round((Date.now()/1000 - 1700000000) / 12)} blocks from timestamp)`);
    } catch (error) {
        console.log(`1. RPC Error: ${error.message}`);
    }
    
    // 2. Check latest token timestamps
    try {
        const result = await pool.query(`
            SELECT 
                platform,
                MAX(created_at) as latest_token,
                EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) as seconds_ago
            FROM tokens
            WHERE platform IN ('zora', 'clanker')
            GROUP BY platform
        `);
        
        console.log(`\n2. Latest token detections:`);
        if (result.rows.length === 0) {
            console.log('   No factory tokens found');
        } else {
            result.rows.forEach(row => {
                const hoursAgo = Math.round(row.seconds_ago / 3600);
                console.log(`   ${row.platform}: ${row.latest_token || 'Never'} (${hoursAgo} hours ago)`);
            });
        }
    } catch (error) {
        console.log(`\n2. Database query error: ${error.message}`);
    }
    
    // 3. Check if there are recent blocks in the database
    try {
        const result = await pool.query(`
            SELECT 
                MAX(block_number) as max_block_in_db
            FROM tokens
            WHERE block_number IS NOT NULL
        `);
        
        console.log(`\n3. Latest block stored in tokens table: ${result.rows[0].max_block_in_db || 'None'}`);
    } catch (error) {
        console.log(`\n3. Block number query error (column might not exist): ${error.message}`);
    }
    
    // 4. Let's check the factory watcher code itself
    console.log(`\n4. Checking factory watcher configuration...`);
    try {
        const fs = await import('fs');
        const watcherCode = fs.readFileSync('index.js', 'utf8');
        
        // Extract key configuration
        const fromBlockMatch = watcherCode.match(/fromBlock:\s*(\d+)/);
        const toBlockMatch = watcherCode.match(/toBlock:\s*['"](latest|pending)['"]/);
        const batchSizeMatch = watcherCode.match(/batchSize:\s*(\d+)/);
        
        console.log(`   From block config: ${fromBlockMatch ? fromBlockMatch[1] : 'Not found'}`);
        console.log(`   To block config: ${toBlockMatch ? toBlockMatch[1] : 'Not found'}`);
        console.log(`   Batch size: ${batchSizeMatch ? batchSizeMatch[1] : 'Not found'}`);
    } catch (error) {
        console.log(`   Error reading watcher config: ${error.message}`);
    }
    
    await pool.end();
}

checkWatcherStatus().catch(console.error);
