const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Verify & System Routes', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('GET /api/info', () => {
    test('should return API information and architecture metadata', async () => {
      const res = await request(app).get('/api/info');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Pharmaceutical Supply Chain API');
      expect(res.body.version).toBe('2.0.0');
      expect(res.body.endpoints).toBeDefined();
    });
  });

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('pharma-supply-chain');
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('GET /verify', () => {
    test('should verify chain integrity (valid genesis chain)', async () => {
      const res = await request(app).get('/verify');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('integrity verified');
      expect(res.body.verification.valid).toBe(true);
      expect(res.body.verification.totalBlocks).toBe(1);
    });

    test('should verify chain after registering drugs and stock', async () => {
      await request(app).post('/drugs').send({
        name: 'Test Drug',
        manufacturer: 'Pharma Test',
        batchId: 'VERIFY-001',
        expiryDate: '2026-12-31',
      });

      const res = await request(app).get('/verify');

      expect(res.status).toBe(200);
      expect(res.body.verification.valid).toBe(true);
      expect(res.body.verification.totalBlocks).toBe(2);
    });

    test('should detect tampering via POST /ledger/tamper', async () => {
      await request(app).post('/drugs').send({
        name: 'Test Drug',
        manufacturer: 'Pharma Test',
        batchId: 'VERIFY-TAMPER-001',
        expiryDate: '2026-12-31',
      });

      // Tamper with Block #1
      await request(app).post('/ledger/tamper').send({
        blockIndex: 1,
        payload: { fake: 'data' },
      });

      const res = await request(app).get('/verify');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('ALERT: Supply chain integrity compromised');
      expect(res.body.verification.valid).toBe(false);
      expect(res.body.verification.invalidBlocks).toContain(1);
    });
  });

  describe('GET /ledger', () => {
    test('should return the full ledger chain', async () => {
      const res = await request(app).get('/ledger');

      expect(res.status).toBe(200);
      expect(res.body.totalBlocks).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.chain)).toBe(true);
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });
});
