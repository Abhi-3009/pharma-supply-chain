const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /inventory/stock - Add / restock inventory
router.post('/stock', optionalAuthMiddleware, inventoryController.addStock);

// GET /inventory - List all inventory
router.get('/', inventoryController.list);

// GET /inventory/item - Get specific drug stock
router.get('/item', inventoryController.getStock);

module.exports = router;
