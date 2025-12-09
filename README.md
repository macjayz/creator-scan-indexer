# CreatorScan Base Indexer

Real-time indexer for creator coins on Base blockchain.

## Architecture
- **Factory Watcher**: Monitors Zora and Clanker factory contracts
- **DEX Watcher**: Detects new tokens via Uniswap V3/Aerodrome liquidity events
- **Backend API**: Serves indexed data to frontend
- **Frontend**: Explorer UI for discovering creator coins

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Alchemy API key (for Base RPC)

### 2. Setup
```bash
# Clone and install
git clone <repository>
cd creator-scan-indexer

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start database services
docker-compose up -d

# Install dependencies
npm install

# Initialize database
psql -h localhost -U creator_scan -d creator_scan -f backend/schema.sql