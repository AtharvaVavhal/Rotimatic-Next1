const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { pool } = require('../src/db/pool');
const ordersDb = require('../src/db/orders.db');

const TEST_DOMAIN = 'orderstest.rotimatic.invalid';
const PASSWORD = 'order-test-password';

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
}

async function signupAgent(label) {
  const agent = request.agent(app);
  const email = uniqueEmail(label);
  const response = await agent
    .post('/api/auth/signup')
    .send({ firstName: 'Order', lastName: 'Tester', email, password: PASSWORD, phone: '9000000000' });
  assert.equal(response.status, 201);
  return { agent, email, userId: response.body.data.user.id };
}

function addressPayload(overrides = {}) {
  return {
    fullName: 'Order Recipient',
    phone: '9111111111',
    addressLine1: '42 Order Street',
    addressLine2: 'Unit 7',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    ...overrides,
  };
}

async function createAddress(agent, overrides = {}) {
  const response = await agent.post('/api/addresses').send(addressPayload(overrides));
  assert.equal(response.status, 201);
  return response.body.data.address;
}

async function cleanupTestData() {
  await pool.query(
    `DELETE FROM orders
     WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`%@${TEST_DOMAIN}`]
  );
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${TEST_DOMAIN}`]);
}

before(async () => {
  await pool.query('SELECT 1');
  await cleanupTestData();
});

after(async () => {
  await cleanupTestData();
  await pool.end();
});

describe('POST /api/orders', () => {
  test('rejects unauthenticated order creation', async () => {
    const response = await request(app).post('/api/orders').send({ variant: 'black', quantity: 1, addressId: '11111111-1111-4111-8111-111111111111' });
    assert.equal(response.status, 401);
  });

  test('creates a pending order, one item, and a shipping snapshot', async () => {
    const { agent } = await signupAgent('create');
    const address = await createAddress(agent);
    const response = await agent.post('/api/orders').send({
      variant: 'black',
      quantity: 2,
      addressId: address.id,
      unitPrice: 1,
      subtotal: 1,
      total: 1,
    });

    assert.equal(response.status, 201);
    const order = response.body.data.order;
    assert.match(order.orderNumber, /^ROT-[0-9a-f-]{36}$/i);
    assert.equal(order.status, 'pending');
    assert.equal(order.currency, 'INR');
    assert.equal(order.subtotal, '49998.00');
    assert.equal(order.shippingAmount, '0.00');
    assert.equal(order.taxAmount, '0.00');
    assert.equal(order.totalAmount, '49998.00');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, 'Rotimatic NEXT');
    assert.equal(order.items[0].variant, 'black');
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.items[0].unitPrice, '24999.00');
    assert.equal(order.items[0].totalPrice, '49998.00');
    assert.equal(order.shippingAddress.fullName, address.fullName);
    assert.equal(order.shippingAddress.addressLine1, address.addressLine1);

    await agent.patch(`/api/addresses/${address.id}`).send({ city: 'Pune' });
    await agent.delete(`/api/addresses/${address.id}`);
    const detail = await agent.get(`/api/orders/${order.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.order.shippingAddress.city, 'Mumbai');
  });

  test('uses the backend catalog price and ignores client totals', async () => {
    const { agent } = await signupAgent('pricing');
    const address = await createAddress(agent);
    const response = await agent.post('/api/orders').send({
      variant: 'white',
      quantity: 3,
      addressId: address.id,
      unitPrice: 0,
      subtotal: 0,
      totalAmount: 0,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.order.subtotal, '44997.00');
    assert.equal(response.body.data.order.items[0].unitPrice, '14999.00');
    assert.equal(response.body.data.order.items[0].totalPrice, '44997.00');
  });

  test('rejects invalid variants, quantities, and address ids', async () => {
    const { agent } = await signupAgent('validation');
    const address = await createAddress(agent);
    const cases = [
      [{ variant: 'not-a-variant', quantity: 1, addressId: address.id }, 400],
      [{ variant: 'black', quantity: 0, addressId: address.id }, 400],
      [{ variant: 'black', quantity: -1, addressId: address.id }, 400],
      [{ variant: 'black', quantity: 11, addressId: address.id }, 400],
      [{ variant: "black' OR '1'='1", quantity: 1, addressId: address.id }, 400],
      [{ variant: 'black', quantity: 1, addressId: 'not-a-uuid' }, 400],
      [{ variant: 'black', quantity: 1.5, addressId: address.id }, 400],
    ];

    for (const [payload, expectedStatus] of cases) {
      const response = await agent.post('/api/orders').send(payload);
      assert.equal(response.status, expectedStatus);
    }
  });

  test('rejects an address owned by another user and an unknown address', async () => {
    const userA = await signupAgent('owner-a');
    const userB = await signupAgent('owner-b');
    const addressB = await createAddress(userB.agent);

    const foreign = await userA.agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: addressB.id });
    const unknown = await userA.agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: '99999999-9999-4999-8999-999999999999' });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.message, 'Address not found.');
    assert.equal(unknown.status, 404);
  });
});

describe('GET /api/orders', () => {
  test('lists only the authenticated user orders newest first', async () => {
    const userA = await signupAgent('list-a');
    const userB = await signupAgent('list-b');
    const addressA = await createAddress(userA.agent);
    const addressB = await createAddress(userB.agent);
    const first = await userA.agent.post('/api/orders').send({ variant: 'white', quantity: 1, addressId: addressA.id });
    const second = await userA.agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: addressA.id });
    await userB.agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: addressB.id });

    const listA = await userA.agent.get('/api/orders');
    assert.equal(listA.status, 200);
    assert.equal(listA.body.data.orders.length, 2);
    assert.equal(listA.body.data.orders[0].id, second.body.data.order.id);
    assert.equal(listA.body.data.orders[1].id, first.body.data.order.id);
    assert.ok(listA.body.data.orders.every((order) => order.id !== undefined));

    const listB = await userB.agent.get('/api/orders');
    assert.equal(listB.body.data.orders.length, 1);
    assert.notEqual(listB.body.data.orders[0].id, first.body.data.order.id);
  });

  test('rejects unauthenticated order listing', async () => {
    const response = await request(app).get('/api/orders');
    assert.equal(response.status, 401);
  });
});

describe('GET /api/orders/:id', () => {
  test('returns order details and rejects foreign, unknown, and malformed ids safely', async () => {
    const userA = await signupAgent('detail-a');
    const userB = await signupAgent('detail-b');
    const addressA = await createAddress(userA.agent);
    const order = await userA.agent.post('/api/orders').send({ variant: 'white', quantity: 1, addressId: addressA.id });

    const detail = await userA.agent.get(`/api/orders/${order.body.data.order.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.order.items.length, 1);
    assert.equal(detail.body.data.order.shippingAddress.country, 'India');

    const foreign = await userB.agent.get(`/api/orders/${order.body.data.order.id}`);
    const unknown = await userA.agent.get('/api/orders/99999999-9999-4999-8999-999999999999');
    const malformed = await userA.agent.get('/api/orders/not-an-id');
    assert.equal(foreign.status, 404);
    assert.equal(unknown.status, 404);
    assert.equal(malformed.status, 404);
  });
});

