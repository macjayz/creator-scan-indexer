-- Drop and recreate database
DROP DATABASE IF EXISTS creator_scan;
CREATE DATABASE creator_scan;

\c creator_scan;

-- Enum for detection methods
CREATE TYPE detection_method AS ENUM (
    'zora_factory',
    'clanker_factory', 
    'uniswap_v3_pool',
    'uniswap_v4_pool',
    'aerodrome_pool',
    'manual'
);

-- Enum for token status
CREATE TYPE token_status AS ENUM (
    'detected',      -- Just detected, no metadata yet
    'indexed',       -- Metadata fetched
    'active',        -- Has liquidity
    'inactive',      -- No liquidity
    'flagged'        -- Potential scam
);

-- Main tokens table
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) UNIQUE NOT NULL, -- 0x...
    name VARCHAR(255),
    symbol VARCHAR(50),
    decimals INTEGER,
    total_supply NUMERIC(78, 0), -- Supports up to 256-bit numbers
    creator_address VARCHAR(42),
    
    -- Detection info
    detection_method detection_method NOT NULL,
    detection_block_number BIGINT NOT NULL,
    detection_transaction_hash VARCHAR(66),
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Platform identification
    platform VARCHAR(50), -- 'zora', 'clanker', 'flaunch', 'mint_club', 'unknown'
    factory_address VARCHAR(42),
    
    -- Status
    status token_status DEFAULT 'detected',
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata_uri TEXT,
    image_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tokens_address ON tokens(address);
CREATE INDEX idx_tokens_creator ON tokens(creator_address);
CREATE INDEX idx_tokens_detection_time ON tokens(detection_timestamp);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_platform ON tokens(platform);

-- Token prices and liquidity (updated regularly)
CREATE TABLE token_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) REFERENCES tokens(address) ON DELETE CASCADE,
    
    -- Price data
    price_eth NUMERIC(30, 18),
    price_usd NUMERIC(30, 6),
    
    -- Liquidity
    liquidity_eth NUMERIC(30, 18),
    liquidity_usd NUMERIC(30, 6),
    
    -- Volume
    volume_24h_eth NUMERIC(30, 18),
    volume_24h_usd NUMERIC(30, 6),
    
    -- Holder data
    holder_count INTEGER DEFAULT 0,
    
    -- Pool info
    primary_pool_address VARCHAR(42),
    dex_name VARCHAR(50), -- 'uniswap_v3', 'aerodrome', etc
    
    -- Timestamp
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(token_address, captured_at)
);

-- Price history (time-series)
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) REFERENCES tokens(address) ON DELETE CASCADE,
    price_eth NUMERIC(30, 18),
    price_usd NUMERIC(30, 6),
    liquidity_eth NUMERIC(30, 18),
    volume_24h_eth NUMERIC(30, 18),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_history_token_time ON price_history(token_address, timestamp);

-- Detection events log (for debugging and analytics)
CREATE TABLE detection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'factory_event', 'pool_created', 'swap'
    contract_address VARCHAR(42),
    block_number BIGINT,
    transaction_hash VARCHAR(66),
    log_index INTEGER,
    raw_data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creator profiles
CREATE TABLE creator_profiles (
    address VARCHAR(42) PRIMARY KEY,
    farcaster_handle VARCHAR(100),
    farcaster_fid BIGINT,
    twitter_handle VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tokens_updated_at 
    BEFORE UPDATE ON tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();