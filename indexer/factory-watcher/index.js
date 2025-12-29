// index.js - Factory Watcher with Zora and Clanker detection
import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { db } from '../utils/database.js';

class FactoryWatcher {
  constructor() {
    this.httpProvider = new ethers.JsonRpcProvider(config.base.httpUrl);
    this.isRunning = false;

    this.lastProcessedBlock = {
      zora: 0,
      clanker: 0
    };

    this.maxBlocksPerRequest = 10;
  }

  async start() {
    console.log('🚀 Starting Factory Watcher...');

    const currentBlock = await this.httpProvider.getBlockNumber();
    const startBlock = currentBlock - 1000;

    this.lastProcessedBlock = {
      zora: startBlock,
      clanker: startBlock
    };

    console.log(`Current Base block: ${currentBlock}`);
    console.log(`Starting from block: ${startBlock}`);
    console.log(`📡 Monitoring:`);
    console.log(`   • Zora Factory: ${config.factories.zora.address}`);
    console.log(`   • Clanker Factory: ${config.factories.clanker.address}`);

    await this.clearOldProgress();

    this.isRunning = true;
    await this.pollForEvents();
    console.log('✅ Factory Watcher is running');
  }

  async clearOldProgress() {
    try {
      console.log('🧹 Clearing old detection events...');
      await db.query(
        `DELETE FROM detection_events 
         WHERE contract_address IN ($1, $2)`,
        [config.factories.zora.address, config.factories.clanker.address]
      );
      console.log('✅ Cleared old progress');
    } catch (error) {
      console.log('Note: Could not clear old progress:', error.message);
    }
  }

  async pollForEvents() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.httpProvider.getBlockNumber();

        await this.processFactoryEvents('zora', config.factories.zora, currentBlock);
        await this.processFactoryEvents('clanker', config.factories.clanker, currentBlock);

        console.log(`⏳ Waiting 30 seconds for next poll...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error('❌ Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  async processFactoryEvents(platform, factory, currentBlock) {
    try {
      const fromBlock = this.lastProcessedBlock[platform];
      const toBlock = Math.min(fromBlock + this.maxBlocksPerRequest - 1, currentBlock);

      if (fromBlock >= toBlock) {
        console.log(`   📭 ${platform}: Already at current block (${fromBlock})`);
        return;
      }

      console.log(`📊 ${platform}: Processing blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);

      let events = [];

      if (platform === 'zora') {
        events = await this.httpProvider.getLogs({
          address: factory.address,
          topics: ['0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81'],
          fromBlock,
          toBlock
        });
      } else if (platform === 'clanker') {
        const contract = new ethers.Contract(factory.address, factory.abi, this.httpProvider);
        events = await contract.queryFilter('TokenCreated', fromBlock, toBlock);
      }

      if (events.length > 0) {
        console.log(`🎯 ${platform}: Found ${events.length} new token(s)!`);
        for (const event of events) {
          if (platform === 'zora') {
            await this.handleZoraLog(event, factory);
          } else if (platform === 'clanker') {
            await this.handleClankerEvent(event, factory);
          }
        }
      } else {
        console.log(`   ${platform}: No new tokens found`);
      }

