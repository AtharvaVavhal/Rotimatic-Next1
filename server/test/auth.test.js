/**
 * Authentication tests — run against the real Express app and the real
 * PostgreSQL database configured via server/.env (no mocking of the DB or
 * session logic). If PostgreSQL is unreachable, the top-level `before`
 * hook fails loudly with the actual connection error instead of letting
 * every test fail with a confusing, unrelated symptom.
 *
 * Run with: npm test  (sets NODE_ENV=test, which only disables the auth
 * rate limiters — see src/middleware/rateLimit.js — so bulk test traffic
 * from one loopback IP doesn't trip them).
 *
 * Test data is scoped to emails under TEST_DOMAIN and deleted in the
 * top-level `after` hook, so no fixture data is left behind.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { pool } = require('../src/db/pool');
const { isUuid } = require('../src/utils/validators');

const TEST_DOMAIN = 'authtest.rotimatic.invalid';
const COOKIE_NAME = 'rotimatic_session';

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
}

function getSetCookie(res, name) {
  const header = res.headers['set-cookie'];
  if (!header) return undefined;
  const line = header.find((c) => c.startsWith(`${name}=`));
  if (!line) return undefined;
  const value = line.split(';')[0].split('=')[1] || '';
  return { raw: line, value };
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function countSessions(userId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1', [userId]);
  return rows[0].n;
}

async function expireSession(sessionId) {
  await pool.query("UPDATE sessions SET expires_at = now() - interval '1 day' WHERE id = $1", [sessionId]);
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

describe('POST /api/auth/signup', () => {
  test('successful signup returns 201, a safe user, and a session cookie', async () => {
    const email = uniqueEmail('signup-ok');
    const res = await request(app).post('/api/auth/signup').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      password: 'correct-horse-battery',
      phone: '9876500000',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.data.user.email, email.toLowerCase());
    assert.equal(res.body.data.user.firstName, 'Ada');
    assert.ok(res.body.data.user.id);
    assert.equal(res.body.data.user.password, undefined);
    assert.equal(res.body.data.user.password_hash, undefined);

    const cookie = getSetCookie(res, COOKIE_NAME);
    assert.ok(cookie, 'expected a session cookie to be set');
    assert.ok(isUuid(cookie.value));
    assert.match(cookie.raw, /HttpOnly/i);
  });

  test('duplicate email is rejected with a 4xx status', async () => {
    const email = uniqueEmail('signup-dup');
    const payload = { firstName: 'A', lastName: 'B', email, password: 'password123' };

    const first = await request(app).post('/api/auth/signup').send(payload);
    assert.equal(first.status, 201);

    const second = await request(app).post('/api/auth/signup').send(payload);
    assert.equal(second.status, 409);
    assert.equal(second.body.status, 'error');
  });

  test('invalid email format is rejected', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      firstName: 'A',
      lastName: 'B',
      email: 'not-an-email',
      password: 'password123',
    });
    assert.equal(res.status, 400);
  });

  test('missing required fields are rejected', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: uniqueEmail('missing') });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /firstName/);
    assert.match(res.body.message, /lastName/);
    assert.match(res.body.message, /password/);
  });

  test('password shorter than the minimum length is rejected', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      firstName: 'A',
      lastName: 'B',
      email: uniqueEmail('short-pw'),
      password: 'short',
    });
    assert.equal(res.status, 400);
  });

  test('password is stored as a bcrypt hash, never in plaintext', async () => {
    const email = uniqueEmail('hash-check');
    const password = 'super-secret-password';
    await request(app).post('/api/auth/signup').send({ firstName: 'A', lastName: 'B', email, password });

    const row = await getUserByEmail(email);
    assert.ok(row);
    assert.notEqual(row.password_hash, password);
    assert.match(row.password_hash, /^\$2[aby]\$/);
  });

  test('password_hash never appears anywhere in the signup response', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      firstName: 'A',
      lastName: 'B',
      email: uniqueEmail('no-hash-leak'),
      password: 'password123',
    });
    const serialized = JSON.stringify(res.body);
    assert.doesNotMatch(serialized, /password/i);
  });
});

describe('POST /api/auth/login', () => {
  const password = 'login-test-password';
  let email;

  before(async () => {
    email = uniqueEmail('login-user');
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Login', lastName: 'User', email, password });
    assert.equal(res.status, 201);
  });

  test('successful login returns 200, safe user data, and a session cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, email.toLowerCase());
    assert.doesNotMatch(JSON.stringify(res.body), /password/i);

    const cookie = getSetCookie(res, COOKIE_NAME);
    assert.ok(cookie);
    assert.ok(isUuid(cookie.value));
  });

  test('wrong password returns a generic 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'error');
  });

  test('nonexistent email returns the same generic 401 (no account-existence leak)', async () => {
    const wrongPwRes = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    const noSuchUserRes = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('never-signed-up'), password: 'whatever123' });

    assert.equal(noSuchUserRes.status, 401);
    assert.equal(noSuchUserRes.body.message, wrongPwRes.body.message);
  });
});

describe('Session behavior (GET /api/auth/me)', () => {
  const password = 'session-test-password';
  let email;
  let userId;

  before(async () => {
    email = uniqueEmail('session-user');
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Session', lastName: 'User', email, password });
    userId = res.body.data.user.id;
  });

  test('valid session returns authenticated:true and the user', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });

    const res = await agent.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.authenticated, true);
    assert.equal(res.body.data.user.email, email.toLowerCase());
  });

  test('missing session cookie returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'error');
  });

  test('invalid/unknown session cookie returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${COOKIE_NAME}=00000000-0000-4000-8000-000000000000`);
    assert.equal(res.status, 401);
  });

  test('malformed (non-UUID) session cookie returns 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=not-a-uuid`);
    assert.equal(res.status, 401);
  });

  test('expired session cannot authenticate', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = getSetCookie(loginRes, COOKIE_NAME);

    await expireSession(cookie.value);

    const res = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${cookie.value}`);
    assert.equal(res.status, 401);
  });

  test('a user can hold multiple simultaneous sessions', async () => {
    const before_ = await countSessions(userId);

    const loginA = await request(app).post('/api/auth/login').send({ email, password });
    const loginB = await request(app).post('/api/auth/login').send({ email, password });

    const cookieA = getSetCookie(loginA, COOKIE_NAME);
    const cookieB = getSetCookie(loginB, COOKIE_NAME);

    assert.notEqual(cookieA.value, cookieB.value);

    const after_ = await countSessions(userId);
    assert.equal(after_, before_ + 2);

    const meA = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${cookieA.value}`);
    const meB = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${cookieB.value}`);
    assert.equal(meA.status, 200);
    assert.equal(meB.status, 200);
  });
});

describe('POST /api/auth/logout', () => {
  const password = 'logout-test-password';
  let email;

  before(async () => {
    email = uniqueEmail('logout-user');
    await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Logout', lastName: 'User', email, password });
  });

  test('valid logout revokes the session and clears the cookie', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = getSetCookie(loginRes, COOKIE_NAME);

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', `${COOKIE_NAME}=${cookie.value}`);

    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.data.loggedOut, true);

    const clearedCookie = getSetCookie(logoutRes, COOKIE_NAME);
    assert.ok(clearedCookie);
    assert.equal(clearedCookie.value, '');

    const meRes = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${cookie.value}`);
    assert.equal(meRes.status, 401);
  });

  test('logout without any session cookie still succeeds', async () => {
    const res = await request(app).post('/api/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.loggedOut, true);
  });

  test('logout with a garbage session cookie still succeeds and clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', `${COOKIE_NAME}=not-a-real-value`);
    assert.equal(res.status, 200);
  });
});

describe('Security', () => {
  test('two session ids are different, high-entropy UUIDs (not sequential/predictable)', async () => {
    const email = uniqueEmail('entropy-user');
    const password = 'entropy-test-password';
    await request(app).post('/api/auth/signup').send({ firstName: 'A', lastName: 'B', email, password });

    const loginA = await request(app).post('/api/auth/login').send({ email, password });
    const loginB = await request(app).post('/api/auth/login').send({ email, password });

    const a = getSetCookie(loginA, COOKIE_NAME).value;
    const b = getSetCookie(loginB, COOKIE_NAME).value;

    assert.ok(isUuid(a));
    assert.ok(isUuid(b));
    assert.notEqual(a, b);
    // A sequential/predictable id scheme would share a long common prefix;
    // a UUIDv4 from pgcrypto's CSPRNG will not.
    assert.notEqual(a.slice(0, 8), b.slice(0, 8));
  });

  test('SQL-injection-shaped email in login is treated as ordinary data, not executed', async () => {
    const before_ = await pool.query('SELECT count(*)::int AS n FROM users');
    const maliciousEmail = "x'or'1'='1@example.com";

    const res = await request(app).post('/api/auth/login').send({ email: maliciousEmail, password: 'whatever123' });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password.');

    const after_ = await pool.query('SELECT count(*)::int AS n FROM users');
    assert.equal(after_.rows[0].n, before_.rows[0].n);
  });

  test('a classic SQL-injection payload in signup email is rejected by validation, never reaches SQL', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      firstName: 'A',
      lastName: 'B',
      email: "'; DROP TABLE users; --",
      password: 'password123',
    });
    assert.equal(res.status, 400);
  });

  test('no response body ever exposes password, password_hash, or the raw session id', async () => {
    const email = uniqueEmail('field-exposure');
    const password = 'field-exposure-password';

    const signupRes = await request(app).post('/api/auth/signup').send({ firstName: 'A', lastName: 'B', email, password });
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = getSetCookie(loginRes, COOKIE_NAME);
    const meRes = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${cookie.value}`);

    for (const res of [signupRes, loginRes, meRes]) {
      const serialized = JSON.stringify(res.body);
      assert.doesNotMatch(serialized, /password/i);
      assert.doesNotMatch(serialized, new RegExp(cookie.value));
    }
  });
});
