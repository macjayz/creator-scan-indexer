// indexer/dex-watcher/index.js
import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

class DexWatcher {
  constructor() {
    this.httpProvider = new ethers.JsonRpcProvider(config.base.httpUrl);
    this.isRunning = false;
    
    // Use config for DEX addresses
    this.dexes = {
      uniswapV3: {
        factory: config.dex.uniswapV3.factory,
        name: 'uniswap_v3',
        abi: config.dex.uniswapV3.abi,
        startBlock: config.dex.uniswapV3.startBlock
      },
      aerodrome: {
        factory: config.dex.aerodrome.factory,
        name: 'aerodrome',
        abi: config.dex.aerodrome.abi,
        startBlock: config.dex.aerodrome.startBlock
      }
    };
    
    // Use config for base tokens
    this.ignoreTokens = new Set(config.baseTokens.map(addr => addr.toLowerCase()));
    
    this.lastProcessedBlock = {
      uniswapV3: this.dexes.uniswapV3.startBlock,
      aerodrome: this.dexes.aerodrome.startBlock
    };
    
    this.maxBlocksPerRequest = 10;
  }

  async start() {
    console.log('🚀 Starting DEX Watcher...');
    console.log(`📡 Monitoring DEX pools on:`);
    console.log(`   • Uniswap V3: ${this.dexes.uniswapV3.factory}`);
    console.log(`   • Aerodrome: ${this.dexes.aerodrome.factory}`);
    console.log(`⚠️  Using ${this.maxBlocksPerRequest} blocks per request`);
    
    this.isRunning = true;
    
    await this.pollForDexEvents();
    
    console.log('✅ DEX Watcher is running');
  }

  async pollForDexEvents() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.httpProvider.getBlockNumber();
        
        for (const [dexKey, dex] of Object.entries(this.dexes)) {
          await this.processDexEvents(dexKey, dex, currentBlock);
        }
        
