const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');

const DOMAIN = 'admintest.rotimatic.invalid';
const PASSWORD = 'admin-test-password';
function email(label) { return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@${DOMAIN}`; }
async function signup(label) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/signup').send({ firstName: 'Admin', lastName: label, email: email(label), password: PASSWORD, phone: '9000000000' });
  assert.equal(response.status, 201);
  return { agent, id: response.body.data.user.id, email: response.body.data.user.email };
}
async function address(agent) {
  const response = await agent.post('/api/addresses').send({ fullName: 'Admin Test', phone: '9000000000', addressLine1: 'Admin Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India', isDefault: true });
  assert.equal(response.status, 201);
  return response.body.data.address.id;
}
async function order(agent) {
  const id = await address(agent);
  const response = await agent.post('/api/orders').send({ variant: 'white', quantity: 1, addressId: id });
  assert.equal(response.status, 201);
  return response.body.data.order;
}
async function cleanup() {
  await pool.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`%@${DOMAIN}`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${DOMAIN}`]);
}
before(async () => { await pool.query('SELECT 1'); await cleanup(); });
after(async () => { await cleanup(); await pool.end(); });

describe('admin authorization and reporting', { concurrency: false }, () => {
  let admin;
  let customer;
  let adminOrder;

  before(async () => {
    admin = await signup('admin');
    customer = await signup('customer');
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.id]);
    adminOrder = await order(customer.agent);
  });

  test('unauthenticated and customer requests are rejected', async () => {
    assert.equal((await request(app).get('/api/admin/stats')).status, 401);
    assert.equal((await customer.agent.get('/api/admin/stats')).status, 403);
    assert.equal((await customer.agent.get('/api/admin/orders')).status, 403);
    assert.equal((await customer.agent.get('/api/admin/customers')).status, 403);
  });

  test('admin can read real stats and paginated orders/customers', async () => {
    const stats = await admin.agent.get('/api/admin/stats');
    assert.equal(stats.status, 200);
    assert.ok(stats.body.data.stats.totalCustomers >= 1);
    assert.ok(stats.body.data.stats.totalOrders >= 1);

    const orders = await admin.agent.get('/api/admin/orders?page=1&limit=10');
    assert.equal(orders.status, 200);
    assert.ok(orders.body.data.pagination.total >= 1);
    assert.equal(orders.body.data.orders[0].orderNumber, adminOrder.orderNumber);
    assert.equal(orders.body.data.orders[0].paymentStatus, 'none');

    const customers = await admin.agent.get('/api/admin/customers?page=1&limit=10');
    assert.equal(customers.status, 200);
    assert.ok(customers.body.data.customers.some((item) => item.email === customer.email));
    assert.equal(customers.body.data.customers[0].password_hash, undefined);
  });

  test('admin can inspect order/customer details without sensitive fields', async () => {
    const orderResponse = await admin.agent.get(`/api/admin/orders/${adminOrder.id}`);
    assert.equal(orderResponse.status, 200);
    assert.equal(orderResponse.body.data.order.order_number, adminOrder.orderNumber);
    assert.equal(orderResponse.body.data.items.length, 1);
    assert.equal(orderResponse.body.data.payments.length, 0);
    assert.equal(JSON.stringify(orderResponse.body), JSON.stringify(orderResponse.body).replace(/password_hash|session_id|RAZORPAY_KEY_SECRET/g, ''));

    const customerResponse = await admin.agent.get(`/api/admin/customers/${customer.id}`);
    assert.equal(customerResponse.status, 200);
    assert.equal(customerResponse.body.data.customer.email, customer.email);
    assert.ok(Array.isArray(customerResponse.body.data.orders));
    assert.equal(customerResponse.body.data.customer.password_hash, undefined);
  });

  test('admin can update fulfillment status but cannot update payment state through the endpoint', async () => {
    const response = await admin.agent.patch(`/api/admin/orders/${adminOrder.id}`).send({ status: 'processing', paymentStatus: 'captured' });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.order.status, 'processing');
    assert.equal(response.body.data.order.paymentStatus, undefined);
  });

  test('invalid order/customer ids return safe not-found responses', async () => {
    assert.equal((await admin.agent.get('/api/admin/orders/not-a-uuid')).status, 404);
    assert.equal((await admin.agent.get('/api/admin/customers/not-a-uuid')).status, 404);
  });
});
