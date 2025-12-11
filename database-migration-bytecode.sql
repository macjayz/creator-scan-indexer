-- Migration 002: Add bytecode scanning tables
-- Run this in your PostgreSQL database

-- 1. Create bytecode_scans table
CREATE TABLE IF NOT EXISTS bytecode_scans (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(42) UNIQUE NOT NULL,
    creator_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    bytecode_hash VARCHAR(66) NOT NULL,
    bytecode_length INTEGER NOT NULL,
    is_erc20 BOOLEAN NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    implementation_type VARCHAR(50),
    features JSONB,
    constructor_args JSONB,
    warnings TEXT[],
    scan_timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_address ON bytecode_scans(contract_address);
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_erc20 ON bytecode_scans(is_erc20);
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_creator ON bytecode_scans(creator_address);
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_block ON bytecode_scans(block_number);
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_type ON bytecode_scans(implementation_type);
CREATE INDEX IF NOT EXISTS idx_bytecode_scans_timestamp ON bytecode_scans(scan_timestamp);

-- 3. Update tokens table to include detection_method if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tokens' AND column_name = 'detection_method') THEN
        ALTER TABLE tokens ADD COLUMN detection_method VARCHAR(50);
    END IF;
END $$;

-- 4. Set detection_method for existing tokens
UPDATE tokens SET detection_method = 'zora_factory' WHERE platform = 'zora' AND detection_method IS NULL;
UPDATE tokens SET detection_method = 'clanker_factory' WHERE platform = 'clanker' AND detection_method IS NULL;
UPDATE tokens SET detection_method = 'dex_uniswap_v3' WHERE platform LIKE '%dex%' AND detection_method IS NULL;

-- 5. Add comment to table
COMMENT ON TABLE bytecode_scans IS 'Stores results of ERC-20 bytecode signature scanning';
COMMENT ON COLUMN bytecode_scans.confidence_score IS 'Confidence score from 0.0 to 1.0';
COMMENT ON COLUMN bytecode_scans.implementation_type IS 'Type of implementation (openzeppelin, solmate, proxy, custom)';

-- 6. Create view for easy ERC-20 detection stats
CREATE OR REPLACE VIEW bytecode_stats AS
SELECT 
    DATE(scan_timestamp) as scan_date,
    COUNT(*) as total_scans,
    COUNT(CASE WHEN is_erc20 THEN 1 END) as erc20_detected,
    ROUND(COUNT(CASE WHEN is_erc20 THEN 1 END) * 100.0 / COUNT(*), 2) as detection_rate,
    AVG(CASE WHEN is_erc20 THEN confidence_score END) as avg_confidence
FROM bytecode_scans
GROUP BY DATE(scan_timestamp)
ORDER BY scan_date DESC;

-- Success message
SELECT '✅ Bytecode scanning database migration completed successfully!' as message;
