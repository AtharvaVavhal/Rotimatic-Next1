// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // eslint-disable-next-line no-console
  console.error(err.stack || err.message);

  res.status(status).json({
    status: 'error',
    message: status === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