describe('Order transaction atomicity', () => {
  test('failed item insertion rolls back the order', async () => {
    const { agent, userId } = await signupAgent('rollback-item');
    const address = await createAddress(agent);
    const before = await pool.query('SELECT count(*)::int AS n FROM orders WHERE user_id = $1', [userId]);
    const originalInsert = ordersDb.insertOrderItem;
    ordersDb.insertOrderItem = async () => { throw new Error('simulated item failure'); };

    try {
      const response = await agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: address.id });
      assert.equal(response.status, 500);
    } finally {
      ordersDb.insertOrderItem = originalInsert;
    }

    const after = await pool.query('SELECT count(*)::int AS n FROM orders WHERE user_id = $1', [userId]);
    assert.equal(after.rows[0].n, before.rows[0].n);
    const orphanItems = await pool.query(
      `SELECT count(*)::int AS n FROM order_items oi
       LEFT JOIN orders o ON o.id = oi.order_id
       WHERE o.id IS NULL`
    );
    assert.equal(orphanItems.rows[0].n, 0);
  });

  test('failed order insertion leaves no item', async () => {
    const { agent, userId } = await signupAgent('rollback-order');
    const address = await createAddress(agent);
    const before = await pool.query('SELECT count(*)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1', [userId]);
    const originalInsert = ordersDb.insertOrder;
    ordersDb.insertOrder = async () => { throw new Error('simulated order failure'); };

    try {
      const response = await agent.post('/api/orders').send({ variant: 'black', quantity: 1, addressId: address.id });
      assert.equal(response.status, 500);
    } finally {
      ordersDb.insertOrder = originalInsert;
    }

    const after = await pool.query('SELECT count(*)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1', [userId]);
    assert.equal(after.rows[0].n, before.rows[0].n);
  });
});
