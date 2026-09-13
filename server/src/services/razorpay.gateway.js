const Razorpay = require('razorpay');
const razorpayConfig = require('../config/razorpay');

let gateway;

function getGateway() {
  razorpayConfig.assertGatewayConfigured();
  if (!gateway) {
    gateway = new Razorpay({ key_id: razorpayConfig.RAZORPAY_KEY_ID, key_secret: razorpayConfig.RAZORPAY_KEY_SECRET });
  }
  return gateway;
}

async function createOrder(options) {
  return getGateway().orders.create(options);
}

async function fetchOrder(orderId) {
  return getGateway().orders.fetch(orderId);
}

async function fetchPayment(paymentId) {
  return getGateway().payments.fetch(paymentId);
}

function setGatewayForTests(testGateway) {
  gateway = testGateway;
}

function resetGatewayForTests() {
  gateway = undefined;
}

module.exports = { createOrder, fetchOrder, fetchPayment, setGatewayForTests, resetGatewayForTests };
