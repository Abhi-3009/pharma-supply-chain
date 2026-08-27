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
      // 1. Seed Users (RBAC across all supply chain roles)
      const userRes = await client.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES
          ('Dr. Alistair Vance (Admin)', 'admin@pharma.com', $1, 'ADMIN'),
          ('PharmaCorp Global Biotech', 'mfg@pharma.com', $1, 'MANUFACTURER'),
          ('Apex BioPharma Labs', 'apex@pharma.com', $1, 'MANUFACTURER'),
          ('FastLogistics Distribution', 'dist@pharma.com', $1, 'DISTRIBUTOR'),
          ('TransGlobal ColdChain Logistics', 'logistics@pharma.com', $1, 'DISTRIBUTOR'),
          ('Mumbai Central Cold Storage', 'warehouse@pharma.com', $1, 'WAREHOUSE'),
          ('Delhi North Regional Depot', 'delhi.wh@pharma.com', $1, 'WAREHOUSE'),
          ('Bangalore TechHub Storage', 'blr.wh@pharma.com', $1, 'WAREHOUSE'),
          ('City General Hospital Pharmacy', 'pharmacy@pharma.com', $1, 'PHARMACY'),
          ('Apollo MedCare Dispensary', 'apollo@pharma.com', $1, 'PHARMACY')
        ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, email, role;
      `, [passwordHash]);

      const users = userRes.rows;
      const mfgUser = users.find((u) => u.email === 'mfg@pharma.com') || users[0];
      const apexUser = users.find((u) => u.email === 'apex@pharma.com') || users[0];
      const distUser = users.find((u) => u.email === 'dist@pharma.com') || users[0];
      const warehouseUser = users.find((u) => u.email === 'warehouse@pharma.com') || users[0];
      const delhiUser = users.find((u) => u.email === 'delhi.wh@pharma.com') || users[0];

      // 2. Seed Drugs across multiple clinical categories
      const drugRes = await client.query(`
        INSERT INTO drugs (name, manufacturer, manufacturer_id, batch_id, expiry_date, description, status)
        VALUES
          ('Paracetamol 650mg (Calpol)', 'PharmaCorp Global Biotech', $1, 'BATCH-2026-001', '2028-12-31', 'Analgesic and antipyretic for pain and fever relief', 'registered'),
          ('Amoxicillin 500mg Trihydrate', 'PharmaCorp Global Biotech', $1, 'BATCH-2026-002', '2027-06-30', 'Broad-spectrum bactericidal penicillin antibiotic', 'registered'),
          ('Insulin Glargine 100IU/ml', 'PharmaCorp Global Biotech', $1, 'BATCH-2026-003', '2026-12-31', 'Recombinant human insulin analog for diabetes management (Cold Chain 2-8°C)', 'registered'),
          ('Remdesivir 100mg Lyophilized', 'Apex BioPharma Labs', $2, 'BATCH-2026-004', '2027-09-15', 'Broad-spectrum antiviral nucleoside ribonucleic acid polymerase inhibitor', 'registered'),
          ('Azithromycin 500mg', 'Apex BioPharma Labs', $2, 'BATCH-2026-005', '2028-03-31', 'Macrolide antibacterial for respiratory tract infections', 'registered'),
          ('Atorvastatin Calcium 20mg', 'Apex BioPharma Labs', $2, 'BATCH-2026-006', '2028-11-30', 'HMG-CoA reductase inhibitor for cardiovascular cholesterol reduction', 'registered')
        ON CONFLICT (batch_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, batch_id;
      `, [mfgUser.id, apexUser.id]);

      const drugs = drugRes.rows;

      // 3. Seed Inventory across 4 national fulfillment depots
      const locations = [
        { name: 'Mumbai Central Cold Storage', qty: 10000 },
        { name: 'Delhi North Regional Depot', qty: 7500 },
        { name: 'Bangalore TechHub Storage', qty: 5000 },
        { name: 'Hyderabad Pharma Logistics Hub', qty: 3500 }
      ];

      for (const drug of drugs) {
        for (const loc of locations) {
          await client.query(`
            INSERT INTO inventory (drug_id, location, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (drug_id, location) DO UPDATE SET quantity = EXCLUDED.quantity;
          `, [drug.id, loc.name, loc.qty]);
        }
      }

      // 4. Seed Shipments across different statuses
      const shipmentsData = [
        {
          drug: drugs[0], // Paracetamol
          origin: 'Mumbai Central Cold Storage',
          dest: 'Delhi North Regional Depot',
          qty: 1500,
          status: 'in-transit',
          createdBy: mfgUser.id,
          events: [
            { status: 'created', location: 'Mumbai Central Cold Storage', user: mfgUser.id },
            { status: 'in-transit', location: 'Highway NH-48 Express Checkpoint', user: distUser.id }
          ]
        },
        {
          drug: drugs[2], // Insulin (Cold chain)
          origin: 'Mumbai Central Cold Storage',
          dest: 'City General Hospital Pharmacy',
          qty: 400,
          status: 'at-checkpoint',
          createdBy: mfgUser.id,
          events: [
            { status: 'created', location: 'Mumbai Central Cold Storage', user: mfgUser.id },
            { status: 'in-transit', location: 'Airport Cargo Terminal Mumbai', user: distUser.id },
            { status: 'at-checkpoint', location: 'Temperature Log Checkpoint (3.4°C - Passed)', user: distUser.id }
          ]
        },
        {
          drug: drugs[3], // Remdesivir
          origin: 'Delhi North Regional Depot',
          dest: 'Apollo MedCare Dispensary',
          qty: 250,
          status: 'delivered',
          createdBy: apexUser.id,
          events: [
            { status: 'created', location: 'Delhi North Regional Depot', user: apexUser.id },
            { status: 'in-transit', location: 'Ring Road Transit Corridor', user: distUser.id },
            { status: 'delivered', location: 'Apollo MedCare Dispensary Dock 2', user: delhiUser.id }
          ]
        },
        {
          drug: drugs[1], // Amoxicillin
          origin: 'Bangalore TechHub Storage',
          dest: 'City General Hospital Pharmacy',
          qty: 800,
          status: 'created',
          createdBy: mfgUser.id,
          events: [
            { status: 'created', location: 'Bangalore TechHub Storage', user: mfgUser.id }
          ]
        }
      ];

      for (const s of shipmentsData) {
        const sRes = await client.query(`
          INSERT INTO shipments (drug_id, drug_name, origin, destination, quantity, status, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `, [s.drug.id, s.drug.name, s.origin, s.dest, s.qty, s.status, s.createdBy]);

        const shipmentId = sRes.rows[0].id;

        for (const ev of s.events) {
          await client.query(`
            INSERT INTO shipment_events (shipment_id, status, location, updated_by)
            VALUES ($1, $2, $3, $4);
          `, [shipmentId, ev.status, ev.location, ev.user]);
        }
      }

      // 5. Seed Immutable Hash-Chain Ledger Entries
      await ledgerRepository.appendBlock({
        eventType: 'SUPPLY_CHAIN_INITIALIZED',
        entityType: 'SYSTEM',
        entityId: '0',
        payload: {
          message: 'Comprehensive Enterprise Pharma Supply Chain network loaded',
          organizations: users.length,
          catalogProducts: drugs.length,
          activeWarehouses: locations.length,
          shipmentsTracked: shipmentsData.length
        },
      }, client);
    });

    logger.info('Database seeded successfully with 10 users, 6 pharmaceutical products, 24 inventory depots, 4 live shipments, and immutable ledger chain!');
    logger.info('Default credentials: email: admin@pharma.com | password: Password123!');
  } catch (error) {
    logger.error('Database seeding failed', { error: error.message, stack: error.stack });
  }
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
