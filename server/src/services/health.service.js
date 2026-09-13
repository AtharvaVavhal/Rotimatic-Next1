function getHealthStatus() {
  return {
    status: 'ok',
    message: 'Rotimatic NEXT API is running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

module.exports = { getHealthStatus };
