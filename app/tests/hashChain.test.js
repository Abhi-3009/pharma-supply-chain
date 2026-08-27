const { HashChainLedger, ledger } = require('../src/ledger/hashChain');

describe('HashChainLedger Class & In-Memory Singleton', () => {
  let testLedger;

  beforeEach(() => {
    testLedger = new HashChainLedger();
  });

  test('should initialize with a valid genesis block', () => {
    const chain = testLedger.getChain();
    expect(chain).toHaveLength(1);
    expect(chain[0].index).toBe(0);
    expect(chain[0].previousHash).toBe('0');
    expect(chain[0].data.type).toBe('GENESIS');
    expect(chain[0].hash).toHaveLength(64);
  });

  test('should add blocks sequentially and maintain hash linkage', () => {
    const block1 = testLedger.addBlock({ event: 'BATCH_CREATED', batchId: 'B-01' });
    expect(block1.index).toBe(1);
    expect(block1.previousHash).toBe(testLedger.chain[0].hash);

    const block2 = testLedger.addBlock({ event: 'SHIPMENT_DISPATCHED', shipmentId: 'S-01' });
    expect(block2.index).toBe(2);
    expect(block2.previousHash).toBe(block1.hash);
    expect(testLedger.getLatestBlock().hash).toBe(block2.hash);
  });

  test('should retrieve block by index or return null if not found', () => {
    testLedger.addBlock({ item: 'Vaccine' });
    const block = testLedger.getBlock(1);
    expect(block).not.toBeNull();
    expect(block.data.item).toBe('Vaccine');

    const nonExistent = testLedger.getBlock(999);
    expect(nonExistent).toBeNull();
  });

  test('should verify valid chain with zero invalid blocks', () => {
    testLedger.addBlock({ drug: 'Amoxicillin', qty: 500 });
    testLedger.addBlock({ drug: 'Paracetamol', qty: 1000 });

    const result = testLedger.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalBlocks).toBe(3);
    expect(result.invalidBlocks).toEqual([]);
  });

  test('should detect tampering when a block hash does not match payload', () => {
    testLedger.addBlock({ drug: 'Legit Batch 1' });
    testLedger.addBlock({ drug: 'Legit Batch 2' });

    // Tamper with block data directly
    testLedger.chain[1].data = { drug: 'Counterfeit Batch' };

    const result = testLedger.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.invalidBlocks).toContain(1);
  });

  test('should detect tampering when previousHash pointer is broken', () => {
    testLedger.addBlock({ step: 1 });
    testLedger.addBlock({ step: 2 });

    // Tamper with previousHash pointer
    testLedger.chain[2].previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const result = testLedger.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.invalidBlocks).toContain(2);
  });

  test('singleton instance should be defined and operable', () => {
    expect(ledger).toBeDefined();
    expect(ledger.getChain().length).toBeGreaterThanOrEqual(1);
  });
});
