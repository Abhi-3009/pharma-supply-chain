const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Inventory Routes', () => {
  let drugId;

  beforeEach(async () => {
    mockDb.reset();

    // Register a test drug
    const drugRes = await request(app).post('/drugs').send({
      name: 'Amoxicillin',
      manufacturer: 'PharmaCore',
      batchId: 'AMOX-101',
      expiryDate: '2027-12-31',
    });
    drugId = drugRes.body.drug.id;
  });

  test('should stock inventory at a specific location', async () => {
    const res = await request(app).post('/inventory/stock').send({
      drugId,
      location: 'Central Warehouse',
      quantity: 500,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Stock updated successfully');
    expect(res.body.inventory.quantity).toBe(500);
    expect(res.body.inventory.location).toBe('Central Warehouse');
  });

  test('should increment stock on successive restock calls', async () => {
    await request(app).post('/inventory/stock').send({
      drugId,
      location: 'Central Warehouse',
      quantity: 200,
    });

    const res = await request(app).post('/inventory/stock').send({
      drugId,
      location: 'Central Warehouse',
      quantity: 300,
    });

    expect(res.status).toBe(200);
    expect(res.body.inventory.quantity).toBe(500);
  });

  test('should reject invalid or negative quantity', async () => {
    const res = await request(app).post('/inventory/stock').send({
      drugId,
      location: 'Central Warehouse',
      quantity: -50,
    });

    expect(res.status).toBe(400);
  });

  test('should list all stock items', async () => {
    await request(app).post('/inventory/stock').send({
      drugId,
      location: 'Warehouse A',
      quantity: 100,
    });

    const res = await request(app).get('/inventory');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.inventory[0].location).toBe('Warehouse A');
  });
});
