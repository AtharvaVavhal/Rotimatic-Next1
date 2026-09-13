const env = require('./env');

const config = {
  RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: env.RAZORPAY_WEBHOOK_SECRET,
};

function assertGatewayConfigured() {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay is not configured.');
    error.status = 503;
    throw error;
  }
}

config.assertGatewayConfigured = assertGatewayConfigured;
module.exports = config;
