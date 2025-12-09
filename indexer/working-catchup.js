// working-catchup.js - Works within free tier limits
import { ethers } from 'ethers';
import { db } from './utils/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function workingCatchup() {
  console.log('🚀 Starting Working Catch-Up (10 blocks at a time)...\n');
  
  // Use public RPC for larger queries
  const provider = new ethers.JsonRpcProvider(process.env.BASE_HTTP_URL);
  const currentBlock = await provider.getBlockNumber();
  const startBlock = parseInt(process.env.START_BLOCK || (currentBlock - 1000));
  
  console.log(`From block: ${startBlock}`);
  console.log(`To block: ${currentBlock}`);
  console.log(`Total blocks: ${currentBlock - startBlock}`);
  console.log(`Processing 10 blocks at a time...\n`);
  
  // Factories to monitor
  const factories = [
    {
      name: 'Zora',
      address: process.env.ZORA_FACTORY_ADDRESS,
      abi: ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
      event: 'CoinCreated'
    },
    {
      name: 'Clanker', 
      address: process.env.CLANKER_FACTORY_ADDRESS,
      abi: ['event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)'],
      event: 'TokenCreated'
    }
  ];
  
  let totalTokensFound = 0;
  const maxBlocksPerRequest = 10; // Free tier safe
  
  // Process in 10-block chunks
  for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += maxBlocksPerRequest) {
    const toBlock = Math.min(fromBlock + maxBlocksPerRequest - 1, currentBlock);
    
    if (fromBlock % 1000 === 0) {
      console.log(`📊 Progress: ${fromBlock - startBlock}/${currentBlock - startBlock} blocks`);
    }
    
    for (const factory of factories) {
      try {
        const contract = new ethers.Contract(factory.address, factory.abi, provider);
        const events = await contract.queryFilter(factory.event, fromBlock, toBlock);
        
        if (events.length > 0) {
          console.log(`\n🎯 Block ${fromBlock}: Found ${events.length} ${factory.name} token(s)!`);
          totalTokensFound += events.length;
          
          for (const event of events) {
            await processTokenEvent(factory, event, provider);
          }
        }
      } catch (error) {
        console.log(`❌ ${factory.name} at blocks ${fromBlock}-${toBlock}: ${error.message}`);
        
        // If it's a rate limit, wait
        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          console.log('⏳ Waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Catch-up complete!`);
  console.log(`📊 Total tokens found: ${totalTokensFound}`);
  
  if (totalTokensFound === 0) {
    console.log(`\n😕 No tokens found. This could mean:`);
    console.log(`   • No creator tokens in ${currentBlock - startBlock} blocks`);
    console.log(`   • Try larger time range (creator tokens are rare)`);
    console.log(`   • Your real-time watcher will catch future tokens`);
  } else {
    console.log(`\n🎉 Refresh your frontend to see ${totalTokensFound} new tokens!`);
  }
}

async function processTokenEvent(factory, event, provider) {
  try {
    let tokenAddress, name, symbol, creatorAddress;
    
    if (factory.name === 'Zora') {
      [tokenAddress, name, symbol, creatorAddress] = event.args;
      console.log(`   📝 ${symbol} (${name}) at ${tokenAddress.substring(0, 10)}...`);
    } else if (factory.name === 'Clanker') {
      [tokenAddress, creatorAddress] = event.args;
      name = event.args[6];
      symbol = event.args[7];
      console.log(`   📝 ${symbol} (${name}) at ${tokenAddress.substring(0, 10)}...`);
    }
    
    // Fetch token metadata
    const metadata = await fetchTokenMetadata(tokenAddress, provider);
    
    // Insert into database
    await db.insertToken({
      address: tokenAddress,
      name: name || metadata.name,
      symbol: symbol || metadata.symbol,
      decimals: metadata.decimals,
      totalSupply: metadata.totalSupply,
      creatorAddress: creatorAddress,
      detectionMethod: `${factory.name.toLowerCase()}_factory`,
      detectionBlockNumber: event.blockNumber,
      detectionTransactionHash: event.transactionHash,
      platform: factory.name.toLowerCase(),
      factoryAddress: factory.address,
      status: 'detected'
    });
    
  } catch (error) {
    console.error(`   Error processing: ${error.message}`);
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

workingCatchup().catch(console.error);
