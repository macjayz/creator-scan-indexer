import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

// Known Uniswap V3 PoolCreated event signature
const POOL_CREATED_TOPIC = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118';

async function findFactory() {
  console.log('Searching for recent PoolCreated events...');
  
  // Get recent logs with PoolCreated signature
  const logs = await provider.getLogs({
    fromBlock: 'latest' - 10000,
    toBlock: 'latest',
    topics: [POOL_CREATED_TOPIC]
  });
  
  console.log(`Found ${logs.length} PoolCreated events in last 10k blocks`);
  
  if (logs.length > 0) {
    // Group by contract address (factory)
    const factories = {};
    logs.forEach(log => {
      factories[log.address] = (factories[log.address] || 0) + 1;
    });
    
    console.log('\nFactory addresses found:');
    Object.entries(factories).forEach(([addr, count]) => {
      console.log(`  ${addr}: ${count} pools created`);
    });
  } else {
    console.log('NO PoolCreated events found. Either:');
    console.log('1. Wrong event signature');
    console.log('2. No pools created recently');
    console.log('3. RPC limit issues');
  }
}

findFactory().catch(console.error);
