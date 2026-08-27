const ledgerService = require('../services/ledgerService');

class VerifyController {
  async verify(req, res, next) {
    try {
      const result = await ledgerService.verifyChain();
      return res.status(200).json({
        message: result.valid
          ? '✅ Supply chain integrity verified — no tampering detected'
          : '❌ ALERT: Supply chain integrity compromised — tampering detected!',
        verification: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLedger(req, res, next) {
    try {
      const chain = await ledgerService.getChain();
      return res.status(200).json({
        totalBlocks: chain.length,
        chain,
      });
    } catch (error) {
      next(error);
    }
  }

  async tamperForTesting(req, res, next) {
    try {
      const { blockIndex, payload } = req.body;
      const modified = await ledgerService.tamperBlockForTesting(blockIndex, payload);
      return res.status(200).json({
        message: `Block #${blockIndex} has been intentionally modified for testing`,
        modified,
      });
    } catch (error) {
      next(error);
    }
  }

  info(req, res) {
    return res.status(200).json({
      name: 'Pharmaceutical Supply Chain API',
      version: '2.0.0',
      description: 'Secure supply chain management with PostgreSQL transactions and persistent SHA-256 hash-chain ledger',
      architecture: 'Modular Monolith with Layered Clean Architecture (Routes -> Controllers -> Services -> Repositories -> PostgreSQL)',
      endpoints: {
        'POST /auth/register': 'Register a new user (Admin, Manufacturer, Distributor, Warehouse, Pharmacy)',
        'POST /auth/login': 'Authenticate and receive JWT token',
        'GET /auth/me': 'Get authenticated user details',
        'POST /drugs': 'Register a new drug (Manufacturer/Admin)',
        'GET /drugs': 'List all registered drugs',
        'GET /drugs/:id': 'Get drug by ID',
        'POST /inventory/stock': 'Restock inventory at a location (Manufacturer/Warehouse/Admin)',
        'GET /inventory': 'List all stock levels across supply chain locations',
        'POST /shipments': 'Create shipment with atomic inventory check & deduction (Manufacturer/Distributor/Warehouse/Admin)',
        'GET /shipments': 'List all shipments',
        'GET /shipments/:id': 'Track shipment with full audit trail events',
        'PUT /shipments/:id/status': 'Update shipment checkpoint status (Distributor/Warehouse/Pharmacy/Admin)',
        'GET /verify': 'Verify cryptographic integrity of the persistent hash-chain ledger',
        'GET /ledger': 'View raw hash-chain ledger blocks',
        'GET /health': 'Service liveness & readiness check',
      },
    });
  }
}

module.exports = new VerifyController();
