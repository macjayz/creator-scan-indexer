// This shows how to update the factory watcher to capture ui_deployer
// The key insight: we need to get the transaction details to find who sent it

import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

async function getTransactionDetails(provider, txHash) {
  try {
    const tx = await provider.getTransaction(txHash);
    return {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasPrice: tx.gasPrice?.toString(),
      gasLimit: tx.gasLimit.toString()
    };
  } catch (error) {
    console.error(`Error getting transaction ${txHash}:`, error.message);
    return null;
  }
}

// Example of how to update the handleEvent function:
async function handleEventWithUIDeployer(platform, factory, event) {
  try {
    // ... existing token extraction logic ...
    
    // Get transaction details to capture ui_deployer
    const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
    const txDetails = await getTransactionDetails(provider, event.transactionHash);
    
    const uiDeployer = txDetails?.from || '0x0000000000000000000000000000000000000000';
    
    // Save to database with ui_deployer
    await db.query(
      `INSERT INTO tokens 
       (address, name, symbol, decimals, total_supply, creator_address,
        detection_method, detection_block_number, detection_transaction_hash,
        platform, factory_address, ui_deployer, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        tokenAddress.toLowerCase(),
        name || 'Unknown',
        symbol || 'UNKNOWN',
        decimals,
        totalSupply,
        creatorAddress.toLowerCase(),
        `${platform}_factory`,
        event.blockNumber,
        event.transactionHash,
        platform,
        factory.address.toLowerCase(),
        uiDeployer.toLowerCase(),  // New field
        'detected'
      ]
    );
    
    console.log(`   ✅ Indexed: ${symbol} via ${platform}, UI deployer: ${uiDeployer.substring(0, 10)}...`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
