const { pool } = require('./pool');

/**
 * All queries are parameterized — never string-concatenate user input
 * into SQL. Rows are returned raw (including password_hash); callers
 * are responsible for stripping sensitive fields via utils/sanitize.js
 * before anything reaches an API response.
 */

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser({ firstName, lastName, email, passwordHash, phone }) {
  const { rows } = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [firstName, lastName, email, passwordHash, phone || null]
  );
  return rows[0];
}

/**
 * Whitelist-only partial update: only first_name/last_name/phone can ever
 * be set here (id, email, password_hash, created_at, updated_at are never
 * touched by this function — updated_at is maintained by the existing
 * trg_users_set_updated_at trigger, not application code). Column names in
 * the SET clause are hardcoded, never derived from the caller, so there is
 * no SQL injection surface even though the clause is built conditionally.
 */
async function updateUserProfile(id, { firstName, lastName, phone } = {}) {
  const setClauses = [];
  const values = [];
  let i = 1;

  if (firstName !== undefined) {
    setClauses.push(`first_name = $${i++}`);
    values.push(firstName);
  }
  if (lastName !== undefined) {
    setClauses.push(`last_name = $${i++}`);
    values.push(lastName);
  }
  if (phone !== undefined) {
    setClauses.push(`phone = $${i++}`);
    values.push(phone);
  }

  if (setClauses.length === 0) {
    return findUserById(id);
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

module.exports = { findUserByEmail, findUserById, createUser, updateUserProfile };
