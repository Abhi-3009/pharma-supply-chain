const crypto = require('crypto');
const { query } = require('./pool');
const logger = require('../utils/logger');

const SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- 1. Users table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'WAREHOUSE', 'PHARMACY')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  -- 2. Drugs table
  CREATE TABLE IF NOT EXISTS drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    manufacturer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    batch_id VARCHAR(100) NOT NULL UNIQUE,
    expiry_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'registered',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_drugs_batch_id ON drugs(batch_id);
  CREATE INDEX IF NOT EXISTS idx_drugs_manufacturer_id ON drugs(manufacturer_id);

  -- 3. Inventory table
  CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
    location VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_drug_location UNIQUE (drug_id, location)
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_drug_location ON inventory(drug_id, location);

  -- 4. Shipments table
  CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
    drug_name VARCHAR(255) NOT NULL,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('created', 'in-transit', 'at-checkpoint', 'delivered', 'recalled')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_shipments_drug_id ON shipments(drug_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

  -- 5. Shipment Events (Audit trail)
  CREATE TABLE IF NOT EXISTS shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events(shipment_id);

  -- 6. Hash-Chain Ledger Entries (Immutable Audit Chain)
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    block_index INTEGER NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    payload JSONB NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_block_index ON ledger_entries(block_index);
`;

/**
 * Run database migrations and seed genesis block if not present
 */
async function runMigrations() {
  try {
    logger.info('Starting PostgreSQL schema migrations...');
    await query(SCHEMA_SQL);
    logger.info('PostgreSQL schema migrations applied successfully');

    // Check if Genesis block exists in ledger_entries
    const ledgerCountRes = await query('SELECT COUNT(*) FROM ledger_entries');
    const count = parseInt(ledgerCountRes.rows[0].count, 10);

    if (count === 0) {
      const genesisTimestamp = new Date().toISOString();
      const genesisData = { type: 'GENESIS', message: 'Pharma Supply Chain Ledger Initialized' };
      const previousHash = '0';
      const payloadString = previousHash + JSON.stringify(genesisData) + genesisTimestamp;
      const genesisHash = crypto.createHash('sha256').update(payloadString).digest('hex');

      await query(
        `INSERT INTO ledger_entries (block_index, event_type, entity_type, entity_id, payload, previous_hash, hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [0, 'GENESIS', 'SYSTEM', '0', JSON.stringify(genesisData), previousHash, genesisHash, genesisTimestamp]
      );
      logger.info('Genesis block initialized in ledger_entries table', { hash: genesisHash });
    }
  } catch (error) {
    logger.error('Database migration failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = {
  runMigrations,
  SCHEMA_SQL,
};
