const env = require('./env');

const config = {
  RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: env.RAZORPAY_WEBHOOK_SECRET,
};

// Guards the create-order / verify-payment paths, which need the API
// key pair but never touch the webhook secret.
function assertGatewayConfigured() {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay is not configured.');
    error.status = 503;
    throw error;
  }
}

// Guards the webhook path specifically. Without this, a missing
// RAZORPAY_WEBHOOK_SECRET still fails closed today (verifyWebhookSignature
// treats a falsy secret as an automatic no-match), but it surfaces as a
// generic "Invalid webhook signature" 400 indistinguishable from a real
// forged request — making a misconfiguration invisible in logs/alerts.
// This gives it a distinct, loud 503 instead.
function assertWebhookConfigured() {
  if (!config.RAZORPAY_WEBHOOK_SECRET) {
    const error = new Error('Razorpay webhook secret is not configured.');
    error.status = 503;
    throw error;
  }
}

config.assertGatewayConfigured = assertGatewayConfigured;
config.assertWebhookConfigured = assertWebhookConfigured;
module.exports = config;