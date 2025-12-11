// index.js - Factory Watcher with UI deployer tracking
import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

class FactoryWatcher {
  constructor() {
    this.httpProvider = new ethers.JsonRpcProvider(config.base.httpUrl);
    this.isRunning = false;
    this.lastProcessedBlock = {
      zora: config.factories.zora.startBlock,
      clanker: config.factories.clanker.startBlock
    };
    this.maxBlocksPerRequest = 10;
  }

  async start() {
    console.log('🚀 Starting Factory Watcher...');
    console.log(`📡 Monitoring:`);
    console.log(`   • Zora Factory: ${config.factories.zora.address}`);
    console.log(`   • Clanker Factory: ${config.factories.clanker.address}`);
    
    this.isRunning = true;
    await this.pollForEvents();
    console.log('✅ Factory Watcher is running');
  }

  async pollForEvents() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.httpProvider.getBlockNumber();
        
        // Process each factory
        for (const [platform, factory] of Object.entries(config.factories)) {
          await this.processFactoryEvents(platform, factory, currentBlock);
        }
        
        console.log('⏳ Waiting 30 seconds for next poll...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } catch (error) {
        console.error('Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  async processFactoryEvents(platform, factory, currentBlock) {
    try {
      const fromBlock = this.lastProcessedBlock[platform];
      const toBlock = Math.min(fromBlock + this.maxBlocksPerRequest - 1, currentBlock);
      
      if (fromBlock >= toBlock) {
        return;
      }
      
      console.log(`📊 ${platform}: Processing blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);
      
      let events = [];
      
      if (platform === 'zora') {
        events = await this.httpProvider.getLogs({
          address: factory.address,
          topics: ['0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81'],
          fromBlock: fromBlock,
          toBlock: toBlock
        });
      } else if (platform === 'clanker') {
        const contract = new ethers.Contract(factory.address, factory.abi, this.httpProvider);
        events = await contract.queryFilter('TokenCreated', fromBlock, toBlock);
      }
      
      if (events.length > 0) {
        console.log(`🎯 ${platform}: Found ${events.length} new token(s)!`);
        
        for (const event of events) {
          await this.handleEvent(platform, factory, event);
        }
      } else {
        console.log(`   ${platform}: No new tokens found`);
      }
      
      this.lastProcessedBlock[platform] = toBlock + 1;
      
    } catch (error) {
      console.error(`Error processing ${platform} events:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  async handleEvent(platform, factory, event) {
    try {
      // Get transaction sender (UI deployer)
      const tx = await this.httpProvider.getTransaction(event.transactionHash);
      const uiDeployer = tx?.from || '0x0000000000000000000000000000000000000000';
      
      console.log(`   📝 UI Deployer: ${uiDeployer.substring(0, 10)}...`);
      
      if (platform === 'zora') {
        await this.handleZoraLog(event, factory, uiDeployer);
      } else if (platform === 'clanker') {
        console.log(`   🔍 Processing Clanker event...`);
        
        try {
          const args = event.args;
          
          if (args.length >= 14) {
            const tokenAddress = args[0];
            const creatorAddress = args[1];
            const name = args[6];
            const symbol = args[7];
            
            console.log(`   🆕 Clanker: ${symbol} (${name}) by ${creatorAddress.substring(0, 10)}...`);
            
            await this.processToken({
              tokenAddress,
              name,
              symbol,
              creatorAddress,
              platform,
              factory,
              uiDeployer,
              event
            });
          } else {
            console.log(`   ⚠️ Clanker event has only ${args.length} args, expected 14`);
            
            if (args.length >= 2) {
              const tokenAddress = args[0];
              const creatorAddress = args[1];
              const name = args[6] || 'Clanker Token';
              const symbol = args[7] || 'CLANKER';
              
              console.log(`   🆕 Clanker (fallback): ${symbol} at ${tokenAddress.substring(0, 10)}...`);
              
              await this.processToken({
                tokenAddress,
                name,
                symbol,
                creatorAddress,
                platform,
                factory,
                uiDeployer,
                event
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error handling Clanker event: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error handling ${platform} event:`, error.message);
    }
  }

  async handleZoraLog(log, factory, uiDeployer) {
    try {
      console.log(`\n🔍 Processing Zora log at block ${log.blockNumber}, tx: ${log.transactionHash.substring(0, 16)}...`);
      
      const creatorAddress = '0x' + log.topics[2].substring(26);
      const data = log.data.substring(2);
      
      console.log(`   📊 Data length: ${data.length} chars (${data.length/2} bytes)`);
      
      // Try different parsing approaches
      const approaches = [
        this.tryApproach1.bind(this),
        this.tryApproach2.bind(this),
        this.tryApproach3.bind(this)
      ];
      
      for (let i = 0; i < approaches.length; i++) {
        console.log(`   🔍 Trying Approach ${i + 1}...`);
        const result = approaches[i](data, creatorAddress, log);
        
        if (result.success) {
          console.log(`   ✅ Approach ${i + 1} succeeded! Token: ${result.tokenAddress}`);
          await this.saveToken(result, log, factory, creatorAddress, uiDeployer);
          return;
        }
      }
      
      console.log(`   ❌ All parsing approaches failed for tx ${log.transactionHash.substring(0, 16)}...`);
      
    } catch (error) {
      console.error('❌ Error handling Zora log:', error.message);
    }
  }

  // [Keep all the tryApproach1, tryApproach2, tryApproach3 methods exactly as they are]
  // ... (copy from original file)

  async saveToken(result, log, factory, creatorAddress, uiDeployer) {
    try {
      const metadata = await this.fetchTokenMetadata(result.tokenAddress);
      
      await db.query(
        `INSERT INTO tokens 
         (address, name, symbol, decimals, total_supply, creator_address,
          detection_method, detection_block_number, detection_transaction_hash,
          platform, factory_address, ui_deployer, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          result.tokenAddress.toLowerCase(),
          result.name || 'Unknown',
          result.symbol || 'UNKNOWN',
          metadata.decimals || 18,
          metadata.totalSupply || '0',
          creatorAddress.toLowerCase(),
          'zora_factory',
          log.blockNumber,
          log.transactionHash,
          'zora',
          factory.address.toLowerCase(),
          uiDeployer.toLowerCase(),
          'detected'
        ]
      );

      console.log(`   ✅ Successfully indexed via ${result.method}!`);
      console.log(`   🎯 UI Deployer saved: ${uiDeployer.substring(0, 10)}...`);
      
    } catch (error) {
      console.error('❌ Error saving token:', error.message);
    }
  }

  async processToken({ tokenAddress, name, symbol, creatorAddress, platform, factory, uiDeployer, event }) {
    try {
      console.log(`   💾 Saving token ${symbol} (${tokenAddress.substring(0, 10)}...)`);
      
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      
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
          metadata.decimals || 18,
          metadata.totalSupply || '0',
          creatorAddress.toLowerCase(),
          `${platform}_factory`,
          event.blockNumber,
          event.transactionHash,
          platform,
          factory.address.toLowerCase(),
          uiDeployer.toLowerCase(),
          'detected'
        ]
      );

      console.log(`   ✅ Indexed: ${symbol} at ${tokenAddress.substring(0, 10)}...`);
      console.log(`   🎯 UI Deployer: ${uiDeployer.substring(0, 10)}...`);
      
    } catch (error) {
      console.error('❌ Error processing token:', error.message);
    }
  }

  async fetchTokenMetadata(tokenAddress) {
    try {
      const erc20Abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)'
      ];
      
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.httpProvider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => ''),
        contract.symbol().catch(() => ''),
        contract.decimals().catch(() => 18),
        contract.totalSupply().catch(() => '0')
      ]);
      
      return {
        name: name || '',
        symbol: symbol || '',
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

  // [Copy all the tryApproach methods from the original file]
  tryApproach1(data, creatorAddress, log) {
    // ... copy from original ...
  }

  tryApproach2(data, creatorAddress, log) {
    // ... copy from original ...
  }

  tryApproach3(data, creatorAddress, log) {
    // ... copy from original ...
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Stopping Factory Watcher...');
  await watcher.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Stopping Factory Watcher...');
  await watcher.stop();
  process.exit(0);
});

// Start the watcher
const watcher = new FactoryWatcher();
watcher.start().catch(console.error);
