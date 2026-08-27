const { withTransaction } = require('../db/pool');
const shipmentRepository = require('../repositories/shipmentRepository');
const drugRepository = require('../repositories/drugRepository');
const inventoryRepository = require('../repositories/inventoryRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const logger = require('../utils/logger');

const VALID_STATUSES = ['created', 'in-transit', 'at-checkpoint', 'delivered', 'recalled'];

class ShipmentService {
  /**
   * Create shipment using an ATOMIC DATABASE TRANSACTION with ROW-LEVEL LOCKING
   */
  async createShipment({ drugId, drugName, origin, destination, quantity, userId }) {
    if (!drugId || !drugName || !origin || !destination) {
      const err = new Error('Missing required fields: drugId, drugName, origin, destination');
      err.statusCode = 400;
      throw err;
    }

    const qty = parseInt(quantity || 1, 10);
    if (isNaN(qty) || qty <= 0) {
      const err = new Error('Quantity must be a positive integer');
      err.statusCode = 400;
      throw err;
    }

    // Execute within an atomic transaction
    return await withTransaction(async (client) => {
      // 1. Verify drug exists
      const drug = await drugRepository.findById(drugId, client);
      if (!drug) {
        const err = new Error(`Drug with ID '${drugId}' not found`);
        err.statusCode = 404;
        throw err;
      }

      // 2. Lock inventory row at origin with FOR UPDATE to prevent race conditions
      const inventory = await inventoryRepository.findByDrugAndLocationForUpdate(drugId, origin, client);

      if (!inventory) {
        const err = new Error(`No inventory found for drug '${drug.name}' at origin '${origin}'`);
        err.statusCode = 400;
        throw err;
      }

      if (inventory.quantity < qty) {
        const err = new Error(
          `Insufficient inventory at origin '${origin}'. Requested: ${qty}, Available: ${inventory.quantity}`
        );
        err.statusCode = 400;
        throw err;
      }

      // 3. Deduct inventory from origin
      const updatedInventory = await inventoryRepository.deductStock(
        { drugId, location: origin, quantity: qty },
        client
      );

      if (!updatedInventory) {
        const err = new Error('Failed to reserve inventory: stock changed concurrently');
        err.statusCode = 409;
        throw err;
      }

      // 4. Create shipment record
      const shipment = await shipmentRepository.create(
        {
          drugId,
          drugName: drug.name,
          origin,
          destination,
          quantity: qty,
          createdBy: userId,
        },
        client
      );

      // 5. Create initial audit event
      await shipmentRepository.addEvent(
        {
          shipmentId: shipment.id,
          status: 'created',
          location: origin,
          updatedBy: userId,
        },
        client
      );

      // 6. Append to persistent SHA-256 ledger
      const ledgerBlock = await ledgerRepository.appendBlock(
        {
          eventType: 'SHIPMENT_CREATED',
          entityType: 'SHIPMENT',
          entityId: shipment.id,
          payload: {
            shipmentId: shipment.id,
            drugId: shipment.drug_id,
            drugName: shipment.drug_name,
            origin: shipment.origin,
            destination: shipment.destination,
            quantity: shipment.quantity,
          },
        },
        client
      );

      logger.info('Shipment created atomically within transaction', {
        shipmentId: shipment.id,
        drugId,
        origin,
        quantity: qty,
        remainingOriginStock: updatedInventory.quantity,
        ledgerIndex: ledgerBlock.block_index,
      });

      return {
        shipment: {
          ...shipment,
          statusHistory: [
            {
              status: 'created',
              location: origin,
              timestamp: shipment.created_at,
            },
          ],
        },
        ledgerBlock: {
          index: ledgerBlock.block_index,
          hash: ledgerBlock.hash,
        },
      };
    });
  }

  /**
   * Update shipment status
   */
  async updateStatus({ shipmentId, status, location, userId }) {
    if (!status) {
      const err = new Error('Missing required field: status');
      err.statusCode = 400;
      throw err;
    }

    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    return await withTransaction(async (client) => {
      const existing = await shipmentRepository.findById(shipmentId, client);
      if (!existing) {
        const err = new Error('Shipment not found');
        err.statusCode = 404;
        throw err;
      }

      const eventLocation = location || existing.origin;

      // Update shipment status
      await shipmentRepository.updateStatus({ shipmentId, status }, client);

      // Add event record
      await shipmentRepository.addEvent(
        {
          shipmentId,
          status,
          location: eventLocation,
          updatedBy: userId,
        },
        client
      );

      // If delivered at destination, add stock to destination inventory
      if (status === 'delivered') {
        await inventoryRepository.addStock(
          {
            drugId: existing.drug_id,
            location: existing.destination,
            quantity: existing.quantity,
          },
          client
        );
      }

      // Record in persistent ledger
      const ledgerBlock = await ledgerRepository.appendBlock(
        {
          eventType: 'SHIPMENT_STATUS_UPDATE',
          entityType: 'SHIPMENT',
          entityId: shipmentId,
          payload: {
            shipmentId,
            drugId: existing.drug_id,
            status,
            location: eventLocation,
          },
        },
        client
      );

      // Fetch refreshed shipment with full history
      const fullShipment = await shipmentRepository.findById(shipmentId, client);

      logger.info('Shipment status updated', {
        shipmentId,
        status,
        location: eventLocation,
        blockIndex: ledgerBlock.block_index,
      });

      return {
        shipment: fullShipment,
        ledgerBlock: {
          index: ledgerBlock.block_index,
          hash: ledgerBlock.hash,
        },
      };
    });
  }

  async getShipmentById(id) {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) {
      const err = new Error('Shipment not found');
      err.statusCode = 404;
      throw err;
    }
    return shipment;
  }

  async getAllShipments() {
    return shipmentRepository.findAll();
  }
}

module.exports = new ShipmentService();