        console.log('⏳ DEX Watcher: Waiting 45 seconds for next poll...');
        await new Promise(resolve => setTimeout(resolve, 45000));
        
      } catch (error) {
        console.error('DEX Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  async processDexEvents(dexKey, dex, currentBlock) {
    try {
      const fromBlock = this.lastProcessedBlock[dexKey];
      
      if (fromBlock >= currentBlock) {
        return;
      }
      
      const toBlock = Math.min(
        fromBlock + this.maxBlocksPerRequest - 1,
        currentBlock
      );
      
      if (fromBlock > toBlock) {
        return;
      }
      
      console.log(`📊 ${dex.name}: Processing blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
      
      const contract = new ethers.Contract(dex.factory, dex.abi, this.httpProvider);
      const events = await contract.queryFilter('PoolCreated', fromBlock, toBlock);
      
      if (events.length > 0) {
        console.log(`🎯 ${dex.name}: Found ${events.length} new pool(s)`);
        
        for (const event of events) {
          await this.handlePoolCreation(dex, event);
        }
      } else {
        console.log(`   ${dex.name}: No new pools found`);
      }
      
      this.lastProcessedBlock[dexKey] = toBlock + 1;
      
    } catch (error) {
      console.error(`Error processing ${dex.name} events:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  async handlePoolCreation(dex, event) {
    try {
      let token0, token1, poolAddress;
      
      if (dex.name === 'uniswap_v3') {
        [token0, token1, , , poolAddress] = event.args;
      } else if (dex.name === 'aerodrome') {
        [token0, token1, , poolAddress] = event.args;
      }
      
      const isNewToken = await this.isPotentialCreatorToken(token0, token1);
      
      if (isNewToken) {
        const newTokenAddress = this.ignoreTokens.has(token0.toLowerCase()) ? token1 : token0;
        const pairedWith = this.ignoreTokens.has(token0.toLowerCase()) ? token0 : token1;
        
        console.log(`   🆕 ${dex.name}: New pool detected!`);
        console.log(`      Token: ${newTokenAddress.substring(0, 10)}...`);
        console.log(`      Paired with: ${this.getTokenName(pairedWith)}`);
        console.log(`      Pool: ${poolAddress.substring(0, 10)}...`);
        
        const existing = await this.checkExistingToken(newTokenAddress);
        
        if (!existing) {
          await this.processNewTokenFromDex(newTokenAddress, dex, event, poolAddress);
        } else {
          console.log(`      Token already indexed via ${existing.detection_method}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error handling pool creation:`, error.message);
    }
  }

  async isPotentialCreatorToken(token0, token1) {
    const t0 = token0.toLowerCase();
    const t1 = token1.toLowerCase();
    
    const isPairedWithBaseToken = 
      this.ignoreTokens.has(t0) || this.ignoreTokens.has(t1);
    
    const otherIsNotBase = 
      (this.ignoreTokens.has(t0) && !this.ignoreTokens.has(t1)) ||
      (!this.ignoreTokens.has(t0) && this.ignoreTokens.has(t1));
    
    return isPairedWithBaseToken && otherIsNotBase;
  }

  getTokenName(address) {
    const addr = address.toLowerCase();
    if (addr === '0x4200000000000000000000000000000000000006') return 'WETH';
    if (addr === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') return 'USDC';
    if (addr === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22') return 'cbETH';
    return 'Unknown';
  }

  async checkExistingToken(tokenAddress) {
    try {
      const result = await db.query(
        'SELECT detection_method FROM tokens WHERE address = $1',
        [tokenAddress.toLowerCase()]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error checking existing token:', error.message);
      return null;
    }
  }

  async processNewTokenFromDex(tokenAddress, dex, event, poolAddress) {
    try {
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      const creator = await this.findCreatorAddress(tokenAddress, event.blockNumber);
      
      await db.insertDetectionEvent({
        eventType: `${dex.name}_pool`,
        contractAddress: dex.factory,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        rawData: {
          tokenAddress,
          poolAddress,
          pairedToken: this.getTokenName(this.ignoreTokens.has(tokenAddress.toLowerCase()) ? 'other' : 'base'),
          dex: dex.name
        }
      });

      await db.insertToken({
        address: tokenAddress,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        totalSupply: metadata.totalSupply,
        creatorAddress: creator,
        detectionMethod: `${dex.name}_pool`,
        detectionBlockNumber: event.blockNumber,
        detectionTransactionHash: event.transactionHash,
        platform: this.guessPlatform(dex, metadata),
        factoryAddress: dex.factory,
        status: 'detected'
      });

      console.log(`   ✅ Indexed via DEX: ${metadata.symbol || 'Unknown'} at ${tokenAddress.substring(0, 10)}...`);
      
    } catch (error) {
      console.error(`Failed to process token ${tokenAddress}:`, error.message);
    }
  }

  async fetchTokenMetadata(tokenAddress) {
    try {
      const erc20Abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
        'function owner() view returns (address)'
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.httpProvider);
      
      const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
        tokenContract.name().catch(() => ''),
        tokenContract.symbol().catch(() => ''),
        tokenContract.decimals().catch(() => 18),
        tokenContract.totalSupply().catch(() => '0'),
        tokenContract.owner().catch(() => '0x0000000000000000000000000000000000000000')
      ]);

      return {
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
        owner
      };
    } catch (error) {
      console.error(`Failed to fetch metadata for ${tokenAddress}:`, error.message);
      return {
        name: '',
        symbol: '',
        decimals: 18,
        totalSupply: '0',
        owner: '0x0000000000000000000000000000000000000000'
      };
    }
  }

  async findCreatorAddress(tokenAddress, fromBlock) {
    try {
      const erc20Abi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.httpProvider);
      
      const transferEvents = await tokenContract.queryFilter('Transfer', fromBlock - 100, fromBlock + 100);
      
      const mintEvent = transferEvents.find(event => 
        event.args.from === '0x0000000000000000000000000000000000000000'
      );
      
      if (mintEvent) {
        return mintEvent.args.to;
      }
      
      return '0x0000000000000000000000000000000000000000';
      
    } catch (error) {
      console.error(`Error finding creator for ${tokenAddress}:`, error.message);
      return '0x0000000000000000000000000000000000000000';
    }
  }

  guessPlatform(dex, metadata) {
    const name = metadata.name.toLowerCase();
    const symbol = metadata.symbol.toLowerCase();
    
    if (name.includes('flaunch') || symbol.includes('fl')) {
      return 'flaunch';
    }
    
    if (name.includes('mint') || symbol.includes('mint')) {
      return 'mint_club';
    }
    
    return `dex_${dex.name}`;
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 DEX Watcher stopped');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Stopping DEX Watcher...');
  await watcher.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Stopping DEX Watcher...');
  await watcher.stop();
  process.exit(0);
});

// Start the watcher
const watcher = new DexWatcher();
watcher.start().catch(console.error);
