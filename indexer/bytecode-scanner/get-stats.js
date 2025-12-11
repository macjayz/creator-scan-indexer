import { BytecodeScanner } from './index.js';

async function showStats() {
    console.log('📊 Bytecode Scanner Statistics\n');
    
    const scanner = new BytecodeScanner();
    
    try {
        const stats = await scanner.getStats();
        
        if (!stats) {
            console.log('No statistics available yet. Run the scanner first.');
            return;
        }
        
        console.log('📈 SCANNER STATISTICS:');
        console.log('======================');
        console.log(`Total scans: ${stats.total_scans || 0}`);
        console.log(`ERC-20 detected: ${stats.erc20_detected || 0}`);
        console.log(`Non-ERC-20: ${stats.non_erc20 || 0}`);
        console.log(`Detection rate: ${stats.total_scans ? ((stats.erc20_detected / stats.total_scans) * 100).toFixed(1) : 0}%`);
        console.log(`Earliest block: ${stats.earliest_block || 'N/A'}`);
        console.log(`Latest block: ${stats.latest_block || 'N/A'}`);
        console.log(`Last scan: ${stats.last_scan ? new Date(stats.last_scan).toLocaleString() : 'Never'}`);
        
        if (stats.scannerstats) {
            console.log('\n🔄 SCANNER RUNTIME:');
            console.log('==================');
            console.log(`Total scanned: ${stats.scannerstats.totalScanned || 0}`);
            console.log(`ERC-20 detected: ${stats.scannerstats.erc20Detected || 0}`);
            console.log(`Errors: ${stats.scannerstats.errors || 0}`);
            console.log(`Last scan time: ${stats.scannerstats.lastScanTime || 'Never'}`);
        }
        
        // Get recent ERC-20 detections
        console.log('\n🎯 RECENT ERC-20 DETECTIONS:');
        console.log('============================');
        
        const recent = await scanner.dbPool.query(`
            SELECT 
                contract_address,
                creator_address,
                block_number,
                confidence_score,
                implementation_type,
                scan_timestamp
            FROM bytecode_scans 
            WHERE is_erc20 = true 
            ORDER BY scan_timestamp DESC 
            LIMIT 5
        `);
        
        if (recent.rows.length === 0) {
            console.log('No ERC-20 tokens detected yet.');
        } else {
            recent.rows.forEach((row, i) => {
                console.log(`${i + 1}. ${row.contract_address.substring(0, 10)}...`);
                console.log(`   Creator: ${row.creator_address.substring(0, 10)}...`);
                console.log(`   Block: ${row.block_number}`);
                console.log(`   Confidence: ${row.confidence_score}`);
                console.log(`   Type: ${row.implementation_type}`);
                console.log(`   Time: ${new Date(row.scan_timestamp).toLocaleTimeString()}`);
                console.log('');
            });
        }
        
        // Get implementation breakdown
        console.log('\n🏗️  IMPLEMENTATION BREAKDOWN:');
        console.log('===========================');
        
        const breakdown = await scanner.dbPool.query(`
            SELECT 
                implementation_type,
                COUNT(*) as count,
                AVG(confidence_score) as avg_confidence
            FROM bytecode_scans 
            WHERE is_erc20 = true
            GROUP BY implementation_type
            ORDER BY count DESC
        `);
        
        if (breakdown.rows.length === 0) {
            console.log('No implementation data available.');
        } else {
            breakdown.rows.forEach(row => {
                console.log(`${row.implementation_type}: ${row.count} tokens (avg confidence: ${row.avg_confidence ? parseFloat(row.avg_confidence).toFixed(2) : 'N/A'})`);
            });
        }
        
    } catch (error) {
        console.error('Error getting statistics:', error);
    } finally {
        await scanner.stop();
    }
}

showStats().catch(console.error);
