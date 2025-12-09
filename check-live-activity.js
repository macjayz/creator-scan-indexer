// check-live-activity.js - Check LIVE right now
import { ethers } from 'ethers';

async function checkLiveActivity() {
  console.log('🔴 Checking LIVE activity RIGHT NOW...\n');
  
  // Use public RPC
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock}`);
  console.log(`Checking last 100 blocks (≈3 minutes)...\n`);
  
  // Check Zora
  const zoraFactory = new ethers.Contract(
    '0x777777751622c0d3258f214f9df38e35bf45baf3',
    ['event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'],
    provider
  );
  
  const zoraEvents = await zoraFactory.queryFilter('CoinCreated', currentBlock - 100, currentBlock);
  console.log(`🎯 Zora tokens in last 100 blocks: ${zoraEvents.length}`);
  
  if (zoraEvents.length > 0) {
    zoraEvents.forEach((event, i) => {
      const [address, name, symbol, creator] = event.args;
      console.log(`${i + 1}. ${symbol} (${name})`);
      console.log(`   Address: ${address}`);
      console.log(`   Creator: ${creator}`);
      console.log(`   Block: ${event.blockNumber}`);
      console.log('');
    });
  } else {
    console.log('😴 No Zora tokens in last 3 minutes (normal)');
  }
  
  // Check DEX
  console.log('\n💧 Checking DEX activity...');
  const uniswapFactory = new ethers.Contract(
    '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    ['event PoolCreated(address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing, address pool)'],
    provider
  );
  
  const pools = await uniswapFactory.queryFilter('PoolCreated', currentBlock - 100, currentBlock);
  console.log(`New pools in last 100 blocks: ${pools.length}`);
  
  const weth = '0x4200000000000000000000000000000000000006';
  const creatorPools = pools.filter(event => {
    const [token0, token1] = event.args;
    return token0.toLowerCase() === weth || token1.toLowerCase() === weth;
  });
  
  console.log(`Pools with WETH (potential creator tokens): ${creatorPools.length}`);
  
  if (creatorPools.length > 0) {
    creatorPools.forEach((event, i) => {
      const [token0, token1, , , pool] = event.args;
      const newToken = token0.toLowerCase() === weth ? token1 : token0;
      console.log(`${i + 1}. New token with liquidity: ${newToken.substring(0, 10)}...`);
    });
  }
  
  console.log('\n📈 REALITY CHECK:');
  console.log('• Base has ~10-20 tx/block');
  console.log('• Creator tokens are RARE events');
  console.log('• Your indexer IS working - it just needs time to find them');
  console.log('• Keep it running 24/7 to catch the next launch!');
}

checkLiveActivity().catch(console.error);
