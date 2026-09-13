const { pool } = require('./pool');

/**
 * Every function that touches a specific address takes both `id` AND
 * `userId` and enforces both in the SQL WHERE clause — never just `id`.
 * A row that exists but belongs to someone else is indistinguishable from
 * a row that doesn't exist at all (both resolve to `null`/0 rows), which
 * is exactly what lets the service layer return a safe 404 either way.
 *
 * `executor` is optional and defaults to the shared pool; callers running
 * a multi-write operation that must be atomic (see addresses.service.js)
 * pass in a checked-out, transaction-bound client instead. No second pool
 * is ever created.
 */
function exec(executor) {
  return executor || pool;
}

async function listAddressesByUser(userId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT * FROM addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, updated_at DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

async function countAddressesForUser(userId, executor) {
  const { rows } = await exec(executor).query(
    'SELECT count(*)::int AS n FROM addresses WHERE user_id = $1',
    [userId]
  );
  return rows[0].n;
}

async function findAddressForUser(id, userId, executor) {
  const { rows } = await exec(executor).query(
    'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}

async function insertAddress(data, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO addresses
       (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.userId,
      data.fullName,
      data.phone,
      data.addressLine1,
      data.addressLine2 || null,
      data.city,
      data.state,
      data.postalCode,
      data.country,
      data.isDefault,
    ]
  );
  return rows[0];
}

// Whitelist: only these keys can ever end up in an UPDATE's SET clause.
// Column names below are hardcoded literals, never derived from caller
// input, so building the clause conditionally introduces no SQL injection
// surface — only the values are parameters.
const UPDATABLE_COLUMNS = {
  fullName: 'full_name',
  phone: 'phone',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  city: 'city',
  state: 'state',
  postalCode: 'postal_code',
  country: 'country',
  isDefault: 'is_default',
};

async function updateAddressForUser(id, userId, fields, executor) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${column} = $${i++}`);
      values.push(fields[key]);
    }
  }

  if (setClauses.length === 0) {
    return findAddressForUser(id, userId, executor);
  }

  values.push(id, userId);
  const idParam = i++;
  const userIdParam = i;

  const { rows } = await exec(executor).query(
    `UPDATE addresses SET ${setClauses.join(', ')}
     WHERE id = $${idParam} AND user_id = $${userIdParam}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteAddressForUser(id, userId, executor) {
  const { rows } = await exec(executor).query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

async function unsetDefaultForUser(userId, executor) {
  await exec(executor).query(
    'UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default = true',
    [userId]
  );
}

async function setAddressDefault(id, userId, executor) {
  const { rows } = await exec(executor).query(
    'UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

async function findMostRecentlyUpdatedAddress(userId, excludeId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT * FROM addresses
     WHERE user_id = $1 AND id <> $2
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId, excludeId]
  );
  return rows[0] || null;
}

module.exports = {
  listAddressesByUser,
  countAddressesForUser,
  findAddressForUser,
  insertAddress,
  updateAddressForUser,
  deleteAddressForUser,
  unsetDefaultForUser,
  setAddressDefault,
  findMostRecentlyUpdatedAddress,
};
