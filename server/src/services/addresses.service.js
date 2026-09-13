const addressesDb = require('../db/addresses.db');
const { pool } = require('../db/pool');
const { toSafeAddress } = require('../utils/sanitize');
const createHttpError = require('../utils/httpError');

// Name of the partial unique index from the Step 2 migration
// (`uq_addresses_default_per_user ON addresses(user_id) WHERE is_default`).
// It is the final backstop against two default addresses for one user —
// everything below is just trying to avoid ever hitting it in practice.
const DEFAULT_INDEX_NAME = 'uq_addresses_default_per_user';

function isDefaultConflict(err) {
  return err && err.code === '23505' && err.constraint === DEFAULT_INDEX_NAME;
}

function normalizeAddressFields(body) {
  const fields = {};
  const stringKeys = [
    'fullName',
    'phone',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
    'country',
  ];

  for (const key of stringKeys) {
    if (body[key] === undefined) continue;
    fields[key] = body[key] === null ? null : body[key].trim();
  }

  if (body.isDefault !== undefined) {
    fields.isDefault = body.isDefault;
  }

  return fields;
}

/**
 * Runs `work(client)` inside BEGIN/COMMIT, rolling back on any error and
 * translating a default-index conflict into a clean 409 instead of a raw
 * Postgres error. Used only for the two operations that must atomically
 * touch more than one row: promoting a new default (unset old + set new)
 * and deleting a default (delete + maybe promote another).
 */
async function withAddressTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (isDefaultConflict(err)) {
      throw createHttpError(409, 'Could not update the default address right now. Please try again.');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listAddresses(userId) {
  const rows = await addressesDb.listAddressesByUser(userId);
  return rows.map(toSafeAddress);
}

/**
 * Decision: a user's very first address always becomes their default,
 * even if the request body said `isDefault: false` or omitted it —
 * simplifies checkout UX (there's always exactly one obvious address to
 * ship to) and avoids a user ending up with saved addresses but no
 * default at all. Documented in README.md under "Default-address
 * behavior".
 */
async function createAddress(userId, body) {
  const fields = normalizeAddressFields(body);
  const existingCount = await addressesDb.countAddressesForUser(userId);
  const isFirstAddress = existingCount === 0;
  const shouldBeDefault = fields.isDefault === true || isFirstAddress;

  if (!shouldBeDefault) {
    const row = await addressesDb.insertAddress({ userId, ...fields, isDefault: false });
    return toSafeAddress(row);
  }

  const row = await withAddressTransaction(async (client) => {
    await addressesDb.unsetDefaultForUser(userId, client);
    return addressesDb.insertAddress({ userId, ...fields, isDefault: true }, client);
  });

  return toSafeAddress(row);
}

async function updateAddress(userId, addressId, body) {
  const existing = await addressesDb.findAddressForUser(addressId, userId);
  if (!existing) {
    throw createHttpError(404, 'Address not found.');
  }

  const fields = normalizeAddressFields(body);

  if (fields.isDefault !== true) {
    // No swap needed: isDefault absent, or explicitly false (removing
    // default status is allowed and never auto-promotes another address —
    // see README "Default-address behavior").
    const updated = await addressesDb.updateAddressForUser(addressId, userId, fields);
    return toSafeAddress(updated);
  }

  const row = await withAddressTransaction(async (client) => {
    await addressesDb.unsetDefaultForUser(userId, client);
    return addressesDb.updateAddressForUser(addressId, userId, fields, client);
  });

  return toSafeAddress(row);
}

async function deleteAddress(userId, addressId) {
  await withAddressTransaction(async (client) => {
    const existing = await addressesDb.findAddressForUser(addressId, userId, client);
    if (!existing) {
      throw createHttpError(404, 'Address not found.');
    }

    await addressesDb.deleteAddressForUser(addressId, userId, client);

    if (existing.is_default) {
      const promoted = await addressesDb.findMostRecentlyUpdatedAddress(userId, addressId, client);
      if (promoted) {
        await addressesDb.setAddressDefault(promoted.id, userId, client);
      }
    }
  });

  return { deleted: true };
}

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress };
