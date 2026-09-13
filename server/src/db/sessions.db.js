const { pool } = require('./pool');

/**
 * The session `id` (UUID PRIMARY KEY, DEFAULT gen_random_uuid()) IS the
 * bearer token stored in the cookie. gen_random_uuid() is sourced from
 * PostgreSQL's pgcrypto extension (a cryptographically secure RNG), so no
 * separate token needs to be generated in application code — this reuses
 * the sessions table exactly as defined in the Step 2 migration.
 */

async function createSession(userId, ttlMs) {
  const ttlSeconds = Math.round(ttlMs / 1000);
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, expires_at)
     VALUES ($1, now() + make_interval(secs => $2::int))
     RETURNING id, user_id, expires_at, created_at, updated_at`,
    [userId, ttlSeconds]
  );
  return rows[0];
}

/**
 * Single parameterized query that simultaneously: rejects a missing
 * session id, rejects an expired one (expires_at > now() in the WHERE
 * clause), and loads the owning user — without ever selecting
 * password_hash, so it can never leak through req.user.
 */
async function findActiveSessionWithUser(sessionId) {
  const { rows } = await pool.query(
    `SELECT
       s.id AS session_id,
       s.expires_at,
       u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at, u.updated_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId]
  );
  return rows[0] || null;
}

async function deleteSessionById(sessionId) {
  const { rowCount } = await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  return rowCount > 0;
}

/**
 * Lightweight housekeeping: removes rows that are already expired.
 * Never touches a session whose expires_at is still in the future, so an
 * active session can never be deleted by this. No scheduler — callers
 * trigger it opportunistically (see auth.service.js).
 */
async function deleteExpiredSessions() {
  const { rowCount } = await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  return rowCount;
}

module.exports = {
  createSession,
  findActiveSessionWithUser,
  deleteSessionById,
  deleteExpiredSessions,
};
