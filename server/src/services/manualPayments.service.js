const paymentsDb = require('../db/payments.db');
const ordersDb = require('../db/orders.db');
const paymentSettingsDb = require('../db/paymentSettings.db');
const { pool } = require('../db/pool');
const createHttpError = require('../utils/httpError');

const PROVIDER = 'manual_upi';

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function safeCustomerPayment(payment, order) {
  return {
    id: payment.id,
    orderId: payment.order_id,
    provider: payment.provider,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    referenceId: payment.reference_id,
    submittedAt: payment.created_at,
    orderStatus: order.status,
  };
}

function safeAdminPayment(payment, order) {
  return {
    id: payment.id,
    orderId: payment.order_id,
    provider: payment.provider,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    referenceId: payment.reference_id,
    submittedAt: payment.created_at,
    verifiedAt: payment.verified_at,
    verifiedBy: payment.verified_by,
    rejectedAt: payment.rejected_at,
    rejectionReason: payment.rejection_reason,
    orderStatus: order ? order.status : undefined,
  };
}

/**
 * Public/customer-facing config — no secrets, just the client's configured
 * UPI ID and QR image reference. Reports disabled (never a fabricated
 * value) until an admin has configured both fields.
 */
async function getManualPaymentConfig() {
  const settings = await paymentSettingsDb.getSettings();
  const enabled = Boolean(settings && settings.upi_id && settings.qr_image_path);
  return {
    enabled,
    upiId: enabled ? settings.upi_id : null,
    qrImagePath: enabled ? settings.qr_image_path : null,
  };
}

/**
 * Customer submits (or resubmits) their UPI transaction reference for a
 * local order. Never creates a Razorpay order, never marks the order paid —
 * it only records a pending manual-payment submission for admin review.
 * Idempotent: repeated calls with the same/updated reference for the same
 * pending order update the existing row instead of creating a duplicate.
 */
async function submitManualPayment(userId, { orderId, referenceId }) {
  const trimmedReference = referenceId.trim();
  const order = await ordersDb.findOrderForUser(orderId, userId);
  if (!order) throw createHttpError(404, 'Order not found.');
  if (order.status !== 'pending') throw createHttpError(409, 'This order is not eligible for payment.');

  const existing = await paymentsDb.findPaymentForOrderUser(orderId, userId, PROVIDER);
  if (existing && existing.status === 'captured') {
    throw createHttpError(409, 'This order has already been paid.');
  }
  if (existing && existing.status === 'pending') {
    const updated = await paymentsDb.updateManualPaymentReference(existing.id, trimmedReference);
    return safeCustomerPayment(updated || existing, order);
  }
  if (existing && existing.status === 'rejected') {
    const updated = await paymentsDb.resubmitManualPayment(existing.id, trimmedReference);
    if (updated) return safeCustomerPayment(updated, order);
  }

  const payment = await paymentsDb.insertPendingManualPayment({
    orderId,
    referenceId: trimmedReference,
    amount: order.total_amount,
    currency: order.currency,
  });
  return safeCustomerPayment(payment, order);
}

/**
 * Admin confirms a manual payment after checking the client's actual
 * UPI/bank/QR account. Only ever touches provider = 'manual_upi' rows —
 * findManualPaymentById filters on that, so a Razorpay payment id here
 * resolves to 404, never a confirmation. Idempotent: confirming an already
 * captured payment just re-reports the current (successful) state.
 */
async function confirmManualPayment(adminId, paymentId) {
  const existing = await paymentsDb.findManualPaymentById(paymentId);
  if (!existing) throw createHttpError(404, 'Payment not found.');

  if (existing.status === 'captured') {
    const order = await ordersDb.findOrderById(existing.order_id);
    return safeAdminPayment(existing, order);
  }
  if (existing.status !== 'pending') {
    throw createHttpError(409, 'This payment is not awaiting verification.');
  }

  const result = await withTransaction(async (client) => {
    const updatedPayment = await paymentsDb.confirmManualPayment(paymentId, adminId, client);
    if (!updatedPayment) {
      const current = await paymentsDb.findManualPaymentById(paymentId, client);
      if (current && current.status === 'captured') {
        return { payment: current, order: await ordersDb.findOrderById(current.order_id, client) };
      }
      throw createHttpError(409, 'This payment is not awaiting verification.');
    }
    const order =
      (await paymentsDb.confirmOrder(updatedPayment.order_id, client)) ||
      (await ordersDb.findOrderById(updatedPayment.order_id, client));
    return { payment: updatedPayment, order };
  });

  return safeAdminPayment(result.payment, result.order);
}

/**
 * Admin rejects a manual payment submission. Never touches the order —
 * a rejected payment must not confirm it. Idempotent for an
 * already-rejected payment; conflicts if the payment was already captured.
 */
async function rejectManualPayment(adminId, paymentId, reason) {
  const existing = await paymentsDb.findManualPaymentById(paymentId);
  if (!existing) throw createHttpError(404, 'Payment not found.');

  if (existing.status === 'rejected') {
    const order = await ordersDb.findOrderById(existing.order_id);
    return safeAdminPayment(existing, order);
  }
  if (existing.status !== 'pending') {
    throw createHttpError(409, 'This payment is not awaiting verification.');
  }

  const updatedPayment = await paymentsDb.rejectManualPayment(paymentId, adminId, reason);
  if (!updatedPayment) throw createHttpError(409, 'This payment is not awaiting verification.');

  const order = await ordersDb.findOrderById(updatedPayment.order_id);
  return safeAdminPayment(updatedPayment, order);
}

module.exports = {
  getManualPaymentConfig,
  submitManualPayment,
  confirmManualPayment,
  rejectManualPayment,
};
