import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

async function backfillUIDeployer() {
  console.log('🔄 Backfilling UI deployer for existing tokens...');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  
  // Get all tokens without ui_deployer
  const result = await db.query(
    "SELECT address, detection_transaction_hash FROM tokens WHERE ui_deployer IS NULL OR ui_deployer = '0x0000000000000000000000000000000000000000'"
  );
  
  console.log(`Found ${result.rows.length} tokens to backfill`);
  
  for (let i = 0; i < result.rows.length; i++) {
    const token = result.rows[i];
    
    try {
      // Get transaction details
      const tx = await provider.getTransaction(token.detection_transaction_hash);
      const uiDeployer = tx?.from || '0x0000000000000000000000000000000000000000';
      
      // Update database
      await db.query(
        'UPDATE tokens SET ui_deployer = $1 WHERE address = $2',
        [uiDeployer.toLowerCase(), token.address]
      );
      
      console.log(`  ${i+1}/${result.rows.length}: Updated ${token.address.substring(0, 10)}... → UI deployer: ${uiDeployer.substring(0, 10)}...`);
      
      // Small delay to avoid rate limiting
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`  Error for ${token.address}:`, error.message);
    }
  }
  
  console.log('✅ Backfill complete!');
}

backfillUIDeployer().catch(console.error);
