// backend/index.js - ONE SIMPLE API ENDPOINT
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

// ONE SINGLE ENDPOINT: Get all tokens
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
  console.log(`   • GET /api/health - Health check`);
  console.log(`\nTry: curl http://localhost:${port}/api/tokens`);
});
