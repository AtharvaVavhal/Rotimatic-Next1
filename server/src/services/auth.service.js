const bcrypt = require('bcryptjs');
const usersDb = require('../db/users.db');
const sessionsDb = require('../db/sessions.db');
const { toSafeUser } = require('../utils/sanitize');
const createHttpError = require('../utils/httpError');
const { SESSION_TTL_MS } = require('../config/session');

const BCRYPT_SALT_ROUNDS = 12;

// A precomputed hash of a fixed, unused dummy password — not a real
// credential. Comparing against it when an email isn't found makes that
// branch do the same bcrypt work as a wrong-password match, so a
// response-time side channel can't be used to tell the two apart.
const DUMMY_PASSWORD_HASH = '$2b$12$3qLC1GvT.8BoXcNJV5jYj.ZFBLH3zd.3xzSqZh9uA.NVMq2eiOCMW';

// Opportunistic cleanup of expired sessions — no scheduler. Runs on a
// small fraction of session-creating calls instead of every single one,
// and only ever deletes rows that are already expired (see sessions.db.js).
const CLEANUP_PROBABILITY = 0.05;
function maybeCleanupExpiredSessions() {
  if (Math.random() < CLEANUP_PROBABILITY) {
    sessionsDb.deleteExpiredSessions().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[auth] Expired session cleanup failed:', err.message);
    });
  }
}

async function signup({ firstName, lastName, email, password, phone }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await usersDb.findUserByEmail(normalizedEmail);
  if (existing) {
    throw createHttpError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const user = await usersDb.createUser({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: phone ? phone.trim() : null,
  });

  const session = await sessionsDb.createSession(user.id, SESSION_TTL_MS);
  maybeCleanupExpiredSessions();

  return { user: toSafeUser(user), session };
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const invalidCredentials = () => createHttpError(401, 'Invalid email or password.');

  const user = await usersDb.findUserByEmail(normalizedEmail);

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw invalidCredentials();
  }

  const session = await sessionsDb.createSession(user.id, SESSION_TTL_MS);
  maybeCleanupExpiredSessions();

  return { user: toSafeUser(user), session };
}

async function logout(sessionId) {
  if (!sessionId) return false;
  return sessionsDb.deleteSessionById(sessionId);
}

module.exports = { signup, login, logout, BCRYPT_SALT_ROUNDS };
