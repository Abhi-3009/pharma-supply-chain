const ledgerRepository = require('../repositories/ledgerRepository');
const logger = require('../utils/logger');

class LedgerService {
  /**
   * Verify the integrity of the persistent hash chain
   * Re-calculates SHA-256 hashes and verifies cryptographic linkage
   */
  async verifyChain() {
    const blocks = await ledgerRepository.getAllBlocks();
    const invalidBlocks = [];

    if (blocks.length === 0) {
      return {
        valid: true,
        totalBlocks: 0,
        invalidBlocks: [],
      };
    }

    for (let i = 1; i < blocks.length; i++) {
      const current = blocks[i];
      const previous = blocks[i - 1];

      // 1. Check previousHash pointer
      if (current.previous_hash !== previous.hash) {
        logger.warn('Ledger linkage broken', {
          blockIndex: current.block_index,
          expectedPreviousHash: previous.hash,
          actualPreviousHash: current.previous_hash,
        });
        invalidBlocks.push(current.block_index);
        continue;
      }

      // 2. Recompute hash from payload and timestamp
      const recalculatedHash = ledgerRepository.constructor.calculateHash(
        current.previous_hash,
        current.payload,
        current.created_at.toISOString ? current.created_at.toISOString() : current.created_at
      );

      if (current.hash !== recalculatedHash) {
        logger.warn('Ledger hash mismatch (data tampered)', {
          blockIndex: current.block_index,
          storedHash: current.hash,
          recalculatedHash,
        });
        invalidBlocks.push(current.block_index);
      }
    }

    const isValid = invalidBlocks.length === 0;

    if (isValid) {
      logger.info('Persistent ledger verification passed', { totalBlocks: blocks.length });
    } else {
      logger.warn('Persistent ledger verification FAILED — tampering detected', {
        totalBlocks: blocks.length,
        invalidBlocks,
      });
    }

    return {
      valid: isValid,
      totalBlocks: blocks.length,
      invalidBlocks,
    };
  }

  async getChain() {
    return ledgerRepository.getAllBlocks();
  }

  async tamperBlockForTesting(blockIndex, modifiedPayload) {
    return ledgerRepository.tamperBlock(blockIndex, modifiedPayload);
  }
}

module.exports = new LedgerService();
