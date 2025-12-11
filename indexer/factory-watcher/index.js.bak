// index.js - Factory Watcher with Zora and Clanker detection
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
      if (platform === 'zora') {
        await this.handleZoraLog(event, factory);
      } else if (platform === 'clanker') {
        console.log(`   🔍 Processing Clanker event...`);
        
        try {
          // The Clanker ABI has 14 parameters
          // event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, 
          //                    address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, 
          //                    string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, 
          //                    uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)
          
          // Extract all args
          const args = event.args;
          
          if (args.length >= 14) {
            // Based on the ABI, parameters are:
            // 0: tokenAddress
            // 1: creatorAdmin
            // 2: interfaceAdmin  
            // 3: creatorRewardRecipient
            // 4: interfaceRewardRecipient
            // 5: positionId
            // 6: name
            // 7: symbol
            // 8: startingTickIfToken0IsNewToken
            // 9: metadata
            // 10: amountTokensBought
            // 11: vaultDuration
            // 12: vaultPercentage
            // 13: msgSender
            
            const tokenAddress = args[0];
            const creatorAddress = args[1]; // creatorAdmin is the creator
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
              event
            });
          } else {
            console.log(`   ⚠️ Clanker event has only ${args.length} args, expected 14`);
            console.log(`   Args: ${JSON.stringify(args)}`);
            
            // Try fallback: first arg is token, second is creator
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

  async handleZoraLog(log, factory) {
    try {
      console.log(`\n🔍 Processing Zora log at block ${log.blockNumber}, tx: ${log.transactionHash.substring(0, 16)}...`);
      
      // Extract creator from topics (payoutRecipient is topics[2])
      const creatorAddress = '0x' + log.topics[2].substring(26);
      
      // Remove '0x' prefix from data for easier parsing
      const data = log.data.substring(2);
      
      console.log(`   📊 Data length: ${data.length} chars (${data.length/2} bytes)`);
      
      // Try Approach 1: The decode-zora-event.js method
      console.log(`   🔍 Trying Approach 1 (decode-zora-event.js method)...`);
      const result1 = this.tryApproach1(data, creatorAddress, log);
      if (result1.success) {
        console.log(`   ✅ Approach 1 succeeded! Token: ${result1.tokenAddress}`);
        await this.saveToken(result1, log, factory, creatorAddress);
        return;
      }
      
      // Try Approach 2: Search for addresses in the data
      console.log(`   🔍 Trying Approach 2 (address search)...`);
      const result2 = this.tryApproach2(data, creatorAddress, log);
      if (result2.success) {
        console.log(`   ✅ Approach 2 succeeded! Token: ${result2.tokenAddress}`);
        await this.saveToken(result2, log, factory, creatorAddress);
        return;
      }
      
      // Try Approach 3: Parse as ABI-encoded with coin as address (not offset)
      console.log(`   🔍 Trying Approach 3 (direct address parsing)...`);
      const result3 = this.tryApproach3(data, creatorAddress, log);
      if (result3.success) {
        console.log(`   ✅ Approach 3 succeeded! Token: ${result3.tokenAddress}`);
        await this.saveToken(result3, log, factory, creatorAddress);
        return;
      }
      
      console.log(`   ❌ All parsing approaches failed for tx ${log.transactionHash.substring(0, 16)}...`);
      
    } catch (error) {
      console.error('❌ Error handling Zora log:', error.message);
    }
  }

  // Approach 1: Based on decode-zora-event.js (the working example)
  tryApproach1(data, creatorAddress, log) {
    try {
      // This is from your working decode-zora-event.js
      // Bytes 128-159 (chars 256-320): offset to coin (token address)
      const coinOffsetHex = data.substring(256, 320);
      const coinOffset = parseInt(coinOffsetHex, 16);
      
      if (isNaN(coinOffset) || coinOffset === 0) {
        return { success: false, error: `Invalid coin offset: ${coinOffsetHex}` };
      }
      
      const coinPosition = coinOffset * 2;
      
      if (coinPosition + 64 > data.length) {
        return { success: false, error: `Coin position ${coinPosition} exceeds data length` };
      }
      
      const tokenAddress = '0x' + data.substring(coinPosition + 24, coinPosition + 64);
      
      if (!ethers.isAddress(tokenAddress)) {
        return { success: false, error: `Invalid address: ${tokenAddress}` };
      }
      
      // Extract name and symbol
      let name = 'Zora Token';
      let symbol = 'ZORA';
      
      try {
        // Name offset is at bytes 64-95 (chars 128-192)
        const nameOffset = parseInt(data.substring(128, 192), 16);
        if (nameOffset > 0) {
          const namePos = nameOffset * 2;
          if (namePos + 64 <= data.length) {
            const nameLength = parseInt(data.substring(namePos, namePos + 64), 16);
            if (nameLength > 0 && namePos + 64 + (nameLength * 2) <= data.length) {
              const nameHex = data.substring(namePos + 64, namePos + 64 + (nameLength * 2));
              name = Buffer.from(nameHex, 'hex').toString('utf-8').replace(/\0/g, '').trim().substring(0, 200);
            }
          }
        }
      } catch (e) { /* Ignore */ }
      
      try {
        // Symbol offset is at bytes 96-127 (chars 192-256)
        const symbolOffset = parseInt(data.substring(192, 256), 16);
        if (symbolOffset > 0) {
          const symbolPos = symbolOffset * 2;
          if (symbolPos + 64 <= data.length) {
            const symbolLength = parseInt(data.substring(symbolPos, symbolPos + 64), 16);
            if (symbolLength > 0 && symbolPos + 64 + (symbolLength * 2) <= data.length) {
              const symbolHex = data.substring(symbolPos + 64, symbolPos + 64 + (symbolLength * 2));
              symbol = Buffer.from(symbolHex, 'hex').toString('utf-8').replace(/\0/g, '').trim().substring(0, 20);
            }
          }
        }
      } catch (e) { /* Ignore */ }
      
      return {
        success: true,
        tokenAddress,
        name,
        symbol,
        method: 'approach1'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Approach 2: Search for addresses AND extract names/symbols
  tryApproach2(data, creatorAddress, log) {
    try {
      // First, try to extract name and symbol from offsets (like decode-zora-event.js)
      let name = 'Unnamed Token';
      let symbol = 'No symbol';
      
      // Parse offsets from fixed data portion
      const nameOffset = parseInt(data.substring(128, 192), 16);
      const symbolOffset = parseInt(data.substring(192, 256), 16);
      
      // Extract name
      if (nameOffset > 0) {
        const namePos = nameOffset * 2;
        if (namePos + 64 <= data.length) {
          const nameLength = parseInt(data.substring(namePos, namePos + 64), 16);
          if (nameLength > 0 && namePos + 64 + (nameLength * 2) <= data.length) {
            const nameHex = data.substring(namePos + 64, namePos + 64 + (nameLength * 2));
            name = Buffer.from(nameHex, 'hex').toString('utf-8').replace(/[^\x20-\x7E]/g, '').trim();
          }
        }
      }
      
      // Extract symbol
      if (symbolOffset > 0) {
        const symbolPos = symbolOffset * 2;
        if (symbolPos + 64 <= data.length) {
          const symbolLength = parseInt(data.substring(symbolPos, symbolPos + 64), 16);
          if (symbolLength > 0 && symbolPos + 64 + (symbolLength * 2) <= data.length) {
            const symbolHex = data.substring(symbolPos + 64, symbolPos + 64 + (symbolLength * 2));
            symbol = Buffer.from(symbolHex, 'hex').toString('utf-8').replace(/[^\x20-\x7E]/g, '').trim();
          }
        }
      }
      
      // Clean up
      name = name.substring(0, 200) || 'Unnamed Token';
      symbol = symbol.substring(0, 20) || 'No symbol';
      
      console.log(`   📝 Extracted name/symbol: "${name}" (${symbol})`);
      
      // Now search for token address (same as before)
      const addresses = [];
      
      for (let i = 320; i <= data.length - 64; i += 64) {
        const chunk = data.substring(i, i + 64);
        if (chunk.startsWith('000000000000000000000000')) {
          const addr = '0x' + chunk.substring(24);
          if (ethers.isAddress(addr) && addr !== ethers.ZeroAddress) {
            addresses.push({
              address: addr,
              position: i
            });
          }
        }
      }
      
      if (addresses.length === 0) {
        return { success: false, error: 'No addresses found in data' };
      }
      
      // Try to pick the most likely token address
      const likelyAddresses = addresses.filter(addr => 
        addr.address.toLowerCase() !== creatorAddress.toLowerCase()
      );
      
      if (likelyAddresses.length === 0) {
        return { success: false, error: 'Only found creator address in data' };
      }
      
      // Take the first likely address as the token address
      const tokenAddress = likelyAddresses[0].address;
      
      return {
        success: true,
        tokenAddress,
        name,
        symbol,
        method: 'approach2'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Approach 3: Parse assuming coin is a regular address parameter
  tryApproach3(data, creatorAddress, log) {
    try {
      // If coin is a regular address (not dynamic), it should be at a fixed position
      // After: currency (32 bytes) + uri offset (32) + name offset (32) + symbol offset (32)
      // That's position 128 bytes = 256 hex chars
      
      const coinChunk = data.substring(256, 320);
      
      if (!coinChunk.startsWith('000000000000000000000000')) {
        return { success: false, error: `Coin chunk doesn't look like address: ${coinChunk}` };
      }
      
      const tokenAddress = '0x' + coinChunk.substring(24);
      
      if (!ethers.isAddress(tokenAddress)) {
        return { success: false, error: `Invalid address: ${tokenAddress}` };
      }
      
      return {
        success: true,
        tokenAddress,
        name: 'Zora Token',
        symbol: 'ZORA',
        method: 'approach3'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveToken(result, log, factory, creatorAddress) {
    try {
      console.log(`   💾 Saving token ${result.symbol} (${result.tokenAddress.substring(0, 10)}...)`);
      
      await db.insertToken({
        address: result.tokenAddress,
        name: result.name,
        symbol: result.symbol,
        decimals: 18,
        totalSupply: '0',
        creatorAddress: creatorAddress,
        detectionMethod: 'zora_factory',
        detectionBlockNumber: log.blockNumber,
        detectionTransactionHash: log.transactionHash,
        platform: 'zora',
        factoryAddress: factory.address,
        status: 'detected'
      });
      
      await db.insertDetectionEvent({
        eventType: 'zora_factory',
        contractAddress: factory.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index,
        rawData: {
          tokenAddress: result.tokenAddress,
          name: result.name,
          symbol: result.symbol,
          creatorAddress,
          parsingMethod: result.method
        }
      });
      
      console.log(`   ✅ Successfully indexed via ${result.method}!`);
    } catch (error) {
      console.error(`   ❌ Failed to save token: ${error.message}`);
    }
  }

  async processToken(data) {
    try {
      const { tokenAddress, name, symbol, creatorAddress, platform, factory, event } = data;
      
      const tokenMetadata = await this.fetchTokenMetadata(tokenAddress);
      
      await db.insertToken({
        address: tokenAddress,
        name: name || tokenMetadata.name,
        symbol: symbol || tokenMetadata.symbol,
        decimals: tokenMetadata.decimals,
        totalSupply: tokenMetadata.totalSupply,
        creatorAddress: creatorAddress,
        detectionMethod: `${platform}_factory`,
        detectionBlockNumber: event.blockNumber,
        detectionTransactionHash: event.transactionHash,
        platform: platform,
        factoryAddress: factory.address,
        status: 'detected'
      });

      console.log(`   ✅ Indexed: ${symbol} at ${tokenAddress.substring(0, 10)}...`);
      
    } catch (error) {
      console.error(`❌ Error processing token:`, error.message);
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
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.httpProvider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name().catch(() => ''),
        tokenContract.symbol().catch(() => ''),
        tokenContract.decimals().catch(() => 18),
        tokenContract.totalSupply().catch(() => '0')
      ]);

      return {
        name: name.substring(0, 200),
        symbol: symbol.substring(0, 20),
        decimals: Number(decimals),
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      console.error(`Failed to fetch metadata for ${tokenAddress}:`, error.message);
      return {
        name: '',
        symbol: '',
        decimals: 18,
        totalSupply: '0'
      };
    }
  }

  async stop() {
    this.isRunning = false;
    await db.close();
    console.log('🛑 Factory Watcher stopped');
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
