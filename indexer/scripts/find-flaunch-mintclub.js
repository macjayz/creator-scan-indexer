import { ethers } from 'ethers';
import { config } from '../config/index.js';

async function findFlaunchHook() {
  console.log('🔍 Searching for Flaunch Uniswap V4 hook transactions...');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  
  // Common Flaunch patterns
  const flaunchSignatures = [
    'flaunch', 'farcaster', 'fc', 'farcaster coin',
    '0xflaunch', 'fc coin', 'farcaster launch'
  ];
  
  // Look for recent pools created with hooks
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 10000; // Last ~10k blocks
  
  const poolManager = new ethers.Contract(
    config.dex.uniswapV4.poolManager,
    config.dex.uniswapV4.abi,
    provider
  );
  
  console.log(`📊 Scanning blocks ${fromBlock} to ${currentBlock}...`);
  
  const events = await poolManager.queryFilter('PoolInitialized', fromBlock, currentBlock);
  
  console.log(`\n🎯 Found ${events.length} Uniswap V4 pools with hooks:`);
  
  const hooks = new Set();
  events.forEach((event, i) => {
    const hook = event.args.hook;
    const token0 = event.args.token0;
    const token1 = event.args.token1;
    
    console.log(`\n${i+1}. Pool ${event.args.poolId.substring(0, 16)}...`);
    console.log(`   Hook: ${hook}`);
    console.log(`   Token0: ${token0}`);
    console.log(`   Token1: ${token1}`);
    console.log(`   Tx: ${event.transactionHash}`);
    
    hooks.add(hook);
  });
  
  console.log(`\n📋 Unique hook addresses found: ${Array.from(hooks).length}`);
  hooks.forEach(hook => {
    console.log(`   • ${hook}`);
  });
}

async function findMintClubTokens() {
  console.log('\n🔍 Searching for Mint Club bonding curve tokens...');
  
  const provider = new ethers.JsonRpcProvider(config.base.httpUrl);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 10000;
  
  // Look for tokens with "Mint" or "MINT" in name/symbol
  const tokenCreatedEvents = await provider.getLogs({
    fromBlock,
    toBlock: currentBlock,
    topics: ['0x4e6c5e2d9d9f7d5e2b2c2d2f2e3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f'] // TokenCreated event signature placeholder
  });
  
  console.log(`📊 Found ${tokenCreatedEvents.length} token creation events`);
  
  // Check contract creation transactions
  console.log('\n💡 Tip: Check these resources for addresses:');
  console.log('   1. Flaunch website/docs: https://flaunch.io or Twitter');
  console.log('   2. Mint Club website: https://mintclub.io');
  console.log('   3. Base blockchain explorers for recent transactions');
  console.log('   4. Farcaster channels discussing Flaunch/Mint Club');
}

async function main() {
  try {
    await findFlaunchHook();
    await findMintClubTokens();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
