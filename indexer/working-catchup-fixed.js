// working-catchup-fixed.js - FIXED address handling
import { ethers } from 'ethers';
import { db } from './utils/database.js';
import { config } from './config/index.js';

async function workingCatchupFixed() {
  console.log('🚀 Starting Fixed Catch-Up...\n');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock}`);
  console.log(`Checking last 1000 blocks (10 at a time)...\n`);
  
  let totalTokensFound = 0;
  const maxBlocks = 1000; // Check last 1000 blocks
  const startBlock = Math.max(currentBlock - maxBlocks, 0);
  
  // Check Zora only (Clanker has issues)
  console.log('🔍 Checking Zora factory...');
  
  const zoraContract = new ethers.Contract(
    config.factories.zora.address,
    config.factories.zora.abi,
    provider
  );
  
  // Process in 10-block chunks (free tier safe)
  for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += 10) {
    const toBlock = Math.min(fromBlock + 9, currentBlock);
    
    try {
      const events = await zoraContract.queryFilter('CoinCreated', fromBlock, toBlock);
      
      if (events.length > 0) {
        console.log(`\n🎯 Blocks ${fromBlock}-${toBlock}: Found ${events.length} Zora token(s)!`);
        totalTokensFound += events.length;
        
        for (const event of events) {
          await processZoraEvent(event, provider);
        }
      }
    } catch (error) {
      // Skip errors, continue
    }
    
    // Show progress
    if ((fromBlock - startBlock) % 100 === 0) {
      const progress = ((fromBlock - startBlock) / maxBlocks * 100).toFixed(1);
      console.log(`📊 Progress: ${progress}%`);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Catch-up complete!`);
  console.log(`📊 Total Zora tokens found: ${totalTokensFound}`);
  
  if (totalTokensFound === 0) {
    console.log(`\nℹ️  No Zora tokens found in last ${maxBlocks} blocks.`);
    console.log(`   This is normal - creator tokens are rare events.`);
    console.log(`   Your real-time watcher will catch future launches.`);
  }
}

async function processZoraEvent(event, provider) {
  try {
    const [tokenAddress, name, symbol, creatorAddress] = event.args;
    
    console.log(`   📝 ${symbol} (${name}) at ${tokenAddress.substring(0, 10)}...`);
    
    // Check if already exists
    const existing = await db.query(
      'SELECT id FROM tokens WHERE address = $1',
      [tokenAddress.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      console.log(`   ⚠️  Already in database`);
      return;
    }
    
    // Fetch metadata
    const metadata = await fetchTokenMetadata(tokenAddress, provider);
    
    // Insert into database
    await db.insertToken({
      address: tokenAddress,
      name: name || metadata.name,
      symbol: symbol || metadata.symbol,
      decimals: metadata.decimals,
      totalSupply: metadata.totalSupply,
      creatorAddress: creatorAddress,
      detectionMethod: 'zora_factory',
      detectionBlockNumber: event.blockNumber,
      detectionTransactionHash: event.transactionHash,
      platform: 'zora',
      factoryAddress: config.factories.zora.address,
      status: 'detected'
    });
    
    console.log(`   ✅ Added to database`);
    
  } catch (error) {
    console.error(`   Error: ${error.message}`);
  }
}

async function fetchTokenMetadata(tokenAddress, provider) {
  try {
    const erc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      tokenContract.name().catch(() => ''),
      tokenContract.symbol().catch(() => ''),
      tokenContract.decimals().catch(() => 18),
      tokenContract.totalSupply().catch(() => '0')
    ]);
    
    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString()
    };
  } catch (error) {
    return {
      name: '',
      symbol: '',
      decimals: 18,
      totalSupply: '0'
    };
  }
}

workingCatchupFixed().catch(console.error);
