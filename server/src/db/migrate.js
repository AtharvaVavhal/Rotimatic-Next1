#!/usr/bin/env node
/**
 * Migration runner. Reuses the same env loading as the rest of the app
 * (src/config/env.js) so DATABASE_URL is never read/configured twice.
 *
 * Usage:
 *   node src/db/migrate.js up      (default)
 *   node src/db/migrate.js down
 */
const path = require('path');
const { runner } = require('node-pg-migrate');
const env = require('../config/env');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

async function main() {
  if (!env.DATABASE_URL) {
    console.error(
      '[migrate] DATABASE_URL is not set. Copy server/.env.example to server/.env and configure it first.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const applied = await runner({
      databaseUrl: env.DATABASE_URL,
      dir: path.join(__dirname, '..', '..', 'migrations'),
      migrationsTable: 'pgmigrations',
      direction,
      count: direction === 'down' ? 1 : Infinity,
      verbose: true,
    });

    if (applied.length === 0) {
      console.log(`[migrate] No migrations to run (${direction}) — already up to date.`);
    } else {
      console.log(
        `[migrate] Applied ${applied.length} migration(s) (${direction}): ${applied
          .map((m) => m.name)
          .join(', ')}`
      );
    }
  } catch (err) {
    console.error(`[migrate] Migration (${direction}) failed:`, err.message);
    process.exitCode = 1;
  }
}

main();
