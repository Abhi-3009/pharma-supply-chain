const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Concurrency & Race Condition Handling', () => {
  let drugId;
  const origin = 'Mumbai Warehouse';

  beforeEach(async () => {
    mockDb.reset();

    // Register drug
    const drugRes = await request(app).post('/drugs').send({
      name: 'Insulin Glargine',
      manufacturer: 'BioPharma Ltd',
      batchId: 'INS-888',
      expiryDate: '2027-01-01',
    });
    drugId = drugRes.body.drug.id;

    // Stock exactly 10 units in Mumbai Warehouse
    await request(app).post('/inventory/stock').send({
      drugId,
      location: origin,
      quantity: 10,
    });
  });

  test('should prevent overselling when two concurrent orders exceed available inventory', async () => {
    // Request A wants 8 units, Request B wants 7 units (Total 15 > 10 available)
    // Concurrently fired requests: Exactly ONE must succeed and the other must be rejected
    const reqA = request(app).post('/shipments').send({
      drugId,
      drugName: 'Insulin Glargine',
      origin,
      destination: 'Hospital North',
      quantity: 8,
    });

    const reqB = request(app).post('/shipments').send({
      drugId,
      drugName: 'Insulin Glargine',
      origin,
      destination: 'Hospital South',
      quantity: 7,
    });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    const statuses = [resA.status, resB.status];
    const successCount = statuses.filter((s) => s === 201).length;
    const failureCount = statuses.filter((s) => s === 400 || s === 409).length;

    // Invariant: Both must NOT succeed simultaneously
    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Verify remaining inventory is non-negative
    const invRes = await request(app).get(`/inventory/item?drugId=${drugId}&location=${encodeURIComponent(origin)}`);
    expect(invRes.body.inventory.quantity).toBeGreaterThanOrEqual(0);
    expect(invRes.body.inventory.quantity).toBeLessThanOrEqual(10);
  });
});
