# Create config directory and file
mkdir -p indexer/config
cat > indexer/config/index.js << 'EOF'
// indexer/config/index.js
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
  
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000
    }
  }
};
EOF