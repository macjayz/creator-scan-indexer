-- scripts/init-full-schema.sql
-- Complete database schema for CreatorScan

-- Drop existing tables (if you want fresh start)
-- DROP TABLE IF EXISTS price_history, detection_events, creator_profiles, token_metrics, tokens;

-- Create enum types
DO $$ BEGIN
    CREATE TYPE detection_method AS ENUM (
        'zora_factory',
        'clanker_factory', 
        'uniswap_v3_pool',
        'uniswap_v4_pool',
        'aerodrome_pool',
        'manual'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE token_status AS ENUM (
        'detected',
        'indexed',
        'active',
        'inactive',
        'flagged'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255),
    symbol VARCHAR(50),
    decimals INTEGER,
    total_supply NUMERIC(78, 0),
    creator_address VARCHAR(42),
    
    -- Detection info
    detection_method detection_method NOT NULL,
    detection_block_number BIGINT NOT NULL,
    detection_transaction_hash VARCHAR(66),
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Platform identification
    platform VARCHAR(50),
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(address);
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_address);
CREATE INDEX IF NOT EXISTS idx_tokens_detection_time ON tokens(detection_timestamp);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_platform ON tokens(platform);

-- Token metrics table
CREATE TABLE IF NOT EXISTS token_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) REFERENCES tokens(address) ON DELETE CASCADE,
    
    price_eth NUMERIC(30, 18),
    price_usd NUMERIC(30, 6),
    
    liquidity_eth NUMERIC(30, 18),
    liquidity_usd NUMERIC(30, 6),
    
    volume_24h_eth NUMERIC(30, 18),
    volume_24h_usd NUMERIC(30, 6),
    
    holder_count INTEGER DEFAULT 0,
    
    primary_pool_address VARCHAR(42),
    dex_name VARCHAR(50),
    
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(token_address, captured_at)
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(42) REFERENCES tokens(address) ON DELETE CASCADE,
    price_eth NUMERIC(30, 18),
    price_usd NUMERIC(30, 6),
    liquidity_eth NUMERIC(30, 18),
    volume_24h_eth NUMERIC(30, 18),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_token_time ON price_history(token_address, timestamp);

-- Detection events log
CREATE TABLE IF NOT EXISTS detection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    contract_address VARCHAR(42),
    block_number BIGINT,
    transaction_hash VARCHAR(66),
    log_index INTEGER,
    raw_data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creator profiles
CREATE TABLE IF NOT EXISTS creator_profiles (
    address VARCHAR(42) PRIMARY KEY,
    farcaster_handle VARCHAR(100),
    farcaster_fid BIGINT,
    twitter_handle VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update trigger for tokens table
DROP TRIGGER IF EXISTS update_tokens_updated_at ON tokens;
CREATE TRIGGER update_tokens_updated_at 
    BEFORE UPDATE ON tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test data
INSERT INTO tokens (address, name, symbol, creator_address, detection_method, detection_block_number, platform, status) 
VALUES 
    ('0xc5102fe9359fd9a28f877a67e36b0f050d81a3cc', 'Hop', 'HOP', '0x1234567890123456789012345678901234567890', 'zora_factory', 20000000, 'zora', 'active'),
    ('0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', 'Coinbase Wrapped Staked ETH', 'cbETH', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'uniswap_v3_pool', 20000100, 'unknown', 'active')
ON CONFLICT (address) DO NOTHING;