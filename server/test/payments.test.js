const crypto = require('crypto');
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { pool } = require('../src/db/pool');
const gateway = require('../src/services/razorpay.gateway');
const razorpayConfig = require('../src/config/razorpay');
const { amountToPaise } = require('../src/services/payments.service');

const TEST_DOMAIN = 'paymentstest.rotimatic.invalid';
const PASSWORD = 'payment-test-password';
const WEBHOOK_SECRET = 'test-webhook-secret';
const KEY_SECRET = 'test-key-secret';
let providerSequence = 0;

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
}

async function signupAgent(label) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/signup').send({
    firstName: 'Payment',
    lastName: 'Tester',
    email: uniqueEmail(label),
    password: PASSWORD,
    phone: '9000000000',
  });
  assert.equal(response.status, 201);
  return { agent, userId: response.body.data.user.id };
}

async function createLocalOrder(agent, variant = 'black', quantity = 1) {
  const addressResponse = await agent.post('/api/addresses').send({
    fullName: 'Payment Recipient',
    phone: '9111111111',
    addressLine1: '10 Payment Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    isDefault: true,
  });
  assert.equal(addressResponse.status, 201);
  const orderResponse = await agent.post('/api/orders').send({
    variant,
    quantity,
    addressId: addressResponse.body.data.address.id,
  });
  assert.equal(orderResponse.status, 201);
  return orderResponse.body.data.order;
}

