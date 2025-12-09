// backend/index.js - TWO ENDPOINTS NOW
import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// Helper: Validate Ethereum address
function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ENDPOINT 1: Get all tokens
app.get('/api/tokens', async (req, res) => {
  try {
    const { limit = 50, offset = 0, platform } = req.query;
    
    let query = `
      SELECT 
        address,
        name,
        symbol,
        decimals,
        total_supply,
        creator_address,
        platform,
        detection_method,
        detection_timestamp,
        status,
        created_at
      FROM tokens
    `;
    
    const params = [];
    
    if (platform) {
      query += ` WHERE platform = $${params.length + 1}`;
      params.push(platform);
    }
    
    query += ` ORDER BY detection_timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      tokens: result.rows
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ENDPOINT 2: Get single token by address
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!isValidEthAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    // Get token details
    const tokenQuery = `
      SELECT 
        address,
        name,
        symbol,
        decimals,
        total_supply,
        creator_address,
        platform,
        detection_method,
        detection_block_number,
        detection_transaction_hash,
        detection_timestamp,
        factory_address,
        status,
        is_verified,
        metadata_uri,
        image_url,
        created_at,
        updated_at
      FROM tokens 
      WHERE address = $1
    `;
    
    const tokenResult = await pool.query(tokenQuery, [address.toLowerCase()]);
    
    if (tokenResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }
    
    const token = tokenResult.rows[0];
    
    // Get latest metrics if available
    const metricsQuery = `
      SELECT 
        price_eth,
        price_usd,
        liquidity_eth,
        liquidity_usd,
        volume_24h_eth,
        volume_24h_usd,
        holder_count,
        primary_pool_address,
        dex_name,
        captured_at
      FROM token_metrics 
      WHERE token_address = $1 
      ORDER BY captured_at DESC 
      LIMIT 1
    `;
    
    const metricsResult = await pool.query(metricsQuery, [address.toLowerCase()]);
    const metrics = metricsResult.rows[0] || null;
    
    // Get creator profile if available
    const creatorQuery = `
      SELECT 
        farcaster_handle,
        farcaster_fid,
        twitter_handle,
        avatar_url,
        bio
      FROM creator_profiles 
      WHERE address = $1
    `;
    
    const creatorResult = await pool.query(creatorQuery, [token.creator_address]);
    const creator = creatorResult.rows[0] || null;
    
    res.json({
      success: true,
      token: {
        ...token,
        metrics,
        creator
      }
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`📡 Endpoints:`);
  console.log(`   • GET /api/tokens - List all tokens`);
  console.log(`   • GET /api/tokens/:address - Get token details`);
  console.log(`   • GET /api/health - Health check`);
  console.log(`\nExamples:`);
  console.log(`   curl http://localhost:${port}/api/tokens`);
  console.log(`   curl http://localhost:${port}/api/tokens/0x1234567890abcdef1234567890abcdef12345678`);
});
