#!/usr/bin/env node
/**
 * Safe database verification.
 *
 * Confirms, in order, without ever fabricating a passing result:
 *   1. A PostgreSQL connection can be established.
 *   2. Migrations can run (idempotent — safe even if already applied).
 *   3. The expected tables exist after migration.
 *
 * If the connection fails, steps 2 and 3 are skipped and reported as
 * skipped (not passed), and the exact database error is printed.
 */
const path = require('path');
const { runner } = require('node-pg-migrate');
const env = require('../config/env');
const { pool } = require('./pool');

const EXPECTED_TABLES = ['users', 'sessions', 'addresses', 'orders', 'order_items', 'payments'];

async function checkConnection() {
  if (!env.DATABASE_URL) {
    return { ok: false, error: 'DATABASE_URL is not set (copy server/.env.example to server/.env).' };
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (client) client.release();
  }
}

async function runMigrations() {
  try {
    const applied = await runner({
      databaseUrl: env.DATABASE_URL,
      dir: path.join(__dirname, '..', '..', 'migrations'),
      migrationsTable: 'pgmigrations',
      direction: 'up',
      count: Infinity,
      verbose: false,
    });
    return { ok: true, applied: applied.map((m) => m.name) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkTables() {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [EXPECTED_TABLES]
  );
  const present = new Set(rows.map((r) => r.table_name));
  return EXPECTED_TABLES.map((name) => ({ name, exists: present.has(name) }));
}

async function main() {
  console.log('--- Rotimatic NEXT database verification ---');

  console.log('\n[1/3] PostgreSQL connection');
  const connection = await checkConnection();
  if (!connection.ok) {
    console.error(`  FAILED: ${connection.error}`);
    console.log('\n[2/3] Migrations: SKIPPED (no connection)');
    console.log('[3/3] Table existence: SKIPPED (no connection)');
    process.exitCode = 1;
    return;
  }
  console.log('  OK: connected successfully.');

  console.log('\n[2/3] Running migrations (idempotent)');
  const migrations = await runMigrations();
  if (!migrations.ok) {
    console.error(`  FAILED: ${migrations.error}`);
    console.log('\n[3/3] Table existence: SKIPPED (migration failed)');
    process.exitCode = 1;
    return;
  }
  console.log(
    migrations.applied.length
      ? `  OK: applied ${migrations.applied.length} migration(s): ${migrations.applied.join(', ')}`
      : '  OK: already up to date, nothing to apply.'
  );

  console.log('\n[3/3] Verifying expected tables exist');
  const tables = await checkTables();
  let allPresent = true;
  tables.forEach(({ name, exists }) => {
    console.log(`  ${exists ? 'OK  ' : 'MISSING'} ${name}`);
    if (!exists) allPresent = false;
  });

  if (!allPresent) {
    process.exitCode = 1;
    return;
  }

  console.log('\nAll checks passed.');
}

main().finally(() => {
  pool.end();
});
