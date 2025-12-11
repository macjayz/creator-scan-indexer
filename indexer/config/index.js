import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  base: {
    httpUrl: process.env.BASE_HTTP_URL || 'https://mainnet.base.org'
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://creator_scan:local_password@localhost:5433/creator_scan'
  },
  
  factories: {
    zora: {
      address: process.env.ZORA_FACTORY_ADDRESS || '0x777777751622c0d3258f214f9df38e35bf45baf3',
      startBlock: parseInt(process.env.ZORA_START_BLOCK || process.env.START_BLOCK || '39330769'),
      abi: [
        'event CoinCreatedV4(address indexed caller, address indexed payoutRecipient, address indexed platformReferrer, address currency, string uri, string name, string symbol, address coin, tuple poolKey, bytes32 poolKeyHash, string version)'
      ]
    },
    
    clanker: {
      address: process.env.CLANKER_FACTORY_ADDRESS || '0x2a787b2362021cc3eea3c24c4748a6cd5b687382',
      startBlock: parseInt(process.env.CLANKER_START_BLOCK || '39330769'),
      abi: [
        'event TokenCreated(address indexed tokenAddress, address indexed creatorAdmin, address indexed interfaceAdmin, address creatorRewardRecipient, address interfaceRewardRecipient, uint256 positionId, string name, string symbol, int24 startingTickIfToken0IsNewToken, string metadata, uint256 amountTokensBought, uint256 vaultDuration, uint8 vaultPercentage, address msgSender)'
      ]
    }
  },
  
  // DEX monitoring configuration - UPDATED
  dex: {
    uniswapV3: {
      factory: '0x33128a8fc17869897dce68ed026d694621f6fdfd', // Base Uniswap V3 (verified)
      startBlock: parseInt(process.env.UNISWAP_V3_START_BLOCK || '39305106'), // More recent due to Alchemy limits
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'
      ],
      name: 'uniswap_v3',
      eventName: "PoolCreated",
      maxBlockRange: 10 // Alchemy free tier limit
    },
    
    aerodrome: {
      // Temporary - using Uniswap V3 only for now
      factory: '0x0000000000000000000000000000000000000000', // Placeholder
      startBlock: parseInt(process.env.AERODROME_START_BLOCK || '39250000'),
      abi: [
        'event PoolCreated(address indexed token0, address indexed token1, address pool)'
      ],
      name: 'aerodrome',
      enabled: false // Disabled until we find correct address
    }
  },
  
  // Base/common tokens to ignore (WETH, USDC, etc.)
  baseTokens: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', // cbETH
    '0x4ed4e862860bed51a9570b96d89af5e1b0efefed', // DEGEN
    '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'  // BASED
  ],
  
  // Alchemy free tier limitations
  alchemyLimits: {
    maxBlockRange: 10, // Maximum blocks per eth_getLogs call
    maxBlocksPerRequest: 5, // Reduced for safety
    pollInterval: 45000 // 45 seconds between polls
  }
};

console.log('✅ Configuration loaded successfully');