const app = require('./server');
const config = require('./config/env');
const { runMigrations } = require('./db/migrations');
const { closePool } = require('./db/pool');
const logger = require('./utils/logger');

const PORT = config.PORT;

async function startServer() {
  try {
    // Run database migrations on startup
    await runMigrations();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${config.NODE_ENV}]`);
      logger.info(`API endpoints available at http://localhost:${PORT}/api/info`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await closePool();
        logger.info('HTTP server closed, exiting process');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();
