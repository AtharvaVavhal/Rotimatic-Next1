#!/usr/bin/env node
const { pool } = require('./pool');

async function main() {
  const email = process.argv[2] && process.argv[2].trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run admin:promote -- user@example.com');
    process.exitCode = 1;
    return;
  }
  const result = await pool.query(
    `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role`,
    [email]
  );
  if (!result.rows[0]) {
    console.error('No user found for that email.');
    process.exitCode = 1;
    return;
  }
  console.log(`Promoted ${result.rows[0].email} to ${result.rows[0].role}.`);
}

main().catch((error) => {
  console.error('Admin promotion failed:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
