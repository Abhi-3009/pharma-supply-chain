const ledgerRepository = require('../src/repositories/ledgerRepository');
const ledgerService = require('../src/services/ledgerService');
const { mockDb } = require('../src/db/pool');

describe('Persistent Hash-Chain Ledger & Verification', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('calculateHash', () => {
    test('should produce consistent SHA-256 hashes for identical inputs', () => {
      const hash1 = ledgerRepository.constructor.calculateHash('prev-hash-1', { data: 'test' }, '2026-01-01T00:00:00.000Z');
      const hash2 = ledgerRepository.constructor.calculateHash('prev-hash-1', { data: 'test' }, '2026-01-01T00:00:00.000Z');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex characters
    });

    test('should produce different hashes for different inputs', () => {
      const hash1 = ledgerRepository.constructor.calculateHash('prev-1', { data: 'A' }, '2026-01-01T00:00:00.000Z');
      const hash2 = ledgerRepository.constructor.calculateHash('prev-1', { data: 'B' }, '2026-01-01T00:00:00.000Z');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('appendBlock & verifyChain', () => {
    test('should append blocks and maintain a valid chain', async () => {
      const block1 = await ledgerRepository.appendBlock({
        eventType: 'TEST_EVENT_1',
        payload: { detail: 'event 1' },
      });

      const block2 = await ledgerRepository.appendBlock({
        eventType: 'TEST_EVENT_2',
        payload: { detail: 'event 2' },
      });

      expect(block1.block_index).toBe(1);
      expect(block2.block_index).toBe(2);
      expect(block2.previous_hash).toBe(block1.hash);

      const verification = await ledgerService.verifyChain();
      expect(verification.valid).toBe(true);
      expect(verification.totalBlocks).toBe(3); // Genesis (0) + Block 1 + Block 2
      expect(verification.invalidBlocks).toEqual([]);
    });

    test('should detect tampering when a block payload is maliciously modified', async () => {
      await ledgerRepository.appendBlock({
        eventType: 'DRUG_REG',
        payload: { drug: 'Legit Medicine', batch: 'BATCH-001' },
      });

      await ledgerRepository.appendBlock({
        eventType: 'SHIPMENT',
        payload: { quantity: 100 },
      });

      // Verify chain is initially valid
      let verification = await ledgerService.verifyChain();
      expect(verification.valid).toBe(true);

      // Maliciously tamper with Block #1 payload in database
      await ledgerService.tamperBlockForTesting(1, { drug: 'Counterfeit Pill', batch: 'BATCH-001' });

      // Verification must detect the tampering and fail
      verification = await ledgerService.verifyChain();
      expect(verification.valid).toBe(false);
      expect(verification.invalidBlocks).toContain(1);
    });
  });
});
