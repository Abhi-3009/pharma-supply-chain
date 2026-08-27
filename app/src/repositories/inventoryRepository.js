const { query } = require('../db/pool');

class InventoryRepository {
  /**
   * Find inventory at a specific location
   */
  async findByDrugAndLocation(drugId, location, client = null) {
    const sql = `
      SELECT id, drug_id, location, quantity, updated_at
      FROM inventory
      WHERE drug_id = $1 AND location = $2
    `;
    const params = [drugId, location];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Find inventory with exclusive ROW-LEVEL LOCK (FOR UPDATE)
   * Prevents concurrent race conditions / double allocations
   */
  async findByDrugAndLocationForUpdate(drugId, location, client) {
    if (!client) {
      throw new Error('Row-level locking FOR UPDATE requires a dedicated transaction client');
    }
    const sql = `
      SELECT id, drug_id, location, quantity, updated_at
      FROM inventory
      WHERE drug_id = $1 AND location = $2
      FOR UPDATE
    `;
    const params = [drugId, location];
    const res = await client.query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Upsert / Stock inventory
   */
  async addStock({ drugId, location, quantity }, client = null) {
    const sql = `
      INSERT INTO inventory (drug_id, location, quantity, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (drug_id, location)
      DO UPDATE SET
        quantity = inventory.quantity + EXCLUDED.quantity,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, drug_id, location, quantity, updated_at
    `;
    const params = [drugId, location, quantity];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  /**
   * Deduct inventory quantity (used in shipment creation)
   */
  async deductStock({ drugId, location, quantity }, client) {
    if (!client) {
      throw new Error('Deduct stock must run inside a transaction with a dedicated client');
    }
    const sql = `
      UPDATE inventory
      SET quantity = quantity - $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE drug_id = $2 AND location = $3 AND quantity >= $1
      RETURNING id, drug_id, location, quantity, updated_at
    `;
    const params = [quantity, drugId, location];
    const res = await client.query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * List all inventory
   */
  async findAll(client = null) {
    const sql = `
      SELECT i.id, i.drug_id, d.name AS drug_name, d.batch_id, i.location, i.quantity, i.updated_at
      FROM inventory i
      JOIN drugs d ON d.id = i.drug_id
      ORDER BY i.location, d.name
    `;
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows;
  }
}

module.exports = new InventoryRepository();
