const { pool } = require('./pool');

function exec(executor) {
  return executor || pool;
}

/**
 * Single-row config table (id is pinned to 1 by a CHECK constraint). Starts
 * empty — no fabricated UPI ID or QR image ships by default; the client
 * configures both through the admin payment-settings endpoint.
 */
async function getSettings(executor) {
  const { rows } = await exec(executor).query('SELECT * FROM payment_settings WHERE id = 1');
  return rows[0] || null;
}

async function upsertSettings({ upiId, qrImagePath, updatedBy }, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO payment_settings (id, upi_id, qr_image_path, updated_by)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       upi_id = COALESCE($1, payment_settings.upi_id),
       qr_image_path = COALESCE($2, payment_settings.qr_image_path),
       updated_by = $3
     RETURNING *`,
    [upiId ?? null, qrImagePath ?? null, updatedBy]
  );
  return rows[0];
}

module.exports = { getSettings, upsertSettings };
