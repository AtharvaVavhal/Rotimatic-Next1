const createHttpError = require('../utils/httpError');

function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(createHttpError(401, 'Not authenticated.'));
  }
  if (req.user.role !== 'admin') {
    return next(createHttpError(403, 'Admin access required.'));
  }
  return next();
}

module.exports = { requireAdmin };
