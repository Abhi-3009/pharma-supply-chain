const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * Authentication Middleware: Extracts & verifies JWT token from Authorization header
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Missing or malformed Authorization header (Bearer <token>)',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = authService.verifyToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message, ip: req.ip });
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Optional Authentication: Attaches user if token is present, but allows request if not
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      };
    } catch {
      // Continue without user
    }
  }
  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
};
