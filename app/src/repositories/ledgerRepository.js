const crypto = require('crypto');
const { query } = require('../db/pool');

class LedgerRepository {
  /**
   * Compute SHA-256 hash
   */
  static calculateHash(previousHash, payload, timestamp) {
    const dataString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const content = previousHash + dataString + timestamp;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get latest block in the ledger
   */
  async getLatestBlock(client = null, forUpdate = false) {
    const sql = `
      SELECT id, block_index, event_type, entity_type, entity_id, payload, previous_hash, hash, created_at
      FROM ledger_entries
      ORDER BY block_index DESC
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `;
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows[0] || null;
  }

  /**
   * Append a new block to the persistent ledger
   */
  async appendBlock({ eventType, entityType, entityId, payload }, client = null) {
    // 1. Get latest block
    const latest = await this.getLatestBlock(client, !!client);
    const nextIndex = latest ? latest.block_index + 1 : 0;
    const previousHash = latest ? latest.hash : '0';
    const timestamp = new Date().toISOString();
    const hash = LedgerRepository.calculateHash(previousHash, payload, timestamp);

    const sql = `
      INSERT INTO ledger_entries (block_index, event_type, entity_type, entity_id, payload, previous_hash, hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, block_index, event_type, entity_type, entity_id, payload, previous_hash, hash, created_at
    `;
    const params = [nextIndex, eventType, entityType || null, entityId ? String(entityId) : null, JSON.stringify(payload), previousHash, hash, timestamp];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  /**
   * Get full ledger chain in sequential order
   */
  async getAllBlocks(client = null) {
    const sql = `
      SELECT id, block_index, event_type, entity_type, entity_id, payload, previous_hash, hash, created_at
      FROM ledger_entries
      ORDER BY block_index ASC
    `;
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows;
  }

  /**
   * Tamper with a block (FOR TESTING PURPOSES ONLY)
   */
  async tamperBlock(blockIndex, modifiedPayload, client = null) {
    const sql = `
      UPDATE ledger_entries
      SET payload = $1
      WHERE block_index = $2
      RETURNING *
    `;
    const params = [JSON.stringify(modifiedPayload), blockIndex];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }
}

module.exports = new LedgerRepository();
