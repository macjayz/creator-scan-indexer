import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgresql://creator_scan:local_password@localhost:5433/creator_scan'
});

async function debugState() {
    console.log('🔍 Debugging Factory Watcher State\n');
    
    // 1. Check what block the watcher THINKS is current
    console.log('1. Checking for any stored block state...');
    
    // Check if there's a detection_events table with latest blocks
    try {
        const eventsResult = await pool.query(`
            SELECT 
                platform,
                MAX(block_number) as latest_block,
                COUNT(*) as event_count
            FROM detection_events
            GROUP BY platform
        `);
        
        console.log('Detection events table:');
        if (eventsResult.rows.length > 0) {
            eventsResult.rows.forEach(row => {
                console.log(`   ${row.platform}: block ${row.latest_block} (${row.event_count} events)`);
            });
        } else {
            console.log('   No detection events found');
        }
    } catch (error) {
        console.log('   detection_events table error:', error.message);
    }
    
    // 2. Check latest tokens in database
    console.log('\n2. Latest tokens by platform:');
    try {
        const tokensResult = await pool.query(`
            SELECT 
                platform,
                MAX(block_number) as latest_block,
                COUNT(*) as token_count
            FROM tokens
            WHERE block_number IS NOT NULL
            GROUP BY platform
        `);
        
        if (tokensResult.rows.length > 0) {
            tokensResult.rows.forEach(row => {
                console.log(`   ${row.platform}: block ${row.latest_block} (${row.token_count} tokens)`);
            });
        } else {
            console.log('   No tokens with block numbers');
        }
    } catch (error) {
        console.log('   Tokens query error (block_number column might not exist):', error.message);
    }
    
    // 3. Check if block_number column exists in tokens table
    console.log('\n3. Checking tokens table schema...');
    try {
        const schemaResult = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'tokens'
            AND column_name = 'block_number'
        `);
        
        if (schemaResult.rows.length > 0) {
            console.log('   block_number column: EXISTS');
        } else {
            console.log('   block_number column: DOES NOT EXIST (this is likely the problem!)');
            console.log('   The factory watcher might be saving block_number but the column is missing.');
        }
    } catch (error) {
        console.log('   Schema query error:', error.message);
    }
    
    await pool.end();
    
    console.log('\n🔧 SUGGESTED FIX:');
    console.log('   If block_number column is missing, run:');
    console.log('   psql "postgresql://creator_scan:local_password@localhost:5433/creator_scan" -c "ALTER TABLE tokens ADD COLUMN block_number BIGINT;"');
}

debugState();
