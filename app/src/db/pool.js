const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../utils/logger');
const mockDb = require('./inMemoryAdapter');

let pool = null;
let useMock = config.USE_IN_MEMORY_DB || process.env.NODE_ENV === 'test';

/**
 * Initialize or get PostgreSQL connection pool
 */
function getPool() {
  if (useMock) {
    return null;
  }

  if (!pool) {
    const poolConfig = config.DATABASE_URL
      ? {
          connectionString: config.DATABASE_URL,
          ssl: config.PG.ssl,
          max: config.PG.max,
        }
      : {
          host: config.PG.host,
          port: config.PG.port,
          user: config.PG.user,
          password: config.PG.password,
          database: config.PG.database,
          ssl: config.PG.ssl,
          max: config.PG.max,
          idleTimeoutMillis: config.PG.idleTimeoutMillis,
          connectionTimeoutMillis: config.PG.connectionTimeoutMillis,
        };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
    });
  }
  return pool;
}

/**
 * Execute a single query with parameters
 * @param {string} text - SQL statement
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  if (useMock) {
    return mockDb.query(text, params);
  }

  try {
    const start = Date.now();
    const res = await getPool().query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    // If PostgreSQL connection fails in test/development, fallback to mock DB gracefully
    if (process.env.NODE_ENV === 'test' || config.NODE_ENV === 'development') {
      logger.warn('PostgreSQL unavailable, falling back to in-memory database simulator', { error: error.message });
      useMock = true;
      return mockDb.query(text, params);
    }
    throw error;
  }
}

/**
 * Acquire client from pool
 */
async function getClient() {
  if (useMock) {
    return {
      query: (text, params) => mockDb.query(text, params),
      release: () => {},
    };
  }

  try {
    return getPool().connect();
  } catch (error) {
    if (process.env.NODE_ENV === 'test' || config.NODE_ENV === 'development') {
      logger.warn('PostgreSQL connect failed, using mock client', { error: error.message });
      useMock = true;
      return {
        query: (text, params) => mockDb.query(text, params),
        release: () => {},
      };
    }
    throw error;
  }
}

/**
 * Execute operations within an atomic database transaction
 */
async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back due to error', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL connection pool closed');
  }
}

function setUseMock(val) {
  useMock = val;
}

module.exports = {
  getPool,
  query,
  getClient,
  withTransaction,
  closePool,
  setUseMock,
  mockDb,
};
