const express = require('express');
const shipmentController = require('../controllers/shipmentController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /shipments - Create a new shipment (atomic inventory deduction & transaction)
router.post('/', optionalAuthMiddleware, shipmentController.create);

// GET /shipments - List all shipments
router.get('/', shipmentController.list);

// GET /shipments/:id - Track a shipment
router.get('/:id', shipmentController.getById);

// PUT /shipments/:id/status - Update shipment status
router.put('/:id/status', optionalAuthMiddleware, shipmentController.updateStatus);

module.exports = router;