function paymentSignature(orderId, paymentId) {
  return crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

function webhookSignature(body) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function configureGateway() {
  razorpayConfig.RAZORPAY_KEY_ID = 'rzp_test_mock';
  razorpayConfig.RAZORPAY_KEY_SECRET = KEY_SECRET;
  razorpayConfig.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  gateway.setGatewayForTests({
    orders: {
      create: async (options) => ({ id: `provider-order-${++providerSequence}`, amount: options.amount, currency: options.currency }),
      fetch: async (id) => ({ id, amount: id.includes('white') ? 1499900 : 2499900, currency: 'INR' }),
    },
    payments: {
      fetch: async (id) => ({ id, order_id: 'provider-order-1', amount: 2499900, currency: 'INR', status: 'captured', method: 'upi' }),
    },
  });
}

async function cleanupTestData() {
  await pool.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`%@${TEST_DOMAIN}`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${TEST_DOMAIN}`]);
}

before(async () => {
  await pool.query('SELECT 1');
  await cleanupTestData();
  configureGateway();
});

beforeEach(() => {
  configureGateway();
});

after(async () => {
  await cleanupTestData();
  gateway.resetGatewayForTests();
  razorpayConfig.RAZORPAY_KEY_ID = '';
  razorpayConfig.RAZORPAY_KEY_SECRET = '';
  razorpayConfig.RAZORPAY_WEBHOOK_SECRET = '';
  await pool.end();
});

describe('Payment integration', { concurrency: false }, () => {
describe('Payment order creation', { concurrency: false }, () => {
  test('rejects unauthenticated, malformed, missing, and foreign orders', async () => {
    const unauthenticated = await request(app).post('/api/payments/create-order').send({ orderId: 'not-an-id' });
    assert.equal(unauthenticated.status, 401);

    const userA = await signupAgent('create-a');
    const userB = await signupAgent('create-b');
    const order = await createLocalOrder(userB.agent);
    const foreign = await userA.agent.post('/api/payments/create-order').send({ orderId: order.id });
    const missing = await userA.agent.post('/api/payments/create-order').send({ orderId: '99999999-9999-4999-8999-999999999999' });
    assert.equal(foreign.status, 404);
    assert.equal(missing.status, 404);
  });

  test('creates a pending Razorpay order from the local total and ignores client amount', async () => {
    const { agent } = await signupAgent('create-valid');
    const order = await createLocalOrder(agent, 'white', 2);
    const response = await agent.post('/api/payments/create-order').send({ orderId: order.id, amount: 1 });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.payment.keyId, 'rzp_test_mock');
    assert.equal(response.body.data.payment.amount, 2999800);
    assert.equal(response.body.data.payment.currency, 'INR');
    assert.equal(response.body.data.payment.status, 'pending');
    const payment = await pool.query('SELECT provider, provider_order_id, amount, currency, status FROM payments WHERE order_id = $1', [order.id]);
    assert.equal(payment.rows[0].provider, 'razorpay');
    assert.equal(payment.rows[0].amount, '29998.00');
    assert.equal(payment.rows[0].status, 'pending');
  });

  test('rejects cancelled and already paid orders', async () => {
    const cancelledUser = await signupAgent('cancelled');
    const cancelled = await createLocalOrder(cancelledUser.agent);
    await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [cancelled.id]);
    const cancelledResponse = await cancelledUser.agent.post('/api/payments/create-order').send({ orderId: cancelled.id });
    assert.equal(cancelledResponse.status, 409);

    const paidUser = await signupAgent('paid');
    const paid = await createLocalOrder(paidUser.agent);
    await pool.query("UPDATE orders SET status = 'confirmed' WHERE id = $1", [paid.id]);
    await pool.query("INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status) VALUES ($1, 'razorpay', $2, $3, $4, 'INR', 'captured')", [paid.id, 'already-paid-provider-order', 'already-paid-provider-payment', '24999.00']);
    const paidResponse = await paidUser.agent.post('/api/payments/create-order').send({ orderId: paid.id });
    assert.equal(paidResponse.status, 409);
  });

  test('converts supported money values exactly to paise', () => {
    assert.equal(amountToPaise('14999.00'), 1499900);
    assert.equal(amountToPaise('24999.00'), 2499900);
    assert.equal(amountToPaise('49998.00'), 4999800);
  });
});

describe('Payment verification', { concurrency: false }, () => {
  test('validates signature, provider association, and confirms the local order', async () => {
    const { agent } = await signupAgent('verify-valid');
    const order = await createLocalOrder(agent);
    const created = await agent.post('/api/payments/create-order').send({ orderId: order.id });
    const providerOrderId = created.body.data.payment.razorpayOrderId;
    const paymentId = 'provider-payment-valid';
    const originalFetchOrder = gateway.createOrder;
    gateway.setGatewayForTests({
      orders: { create: async (options) => ({ id: providerOrderId, amount: options.amount, currency: 'INR' }), fetch: async (id) => ({ id, amount: 2499900, currency: 'INR' }) },
      payments: { fetch: async (id) => ({ id, order_id: providerOrderId, amount: 2499900, currency: 'INR', status: 'captured', method: 'card' }) },
    });

    const response = await agent.post('/api/payments/verify').send({
      orderId: order.id,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: paymentSignature(providerOrderId, paymentId),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.payment.status, 'captured');
    assert.equal(response.body.data.payment.orderStatus, 'confirmed');
    const local = await pool.query('SELECT p.status, p.provider_payment_id, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1', [order.id]);
    assert.equal(local.rows[0].status, 'captured');
    assert.equal(local.rows[0].provider_payment_id, paymentId);
    assert.equal(local.rows[0].order_status, 'confirmed');
    void originalFetchOrder;
  });

  test('rejects invalid signatures and mismatched provider orders', async () => {
    const { agent } = await signupAgent('verify-invalid');
    const order = await createLocalOrder(agent);
    const created = await agent.post('/api/payments/create-order').send({ orderId: order.id });
    const providerOrderId = created.body.data.payment.razorpayOrderId;
    const invalid = await agent.post('/api/payments/verify').send({ orderId: order.id, razorpayOrderId: providerOrderId, razorpayPaymentId: 'payment-invalid', razorpaySignature: 'bad' });
    const wrongOrder = await agent.post('/api/payments/verify').send({ orderId: order.id, razorpayOrderId: 'provider-order-other', razorpayPaymentId: 'payment-invalid', razorpaySignature: paymentSignature('provider-order-other', 'payment-invalid') });
    assert.equal(invalid.status, 400);
    assert.equal(wrongOrder.status, 404);
  });

  test('is idempotent for a repeated captured callback and keeps failed payments pending', async () => {
    const { agent } = await signupAgent('verify-idempotent');
    const order = await createLocalOrder(agent);
    const created = await agent.post('/api/payments/create-order').send({ orderId: order.id });
    const providerOrderId = created.body.data.payment.razorpayOrderId;
    const paymentId = 'provider-payment-repeat';
    gateway.setGatewayForTests({
      orders: { create: async (options) => ({ id: providerOrderId, amount: options.amount, currency: 'INR' }), fetch: async (id) => ({ id, amount: 2499900, currency: 'INR' }) },
      payments: { fetch: async (id) => ({ id, order_id: providerOrderId, amount: 2499900, currency: 'INR', status: 'captured', method: 'upi' }) },
    });
    const payload = { orderId: order.id, razorpayOrderId: providerOrderId, razorpayPaymentId: paymentId, razorpaySignature: paymentSignature(providerOrderId, paymentId) };
    const first = await agent.post('/api/payments/verify').send(payload);
    const second = await agent.post('/api/payments/verify').send(payload);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const count = await pool.query("SELECT count(*)::int AS n FROM payments WHERE order_id = $1 AND provider = 'razorpay'", [order.id]);
    assert.equal(count.rows[0].n, 1);

    const failedUser = await signupAgent('verify-failed');
    const failedOrder = await createLocalOrder(failedUser.agent);
    let failedProviderOrderId;
    gateway.setGatewayForTests({
      orders: {
        create: async (options) => {
          failedProviderOrderId = 'provider-order-failed';
          return { id: failedProviderOrderId, amount: options.amount, currency: 'INR' };
        },
        fetch: async (id) => ({ id, amount: 2499900, currency: 'INR' }),
      },
      payments: { fetch: async (id) => ({ id, order_id: failedProviderOrderId, amount: 2499900, currency: 'INR', status: 'failed', method: 'upi' }) },
    });
    const failedCreated = await failedUser.agent.post('/api/payments/create-order').send({ orderId: failedOrder.id });
    const failedPaymentId = 'provider-payment-failed';
    assert.equal(failedCreated.body.data.payment.razorpayOrderId, failedProviderOrderId);
    const failed = await failedUser.agent.post('/api/payments/verify').send({ orderId: failedOrder.id, razorpayOrderId: failedProviderOrderId, razorpayPaymentId: failedPaymentId, razorpaySignature: paymentSignature(failedProviderOrderId, failedPaymentId) });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data.payment.status, 'failed');
    const failedState = await pool.query('SELECT p.status, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1', [failedOrder.id]);
    assert.equal(failedState.rows[0].status, 'failed');
    assert.equal(failedState.rows[0].order_status, 'pending');
  });
});

describe('Payment webhook', { concurrency: false }, () => {
  test('rejects invalid signatures and processes captured events idempotently', async () => {
    const { agent } = await signupAgent('webhook');
    const order = await createLocalOrder(agent);
    const created = await agent.post('/api/payments/create-order').send({ orderId: order.id });
    const providerOrderId = created.body.data.payment.razorpayOrderId;
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'webhook-payment', order_id: providerOrderId, amount: 2499900, currency: 'INR', status: 'captured', method: 'upi' } } } });
    const invalid = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'bad').send(body);
    const valid = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSignature(body)).send(body);
    const duplicate = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSignature(body)).send(body);
    assert.equal(invalid.status, 400);
    assert.equal(valid.status, 200);
    assert.equal(duplicate.status, 200);
    const state = await pool.query('SELECT p.status, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1', [order.id]);
    assert.equal(state.rows[0].status, 'captured');
    assert.equal(state.rows[0].order_status, 'confirmed');
  });

  test('processes failed events without confirming the order', async () => {
    const { agent } = await signupAgent('webhook-failed');
    const order = await createLocalOrder(agent);
    const created = await agent.post('/api/payments/create-order').send({ orderId: order.id });
    const providerOrderId = created.body.data.payment.razorpayOrderId;
    const body = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'webhook-failed-payment', order_id: providerOrderId, amount: 2499900, currency: 'INR', status: 'failed', method: 'upi' } } } });
    const response = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSignature(body)).send(body);
    assert.equal(response.status, 200);
    const state = await pool.query('SELECT p.status, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1', [order.id]);
    assert.equal(state.rows[0].status, 'failed');
    assert.equal(state.rows[0].order_status, 'pending');
  });
});
});
