const { query } = require('../db/pool');

class ShipmentRepository {
  async create({ drugId, drugName, origin, destination, quantity, createdBy }, client = null) {
    const sql = `
      INSERT INTO shipments (drug_id, drug_name, origin, destination, quantity, status, created_by)
      VALUES ($1, $2, $3, $4, $5, 'created', $6)
      RETURNING id, drug_id, drug_name, origin, destination, quantity, status, created_by, created_at, updated_at
    `;
    const params = [drugId, drugName, origin, destination, quantity, createdBy || null];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  async addEvent({ shipmentId, status, location, updatedBy }, client = null) {
    const sql = `
      INSERT INTO shipment_events (shipment_id, status, location, updated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, shipment_id, status, location, updated_by, created_at
    `;
    const params = [shipmentId, status, location, updatedBy || null];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  async updateStatus({ shipmentId, status }, client = null) {
    const sql = `
      UPDATE shipments
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, drug_id, drug_name, origin, destination, quantity, status, created_at, updated_at
    `;
    const params = [status, shipmentId];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  async findById(id, client = null) {
    const sql = 'SELECT * FROM shipments WHERE id = $1';
    const params = [id];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    const shipment = res.rows[0];
    if (!shipment) return null;

    // Fetch status history events
    const eventsSql = `
      SELECT se.id, se.status, se.location, se.created_at AS timestamp, u.name AS updated_by_name, u.role AS updated_by_role
      FROM shipment_events se
      LEFT JOIN users u ON u.id = se.updated_by
      WHERE se.shipment_id = $1
      ORDER BY se.created_at ASC
    `;
    const eventsRes = client ? await client.query(eventsSql, params) : await query(eventsSql, params);
    shipment.statusHistory = eventsRes.rows;
    return shipment;
  }

  async findAll(client = null) {
    const sql = 'SELECT * FROM shipments ORDER BY created_at DESC';
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows;
  }
}

module.exports = new ShipmentRepository();
