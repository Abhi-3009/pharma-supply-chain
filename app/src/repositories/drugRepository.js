const { query } = require('../db/pool');

class DrugRepository {
  async create({ name, manufacturer, manufacturerId, batchId, expiryDate, description }, client = null) {
    const sql = `
      INSERT INTO drugs (name, manufacturer, manufacturer_id, batch_id, expiry_date, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'registered')
      RETURNING id, name, manufacturer, manufacturer_id, batch_id, expiry_date, description, status, created_at, updated_at
    `;
    const params = [name, manufacturer, manufacturerId || null, batchId, expiryDate, description || ''];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  async findByBatchId(batchId, client = null) {
    const sql = 'SELECT * FROM drugs WHERE batch_id = $1';
    const params = [batchId];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  async findById(id, client = null) {
    const sql = 'SELECT * FROM drugs WHERE id = $1';
    const params = [id];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  async findAll(client = null) {
    const sql = 'SELECT * FROM drugs ORDER BY created_at DESC';
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows;
  }
}

module.exports = new DrugRepository();
