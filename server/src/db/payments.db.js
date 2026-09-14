const { pool } = require('./pool');

function exec(executor) {
  return executor || pool;
}

async function findPaymentForOrderUser(orderId, userId, provider, executor) {
  const { rows } = await exec(executor).query(
    `SELECT p.*
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.order_id = $1 AND o.user_id = $2 AND p.provider = $3
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [orderId, userId, provider]
  );
  return rows[0] || null;
}

async function findByProviderOrderId(provider, providerOrderId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT * FROM payments
     WHERE provider = $1 AND provider_order_id = $2`,
    [provider, providerOrderId]
  );
  return rows[0] || null;
}

async function insertPendingPayment(data, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO payments (order_id, provider, provider_order_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (provider, provider_order_id) DO NOTHING
     RETURNING *`,
    [data.orderId, data.provider, data.providerOrderId, data.amount, data.currency]
  );
  return rows[0] || findByProviderOrderId(data.provider, data.providerOrderId, executor);
}

async function updatePaymentState(paymentId, data, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE payments
     SET provider_payment_id = COALESCE($2, provider_payment_id),
         status = $3,
         method = COALESCE($4, method)
     WHERE id = $1 AND provider = $5
     RETURNING *`,
    [paymentId, data.providerPaymentId || null, data.status, data.method || null, data.provider]
  );
  return rows[0] || null;
}

async function confirmOrder(orderId, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE orders
     SET status = 'confirmed'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [orderId]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// Manual UPI/QR payments — same table, provider = 'manual_upi'. Kept as
// separate functions from the Razorpay ones above so the two flows never
// share a code path (Razorpay confirmation only ever happens through
// signature/webhook verification; manual confirmation only ever happens
// through the admin endpoints below).
// ---------------------------------------------------------------------

async function insertPendingManualPayment(data, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO payments (order_id, provider, amount, currency, status, reference_id)
     VALUES ($1, 'manual_upi', $2, $3, 'pending', $4)
     RETURNING *`,
    [data.orderId, data.amount, data.currency, data.referenceId]
  );
  return rows[0];
}

async function updateManualPaymentReference(paymentId, referenceId, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE payments SET reference_id = $2
     WHERE id = $1 AND provider = 'manual_upi' AND status = 'pending'
     RETURNING *`,
    [paymentId, referenceId]
  );
  return rows[0] || null;
}

async function resubmitManualPayment(paymentId, referenceId, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE payments
     SET reference_id = $2, status = 'pending', rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL
     WHERE id = $1 AND provider = 'manual_upi' AND status = 'rejected'
     RETURNING *`,
    [paymentId, referenceId]
  );
  return rows[0] || null;
}

async function findManualPaymentById(paymentId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT * FROM payments WHERE id = $1 AND provider = 'manual_upi'`,
    [paymentId]
  );
  return rows[0] || null;
}

async function confirmManualPayment(paymentId, adminId, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE payments
     SET status = 'captured', verified_at = now(), verified_by = $2
     WHERE id = $1 AND provider = 'manual_upi' AND status = 'pending'
     RETURNING *`,
    [paymentId, adminId]
  );
  return rows[0] || null;
}

async function rejectManualPayment(paymentId, adminId, reason, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE payments
     SET status = 'rejected', rejected_at = now(), rejected_by = $2, rejection_reason = $3
     WHERE id = $1 AND provider = 'manual_upi' AND status = 'pending'
     RETURNING *`,
    [paymentId, adminId, reason || null]
  );
  return rows[0] || null;
}

module.exports = {
  findPaymentForOrderUser,
  findByProviderOrderId,
  insertPendingPayment,
  updatePaymentState,
  confirmOrder,
  insertPendingManualPayment,
  updateManualPaymentReference,
  resubmitManualPayment,
  findManualPaymentById,
  confirmManualPayment,
  rejectManualPayment,
};
