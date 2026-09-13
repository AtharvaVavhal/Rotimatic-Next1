/**
 * Wraps an async Express handler so rejected promises are forwarded
 * to the centralized error-handling middleware instead of crashing.
 */
function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
