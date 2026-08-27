const winston = require('winston');
const path = require('path');

/**
 * Application logger — outputs structured JSON logs compatible with ELK Stack.
 *
 * Transports:
 *   - Console: colorized for local development
 *   - File (combined): all logs
 *   - File (error): error-level logs only
 *
 * In production, logs are sent to Logstash via the app's stdout (captured by Docker/K8s).
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'pharma-supply-chain',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// In non-production, log to console with human-readable colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
        }),
      ),
    }),
  );
} else {
  // In production, stream structured JSON directly to stdout for Docker/K8s Logstash ingestion
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

module.exports = logger;
