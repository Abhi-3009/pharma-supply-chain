const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('./pool');
const { runMigrations } = require('./migrations');
const ledgerRepository = require('../repositories/ledgerRepository');
const logger = require('../utils/logger');

/**
 * Seed script to populate the PostgreSQL database with realistic pharmaceutical supply chain demo data.
 * Usage: npm run seed
 */
async function seedDatabase() {
  try {
    logger.info('Running migrations before seeding...');
    await runMigrations();

    logger.info('Starting demo database seed...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    await withTransaction(async (client) => {
      // 1. Seed Users (RBAC)
      const userRes = await client.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES
          ('Dr. Alistair Vance (Admin)', 'admin@pharma.com', $1, 'ADMIN'),
          ('PharmaCorp Manufacturing', 'mfg@pharma.com', $1, 'MANUFACTURER'),
          ('FastLogistics Distribution', 'dist@pharma.com', $1, 'DISTRIBUTOR'),
          ('Mumbai Central Warehouse', 'warehouse@pharma.com', $1, 'WAREHOUSE'),
          ('City General Pharmacy', 'pharmacy@pharma.com', $1, 'PHARMACY')
        ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, email, role;
      `, [passwordHash]);

      const users = userRes.rows;
      const mfgUser = users.find((u) => u.role === 'MANUFACTURER') || users[0];
      const warehouseUser = users.find((u) => u.role === 'WAREHOUSE') || users[0];

      // 2. Seed Drugs
      const drugRes = await client.query(`
        INSERT INTO drugs (name, manufacturer, manufacturer_id, batch_id, expiry_date, description, status)
        VALUES
          ('Aspirin 500mg', 'PharmaCorp', $1, 'BATCH-2026-001', '2028-12-31', 'Analgesic and anti-inflammatory medication', 'registered'),
          ('Amoxicillin 250mg', 'PharmaCorp', $1, 'BATCH-2026-002', '2027-06-30', 'Broad-spectrum penicillin antibiotic', 'registered'),
          ('Insulin Glargine 100IU', 'PharmaCorp', $1, 'BATCH-2026-003', '2026-12-31', 'Long-acting basal insulin for diabetes management', 'registered')
        ON CONFLICT (batch_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, batch_id;
      `, [mfgUser.id]);

      const drugs = drugRes.rows;

      // 3. Seed Inventory
      for (const drug of drugs) {
        await client.query(`
          INSERT INTO inventory (drug_id, location, quantity)
          VALUES
            ($1, 'Mumbai Central Depot', 5000),
            ($1, 'Delhi Regional Warehouse', 2500),
            ($1, 'Bangalore Distribution Hub', 1200)
          ON CONFLICT (drug_id, location) DO UPDATE SET quantity = EXCLUDED.quantity;
        `, [drug.id]);
      }

      // 4. Seed Shipments & Events
      const aspirin = drugs[0];
      const shipmentRes = await client.query(`
        INSERT INTO shipments (drug_id, drug_name, origin, destination, quantity, status, created_by)
        VALUES
          ($1, $2, 'Mumbai Central Depot', 'Delhi Regional Warehouse', 500, 'in-transit', $3),
          ($1, $2, 'Delhi Regional Warehouse', 'City General Pharmacy', 150, 'delivered', $4)
        RETURNING id, status, origin, destination;
      `, [aspirin.id, aspirin.name, mfgUser.id, warehouseUser.id]);

      const [shipment1, shipment2] = shipmentRes.rows;

      // Shipment 1 Events
      await client.query(`
        INSERT INTO shipment_events (shipment_id, status, location, updated_by)
        VALUES
          ($1, 'created', 'Mumbai Central Depot', $2),
          ($1, 'in-transit', 'Highway NH-48 Checkpoint', $2);
      `, [shipment1.id, mfgUser.id]);

      // Shipment 2 Events
      await client.query(`
        INSERT INTO shipment_events (shipment_id, status, location, updated_by)
        VALUES
          ($1, 'created', 'Delhi Regional Warehouse', $2),
          ($1, 'in-transit', 'North Expressway Toll', $2),
          ($1, 'delivered', 'City General Pharmacy', $2);
      `, [shipment2.id, warehouseUser.id]);

      // 5. Seed Ledger Entries for Demo Events
      await ledgerRepository.appendBlock({
        eventType: 'SEED_INITIALIZATION',
        entityType: 'SYSTEM',
        entityId: '0',
        payload: {
          message: 'Demo seed data successfully generated with users, drug catalog, inventory, and initial shipments',
          usersCount: users.length,
          drugsCount: drugs.length,
        },
      }, client);
    });

    logger.info('Database seeded successfully with default users, drugs, inventory, and shipments!');
    logger.info('Default credentials for testing: email: admin@pharma.com | password: Password123!');
  } catch (error) {
    logger.error('Database seeding failed', { error: error.message, stack: error.stack });
  }
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
