const { query } = require('../db/pool');

class UserRepository {
  async create({ name, email, passwordHash, role }, client = null) {
    const sql = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at
    `;
    const params = [name, email.toLowerCase(), passwordHash, role];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  async findByEmail(email, client = null) {
    const sql = 'SELECT * FROM users WHERE email = $1';
    const params = [email.toLowerCase()];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  async findById(id, client = null) {
    const sql = 'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1';
    const params = [id];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0] || null;
  }

  async findAll(client = null) {
    const sql = 'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC';
    const res = client ? await client.query(sql) : await query(sql);
    return res.rows;
  }
}

module.exports = new UserRepository();
