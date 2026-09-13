const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('../config/env');

const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Prevent an idle client error from crashing the process.
pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Unexpected PostgreSQL client error:', err.message);
});

/**
 * Safe connection check — logs the outcome and resolves to a boolean.
 * Never throws, so it can be called at startup without affecting
 * whether the HTTP server comes up.
 */
async function testConnection() {
  if (!DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('[db] DATABASE_URL is not set — skipping connection test.');
    return false;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    // eslint-disable-next-line no-console
    console.log('[db] PostgreSQL connection verified.');
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] PostgreSQL connection failed:', err.message);
    return false;
  } finally {
    if (client) client.release();
  }
}

module.exports = { pool, testConnection };
