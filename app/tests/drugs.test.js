const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Drug Routes', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('POST /drugs', () => {
    const validDrug = {
      name: 'Aspirin',
      manufacturer: 'PharmaCorp',
      batchId: 'BATCH-001',
      expiryDate: '2026-12-31',
      description: 'Pain reliever',
    };

    test('should register a new drug successfully', async () => {
      const res = await request(app).post('/drugs').send(validDrug);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Drug registered successfully');
      expect(res.body.drug.name).toBe('Aspirin');
      expect(res.body.drug.manufacturer).toBe('PharmaCorp');
      expect(res.body.drug.batch_id || res.body.drug.batchId).toBe('BATCH-001');
      expect(res.body.drug.id).toBeDefined();
      expect(res.body.drug.status).toBe('registered');
      expect(res.body.ledgerBlock).toBeDefined();
      expect(res.body.ledgerBlock.hash).toBeDefined();
    });

    test('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/drugs')
        .send({ name: 'Aspirin' }); // missing manufacturer, batchId, expiryDate

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 409 for duplicate batchId', async () => {
      await request(app).post('/drugs').send(validDrug);
      const res = await request(app).post('/drugs').send(validDrug);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    test('should register drug without optional description', async () => {
      const drugWithoutDesc = {
        name: 'Paracetamol',
        manufacturer: 'HealthMed',
        batchId: 'BATCH-002',
        expiryDate: '2026-12-31',
      };
      const res = await request(app).post('/drugs').send(drugWithoutDesc);

      expect(res.status).toBe(201);
      expect(res.body.drug.description).toBe('');
    });
  });

  describe('GET /drugs', () => {
    test('should return empty array when no drugs registered', async () => {
      const res = await request(app).get('/drugs');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.drugs).toEqual([]);
    });

    test('should return all registered drugs', async () => {
      await request(app).post('/drugs').send({
        name: 'Drug A',
        manufacturer: 'Corp A',
        batchId: 'B-001',
        expiryDate: '2026-12-31',
      });
      await request(app).post('/drugs').send({
        name: 'Drug B',
        manufacturer: 'Corp B',
        batchId: 'B-002',
        expiryDate: '2027-06-30',
      });

      const res = await request(app).get('/drugs');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.drugs).toHaveLength(2);
    });
  });

  describe('GET /drugs/:id', () => {
    test('should return a drug by its ID', async () => {
      const createRes = await request(app).post('/drugs').send({
        name: 'Ibuprofen',
        manufacturer: 'MedCo',
        batchId: 'B-100',
        expiryDate: '2027-01-01',
      });

      const drugId = createRes.body.drug.id;
      const res = await request(app).get(`/drugs/${drugId}`);

      expect(res.status).toBe(200);
      expect(res.body.drug.name).toBe('Ibuprofen');
    });

    test('should return 404 for non-existent drug', async () => {
      const res = await request(app).get('/drugs/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Drug not found');
    });
  });
});
