const logger = require('../utils/logger');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if the authenticated user has one of the allowed roles
 *
 * @param  {...string} allowedRoles - e.g. ('ADMIN', 'MANUFACTURER')
 */
function roleMiddleware(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required before role verification' });
    }

    const userRole = req.user.role.toUpperCase();

    // ADMIN always has full access
    if (userRole === 'ADMIN' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    logger.warn('RBAC Authorization failed: Forbidden role', {
      userId: req.user.id,
      userRole,
      allowedRoles: normalizedAllowed,
      endpoint: `${req.method} ${req.originalUrl}`,
    });

    return res.status(403).json({
      error: `Access denied. Requires one of roles: ${normalizedAllowed.join(', ')}. Your role is: ${userRole}`,
    });
  };
}

module.exports = roleMiddleware;
