// indexer/config/index.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // Blockchain
  base: {
    wsUrl: process.env.BASE_WS_URL,
    httpUrl: process.env.BASE_HTTP_URL,
    backupHttpUrl: process.env.BACKUP_BASE_HTTP_URL,
  },
  
  // Factory addresses
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
      factory: process.env.UNISWAP_V3_FACTORY,
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, uint24 fee, int24 tickSpacing, address pool)'
      ]
    },
    aerodrome: {
      factory: process.env.AERODROME_FACTORY,
      startBlock: parseInt(process.env.START_BLOCK || '20000000'),
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, bool stable, address pool, uint256)'
      ]
    }
  },
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000
    }
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL
  },
  
  // Indexer settings
  indexer: {
    blockBatchSize: parseInt(process.env.BLOCK_BATCH_SIZE || '1000'),
    maxBlocksPerRun: parseInt(process.env.MAX_BLOCKS_PER_RUN || '50000'),
    pollInterval: 2000, // ms
    maxRetries: 3
  }
};

// Validate required config
const requiredEnvVars = [
  'BASE_WS_URL',
  'BASE_HTTP_URL',
  'ZORA_FACTORY_ADDRESS',
  'CLANKER_FACTORY_ADDRESS',
  'DATABASE_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('✅ Configuration loaded successfully');