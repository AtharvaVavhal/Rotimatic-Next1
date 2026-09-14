const asyncHandler = require('../utils/asyncHandler');
const createHttpError = require('../utils/httpError');
const adminDb = require('../db/admin.db');
const paymentSettingsDb = require('../db/paymentSettings.db');
const razorpayConfig = require('../config/razorpay');
const { isUuid, validatePaymentSettingsPayload } = require('../utils/validators');

const STATUS_VALUES = new Set(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

function pagination(req) {
  return { page: req.query.page, limit: req.query.limit, search: req.query.search || '' };
}

function pageResponse(result, key) {
  return { [key]: result.rows, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } };
}

function mapOrderRow(row) {
  return { id: row.id, orderNumber: row.order_number, status: row.status, totalAmount: row.total_amount, currency: row.currency, createdAt: row.created_at, customerId: row.customer_id, firstName: row.first_name, lastName: row.last_name, email: row.email, products: row.products, quantity: row.quantity, paymentStatus: row.payment_status };
}

function mapCustomerRow(row) {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone, createdAt: row.created_at, orderCount: row.order_count, confirmedSpend: row.confirmed_spend };
}

const stats = asyncHandler(async (req, res) => {
  const row = await adminDb.getStats();
  res.json({ status: 'ok', data: { stats: {
    totalCustomers: row.total_customers,
    totalOrders: row.total_orders,
    pendingOrders: row.pending_orders,
    confirmedOrders: row.confirmed_orders,
    closedOrders: row.closed_orders,
    totalRevenue: row.total_revenue,
    pendingPayments: row.pending_payments,
    pendingManualPayments: row.pending_manual_payments,
  } } });
});

const orders = asyncHandler(async (req, res) => {
  const result = await adminDb.listOrders(pagination(req));
  res.json({ status: 'ok', data: pageResponse({ ...result, rows: result.rows.map(mapOrderRow) }, 'orders') });
});

const order = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Order not found.');
  const result = await adminDb.getOrder(req.params.id);
  if (!result) throw createHttpError(404, 'Order not found.');
  res.json({ status: 'ok', data: { order: result.order, items: result.items, payments: result.payments } });
});

const updateOrder = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Order not found.');
  if (!STATUS_VALUES.has(req.body.status)) throw createHttpError(400, 'status is not supported or payment-controlled.');
  const updated = await adminDb.updateOrderStatus(req.params.id, req.body.status);
  if (!updated) throw createHttpError(404, 'Order not found.');
  res.json({ status: 'ok', data: { order: updated } });
});

const customers = asyncHandler(async (req, res) => {
  const result = await adminDb.listCustomers(pagination(req));
  res.json({ status: 'ok', data: pageResponse({ ...result, rows: result.rows.map(mapCustomerRow) }, 'customers') });
});

const customer = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Customer not found.');
  const result = await adminDb.getCustomer(req.params.id);
  if (!result) throw createHttpError(404, 'Customer not found.');
  res.json({ status: 'ok', data: result });
});

function mapPaymentSettings(settings) {
  return {
    // Never expose RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET — only
    // whether the gateway is configured, which is safe to show.
    razorpayConfigured: Boolean(razorpayConfig.RAZORPAY_KEY_ID && razorpayConfig.RAZORPAY_KEY_SECRET),
    manualUpiEnabled: Boolean(settings && settings.upi_id && settings.qr_image_path),
    upiId: settings ? settings.upi_id : null,
    qrImagePath: settings ? settings.qr_image_path : null,
    updatedAt: settings ? settings.updated_at : null,
  };
}

const paymentSettings = asyncHandler(async (req, res) => {
  const settings = await paymentSettingsDb.getSettings();
  res.json({ status: 'ok', data: { paymentSettings: mapPaymentSettings(settings) } });
});

const updatePaymentSettings = asyncHandler(async (req, res) => {
  const errors = validatePaymentSettingsPayload(req.body);
  if (errors.length) throw createHttpError(400, errors.join(' '));
  const updated = await paymentSettingsDb.upsertSettings({
    upiId: req.body.upiId !== undefined ? req.body.upiId.trim() : undefined,
    qrImagePath: req.body.qrImagePath !== undefined ? req.body.qrImagePath.trim() : undefined,
    updatedBy: req.user.id,
  });
  res.json({ status: 'ok', data: { paymentSettings: mapPaymentSettings(updated) } });
});

module.exports = { stats, orders, order, updateOrder, customers, customer, paymentSettings, updatePaymentSettings };
    