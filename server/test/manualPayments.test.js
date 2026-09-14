const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { pool } = require('../src/db/pool');

const DOMAIN = 'manualpaytest.rotimatic.invalid';
const PASSWORD = 'manual-payment-test-password';

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${DOMAIN}`;
}

async function signupAgent(label) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/signup').send({
    firstName: 'Manual',
    lastName: 'Tester',
    email: uniqueEmail(label),
    password: PASSWORD,
    phone: '9000000000',
  });
  assert.equal(response.status, 201);
  return { agent, userId: response.body.data.user.id, email: response.body.data.user.email };
}

async function createLocalOrder(agent, variant = 'white', quantity = 1) {
  const addressResponse = await agent.post('/api/addresses').send({
    fullName: 'Manual Payment Recipient',
    phone: '9111111111',
    addressLine1: '1 Manual Street',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
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

async function makeAdmin(userId) {
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

async function cleanupTestData() {
  await pool.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`%@${DOMAIN}`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${DOMAIN}`]);
  await pool.query('DELETE FROM payment_settings WHERE id = 1');
}

before(async () => {
  await pool.query('SELECT 1');
  await cleanupTestData();
});

after(async () => {
  await cleanupTestData();
  await pool.end();
});

describe('Manual UPI/QR payments', { concurrency: false }, () => {
  describe('GET /api/payments/manual/config', () => {
    test('reports disabled with no fabricated UPI ID/QR when unconfigured, and reflects real admin config once set', async () => {
      const unconfigured = await request(app).get('/api/payments/manual/config');
      assert.equal(unconfigured.status, 200);
      assert.equal(unconfigured.body.data.config.enabled, false);
      assert.equal(unconfigured.body.data.config.upiId, null);
      assert.equal(unconfigured.body.data.config.qrImagePath, null);

      const admin = await signupAgent('config-admin');
      await makeAdmin(admin.userId);
      const updateResponse = await admin.agent.patch('/api/admin/payment-settings').send({
        upiId: 'client@upi',
        qrImagePath: 'assets/qr-code.png',
      });
      assert.equal(updateResponse.status, 200);
      assert.equal(updateResponse.body.data.paymentSettings.manualUpiEnabled, true);
      assert.equal(updateResponse.body.data.paymentSettings.upiId, 'client@upi');
      assert.equal(JSON.stringify(updateResponse.body).includes('RAZORPAY'), false);

      const configured = await request(app).get('/api/payments/manual/config');
      assert.equal(configured.status, 200);
      assert.equal(configured.body.data.config.enabled, true);
      assert.equal(configured.body.data.config.upiId, 'client@upi');
      assert.equal(configured.body.data.config.qrImagePath, 'assets/qr-code.png');
    });
  });

  describe('Admin payment settings', () => {
    test('rejects unauthenticated and non-admin access, and invalid values', async () => {
      const customer = await signupAgent('settings-customer');
      assert.equal((await request(app).get('/api/admin/payment-settings')).status, 401);
      assert.equal((await customer.agent.get('/api/admin/payment-settings')).status, 403);
      assert.equal((await request(app).patch('/api/admin/payment-settings').send({ upiId: 'x@y' })).status, 401);
      assert.equal((await customer.agent.patch('/api/admin/payment-settings').send({ upiId: 'x@y' })).status, 403);

      const admin = await signupAgent('settings-admin');
      await makeAdmin(admin.userId);
      const badUpi = await admin.agent.patch('/api/admin/payment-settings').send({ upiId: 'not-a-upi-id' });
      assert.equal(badUpi.status, 400);
      const badPath = await admin.agent.patch('/api/admin/payment-settings').send({ qrImagePath: '../../etc/passwd' });
      assert.equal(badPath.status, 400);
      const badPath2 = await admin.agent.patch('/api/admin/payment-settings').send({ qrImagePath: '/etc/passwd.png' });
      assert.equal(badPath2.status, 400);
      const badPath3 = await admin.agent.patch('/api/admin/payment-settings').send({ qrImagePath: 'assets/script.exe' });
      assert.equal(badPath3.status, 400);
    });

    test('admin can read current settings without exposing Razorpay secrets', async () => {
      const admin = await signupAgent('settings-read-admin');
      await makeAdmin(admin.userId);
      const response = await admin.agent.get('/api/admin/payment-settings');
      assert.equal(response.status, 200);
      assert.ok('razorpayConfigured' in response.body.data.paymentSettings);
      assert.equal(JSON.stringify(response.body).includes('RAZORPAY_KEY_SECRET'), false);
      assert.equal(JSON.stringify(response.body).includes('RAZORPAY_WEBHOOK_SECRET'), false);
    });
  });

  describe('POST /api/payments/manual', () => {
    test('rejects unauthenticated submission', async () => {
      const response = await request(app)
        .post('/api/payments/manual')
        .send({ orderId: '11111111-1111-4111-8111-111111111111', referenceId: '123456789012' });
      assert.equal(response.status, 401);
    });

    test('rejects invalid orderId and referenceId shapes', async () => {
      const { agent } = await signupAgent('validation');
      const order = await createLocalOrder(agent);
      const badOrderId = await agent.post('/api/payments/manual').send({ orderId: 'not-a-uuid', referenceId: '123456789012' });
      const missingRef = await agent.post('/api/payments/manual').send({ orderId: order.id });
      const shortRef = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: 'ab' });
      const badCharsRef = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '<script>x' });
      assert.equal(badOrderId.status, 400);
      assert.equal(missingRef.status, 400);
      assert.equal(shortRef.status, 400);
      assert.equal(badCharsRef.status, 400);
    });

    test('rejects an order owned by another user and an unknown order', async () => {
      const userA = await signupAgent('owner-a');
      const userB = await signupAgent('owner-b');
      const orderB = await createLocalOrder(userB.agent);
      const foreign = await userA.agent.post('/api/payments/manual').send({ orderId: orderB.id, referenceId: '123456789012' });
      const unknown = await userA.agent
        .post('/api/payments/manual')
        .send({ orderId: '99999999-9999-4999-8999-999999999999', referenceId: '123456789012' });
      assert.equal(foreign.status, 404);
      assert.equal(unknown.status, 404);
    });

    test('rejects submission for a non-pending order', async () => {
      const { agent } = await signupAgent('nonpending');
      const order = await createLocalOrder(agent);
      await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
      const response = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '123456789012' });
      assert.equal(response.status, 409);
    });

    test('creates a pending manual payment using the local order amount, ignoring any client-supplied amount/status', async () => {
      const { agent } = await signupAgent('create-valid');
      const order = await createLocalOrder(agent, 'white', 2);
      const response = await agent.post('/api/payments/manual').send({
        orderId: order.id,
        referenceId: '987654321098',
        amount: '1.00',
        status: 'captured',
      });
      assert.equal(response.status, 201);
      const payment = response.body.data.payment;
      assert.equal(payment.provider, 'manual_upi');
      assert.equal(payment.status, 'pending');
      assert.equal(payment.amount, order.totalAmount);
      assert.equal(payment.referenceId, '987654321098');
      assert.equal(payment.orderStatus, 'pending');

      const row = await pool.query(
        `SELECT amount, status, reference_id FROM payments WHERE order_id = $1 AND provider = 'manual_upi'`,
        [order.id]
      );
      assert.equal(row.rows[0].amount, order.totalAmount);
      assert.equal(row.rows[0].status, 'pending');
      assert.equal(row.rows[0].reference_id, '987654321098');

      const orderRow = await pool.query('SELECT status FROM orders WHERE id = $1', [order.id]);
      assert.equal(orderRow.rows[0].status, 'pending');
    });

    test('is idempotent: resubmitting for the same order updates the one pending row instead of duplicating it', async () => {
      const { agent } = await signupAgent('idempotent');
      const order = await createLocalOrder(agent);
      const first = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '111122223333' });
      const second = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '444455556666' });
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(second.body.data.payment.referenceId, '444455556666');

      const count = await pool.query(
        `SELECT count(*)::int AS n FROM payments WHERE order_id = $1 AND provider = 'manual_upi'`,
        [order.id]
      );
      assert.equal(count.rows[0].n, 1);
    });

    test('rejects submission once the order already has a captured manual payment', async () => {
      const { agent } = await signupAgent('already-paid');
      const order = await createLocalOrder(agent);
      const submit = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '111122223333' });
      const paymentId = submit.body.data.payment.id;
      await pool.query(
        `UPDATE payments SET status = 'captured' WHERE id = $1`,
        [paymentId]
      );
      const resubmit = await agent.post('/api/payments/manual').send({ orderId: order.id, referenceId: '999988887777' });
      assert.equal(resubmit.status, 409);
    });
  });

  describe('Admin manual payment verification', () => {
    async function setupPendingManualPayment(label) {
      const customer = await signupAgent(`${label}-customer`);
      const order = await createLocalOrder(customer.agent);
      const submit = await customer.agent
        .post('/api/payments/manual')
        .send({ orderId: order.id, referenceId: '135791113151' });
      assert.equal(submit.status, 201);
      const admin = await signupAgent(`${label}-admin`);
      await makeAdmin(admin.userId);
      return { customer, order, paymentId: submit.body.data.payment.id, admin };
    }

    test('unauthenticated and customer requests are rejected', async () => {
      const { customer, paymentId } = await setupPendingManualPayment('authz');
      assert.equal((await request(app).post(`/api/admin/payments/${paymentId}/confirm`)).status, 401);
      assert.equal((await request(app).post(`/api/admin/payments/${paymentId}/reject`)).status, 401);
      assert.equal((await customer.agent.post(`/api/admin/payments/${paymentId}/confirm`)).status, 403);
      assert.equal((await customer.agent.post(`/api/admin/payments/${paymentId}/reject`)).status, 403);
    });

    test('customer cannot confirm their own payment through the customer-facing API surface', async () => {
      const { customer, paymentId } = await setupPendingManualPayment('self-confirm');
      const response = await customer.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      assert.equal(response.status, 403);
    });

    test('admin sees the manual payment (reference id, amount, pending status) on the order detail', async () => {
      const { order, paymentId, admin } = await setupPendingManualPayment('detail');
      const response = await admin.agent.get(`/api/admin/orders/${order.id}`);
      assert.equal(response.status, 200);
      const payment = response.body.data.payments.find((p) => p.id === paymentId);
      assert.ok(payment);
      assert.equal(payment.provider, 'manual_upi');
      assert.equal(payment.status, 'pending');
      assert.equal(payment.reference_id, '135791113151');
      assert.equal(String(payment.amount), String(order.totalAmount));
    });

    test('admin can confirm a manual payment, which records the verifier/timestamp and confirms the order', async () => {
      const { order, paymentId, admin } = await setupPendingManualPayment('confirm');
      const response = await admin.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.payment.status, 'captured');
      assert.equal(response.body.data.payment.orderStatus, 'confirmed');
      assert.ok(response.body.data.payment.verifiedAt);
      assert.equal(response.body.data.payment.verifiedBy, admin.userId);

      const orderRow = await pool.query('SELECT status FROM orders WHERE id = $1', [order.id]);
      assert.equal(orderRow.rows[0].status, 'confirmed');
    });

    test('duplicate confirmation is idempotent and does not double-process', async () => {
      const { paymentId, admin } = await setupPendingManualPayment('dup-confirm');
      const first = await admin.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      const second = await admin.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.payment.status, 'captured');
      assert.equal(second.body.data.payment.verifiedAt, first.body.data.payment.verifiedAt);
    });

    test('admin can reject a manual payment with a reason, and the order stays pending (not confirmed)', async () => {
      const { order, paymentId, admin } = await setupPendingManualPayment('reject');
      const response = await admin.agent
        .post(`/api/admin/payments/${paymentId}/reject`)
        .send({ reason: 'Transaction reference could not be verified' });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.payment.status, 'rejected');
      assert.equal(response.body.data.payment.rejectionReason, 'Transaction reference could not be verified');
      assert.equal(response.body.data.payment.orderStatus, 'pending');

      const orderRow = await pool.query('SELECT status FROM orders WHERE id = $1', [order.id]);
      assert.equal(orderRow.rows[0].status, 'pending');
    });

    test('a rejected payment cannot later be confirmed', async () => {
      const { paymentId, admin } = await setupPendingManualPayment('reject-then-confirm');
      const rejected = await admin.agent.post(`/api/admin/payments/${paymentId}/reject`).send({ reason: 'Bad reference' });
      assert.equal(rejected.status, 200);
      const confirmAttempt = await admin.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      assert.equal(confirmAttempt.status, 409);
    });

    test('a captured payment cannot later be rejected', async () => {
      const { paymentId, admin } = await setupPendingManualPayment('confirm-then-reject');
      const confirmed = await admin.agent.post(`/api/admin/payments/${paymentId}/confirm`);
      assert.equal(confirmed.status, 200);
      const rejectAttempt = await admin.agent.post(`/api/admin/payments/${paymentId}/reject`).send({ reason: 'too late' });
      assert.equal(rejectAttempt.status, 409);
    });

    test('admin cannot confirm or reject a Razorpay payment through the manual endpoints', async () => {
      const customer = await signupAgent('razorpay-guard-customer');
      const order = await createLocalOrder(customer.agent);
      const insert = await pool.query(
        `INSERT INTO payments (order_id, provider, provider_order_id, amount, currency, status)
         VALUES ($1, 'razorpay', 'order_guard_test', $2, 'INR', 'pending')
         RETURNING id`,
        [order.id, order.totalAmount]
      );
      const razorpayPaymentId = insert.rows[0].id;
      const admin = await signupAgent('razorpay-guard-admin');
      await makeAdmin(admin.userId);

      const confirmAttempt = await admin.agent.post(`/api/admin/payments/${razorpayPaymentId}/confirm`);
      const rejectAttempt = await admin.agent.post(`/api/admin/payments/${razorpayPaymentId}/reject`);
      assert.equal(confirmAttempt.status, 404);
      assert.equal(rejectAttempt.status, 404);

      const row = await pool.query('SELECT status FROM payments WHERE id = $1', [razorpayPaymentId]);
      assert.equal(row.rows[0].status, 'pending');
    });

    test('confirming/rejecting an unknown payment id returns a safe not-found response', async () => {
      const admin = await signupAgent('unknown-payment-admin');
      await makeAdmin(admin.userId);
      const unknownId = '99999999-9999-4999-8999-999999999999';
      assert.equal((await admin.agent.post(`/api/admin/payments/${unknownId}/confirm`)).status, 404);
      assert.equal((await admin.agent.post(`/api/admin/payments/not-a-uuid/confirm`)).status, 404);
    });
  });
});
