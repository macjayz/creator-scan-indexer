import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://creator_scan:local_password@localhost:5433/creator_scan',
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

/* ----------------------------------------------------------
   NEW ENDPOINT ADDED
   /api/platforms → Returns the platform list + token counts
------------------------------------------------------------- */
app.get('/api/platforms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT platform, COUNT(*) as count
      FROM tokens
      GROUP BY platform
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      platforms: result.rows,
    });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all tokens with filters
app.get('/api/tokens', async (req, res) => {
  try {
    const {
      platform,
      search,
      limit = 200,
      offset = 0,
      sort = 'detection_timestamp',
      order = 'DESC',
    } = req.query;

    let query = 'SELECT * FROM tokens WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Platform filter
    if (platform) {
      paramCount++;
      if (platform === 'dex') {
        query += ` AND platform LIKE $${paramCount}`;
        params.push('dex%');
      } else {
        query += ` AND platform = $${paramCount}`;
        params.push(platform);
      }
    }

    // Search filter
    if (search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR 
        symbol ILIKE $${paramCount} OR 
        address ILIKE $${paramCount} OR
        creator_address ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add sorting and pagination
    paramCount++;
    query += ` ORDER BY ${sort} ${order} LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    if (offset > 0) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset));
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      tokens: result.rows,
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get token by address (full JSON)
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await pool.query(
      'SELECT * FROM tokens WHERE address = $1',
      [address.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
      });
    }

    res.json({
      success: true,
      token: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get platform statistics
app.get('/api/stats', async (req, res) => {
  try {
    const platformStats = await pool.query(`
      SELECT 
        platform,
        COUNT(*) as count
      FROM tokens
      GROUP BY platform
      ORDER BY count DESC
    `);

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM tokens'
    );
    const total = parseInt(totalResult.rows[0].total);

    const recentResult = await pool.query(`
      SELECT COUNT(*) as recent 
      FROM tokens 
      WHERE detection_timestamp > NOW() - INTERVAL '24 hours'
    `);
    const recent24h = parseInt(recentResult.rows[0].recent);

    res.json({
      success: true,
      total,
      recent24h,
      platforms: platformStats.rows,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get detection events
app.get('/api/events', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(
      `SELECT * FROM detection_events 
       ORDER BY block_number DESC, log_index DESC 
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      count: result.rows.length,
      events: result.rows,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Duplicate endpoint (kept minimal for compatibility)
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await pool.query(
      'SELECT * FROM tokens WHERE address = $1',
      [address.toLowerCase()]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Token not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Backend API running on http://localhost:${port}`);
});