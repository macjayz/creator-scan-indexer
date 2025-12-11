// DEX Watcher with Alchemy Free Tier support
import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

class DexWatcher {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.base.httpUrl);
    this.isRunning = false;
    
    // Only track enabled DEXes
    this.dexes = [];
    
    if (config.dex.uniswapV3.factory !== '0x0000000000000000000000000000000000000000') {
      this.dexes.push({
        name: 'uniswap_v3',
        factory: config.dex.uniswapV3.factory,
        startBlock: config.dex.uniswapV3.startBlock,
        abi: config.dex.uniswapV3.abi,
        eventName: 'PoolCreated',
        maxBlockRange: config.dex.uniswapV3.maxBlockRange || 10,
        enabled: true
      });
    }
    
    if (config.dex.aerodrome.enabled && config.dex.aerodrome.factory !== '0x0000000000000000000000000000000000000000') {
      this.dexes.push({
        name: 'aerodrome',
        factory: config.dex.aerodrome.factory,
        startBlock: config.dex.aerodrome.startBlock,
        abi: config.dex.aerodrome.abi,
        eventName: 'PoolCreated',
        maxBlockRange: 10,
        enabled: true
      });
    }
    
    // Track last processed blocks per DEX
    this.lastProcessedBlocks = {};
    this.dexes.forEach(dex => {
      this.lastProcessedBlocks[dex.name] = dex.startBlock;
    });
    
    // Respect Alchemy free tier limits
    this.maxBlocksPerRequest = config.alchemyLimits.maxBlocksPerRequest || 5;
    this.pollInterval = config.alchemyLimits.pollInterval || 45000;
    
    // Base tokens to ignore
    this.baseTokens = new Set(config.baseTokens.map(addr => addr.toLowerCase()));
    
    console.log(`⚠️  Using Alchemy Free Tier settings:`);
    console.log(`   Max blocks per request: ${this.maxBlocksPerRequest}`);
    console.log(`   Poll interval: ${this.pollInterval/1000}s`);
  }

  async start() {
    console.log('🚀 Starting DEX Watcher (Alchemy Free Tier compatible)...');
    
    if (this.dexes.length === 0) {
      console.log('❌ No DEXes configured. Please check your config.');
      return;
    }
    
    console.log(`📡 Monitoring DEX pools on:`);
    this.dexes.forEach(dex => {
      console.log(`   • ${dex.name}: ${dex.factory}`);
    });
    console.log(`   Base tokens to ignore: ${this.baseTokens.size} tokens`);
    
    this.isRunning = true;
    await this.loadLastProcessedBlocks();
    await this.pollForEvents();
  }

  async loadLastProcessedBlocks() {
    try {
      const currentBaseBlock = await this.provider.getBlockNumber();
      console.log(`Current Base block: ${currentBaseBlock}`);
      
      for (const dex of this.dexes) {
        console.log(`\nDEBUG: Checking ${dex.name}`);
        console.log(`DEBUG: Configured start block: ${this.lastProcessedBlocks[dex.name]}`);
        
        const result = await db.query(
          'SELECT MAX(block_number) as last_block, COUNT(*) as total_events FROM detection_events WHERE contract_address = $1',
          [dex.factory.toLowerCase()]
        );
        
        console.log(`DEBUG: Found ${result.rows[0]?.total_events || 0} events for ${dex.name}`);
        console.log(`DEBUG: Max block in DB: ${result.rows[0]?.last_block || 'none'}`);
        
        let useBlock;
        
        if (result.rows[0] && result.rows[0].last_block) {
          const lastBlock = parseInt(result.rows[0].last_block);
          console.log(`DEBUG: lastBlock as number: ${lastBlock}`);
          
          const blocksBehind = currentBaseBlock - lastBlock;
          console.log(`DEBUG: ${blocksBehind} blocks behind current`);
          
          // Check if stored block is reasonably recent (less than 20,000 blocks behind)
          if (blocksBehind < 20000) {
            // Use stored block + 1
            useBlock = lastBlock + 1;
            console.log(`   📍 ${dex.name}: Using stored block ${useBlock}`);
          } else {
            // Stored block is too old
            console.log(`⚠️  Stored block ${lastBlock} is too old (${blocksBehind} blocks behind)`);
            useBlock = currentBaseBlock - 1000; // Scan last 1000 blocks
          }
        } else {
          // No stored blocks
          console.log(`   📍 ${dex.name}: No stored blocks found`);
          useBlock = currentBaseBlock - 1000; // Scan last 1000 blocks
        }
        
        // Final check: If configured start block is way too old, ignore it
        const configuredBlocksBehind = currentBaseBlock - this.lastProcessedBlocks[dex.name];
        if (configuredBlocksBehind > 50000) {
          console.log(`⚠️  Configured start block ${this.lastProcessedBlocks[dex.name]} is ${configuredBlocksBehind} blocks behind`);
          console.log(`   Overriding with recent block: ${currentBaseBlock - 1000}`);
          useBlock = currentBaseBlock - 1000;
        }
        
        // Apply the final block to use
        this.lastProcessedBlocks[dex.name] = useBlock;
        console.log(`   ✅ Final start block: ${this.lastProcessedBlocks[dex.name]}`);
      }
    } catch (error) {
      console.log('No previous detection events found, starting from configured blocks');
    }
  }

  async pollForEvents() {
    console.log('\n✅ DEX Watcher is running');
    
    while (this.isRunning) {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        console.log(`\n📊 Current block: ${currentBlock}`);
        
        for (const dex of this.dexes) {
          await this.processDexEvents(dex, currentBlock);
        }
        
        console.log(`⏳ Next poll in ${this.pollInterval/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
      } catch (error) {
        console.error('❌ Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  async processDexEvents(dex, currentBlock) {
    try {
      let fromBlock = this.lastProcessedBlocks[dex.name];
      
      if (fromBlock >= currentBlock) {
        console.log(`   📭 ${dex.name}: Already at current block (${fromBlock})`);
        return;
      }
      
      // Calculate safe range based on Alchemy limits
      const maxRange = Math.min(dex.maxBlockRange, this.maxBlocksPerRequest);
      let toBlock = Math.min(fromBlock + maxRange - 1, currentBlock);
      
      if (fromBlock > toBlock) {
        return;
      }
      
      console.log(`   🔍 ${dex.name}: Processing blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
      
      const contract = new ethers.Contract(dex.factory, dex.abi, this.provider);
      
      try {
        console.log("DEBUG: dex.factory =", dex.factory);
        console.log("DEBUG: dex.eventName =", dex.eventName);
        
        const events = await contract.queryFilter(dex.eventName, fromBlock, toBlock);
        console.log(`DEBUG: Got ${events.length} events`);
        if (events.length > 0) {
          console.log(`   🎯 Found ${events.length} new pool(s)`);
          
          for (const event of events) {
            await this.handlePoolCreation(dex, event);
          }
        } else {
          console.log(`   📭 No new pools found`);
        }
        
        // Successfully processed, update block
        this.lastProcessedBlocks[dex.name] = toBlock + 1;
        
      } catch (error) {
        // If we get a block range error, reduce range and retry
        if (error.message.includes('block range') || error.message.includes('eth_getLogs')) {
          console.log(`   ⚠️ ${dex.name}: Block range error, reducing range...`);
          
          // Try smaller range
          const smallerRange = Math.max(2, Math.floor(maxRange / 2));
          toBlock = Math.min(fromBlock + smallerRange - 1, currentBlock);
          
          try {
            const events = await contract.queryFilter(dex.eventName, fromBlock, toBlock);
            
            if (events.length > 0) {
              console.log(`   🎯 Found ${events.length} new pool(s) with smaller range`);
              
              for (const event of events) {
                await this.handlePoolCreation(dex, event);
              }
            }
            
            this.lastProcessedBlocks[dex.name] = toBlock + 1;
          } catch (retryError) {
            console.log(`   ❌ ${dex.name}: Still failing with smaller range, skipping block ${fromBlock}`);
            // Skip this block and move on
            this.lastProcessedBlocks[dex.name] = fromBlock + 1;
          }
        } else {
          console.error(`   ❌ ${dex.name}: Error:`, error.message);
          // Skip this block on other errors
          this.lastProcessedBlocks[dex.name] = fromBlock + 1;
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${dex.name}:`, error.message);
    }
  }

  async handlePoolCreation(dex, event) {
    console.log(`\n=== DEBUG: Processing ${dex.name} pool creation ===`);
    console.log(`DEBUG: Event block: ${event.blockNumber}, Tx: ${event.transactionHash}`);
    
    try {
      // Extract pool data based on DEX type
      let token0, token1, poolAddress;
      
      console.log(`DEBUG: Event args length: ${event.args?.length || 0}`);
      console.log(`DEBUG: Event args:`, event.args ? [...event.args].map(arg => arg.toString()) : 'No args');
      
      if (dex.name === 'uniswap_v3') {
        if (!event.args || event.args.length < 5) {
          console.log(`❌ ERROR: Invalid event args for uniswap_v3. Expected 5 args, got ${event.args?.length || 0}`);
          return;
        }
        token0 = event.args[0];
        token1 = event.args[1];
        poolAddress = event.args[4];
      } else if (dex.name === 'aerodrome') {
        if (!event.args || event.args.length < 3) {
          console.log(`❌ ERROR: Invalid event args for aerodrome. Expected 3 args, got ${event.args?.length || 0}`);
          return;
        }
        token0 = event.args[0];
        token1 = event.args[1];
        poolAddress = event.args[2];
      } else {
        console.log(`   ❌ Unknown DEX type: ${dex.name}`);
        return;
      }
      
      // Validate addresses
      if (!token0 || !token1 || !poolAddress) {
        console.log(`❌ ERROR: Missing address(es): token0=${!!token0}, token1=${!!token1}, pool=${!!poolAddress}`);
        return;
      }
      
      console.log(`DEBUG: token0 = ${token0}`);
      console.log(`DEBUG: token1 = ${token1}`);
      console.log(`DEBUG: poolAddress = ${poolAddress}`);
      
      // Check if this is a potential creator token (paired with a base token)
      const isCreatorToken = this.isPotentialCreatorToken(token0, token1);
      console.log(`DEBUG: isCreatorToken = ${isCreatorToken}`);
      
      if (!isCreatorToken) {
        console.log(`   📍 Skipping non-creator pool: ${token0.substring(0, 10)}... / ${token1.substring(0, 10)}...`);
        return;
      }
      
      // Determine which token is the new one (not a base token)
      const newTokenAddress = this.baseTokens.has(token0.toLowerCase()) ? token1 : token0;
      const pairedWith = this.baseTokens.has(token0.toLowerCase()) ? token0 : token1;
      
      console.log(`\n   🆕 New creator token detected via ${dex.name}:`);
      console.log(`      New Token: ${newTokenAddress}`);
      console.log(`      Paired with: ${this.getTokenSymbol(pairedWith)} (${pairedWith})`);
      console.log(`      Pool: ${poolAddress}`);
      console.log(`      Block: ${event.blockNumber}, Tx: ${event.transactionHash}`);
      
      // Check if token already exists in database
      const existing = await this.checkExistingToken(newTokenAddress);
      
      if (existing) {
        console.log(`      ⚠️ Token already indexed via ${existing.detection_method}`);
        
        // Still save the pool if it doesn't exist
        try {
          await this.saveDexPool(dex, poolAddress, newTokenAddress, pairedWith, event);
        } catch (poolError) {
          console.log(`      ⚠️ Could not save pool: ${poolError.message}`);
        }
        return;
      }
      
      // Fetch token metadata (with timeout)
      console.log(`      🔍 Fetching token metadata...`);
      const metadata = await this.fetchTokenMetadata(newTokenAddress);
      
      if (!metadata.name && !metadata.symbol) {
        console.log(`      ⚠️ Token has no name/symbol, might be non-standard`);
      } else {
        console.log(`      ✅ Metadata: ${metadata.symbol} (${metadata.name}), Decimals: ${metadata.decimals}`);
      }
      
      // Try to find creator (first minter/transfer from zero address)
      console.log(`      🔍 Finding creator address...`);
      const creator = await this.findCreatorAddress(newTokenAddress, event.blockNumber);
      console.log(`      ✅ Creator: ${creator}`);
      
      // Guess platform based on metadata
      const platform = this.guessPlatform(metadata, dex);
      
      // Save detection event
      try {
        await this.saveDetectionEvent(dex, event, newTokenAddress, poolAddress, token0, token1);
        console.log(`      ✅ Detection event saved`);
      } catch (detectionError) {
        console.log(`      ⚠️ Could not save detection event: ${detectionError.message}`);
      }
      
      // Save token to database
      try {
        await this.saveToken(dex, newTokenAddress, metadata, creator, event, platform);
        console.log(`      ✅ Token saved to database`);
      } catch (tokenError) {
        console.log(`      ❌ ERROR saving token: ${tokenError.message}`);
        console.log(`      ❌ SQL Error detail:`, tokenError.detail || 'No detail');
        return; // Don't save pool if token save failed
      }
      
      // Save DEX pool
      try {
        await this.saveDexPool(dex, poolAddress, newTokenAddress, pairedWith, event);
        console.log(`      ✅ DEX pool saved`);
      } catch (poolError) {
        console.log(`      ⚠️ Could not save pool: ${poolError.message}`);
      }
      
      console.log(`      ✅ Complete: ${metadata.symbol || 'Unknown'} (${metadata.name || 'No Name'})`);
      
    } catch (error) {
      console.error(`   ❌ ERROR in handlePoolCreation: ${error.message}`);
      console.error(`   ❌ Stack trace:`, error.stack);
    }
  }

  async saveDetectionEvent(dex, event, newTokenAddress, poolAddress, token0, token1) {
    return db.query(
      `INSERT INTO detection_events 
       (event_type, contract_address, block_number, transaction_hash, log_index, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `${dex.name}_pool_creation`,
        dex.factory.toLowerCase(),
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        JSON.stringify({
          tokenAddress: newTokenAddress.toLowerCase(),
          poolAddress: poolAddress.toLowerCase(),
          token0: token0.toLowerCase(),
          token1: token1.toLowerCase(),
          dex: dex.name
        })
      ]
    );
  }

  async saveToken(dex, newTokenAddress, metadata, creator, event, platform) {
    return db.query(
      `INSERT INTO tokens 
       (address, name, symbol, decimals, total_supply, creator_address, 
        detection_method, detection_block_number, detection_transaction_hash,
        platform, factory_address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (address) DO UPDATE SET 
         name = EXCLUDED.name,
         symbol = EXCLUDED.symbol,
         decimals = EXCLUDED.decimals,
         updated_at = NOW(),
         detection_block_number = EXCLUDED.detection_block_number
       RETURNING address`,
      [
        newTokenAddress.toLowerCase(),
        metadata.name || 'Unknown',
        metadata.symbol || 'UNKNOWN',
        metadata.decimals,
        metadata.totalSupply,
        creator.toLowerCase(),
        `${dex.name}_pool`,
        event.blockNumber,
        event.transactionHash,
        platform,
        dex.factory.toLowerCase(),
        'detected'
      ]
    );
  }

  async saveDexPool(dex, poolAddress, tokenAddress, pairedWith, event) {
    // First check if pool already exists
    const existingPool = await db.query(
      'SELECT id FROM dex_pools WHERE pool_address = $1',
      [poolAddress.toLowerCase()]
    );
    
    if (existingPool.rows.length > 0) {
      console.log(`      ⚠️ Pool already exists in database`);
      return;
    }
    
    return db.query(
      `INSERT INTO dex_pools 
       (pool_address, dex_name, token0_address, token1_address, 
        factory_address, creation_block, creation_transaction_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        poolAddress.toLowerCase(),
        dex.name,
        tokenAddress.toLowerCase(),
        pairedWith.toLowerCase(),
        dex.factory.toLowerCase(),
        event.blockNumber,
        event.transactionHash
      ]
    );
  }

  isPotentialCreatorToken(token0, token1) {
    const t0 = token0.toLowerCase();
    const t1 = token1.toLowerCase();
    
    // Check if one token is a base token and the other is not
    const token0IsBase = this.baseTokens.has(t0);
    const token1IsBase = this.baseTokens.has(t1);
    
    return (token0IsBase && !token1IsBase) || (!token0IsBase && token1IsBase);
  }

  getTokenSymbol(address) {
    const addr = address.toLowerCase();
    const symbols = {
      '0x4200000000000000000000000000000000000006': 'WETH',
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
      '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'cbETH',
      '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': 'DEGEN',
      '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b': 'BASED'
    };
    return symbols[addr] || 'Unknown';
  }

  async checkExistingToken(tokenAddress) {
    try {
      const result = await db.query(
        'SELECT detection_method FROM tokens WHERE address = $1',
        [tokenAddress.toLowerCase()]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.log(`      ⚠️ Error checking existing token: ${error.message}`);
      return null;
    }
  }

  async fetchTokenMetadata(tokenAddress) {
    console.log(`      🔍 Fetching metadata for ${tokenAddress.substring(0, 10)}...`);
    try {
      const erc20Abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)'
      ];
      
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      
      // Use Promise.race for timeout
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
      );
      
      const fetchPromise = Promise.all([
        contract.name().catch(() => ''),
        contract.symbol().catch(() => ''),
        contract.decimals().catch(() => 18),
        contract.totalSupply().catch(() => '0')
      ]);
      
      const [name, symbol, decimals, totalSupply] = await Promise.race([fetchPromise, timeout]);
      
      return {
        name: (name || '').substring(0, 200),
        symbol: (symbol || '').substring(0, 50),
        decimals: Number(decimals),
        totalSupply: totalSupply.toString()
      };
      
    } catch (error) {
      console.log(`      ⚠️ Could not fetch metadata for ${tokenAddress.substring(0, 10)}...: ${error.message}`);
      return {
        name: '',
        symbol: '',
        decimals: 18,
        totalSupply: '0'
      };
    }
  }

  async findCreatorAddress(tokenAddress, aroundBlock) {
    console.log(`      🔍 Looking for creator in blocks ${aroundBlock - 5} to ${aroundBlock + 5}`);
    try {
      const erc20Abi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      
      // Look for mint events with small range due to Alchemy limits
      const fromBlock = Math.max(aroundBlock - 5, 0);
      const toBlock = Math.min(aroundBlock + 5, await this.provider.getBlockNumber());
      
      console.log(`      🔍 Querying Transfer events...`);
      const events = await contract.queryFilter('Transfer', fromBlock, toBlock);
      console.log(`      🔍 Found ${events.length} Transfer events`);
      
      const mintEvent = events.find(e => 
        e.args.from === '0x0000000000000000000000000000000000000000'
      );
      
      if (mintEvent) {
        console.log(`      ✅ Found mint event at tx: ${mintEvent.transactionHash.substring(0, 16)}...`);
        return mintEvent.args.to;
      }
      
      console.log(`      ⚠️ No mint event found, using zero address`);
      return '0x0000000000000000000000000000000000000000';
      
    } catch (error) {
      console.log(`      ⚠️ Error finding creator: ${error.message}`);
      return '0x0000000000000000000000000000000000000000';
    }
  }

  guessPlatform(metadata, dex) {
    const name = (metadata.name || '').toLowerCase();
    const symbol = (metadata.symbol || '').toLowerCase();
    
    // Check for Flaunch patterns
    if (name.includes('flaunch') || symbol.includes('fl') || symbol.includes('fc')) {
      return 'flaunch';
    }
    
    // Check for Mint Club patterns
    if (name.includes('mint') || symbol.includes('mint') || symbol.includes('mt')) {
      return 'mint_club';
    }
    
    // Default to DEX detection
    return `dex_${dex.name}`;
  }

  async stop() {
    this.isRunning = false;
    console.log('\n🛑 DEX Watcher stopped');
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
watcher.start().catch(error => {
  console.error('Failed to start DEX watcher:', error);
  process.exit(1);
});