      this.lastProcessedBlock[platform] = toBlock + 1;
    } catch (error) {
      console.error(`❌ Error processing ${platform}:`, error.message);
    }
  }

  async handleZoraLog(log, factory) {
    try {
      console.log(`\n🔍 Processing Zora log at block ${log.blockNumber}, tx: ${log.transactionHash.substring(0, 16)}...`);
      console.log(`   📊 Data length: ${log.data.length} chars (${log.data.length / 2} bytes)`);

      // Try to decode using contract ABI first
      try {
        const contract = new ethers.Contract(factory.address, factory.abi, this.httpProvider);
        const decodedEvent = contract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (decodedEvent && decodedEvent.name === 'CoinCreated') {
          const tokenAddress = decodedEvent.args.token;
          const creatorAddress = decodedEvent.args.payoutRecipient;
          
          console.log(`   ✅ Successfully decoded event!`);
          console.log(`      Token: ${tokenAddress}`);
          console.log(`      Creator: ${creatorAddress}`);
          
          await this.saveTokenWithErrorHandling({
            success: true,
            tokenAddress,
            name: 'Zora Token',
            symbol: 'ZORA',
            method: 'decoded'
          }, log, factory, creatorAddress);
          return;
        }
      } catch (decodeError) {
        console.log(`   ⚠️ Could not decode with ABI, falling back to raw parsing`);
      }

      // Fall back to raw log parsing
      const data = log.data.substring(2); // Remove 0x
      const creatorAddress = '0x' + log.topics[1].substring(26); // Extract creator

      // Call approaches directly
      const result1 = this.tryApproach1(data, creatorAddress, log);
      if (result1.success) {
        await this.saveTokenWithErrorHandling(result1, log, factory, creatorAddress);
        return;
      }

      const result2 = this.tryApproach2(data, creatorAddress, log);
      if (result2.success) {
        await this.saveTokenWithErrorHandling(result2, log, factory, creatorAddress);
        return;
      }

      const result3 = this.tryApproach3(data, creatorAddress, log);
      if (result3.success) {
        await this.saveTokenWithErrorHandling(result3, log, factory, creatorAddress);
        return;
      }

      console.log(`   ❌ All parsing approaches failed for tx ${log.transactionHash.substring(0, 16)}...`);

    } catch (error) {
      console.error('❌ Error handling Zora log:', error.message);
    }
  }

  tryApproach1(data, creatorAddress, log) {
    try {
      const coinOffsetHex = data.substring(256, 320);
      const coinOffset = parseInt(coinOffsetHex, 16);
      if (isNaN(coinOffset) || coinOffset === 0) return { success: false };

      const coinPosition = coinOffset * 2;
      if (coinPosition + 64 > data.length) return { success: false };

      let tokenAddress = '0x' + data.substring(coinPosition + 24, coinPosition + 64);
      
      // Handle padded addresses
      if (tokenAddress.startsWith('0x000000000000000000000000')) {
        tokenAddress = '0x' + tokenAddress.substring(26); // Remove padding
      }
      
      // Validate address is not garbage (ending with zeros)
      if (tokenAddress.endsWith('0000000000000000') || 
          tokenAddress.endsWith('0000000000000000000000000000000000000000')) {
        return { success: false };
      }
      
      if (!ethers.isAddress(tokenAddress)) return { success: false };

      return { success: true, tokenAddress, name: 'Zora Token', symbol: 'ZORA', method: 'approach1' };
    } catch {
      return { success: false };
    }
  }

  tryApproach2(data, creatorAddress, log) {
    try {
      const addressMatches = data.match(/([0-9a-f]{40})/gi);
      if (!addressMatches) return { success: false };

      for (const match of addressMatches) {
        let potentialAddress = '0x' + match;
        
        // Handle padded addresses
        if (potentialAddress.startsWith('0x000000000000000000000000')) {
          potentialAddress = '0x' + match.substring(24); // Remove padding
        }
        
        // STRICTER VALIDATION: Check if it's a valid address AND not all zeros
        if (ethers.isAddress(potentialAddress) && 
            potentialAddress.toLowerCase() !== creatorAddress.toLowerCase() &&
            !potentialAddress.endsWith('0000000000000000') && // NOT ending with zeros
            !potentialAddress.endsWith('0000000000000000000000000000000000000000') &&
            potentialAddress.length === 42) {
          
          return { success: true, tokenAddress: potentialAddress, name: 'Zora Token', symbol: 'ZORA', method: 'approach2' };
        }
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }

  tryApproach3(data, creatorAddress, log) {
    try {
      const potentialPositions = [64, 128, 192, 256, 320, 384];
      for (const position of potentialPositions) {
        if (position + 64 <= data.length) {
          let potentialAddress = '0x' + data.substring(position + 24, position + 64);
          
          // Handle padded addresses
          if (potentialAddress.startsWith('0x000000000000000000000000')) {
            potentialAddress = '0x' + potentialAddress.substring(26); // Remove padding
          }
          
          // Validate address is not garbage
          if (potentialAddress.endsWith('0000000000000000') || 
              potentialAddress.endsWith('0000000000000000000000000000000000000000')) {
            continue; // Try next position
          }
          
          if (ethers.isAddress(potentialAddress) && potentialAddress.length === 42) {
            return { success: true, tokenAddress: potentialAddress, name: 'Zora Token', symbol: 'ZORA', method: 'approach3' };
          }
        }
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }

  async saveTokenWithErrorHandling(result, log, factory, creatorAddress) {
    try {
      console.log(`   💾 Processing token ${result.tokenAddress.substring(0, 16)}...`);
      
      // Additional validation before saving
      if (result.tokenAddress.length !== 42) {
        console.log(`   ❌ Invalid address length: ${result.tokenAddress.length}`);
        return;
      }
      
      if (!ethers.isAddress(result.tokenAddress)) {
        console.log(`   ❌ Not a valid Ethereum address`);
        return;
      }
      
      // Default values in case metadata fetch fails
      let tokenName = result.name || 'Unknown Token';
      let tokenSymbol = result.symbol || 'UNKNOWN';
      let decimals = 18;
      let totalSupply = '0';
      
      // Try to fetch real ERC20 metadata
      console.log(`   🔍 Fetching real token metadata...`);
      try {
        const erc20Abi = [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ];
        
        const tokenContract = new ethers.Contract(result.tokenAddress, erc20Abi, this.httpProvider);
        
        // Set a timeout for metadata fetch
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Metadata fetch timeout')), 10000)
        );
        
        const metadataPromise = Promise.all([
          tokenContract.name().catch(() => ''),
          tokenContract.symbol().catch(() => ''),
          tokenContract.decimals().catch(() => 18),
          tokenContract.totalSupply().catch(() => '0')
        ]);
        
        const [realName, realSymbol, realDecimals, realTotalSupply] = 
          await Promise.race([metadataPromise, timeout]);
        
        // Use real metadata if available
        if (realName && realName.trim() !== '') {
          tokenName = realName.substring(0, 200);
          console.log(`   ✅ Real name: ${tokenName}`);
        }
        
        if (realSymbol && realSymbol.trim() !== '') {
          tokenSymbol = realSymbol.substring(0, 50);
          console.log(`   ✅ Real symbol: ${tokenSymbol}`);
        }
        
        decimals = Number(realDecimals);
        totalSupply = realTotalSupply.toString();
        
      } catch (metadataError) {
        console.log(`   ⚠️ Could not fetch metadata: ${metadataError.message}`);
        console.log(`   Using default: ${tokenName} (${tokenSymbol})`);
      }
      
      // Save to database with real metadata
      const insertTokenQuery = `
        INSERT INTO tokens (
          address, name, symbol, decimals, total_supply, 
          creator_address, platform, detection_method, detection_block_number, detection_transaction_hash,
          factory_address, created_at, block_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
        ON CONFLICT (address) DO UPDATE SET 
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          decimals = EXCLUDED.decimals,
          total_supply = EXCLUDED.total_supply,
          updated_at = NOW(),
          detection_block_number = EXCLUDED.detection_block_number,
          block_number = EXCLUDED.block_number
        RETURNING id
      `;
  
      const insertValues = [
        result.tokenAddress.toLowerCase(),
        tokenName,
        tokenSymbol,
        decimals,
        totalSupply,
        creatorAddress.toLowerCase(),
        'zora',
        `zora_${result.method}`,
        log.blockNumber,
        log.transactionHash,
        factory.address,
        log.blockNumber
      ];
  
      const dbResult = await db.query(insertTokenQuery, insertValues);
      if (dbResult.rowCount > 0) {
        console.log(`   ✅ Saved: ${tokenSymbol} (${tokenName})`);
      }
    } catch (error) {
      console.error(`   ❌ Error saving token:`, error.message);
    }
  }
}

const watcher = new FactoryWatcher();
watcher.start().catch(error => {
  console.error('FATAL ERROR starting factory watcher:', error);
  process.exit(1);
});