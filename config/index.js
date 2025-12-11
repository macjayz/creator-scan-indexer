import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  base: {
    wsUrl: process.env.BASE_WS_URL,
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
  
  // ADD THIS DEX CONFIGURATION
  dex: {
    uniswapV3: {
      factory: '0x33128a8fc17869897dce68ed026d694621f6fdfd',
      startBlock: parseInt(process.env.UNISWAP_V3_START_BLOCK || '39255634'),
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing, address pool)'
      ],
      eventName: 'PoolCreated',
      maxBlockRange: 10,
      enabled: true
    },
    aerodrome: {
      factory: '0x420dd381b31aef6683db6b902084cb0ffece40da',
      startBlock: parseInt(process.env.AERODROME_START_BLOCK || '39255634'),
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, address pool)'
      ],
      eventName: 'PoolCreated',
      enabled: false  // Set to true if you want to monitor Aerodrome too
    }
  },
  
  // ADD THIS BASE TOKENS CONFIG
  baseTokens: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', // cbETH
    '0x4ed4e862860bed51a9570b96d89af5e1b0efefed', // DEGEN
    '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'  // BASED
  ],
  
  // ADD THIS ALCHEMY LIMITS CONFIG
  alchemyLimits: {
    maxBlocksPerRequest: 5,
    pollInterval: 45000
  },
  
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000
    }
  }
};