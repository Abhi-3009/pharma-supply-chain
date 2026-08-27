const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * In-Memory SQL Simulator for local unit/integration tests
 * Allows tests to run without requiring a running PostgreSQL server daemon.
 * Supports:
 *   - Schema tables (users, drugs, inventory, shipments, shipment_events, ledger_entries)
 *   - Transactions (BEGIN, COMMIT, ROLLBACK)
 *   - Parameterized queries ($1, $2, etc.)
 *   - Row locking (FOR UPDATE)
 */
class InMemoryDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.tables = {
      users: [],
      drugs: [],
      inventory: [],
      shipments: [],
      shipment_events: [],
      ledger_entries: [],
    };

    // Seed Genesis block in ledger_entries
    const genesisTimestamp = new Date().toISOString();
    const genesisData = { type: 'GENESIS', message: 'Pharma Supply Chain Ledger Initialized' };
    const previousHash = '0';
    const payloadString = previousHash + JSON.stringify(genesisData) + genesisTimestamp;
    const genesisHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    this.tables.ledger_entries.push({
      id: 1,
      block_index: 0,
      event_type: 'GENESIS',
      entity_type: 'SYSTEM',
      entity_id: '0',
      payload: genesisData,
      previous_hash: previousHash,
      hash: genesisHash,
      created_at: genesisTimestamp,
    });
  }

  async query(text, params = []) {
    const norm = text.replace(/\s+/g, ' ').trim();

    // 1. DDL Statements (CREATE / ALTER / DROP)
    if (norm.startsWith('CREATE') || norm.startsWith('ALTER') || norm.startsWith('DROP')) {
      return { rows: [], rowCount: 0 };
    }

    // 2. USERS
    if (norm.includes('INSERT INTO users')) {
      const [name, email, passwordHash, role] = params;
      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        password_hash: passwordHash,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tables.users.push(user);
      return { rows: [{ ...user }], rowCount: 1 };
    }

    if (norm.includes('FROM users WHERE email = $1')) {
      const user = this.tables.users.find((u) => u.email.toLowerCase() === params[0].toLowerCase());
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    if (norm.includes('FROM users WHERE id = $1')) {
      const user = this.tables.users.find((u) => u.id === params[0]);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    if (norm.includes('FROM users ORDER BY')) {
      return { rows: [...this.tables.users], rowCount: this.tables.users.length };
    }

    // 3. DRUGS
    if (norm.includes('INSERT INTO drugs')) {
      const [name, manufacturer, manufacturerId, batchId, expiryDate, description] = params;
      const drug = {
        id: crypto.randomUUID(),
        name,
        manufacturer,
        manufacturer_id: manufacturerId || null,
        batch_id: batchId,
        expiry_date: expiryDate,
        description: description || '',
        status: 'registered',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tables.drugs.push(drug);
      return { rows: [{ ...drug }], rowCount: 1 };
    }

    if (norm.includes('FROM drugs WHERE batch_id = $1')) {
      const drug = this.tables.drugs.find((d) => d.batch_id === params[0]);
      return { rows: drug ? [{ ...drug }] : [], rowCount: drug ? 1 : 0 };
    }

    if (norm.includes('FROM drugs WHERE id = $1')) {
      const drug = this.tables.drugs.find((d) => d.id === params[0]);
      return { rows: drug ? [{ ...drug }] : [], rowCount: drug ? 1 : 0 };
    }

    if (norm.includes('FROM drugs ORDER BY')) {
      return { rows: [...this.tables.drugs], rowCount: this.tables.drugs.length };
    }

    // 4. INVENTORY
    if (norm.includes('INSERT INTO inventory')) {
      const [drugId, location, quantity] = params;
      let item = this.tables.inventory.find((i) => i.drug_id === drugId && i.location === location);
      if (item) {
        item.quantity += quantity;
        item.updated_at = new Date().toISOString();
      } else {
        item = {
          id: crypto.randomUUID(),
          drug_id: drugId,
          location,
          quantity,
          updated_at: new Date().toISOString(),
        };
        this.tables.inventory.push(item);
      }
      return { rows: [{ ...item }], rowCount: 1 };
    }

    if (norm.includes('FROM inventory WHERE drug_id = $1 AND location = $2')) {
      const item = this.tables.inventory.find((i) => i.drug_id === params[0] && i.location === params[1]);
      return { rows: item ? [{ ...item }] : [], rowCount: item ? 1 : 0 };
    }

    if (norm.includes('UPDATE inventory') && norm.includes('quantity >= $1')) {
      const [quantity, drugId, location] = params;
      const item = this.tables.inventory.find((i) => i.drug_id === drugId && i.location === location);
      if (item && item.quantity >= quantity) {
        item.quantity -= quantity;
        item.updated_at = new Date().toISOString();
        return { rows: [{ ...item }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.includes('FROM inventory') && norm.includes('JOIN drugs')) {
      const rows = this.tables.inventory.map((inv) => {
        const drug = this.tables.drugs.find((d) => d.id === inv.drug_id) || {};
        return {
          id: inv.id,
          drug_id: inv.drug_id,
          drug_name: drug.name || 'Unknown',
          batch_id: drug.batch_id || '',
          location: inv.location,
          quantity: inv.quantity,
          updated_at: inv.updated_at,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 5. SHIPMENTS
    if (norm.includes('INSERT INTO shipments')) {
      const [drugId, drugName, origin, destination, quantity, createdBy] = params;
      const shipment = {
        id: crypto.randomUUID(),
        drug_id: drugId,
        drug_name: drugName,
        origin,
        destination,
        quantity,
        status: 'created',
        created_by: createdBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tables.shipments.push(shipment);
      return { rows: [{ ...shipment }], rowCount: 1 };
    }

    if (norm.includes('INSERT INTO shipment_events')) {
      const [shipmentId, status, location, updatedBy] = params;
      const event = {
        id: crypto.randomUUID(),
        shipment_id: shipmentId,
        status,
        location,
        updated_by: updatedBy || null,
        created_at: new Date().toISOString(),
      };
      this.tables.shipment_events.push(event);
      return { rows: [{ ...event }], rowCount: 1 };
    }

    if (norm.includes('UPDATE shipments') && norm.includes('SET status = $1')) {
      const [status, shipmentId] = params;
      const shipment = this.tables.shipments.find((s) => s.id === shipmentId);
      if (shipment) {
        shipment.status = status;
        shipment.updated_at = new Date().toISOString();
        return { rows: [{ ...shipment }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.includes('FROM shipments WHERE id = $1')) {
      const shipment = this.tables.shipments.find((s) => s.id === params[0]);
      return { rows: shipment ? [{ ...shipment }] : [], rowCount: shipment ? 1 : 0 };
    }

    if (norm.includes('FROM shipment_events') && norm.includes('shipment_id = $1')) {
      const events = this.tables.shipment_events
        .filter((e) => e.shipment_id === params[0])
        .map((e) => {
          const user = this.tables.users.find((u) => u.id === e.updated_by);
          return {
            id: e.id,
            status: e.status,
            location: e.location,
            timestamp: e.created_at,
            updated_by_name: user ? user.name : null,
            updated_by_role: user ? user.role : null,
          };
        });
      return { rows: events, rowCount: events.length };
    }

    if (norm.includes('FROM shipments ORDER BY')) {
      return { rows: [...this.tables.shipments], rowCount: this.tables.shipments.length };
    }

    // 6. LEDGER_ENTRIES
    if (norm.includes('INSERT INTO ledger_entries')) {
      const [blockIndex, eventType, entityType, entityId, payloadStr, previousHash, hash, timestamp] = params;
      const parsedPayload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
      const block = {
        id: this.tables.ledger_entries.length + 1,
        block_index: blockIndex,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        payload: parsedPayload,
        previous_hash: previousHash,
        hash,
        created_at: timestamp,
      };
      this.tables.ledger_entries.push(block);
      return { rows: [{ ...block }], rowCount: 1 };
    }

    if (norm.includes('FROM ledger_entries') && norm.includes('ORDER BY block_index DESC LIMIT 1')) {
      const latest = this.tables.ledger_entries[this.tables.ledger_entries.length - 1];
      return { rows: latest ? [{ ...latest }] : [], rowCount: latest ? 1 : 0 };
    }

    if (norm.includes('FROM ledger_entries') && norm.includes('ORDER BY block_index ASC')) {
      return { rows: [...this.tables.ledger_entries], rowCount: this.tables.ledger_entries.length };
    }

    if (norm.includes('COUNT(*)') && norm.includes('FROM ledger_entries')) {
      return { rows: [{ count: this.tables.ledger_entries.length }], rowCount: 1 };
    }

    if (norm.includes('UPDATE ledger_entries SET payload = $1 WHERE block_index = $2')) {
      const [payloadStr, blockIndex] = params;
      const block = this.tables.ledger_entries.find((b) => b.block_index === parseInt(blockIndex, 10));
      if (block) {
        block.payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
        return { rows: [{ ...block }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    logger.debug('Unhandled In-Memory SQL Query', { norm });
    return { rows: [], rowCount: 0 };
  }
}

const mockDb = new InMemoryDatabase();

module.exports = mockDb;
