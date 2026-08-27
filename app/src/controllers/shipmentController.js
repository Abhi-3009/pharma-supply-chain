const shipmentService = require('../services/shipmentService');

class ShipmentController {
  async create(req, res, next) {
    try {
      const { drugId, drugName, origin, destination, quantity } = req.body;
      const userId = req.user ? req.user.id : null;

      const result = await shipmentService.createShipment({
        drugId,
        drugName,
        origin,
        destination,
        quantity,
        userId,
      });

      return res.status(201).json({
        message: 'Shipment created successfully',
        shipment: result.shipment,
        ledgerBlock: result.ledgerBlock,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const shipments = await shipmentService.getAllShipments();
      return res.status(200).json({
        count: shipments.length,
        shipments,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const shipment = await shipmentService.getShipmentById(req.params.id);
      return res.status(200).json({ shipment });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { status, location } = req.body;
      const userId = req.user ? req.user.id : null;

      const result = await shipmentService.updateStatus({
        shipmentId: req.params.id,
        status,
        location,
        userId,
      });

      return res.status(200).json({
        message: 'Shipment status updated successfully',
        shipment: result.shipment,
        ledgerBlock: result.ledgerBlock,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ShipmentController();
