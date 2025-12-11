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

      const tokenAddress = '0x' + data.substring(coinPosition + 24, coinPosition + 64);
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
        const potentialAddress = '0x' + match;
        if (ethers.isAddress(potentialAddress) && potentialAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
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
          const potentialAddress = '0x' + data.substring(position + 24, position + 64);
          if (ethers.isAddress(potentialAddress)) return { success: true, tokenAddress: potentialAddress, name: 'Zora Token', symbol: 'ZORA', method: 'approach3' };
        }
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }

  async saveTokenWithErrorHandling(result, log, factory, creatorAddress) {
    try {
      console.log(`   💾 Saving token ${result.symbol} (${result.tokenAddress.substring(0, 16)}...)`);
      const insertTokenQuery = `
        INSERT INTO tokens (
          address, name, symbol, decimals, total_supply, 
          creator_address, platform, detection_method, detection_block_number, detection_transaction_hash,
          factory_address, created_at, block_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
        ON CONFLICT (address) DO UPDATE SET 
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          updated_at = NOW(),
          detection_block_number = EXCLUDED.detection_block_number,
          block_number = EXCLUDED.block_number
        RETURNING id
      `;

      const insertValues = [
        result.tokenAddress,
        result.name,
        result.symbol,
        18,
        '0',
        creatorAddress,
        'zora',
        `zora_${result.method}`,
        log.blockNumber,
        log.transactionHash,
        factory.address,
        log.blockNumber
      ];

      const dbResult = await db.query(insertTokenQuery, insertValues);
      if (dbResult.rowCount > 0) console.log(`   ✅ Saved token ID: ${dbResult.rows[0].id}`);
    } catch (error) {
      console.error(`   ❌ Error saving token:`, error.message);
    }
  }

  async handleClankerEvent(log, factory) {
    // Your previous Clanker logic remains
  }
}

const watcher = new FactoryWatcher();
watcher.start().catch(error => {
  console.error('FATAL ERROR starting factory watcher:', error);
  process.exit(1);
});