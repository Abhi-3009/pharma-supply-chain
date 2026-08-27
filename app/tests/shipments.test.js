const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Shipment Routes', () => {
  let testDrugId;
  const origin = 'Mumbai Warehouse';
  const destination = 'Delhi Hospital';

  beforeEach(async () => {
    mockDb.reset();

    // Register a valid test drug
    const drugRes = await request(app).post('/drugs').send({
      name: 'Aspirin',
      manufacturer: 'PharmaCorp',
      batchId: 'BATCH-SHIP-01',
      expiryDate: '2026-12-31',
    });
    testDrugId = drugRes.body.drug.id;

    // Stock inventory at origin
    await request(app).post('/inventory/stock').send({
      drugId: testDrugId,
      location: origin,
      quantity: 1000,
    });
  });

  describe('POST /shipments', () => {
    test('should create a new shipment successfully and deduct inventory atomically', async () => {
      const res = await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination,
        quantity: 500,
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Shipment created successfully');
      expect(res.body.shipment.drug_id || res.body.shipment.drugId).toBe(testDrugId);
      expect(res.body.shipment.origin).toBe(origin);
      expect(res.body.shipment.destination).toBe(destination);
      expect(res.body.shipment.status).toBe('created');
      expect(res.body.shipment.statusHistory).toHaveLength(1);
      expect(res.body.ledgerBlock).toBeDefined();
    });

    test('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/shipments')
        .send({ drugId: testDrugId }); // missing drugName, origin, destination

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 400 when inventory is insufficient', async () => {
      const res = await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination,
        quantity: 5000, // Available is only 1000
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient inventory');
    });

    test('should default quantity to 1 when not provided', async () => {
      const res = await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination,
      });

      expect(res.status).toBe(201);
      expect(res.body.shipment.quantity).toBe(1);
    });
  });

  describe('GET /shipments', () => {
    test('should return empty array when no shipments exist', async () => {
      const res = await request(app).get('/shipments');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.shipments).toEqual([]);
    });

    test('should return all shipments', async () => {
      await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination: 'Hospital 1',
        quantity: 10,
      });
      await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination: 'Hospital 2',
        quantity: 20,
      });

      const res = await request(app).get('/shipments');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('GET /shipments/:id', () => {
    test('should return a shipment by ID with status history', async () => {
      const createRes = await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination,
        quantity: 50,
      });

      const shipmentId = createRes.body.shipment.id;
      const res = await request(app).get(`/shipments/${shipmentId}`);

      expect(res.status).toBe(200);
      expect(res.body.shipment.id).toBe(shipmentId);
      expect(res.body.shipment.statusHistory).toHaveLength(1);
    });

    test('should return 404 for non-existent shipment', async () => {
      const res = await request(app).get('/shipments/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Shipment not found');
    });
  });

  describe('PUT /shipments/:id/status', () => {
    let shipmentId;

    beforeEach(async () => {
      const createRes = await request(app).post('/shipments').send({
        drugId: testDrugId,
        drugName: 'Aspirin',
        origin,
        destination,
        quantity: 25,
      });
      shipmentId = createRes.body.shipment.id;
    });

    test('should update shipment status successfully', async () => {
      const res = await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({ status: 'in-transit', location: 'Highway NH-48' });

      expect(res.status).toBe(200);
      expect(res.body.shipment.status).toBe('in-transit');
      expect(res.body.shipment.statusHistory).toHaveLength(2);
      expect(res.body.ledgerBlock).toBeDefined();
    });

    test('should track multiple status updates in history', async () => {
      await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({ status: 'in-transit', location: 'Highway NH-48' });
      await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({ status: 'at-checkpoint', location: 'Checkpoint Jaipur' });
      const res = await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({ status: 'delivered', location: destination });

      expect(res.body.shipment.statusHistory).toHaveLength(4); // created + 3 updates
      expect(res.body.shipment.status).toBe('delivered');
    });

    test('should return 400 for invalid status', async () => {
      const res = await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    test('should return 400 when status is missing', async () => {
      const res = await request(app)
        .put(`/shipments/${shipmentId}/status`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required field');
    });

    test('should return 404 for non-existent shipment', async () => {
      const res = await request(app)
        .put('/shipments/non-existent/status')
        .send({ status: 'in-transit' });

      expect(res.status).toBe(404);
    });
  });
});
