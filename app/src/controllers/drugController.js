const drugService = require('../services/drugService');

class DrugController {
  async create(req, res, next) {
    try {
      const { name, manufacturer, batchId, expiryDate, description } = req.body;
      const userId = req.user ? req.user.id : null;

      const result = await drugService.registerDrug({
        name,
        manufacturer,
        batchId,
        expiryDate,
        description,
        userId,
      });

      return res.status(201).json({
        message: 'Drug registered successfully',
        drug: result.drug,
        ledgerBlock: result.ledgerBlock,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const drugs = await drugService.getAllDrugs();
      return res.status(200).json({
        count: drugs.length,
        drugs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const drug = await drugService.getDrugById(req.params.id);
      return res.status(200).json({ drug });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DrugController();
