// indexer/config/index.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  base: {
    wsUrl: process.env.BASE_WS_URL || process.env.BASE_HTTP_URL.replace('https://', 'wss://').replace('http://', 'ws://'),
    httpUrl: process.env.BASE_HTTP_URL,
  },
  
  factories: {
    zora: {
      address: process.env.ZORA_FACTORY_ADDRESS,
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: [
        'event CoinCreated(address indexed token, string name, string symbol, address indexed payoutRecipient)'
      ]
    },
    clanker: {
      address: process.env.CLANKER_FACTORY_ADDRESS,
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: [
        'event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)'
      ]
    }
  },
  
  // DEX addresses
  dex: {
    uniswapV3: {
      factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: ['event PoolCreated(address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing, address pool)']
    },
    aerodrome: {
      factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: ['event PoolCreated(address indexed token0, address indexed token1, bool stable, address pool, uint256)']
    }
  },
  
  // Common base tokens to ignore
  baseTokens: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'  // cbETH
  ],
  
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000
    }
  }
};

console.log('✅ Configuration loaded successfully');
