const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Database Transactions & Atomic Rollback', () => {
  let drugId;
  const origin = 'Main Depot';

  beforeEach(async () => {
    mockDb.reset();

    // Register a drug
    const drugRes = await request(app).post('/drugs').send({
      name: 'Hydrochlorothiazide',
      manufacturer: 'CardioPharma',
      batchId: 'HCTZ-500',
      expiryDate: '2028-01-01',
    });
    drugId = drugRes.body.drug.id;

    // Stock initial inventory
    await request(app).post('/inventory/stock').send({
      drugId,
      location: origin,
      quantity: 100,
    });
  });

  test('should atomically rollback all changes when shipment creation fails due to insufficient stock', async () => {
    // Attempt to order 150 units (only 100 available)
    const res = await request(app).post('/shipments').send({
      drugId,
      drugName: 'Hydrochlorothiazide',
      origin,
      destination: 'Community Clinic',
      quantity: 150,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient inventory');

    // Verify NO shipment was created
    const shipmentsRes = await request(app).get('/shipments');
    expect(shipmentsRes.body.shipments).toHaveLength(0);

    // Verify origin stock was NOT deducted (preserved at 100)
    const stockRes = await request(app).get(`/inventory/item?drugId=${drugId}&location=${encodeURIComponent(origin)}`);
    expect(stockRes.body.inventory.quantity).toBe(100);

    // Verify NO invalid ledger block was recorded
    const ledgerRes = await request(app).get('/ledger');
    // Ledger should only have Genesis (0) + Drug Reg (1) + Stock Added (2) = 3 blocks
    expect(ledgerRes.body.totalBlocks).toBe(3);
  });
});
