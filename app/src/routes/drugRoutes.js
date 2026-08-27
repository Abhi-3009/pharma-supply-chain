const express = require('express');
const drugController = require('../controllers/drugController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /drugs - Register a new drug (Manufacturer / Admin)
router.post('/', optionalAuthMiddleware, drugController.create);

// GET /drugs - List all registered drugs
router.get('/', drugController.list);

// GET /drugs/:id - Get drug by ID
router.get('/:id', drugController.getById);

module.exports = router;
