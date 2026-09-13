/**
 * User profile + address tests — same conventions as test/auth.test.js:
 * run against the real Express app and the real PostgreSQL database from
 * server/.env, nothing mocked. Test data is scoped to emails under
 * TEST_DOMAIN and deleted in the top-level `after` hook (addresses cascade
 * with their owning user, so deleting the user is enough).
 *
 * Run with: npm test (sets NODE_ENV=test — disables the auth rate limiters
 * only, see src/middleware/rateLimit.js).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { pool } = require('../src/db/pool');
const { isUuid } = require('../src/utils/validators');

const TEST_DOMAIN = 'profiletest.rotimatic.invalid';
const PASSWORD = 'profile-test-password';

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
}

async function signupAgent(label) {
  const agent = request.agent(app);
  const email = uniqueEmail(label);
  const res = await agent
    .post('/api/auth/signup')
    .send({ firstName: 'First', lastName: 'Last', email, password: PASSWORD });
  return { agent, email, userId: res.body.data.user.id };
}

function validAddressPayload(overrides = {}) {
  return {
    fullName: 'Test Recipient',
    phone: '9000000000',
    addressLine1: '123 Test Street',
    addressLine2: 'Near Test Landmark',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    ...overrides,
  };
}

async function cleanupTestData() {
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

describe('GET /api/users/me', () => {
  test('authenticated request returns the profile', async () => {
    const { agent, email } = await signupAgent('profile-get');
    const res = await agent.get('/api/users/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.data.user.email, email.toLowerCase());
    assert.ok(res.body.data.user.id);
    assert.ok(res.body.data.user.createdAt);
    assert.ok(res.body.data.user.updatedAt);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/users/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'error');
  });
});

describe('PATCH /api/users/me', () => {
  test('updates allowed fields and returns the updated safe user', async () => {
    const { agent } = await signupAgent('profile-patch');
    const res = await agent
      .patch('/api/users/me')
      .send({ firstName: 'Updated', lastName: 'Name', phone: '9123456789' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.firstName, 'Updated');
    assert.equal(res.body.data.user.lastName, 'Name');
    assert.equal(res.body.data.user.phone, '9123456789');
  });

  test('rejects invalid (blank) values', async () => {
    const { agent } = await signupAgent('profile-invalid');
    const res = await agent.patch('/api/users/me').send({ firstName: '   ' });
    assert.equal(res.status, 400);
  });

  test('rejects an empty body — nothing to update', async () => {
    const { agent } = await signupAgent('profile-empty');
    const res = await agent.patch('/api/users/me').send({});
    assert.equal(res.status, 400);
  });

  test('id/password_hash/timestamps cannot be changed even if supplied', async () => {
    const { agent, userId } = await signupAgent('profile-immutable');
    const res = await agent.patch('/api/users/me').send({
      lastName: 'ShouldChange',
      id: '11111111-1111-1111-1111-111111111111',
      password_hash: 'hacked-hash',
      createdAt: '2000-01-01T00:00:00.000Z',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, userId);
    assert.equal(res.body.data.user.lastName, 'ShouldChange');
  });

  test('password_hash never appears in profile responses', async () => {
    const { agent } = await signupAgent('profile-hash-leak');
    const getRes = await agent.get('/api/users/me');
    const patchRes = await agent.patch('/api/users/me').send({ firstName: 'X' });

    for (const res of [getRes, patchRes]) {
      assert.doesNotMatch(JSON.stringify(res.body), /password/i);
    }
  });
});

describe('POST /api/addresses', () => {
  test('creates an address for the authenticated user', async () => {
    const { agent } = await signupAgent('addr-create');
    const res = await agent.post('/api/addresses').send(validAddressPayload());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.address.city, 'Mumbai');
    assert.ok(isUuid(res.body.data.address.id));
  });

  test('rejects missing required fields', async () => {
    const { agent } = await signupAgent('addr-missing');
    const res = await agent.post('/api/addresses').send({ fullName: 'X' });
    assert.equal(res.status, 400);
  });

  test('unauthenticated create is rejected', async () => {
    const res = await request(app).post('/api/addresses').send(validAddressPayload());
    assert.equal(res.status, 401);
  });

  test('the first address always becomes default, even if isDefault:false is sent', async () => {
    const { agent } = await signupAgent('addr-first-default');
    const res = await agent.post('/api/addresses').send(validAddressPayload({ isDefault: false }));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.address.isDefault, true);
  });

  test('a second address with isDefault:true replaces the previous default', async () => {
    const { agent } = await signupAgent('addr-replace-default');
    const first = await agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'First' }));
    const second = await agent
      .post('/api/addresses')
      .send(validAddressPayload({ addressLine1: 'Second', isDefault: true }));

    assert.equal(second.body.data.address.isDefault, true);

    const list = await agent.get('/api/addresses');
    const firstInList = list.body.data.addresses.find((a) => a.id === first.body.data.address.id);
    const secondInList = list.body.data.addresses.find((a) => a.id === second.body.data.address.id);

    assert.equal(firstInList.isDefault, false);
    assert.equal(secondInList.isDefault, true);
    assert.equal(list.body.data.addresses[0].id, second.body.data.address.id, 'default should sort first');
  });

  test('user_id supplied in the request body is ignored — address is owned by req.user.id', async () => {
    const userA = await signupAgent('addr-uid-a');
    const userB = await signupAgent('addr-uid-b');

    const res = await userA.agent
      .post('/api/addresses')
      .send(validAddressPayload({ userId: userB.userId, user_id: userB.userId }));
    assert.equal(res.status, 201);

    const listA = await userA.agent.get('/api/addresses');
    const listB = await userB.agent.get('/api/addresses');
    assert.ok(listA.body.data.addresses.some((a) => a.id === res.body.data.address.id));
    assert.ok(!listB.body.data.addresses.some((a) => a.id === res.body.data.address.id));
  });

  test('SQL-injection-shaped field values are stored as ordinary data, not executed', async () => {
    const { agent } = await signupAgent('addr-sqli');
    const payload = validAddressPayload({
      fullName: "Robert'); DROP TABLE addresses;--",
      city: "x' OR '1'='1",
    });

    const res = await agent.post('/api/addresses').send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.address.fullName, payload.fullName);
    assert.equal(res.body.data.address.city, payload.city);

    const list = await agent.get('/api/addresses');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.addresses.length, 1);
  });
});

describe('GET /api/addresses', () => {
  test("returns only the authenticated user's own addresses, sorted default-first", async () => {
    const { agent } = await signupAgent('addr-list');
    await agent.post('/api/addresses').send(validAddressPayload());

    const res = await agent.get('/api/addresses');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.addresses));
    assert.equal(res.body.data.addresses.length, 1);
  });

  test('unauthenticated list is rejected', async () => {
    const res = await request(app).get('/api/addresses');
    assert.equal(res.status, 401);
  });
});

describe('PATCH /api/addresses/:id', () => {
  test('updates address fields', async () => {
    const { agent } = await signupAgent('addr-update');
    const created = await agent.post('/api/addresses').send(validAddressPayload());

    const res = await agent.patch(`/api/addresses/${created.body.data.address.id}`).send({ city: 'Pune' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.address.city, 'Pune');
  });

  test('setting isDefault:true unsets the previous default (exactly one default remains)', async () => {
    const { agent } = await signupAgent('addr-update-default');
    const a = await agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'A' }));
    const b = await agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'B' }));

    const patchRes = await agent.patch(`/api/addresses/${b.body.data.address.id}`).send({ isDefault: true });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.address.isDefault, true);

    const list = await agent.get('/api/addresses');
    const defaults = list.body.data.addresses.filter((addr) => addr.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].id, b.body.data.address.id);
  });

  test('setting isDefault:false removes default status without auto-promoting another', async () => {
    const { agent } = await signupAgent('addr-unset-default');
    const created = await agent.post('/api/addresses').send(validAddressPayload());

    const res = await agent.patch(`/api/addresses/${created.body.data.address.id}`).send({ isDefault: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.address.isDefault, false);

    const list = await agent.get('/api/addresses');
    assert.ok(list.body.data.addresses.every((addr) => addr.isDefault === false));
  });

  test('id/user_id/created_at cannot be changed via PATCH', async () => {
    const { agent } = await signupAgent('addr-immutable');
    const created = await agent.post('/api/addresses').send(validAddressPayload());
    const originalId = created.body.data.address.id;
    const originalCreatedAt = created.body.data.address.createdAt;

    const res = await agent.patch(`/api/addresses/${originalId}`).send({
      city: 'Changed',
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      createdAt: '2000-01-01T00:00:00.000Z',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.address.id, originalId);
    assert.equal(res.body.data.address.createdAt, originalCreatedAt);
    assert.equal(res.body.data.address.city, 'Changed');
  });
});

describe('DELETE /api/addresses/:id', () => {
  test('deletes an address belonging to the user', async () => {
    const { agent } = await signupAgent('addr-delete');
    const created = await agent.post('/api/addresses').send(validAddressPayload());

    const res = await agent.delete(`/api/addresses/${created.body.data.address.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, true);

    const list = await agent.get('/api/addresses');
    assert.equal(list.body.data.addresses.length, 0);
  });

  test('deleting the default address promotes the most recently updated remaining address', async () => {
    const { agent } = await signupAgent('addr-delete-promote');
    const a = await agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'A' }));
    const b = await agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'B' }));

    await agent.patch(`/api/addresses/${b.body.data.address.id}`).send({ city: 'Touched' });

    const del = await agent.delete(`/api/addresses/${a.body.data.address.id}`);
    assert.equal(del.status, 200);

    const list = await agent.get('/api/addresses');
    assert.equal(list.body.data.addresses.length, 1);
    assert.equal(list.body.data.addresses[0].id, b.body.data.address.id);
    assert.equal(list.body.data.addresses[0].isDefault, true);
  });

  test('deleting the only address leaves zero addresses and no default', async () => {
    const { agent } = await signupAgent('addr-delete-only');
    const created = await agent.post('/api/addresses').send(validAddressPayload());
    await agent.delete(`/api/addresses/${created.body.data.address.id}`);

    const list = await agent.get('/api/addresses');
    assert.equal(list.body.data.addresses.length, 0);
  });

  test('unauthenticated access is rejected on every address endpoint', async () => {
    const randomId = '11111111-1111-1111-1111-111111111111';
    const results = await Promise.all([
      request(app).get('/api/addresses'),
      request(app).post('/api/addresses').send(validAddressPayload()),
      request(app).patch(`/api/addresses/${randomId}`).send({ city: 'X' }),
      request(app).delete(`/api/addresses/${randomId}`),
    ]);
    for (const res of results) {
      assert.equal(res.status, 401);
    }
  });
});

describe('Address ownership', () => {
  test("User A cannot read, update, or delete User B's address (and vice versa)", async () => {
    const userA = await signupAgent('own-a');
    const userB = await signupAgent('own-b');

    const addrB = await userB.agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'B only' }));
    const addrBId = addrB.body.data.address.id;

    const listA = await userA.agent.get('/api/addresses');
    assert.ok(!listA.body.data.addresses.some((a) => a.id === addrBId));

    const patchByA = await userA.agent.patch(`/api/addresses/${addrBId}`).send({ city: 'Hacked' });
    assert.equal(patchByA.status, 404);

    const deleteByA = await userA.agent.delete(`/api/addresses/${addrBId}`);
    assert.equal(deleteByA.status, 404);

    const listBAfter = await userB.agent.get('/api/addresses');
    const stillThere = listBAfter.body.data.addresses.find((a) => a.id === addrBId);
    assert.ok(stillThere, "B's address must still exist, untouched");
    assert.equal(stillThere.city, 'Mumbai');

    // symmetric check: B cannot touch A's address either
    const addrA = await userA.agent.post('/api/addresses').send(validAddressPayload({ addressLine1: 'A only' }));
    const addrAId = addrA.body.data.address.id;

    const patchByB = await userB.agent.patch(`/api/addresses/${addrAId}`).send({ city: 'Hacked' });
    const deleteByB = await userB.agent.delete(`/api/addresses/${addrAId}`);
    assert.equal(patchByB.status, 404);
    assert.equal(deleteByB.status, 404);
  });
});

describe('Address security', () => {
  test('invalid (non-UUID) address id is handled safely — 404, not a crash', async () => {
    const { agent } = await signupAgent('sec-invalid-id');
    const patchRes = await agent.patch('/api/addresses/not-a-uuid').send({ city: 'X' });
    const deleteRes = await agent.delete('/api/addresses/not-a-uuid');
    assert.equal(patchRes.status, 404);
    assert.equal(deleteRes.status, 404);
  });

  test('SQL-injection-shaped address id cannot bypass ownership checks', async () => {
    const { agent } = await signupAgent('sec-sqli-id');
    const maliciousId = "' OR '1'='1";

    const patchRes = await agent.patch(`/api/addresses/${encodeURIComponent(maliciousId)}`).send({ city: 'X' });
    const deleteRes = await agent.delete(`/api/addresses/${encodeURIComponent(maliciousId)}`);

    assert.equal(patchRes.status, 404);
    assert.equal(deleteRes.status, 404);
  });

  test('unknown (well-formed) address id returns the same safe 404 as an unowned one', async () => {
    const { agent } = await signupAgent('sec-unknown-id');
    const randomId = '99999999-9999-4999-8999-999999999999';

    const res = await agent.patch(`/api/addresses/${randomId}`).send({ city: 'X' });
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Address not found.');
  });
});
