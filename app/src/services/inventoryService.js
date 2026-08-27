const inventoryRepository = require('../repositories/inventoryRepository');
const drugRepository = require('../repositories/drugRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const logger = require('../utils/logger');

class InventoryService {
  async addStock({ drugId, location, quantity }) {
    if (!drugId || !location || !quantity) {
      const err = new Error('Missing required fields: drugId, location, quantity');
      err.statusCode = 400;
      throw err;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      const err = new Error('Quantity must be a positive integer');
      err.statusCode = 400;
      throw err;
    }

    const drug = await drugRepository.findById(drugId);
    if (!drug) {
      const err = new Error('Drug not found');
      err.statusCode = 404;
      throw err;
    }

    const inventory = await inventoryRepository.addStock({
      drugId,
      location,
      quantity: qty,
    });

    // Record stock addition in ledger
    await ledgerRepository.appendBlock({
      eventType: 'INVENTORY_STOCK_ADDED',
      entityType: 'INVENTORY',
      entityId: inventory.id,
      payload: {
        inventoryId: inventory.id,
        drugId,
        drugName: drug.name,
        location,
        quantityAdded: qty,
        totalQuantity: inventory.quantity,
      },
    });

    logger.info('Inventory stock updated', {
      drugId,
      location,
      quantityAdded: qty,
      newTotal: inventory.quantity,
    });

    return inventory;
  }

  async getInventory() {
    return inventoryRepository.findAll();
  }

  async getStock(drugId, location) {
    return inventoryRepository.findByDrugAndLocation(drugId, location);
  }
}

module.exports = new InventoryService();
