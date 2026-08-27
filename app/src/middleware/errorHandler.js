const logger = require('../utils/logger');

/**
 * Centralized error handler middleware
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    logger.error('Unhandled Server Error', {
      error: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Client Error', {
      statusCode,
      message: err.message,
      path: req.originalUrl,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
