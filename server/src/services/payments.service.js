const crypto = require('crypto');
const paymentsDb = require('../db/payments.db');
const ordersDb = require('../db/orders.db');
const razorpayGateway = require('./razorpay.gateway');
const razorpayConfig = require('../config/razorpay');
const { pool } = require('../db/pool');
const createHttpError = require('../utils/httpError');

const PROVIDER = 'razorpay';

function amountToPaise(amount) {
  const text = String(amount);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw createHttpError(500, 'Invalid local order amount.');
  const paise = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw createHttpError(500, 'Invalid local order amount.');
  }
  return Number(paise);
}

function verifySignature(orderId, paymentId, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(signature, 'hex');
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const suppliedBuffer = Buffer.from(signature, 'hex');
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function safePayment(payment, order) {
  return {
    keyId: razorpayConfig.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.provider_order_id,
    razorpayPaymentId: payment.provider_payment_id || null,
    orderId: order.id,
    amount: amountToPaise(order.total_amount),
    currency: order.currency,
    status: payment.status,
    orderStatus: order.status,
  };
}

async function withPaymentTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createPaymentOrder(userId, orderId) {
  razorpayConfig.assertGatewayConfigured();
  const order = await ordersDb.findOrderForUser(orderId, userId);
  if (!order) throw createHttpError(404, 'Order not found.');
  if (order.status !== 'pending') throw createHttpError(409, 'This order is not eligible for payment.');

  const amount = amountToPaise(order.total_amount);
  const existing = await paymentsDb.findPaymentForOrderUser(orderId, userId, PROVIDER);
  if (existing && existing.status === 'captured') throw createHttpError(409, 'This order has already been paid.');
  if (existing && existing.provider_order_id && existing.status === 'pending') {
    return safePayment(existing, order);
  }
  if (order.currency !== 'INR') throw createHttpError(400, 'This order uses an unsupported currency.');

  const providerOrder = await razorpayGateway.createOrder({
    amount,
    currency: order.currency,
    receipt: order.order_number,
    notes: { local_order_id: order.id },
  });
  if (!providerOrder || !providerOrder.id || Number(providerOrder.amount) !== amount || providerOrder.currency !== order.currency) {
    throw createHttpError(502, 'Payment gateway returned an invalid order.');
  }

  const payment = await paymentsDb.insertPendingPayment({
    orderId,
    provider: PROVIDER,
    providerOrderId: providerOrder.id,
    amount: order.total_amount,
    currency: order.currency,
  });
  return safePayment(payment, order);
}

function providerStatus(providerPayment) {
  if (providerPayment.status === 'captured') return 'captured';
  if (providerPayment.status === 'authorized') return 'authorized';
  if (providerPayment.status === 'failed') return 'failed';
  throw createHttpError(400, 'Payment is not in a supported state.');
}

async function verifyPayment(userId, input) {
  const order = await ordersDb.findOrderForUser(input.orderId, userId);
  if (!order) throw createHttpError(404, 'Order not found.');
  const payment = await paymentsDb.findPaymentForOrderUser(input.orderId, userId, PROVIDER);
  if (!payment || payment.provider_order_id !== input.razorpayOrderId) {
    throw createHttpError(404, 'Payment order not found.');
  }
  if (!verifySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, razorpayConfig.RAZORPAY_KEY_SECRET)) {
    throw createHttpError(400, 'Invalid payment signature.');
  }
  if (payment.status === 'captured' && payment.provider_payment_id === input.razorpayPaymentId && order.status === 'confirmed') {
    return safePayment(payment, order);
  }
  if (order.status !== 'pending') throw createHttpError(409, 'This order is not eligible for payment verification.');

  const providerOrder = await razorpayGateway.fetchOrder(input.razorpayOrderId);
  const providerPayment = await razorpayGateway.fetchPayment(input.razorpayPaymentId);
  const expectedAmount = amountToPaise(order.total_amount);
  if (!providerOrder || providerOrder.id !== input.razorpayOrderId || Number(providerOrder.amount) !== expectedAmount || providerOrder.currency !== order.currency) {
    throw createHttpError(400, 'Payment order does not match the local order.');
  }
  if (!providerPayment || providerPayment.id !== input.razorpayPaymentId || providerPayment.order_id !== input.razorpayOrderId || Number(providerPayment.amount) !== expectedAmount || providerPayment.currency !== order.currency) {
    throw createHttpError(400, 'Payment does not match the local order.');
  }

  const status = providerStatus(providerPayment);
  const result = await withPaymentTransaction(async (client) => {
    const updatedPayment = await paymentsDb.updatePaymentState(payment.id, {
      provider: PROVIDER,
      providerPaymentId: providerPayment.id,
      status,
      method: providerPayment.method,
    }, client);
    let updatedOrder = order;
    if (status === 'captured') updatedOrder = await paymentsDb.confirmOrder(order.id, client) || order;
    return { payment: updatedPayment, order: updatedOrder };
  });
  return safePayment(result.payment, result.order);
}

async function handleWebhook(rawBody, signature) {
  razorpayConfig.assertWebhookConfigured();
  if (!verifyWebhookSignature(rawBody, signature, razorpayConfig.RAZORPAY_WEBHOOK_SECRET)) {
    throw createHttpError(400, 'Invalid webhook signature.');
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    throw createHttpError(400, 'Invalid webhook payload.');
  }

  const supportedEvents = ['payment.captured', 'payment.authorized', 'payment.failed'];
  if (!supportedEvents.includes(event.event)) return { received: true, processed: false };
  const entity = event.payload && event.payload.payment && event.payload.payment.entity;
  if (!entity || !entity.order_id || !entity.id) return { received: true, processed: false };

  const payment = await paymentsDb.findByProviderOrderId(PROVIDER, entity.order_id);
  if (!payment) return { received: true, processed: false };
  if (payment.status === 'captured' && event.event === 'payment.captured') return { received: true, processed: true };

  const expectedAmount = amountToPaise(payment.amount);
  if (Number(entity.amount) !== expectedAmount || entity.currency !== payment.currency) {
    throw createHttpError(400, 'Webhook payment does not match the local payment.');
  }
  const status = event.event === 'payment.captured' ? 'captured' : event.event === 'payment.authorized' ? 'authorized' : 'failed';
  await withPaymentTransaction(async (client) => {
    await paymentsDb.updatePaymentState(payment.id, {
      provider: PROVIDER,
      providerPaymentId: entity.id,
      status,
      method: entity.method,
    }, client);
    if (status === 'captured') await paymentsDb.confirmOrder(payment.order_id, client);
  });
  return { received: true, processed: true, orderStatus: status === 'captured' ? 'confirmed' : 'pending' };
}

module.exports = { createPaymentOrder, verifyPayment, handleWebhook, amountToPaise, verifySignature, verifyWebhookSignature };