// historical-catchup.js - Process historical blocks efficiently
import { ethers } from 'ethers';
import { db } from './utils/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function historicalCatchup() {
  console.log('🚀 Starting Historical Catch-Up...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  const currentBlock = await provider.getBlockNumber();
  const startBlock = parseInt(process.env.START_BLOCK || currentBlock - 10000);
  
  console.log(`From block: ${startBlock}`);
  console.log(`To block: ${currentBlock}`);
  console.log(`Total blocks: ${currentBlock - startBlock}`);
  
  // Factories to monitor
  const factories = [
    {
      name: 'Zora',
      address: '0x777777751622c0d3258f214f9df38e35bf45baf3',
      abi: ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
      event: 'CoinCreated'
    },
    {
      name: 'Clanker', 
      address: '0x2A787b2362021cC3eEa3C24C4748a6cd5b687382',
      abi: ['event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)'],
      event: 'TokenCreated'
    }
  ];
  
  let totalTokensFound = 0;
  
  // Process in chunks (100 blocks at a time for public RPC)
  const chunkSize = 100;
  for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    
    console.log(`\n📦 Processing blocks ${fromBlock} to ${toBlock}...`);
    
    for (const factory of factories) {
      try {
        const contract = new ethers.Contract(factory.address, factory.abi, provider);
        const events = await contract.queryFilter(factory.event, fromBlock, toBlock);
        
        if (events.length > 0) {
          console.log(`   🎯 ${factory.name}: Found ${events.length} token(s)`);
          totalTokensFound += events.length;
          
          // Process each token
          for (const event of events) {
            await processTokenEvent(factory, event);
          }
        }
      } catch (error) {
        console.log(`   ❌ ${factory.name}: ${error.message}`);
        // If we hit rate limits, wait and continue
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          console.log('   ⏳ Waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    // Small delay between chunks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Historical catch-up complete!`);
  console.log(`📊 Total tokens found: ${totalTokensFound}`);
  
  if (totalTokensFound > 0) {
    console.log(`\n🎉 Refresh your frontend to see the new tokens!`);
  } else {
    console.log(`\n😕 No tokens found in historical data.`);
    console.log(`   This could mean:`);
    console.log(`   1. No creator tokens launched in that period`);
    console.log(`   2. RPC limits preventing full queries`);
    console.log(`   3. Try with a larger date range`);
  }
}

async function processTokenEvent(factory, event) {
  try {
    let tokenAddress, name, symbol, creatorAddress;
    
    if (factory.name === 'Zora') {
      [tokenAddress, name, symbol, creatorAddress] = event.args;
    } else if (factory.name === 'Clanker') {
      [tokenAddress, creatorAddress] = event.args;
      name = event.args[6];
      symbol = event.args[7];
    }
    
    console.log(`      📝 ${symbol} (${name}) by ${creatorAddress.substring(0, 10)}...`);
    
    // Insert into database
    await db.insertToken({
      address: tokenAddress,
      name: name,
      symbol: symbol,
      decimals: 18, // Default
      totalSupply: '0', // Will fetch later
      creatorAddress: creatorAddress,
      detectionMethod: `${factory.name.toLowerCase()}_factory`,
      detectionBlockNumber: event.blockNumber,
      detectionTransactionHash: event.transactionHash,
      platform: factory.name.toLowerCase(),
      factoryAddress: factory.address,
      status: 'detected'
    });
    
  } catch (error) {
    console.error(`Error processing event:`, error.message);
  }
}

historicalCatchup().catch(console.error);
