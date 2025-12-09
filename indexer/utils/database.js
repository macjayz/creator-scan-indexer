// indexer/utils/database.js
import pg from 'pg';
const { Pool } = pg;
import { config } from '../config/index.js';

export class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      ...config.database.pool
    });
    
    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);
      return res;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  }

  async insertToken(tokenData) {
    const query = `
      INSERT INTO tokens (
        address, name, symbol, decimals, total_supply, creator_address,
        detection_method, detection_block_number, detection_transaction_hash,
        platform, factory_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (address) 
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, tokens.name),
        symbol = COALESCE(EXCLUDED.symbol, tokens.symbol),
        updated_at = NOW()
      RETURNING id
    `;

    const values = [
      tokenData.address,
      tokenData.name,
      tokenData.symbol,
      tokenData.decimals,
      tokenData.totalSupply,
      tokenData.creatorAddress,
      tokenData.detectionMethod,
      tokenData.detectionBlockNumber,
      tokenData.detectionTransactionHash,
      tokenData.platform,
      tokenData.factoryAddress,
      tokenData.status || 'detected'
    ];

    return this.query(query, values);
  }

  async insertDetectionEvent(eventData) {
    const query = `
      INSERT INTO detection_events (
        event_type, contract_address, block_number, 
        transaction_hash, log_index, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [
      eventData.eventType,
      eventData.contractAddress,
      eventData.blockNumber,
      eventData.transactionHash,
      eventData.logIndex,
      JSON.stringify(eventData.rawData)
    ];

    return this.query(query, values);
  }

  async close() {
    await this.pool.end();
  }
}

// Singleton instance
export const db = new Database();
