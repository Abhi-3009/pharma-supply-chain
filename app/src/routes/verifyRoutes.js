const express = require('express');
const verifyController = require('../controllers/verifyController');

const router = express.Router();

// GET /verify - Verify persistent hash-chain ledger integrity
router.get('/verify', verifyController.verify);

// GET /ledger - View full raw hash chain
router.get('/ledger', verifyController.getLedger);

// POST /ledger/tamper - Tamper with a block for testing / demonstration purposes
router.post('/ledger/tamper', verifyController.tamperForTesting);

// GET /api/info - API documentation & architecture overview
router.get('/api/info', verifyController.info);

module.exports = router;
