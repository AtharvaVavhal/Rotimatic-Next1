/**
 * Creates an Error carrying an HTTP status, understood by the existing
 * centralized error handler (src/middleware/errorHandler.js). Keeps
 * controllers/services from hand-rolling `err.status = ...` everywhere.
 */
function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = createHttpError;
