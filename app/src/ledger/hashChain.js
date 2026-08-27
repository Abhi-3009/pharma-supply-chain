const crypto = require('crypto');

/**
 * HashChainLedger — Immutable hash-chain for pharmaceutical supply chain integrity.
 *
 * Each block contains:
 *   - index: sequential block number
 *   - timestamp: ISO 8601 creation time
 *   - data: arbitrary payload (drug registration, shipment event, etc.)
 *   - previousHash: hash of the preceding block
 *   - hash: SHA-256( previousHash + JSON(data) + timestamp )
 *
 * Tampering with any block invalidates the chain from that point onward,
 * enabling counterfeit / data-integrity detection via GET /verify.
 */
class HashChainLedger {
  constructor() {
    this.chain = [];
    // Genesis block
    this._createBlock({ type: 'GENESIS', message: 'Pharma Supply Chain Ledger Initialized' }, '0');
  }

  /**
   * Compute SHA-256 hash for a block.
   * @param {string} previousHash
   * @param {object} data
   * @param {string} timestamp
   * @returns {string} hex-encoded hash
   */
  static calculateHash(previousHash, data, timestamp) {
    const payload = previousHash + JSON.stringify(data) + timestamp;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Internal: create a block and append it to the chain.
   */
  _createBlock(data, previousHash) {
    const timestamp = new Date().toISOString();
    const hash = HashChainLedger.calculateHash(previousHash, data, timestamp);

    const block = {
      index: this.chain.length,
      timestamp,
      data,
      previousHash,
      hash,
    };

    this.chain.push(block);
    return block;
  }

  /**
   * Get the most recent block in the chain.
   * @returns {object} latest block
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Add a new block with the given data to the chain.
   * @param {object} data - payload to store in the block
   * @returns {object} the newly created block
   */
  addBlock(data) {
    const previousHash = this.getLatestBlock().hash;
    return this._createBlock(data, previousHash);
  }

  /**
   * Verify the integrity of the entire chain.
   * Re-computes every hash and checks linkage.
   *
   * @returns {{ valid: boolean, invalidBlocks: number[] }}
   */
  verifyChain() {
    const invalidBlocks = [];

    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // Check that previousHash pointer is correct
      if (current.previousHash !== previous.hash) {
        invalidBlocks.push(i);
        continue;
      }

      // Re-compute hash and compare
      const recalculated = HashChainLedger.calculateHash(
        current.previousHash,
        current.data,
        current.timestamp,
      );

      if (current.hash !== recalculated) {
        invalidBlocks.push(i);
      }
    }

    return {
      valid: invalidBlocks.length === 0,
      totalBlocks: this.chain.length,
      invalidBlocks,
    };
  }

  /**
   * Return the full chain.
   * @returns {object[]}
   */
  getChain() {
    return this.chain;
  }

  /**
   * Get a specific block by index.
   * @param {number} index
   * @returns {object|null}
   */
  getBlock(index) {
    return this.chain[index] || null;
  }
}

// Singleton ledger instance shared across the application
const ledger = new HashChainLedger();

module.exports = { HashChainLedger, ledger };
