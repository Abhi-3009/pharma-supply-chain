const drugRepository = require('../repositories/drugRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const logger = require('../utils/logger');

class DrugService {
  async registerDrug({ name, manufacturer, batchId, expiryDate, description, userId }) {
    if (!name || !manufacturer || !batchId || !expiryDate) {
      const err = new Error('Missing required fields: name, manufacturer, batchId, expiryDate');
      err.statusCode = 400;
      throw err;
    }

    const existing = await drugRepository.findByBatchId(batchId);
    if (existing) {
      const err = new Error(`Drug with batchId '${batchId}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const drug = await drugRepository.create({
      name,
      manufacturer,
      manufacturerId: userId || null,
      batchId,
      expiryDate,
      description,
    });

    // Record in persistent ledger
    const ledgerBlock = await ledgerRepository.appendBlock({
      eventType: 'DRUG_REGISTRATION',
      entityType: 'DRUG',
      entityId: drug.id,
      payload: {
        drugId: drug.id,
        name: drug.name,
        manufacturer: drug.manufacturer,
        batchId: drug.batch_id,
        expiryDate: drug.expiry_date,
      },
    });

    logger.info('Drug registered successfully', {
      drugId: drug.id,
      batchId: drug.batch_id,
      blockIndex: ledgerBlock.block_index,
    });

    return {
      drug,
      ledgerBlock: {
        index: ledgerBlock.block_index,
        hash: ledgerBlock.hash,
      },
    };
  }

  async getAllDrugs() {
    return drugRepository.findAll();
  }

  async getDrugById(id) {
    const drug = await drugRepository.findById(id);
    if (!drug) {
      const err = new Error('Drug not found');
      err.statusCode = 404;
      throw err;
    }
    return drug;
  }
}

module.exports = new DrugService();
