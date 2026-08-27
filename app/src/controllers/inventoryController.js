const inventoryService = require('../services/inventoryService');

class InventoryController {
  async addStock(req, res, next) {
    try {
      const { drugId, location, quantity } = req.body;
      const inventory = await inventoryService.addStock({ drugId, location, quantity });
      return res.status(200).json({
        message: 'Stock updated successfully',
        inventory,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const inventory = await inventoryService.getInventory();
      return res.status(200).json({
        count: inventory.length,
        inventory,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStock(req, res, next) {
    try {
      const { drugId, location } = req.query;
      const inventory = await inventoryService.getStock(drugId, location);
      return res.status(200).json({ inventory });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
