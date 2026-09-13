const crypto = require('crypto');
const ordersDb = require('../db/orders.db');
const { pool } = require('../db/pool');
const { findVariant, PRODUCT_CATALOG } = require('../config/products');
const createHttpError = require('../utils/httpError');
const { toSafeOrder } = require('../utils/sanitize');

function centsToNumeric(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function calculateTotals(variant, quantity) {
  const subtotalCents = variant.unitPriceCents * quantity;
  const zero = '0.00';
  return {
    unitPrice: centsToNumeric(variant.unitPriceCents),
    subtotal: centsToNumeric(subtotalCents),
    shippingAmount: zero,
    taxAmount: zero,
    totalAmount: centsToNumeric(subtotalCents),
  };
}

async function withOrderTransaction(work) {
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

async function createOrder(userId, { variant: variantId, quantity, addressId }) {
  const variant = findVariant(variantId);
  if (!variant) throw createHttpError(400, 'variant must be a valid product variant.');

  const totals = calculateTotals(variant, quantity);
  const result = await withOrderTransaction(async (client) => {
    const address = await ordersDb.findShippingAddressForUser(addressId, userId, client);
    if (!address) throw createHttpError(404, 'Address not found.');

    const order = await ordersDb.insertOrder({
      userId,
      orderNumberSeed: `PENDING-${crypto.randomUUID()}`,
      ...totals,
      currency: PRODUCT_CATALOG.currency,
      shippingFullName: address.full_name,
      shippingPhone: address.phone,
      shippingAddressLine1: address.address_line1,
      shippingAddressLine2: address.address_line2,
      shippingCity: address.city,
      shippingState: address.state,
      shippingPostalCode: address.postal_code,
      shippingCountry: address.country,
    }, client);

    const item = await ordersDb.insertOrderItem({
      orderId: order.id,
      productName: variant.productName,
      variant: variant.variantId,
      quantity,
      unitPrice: totals.unitPrice,
      totalPrice: totals.totalAmount,
    }, client);

    const finalizedOrder = await ordersDb.finalizeOrderNumber(order.id, client);
    return { order: finalizedOrder, items: [item] };
  });

  return toSafeOrder(result.order, result.items);
}

async function listOrders(userId) {
  const rows = await ordersDb.listOrdersByUser(userId);
  return rows.map((row) => toSafeOrder(row, row.items));
}

async function getOrder(userId, orderId) {
  const order = await ordersDb.findOrderForUser(orderId, userId);
  if (!order) throw createHttpError(404, 'Order not found.');
  const items = await ordersDb.listOrderItems(order.id);
  return toSafeOrder(order, items);
}

module.exports = { createOrder, listOrders, getOrder, calculateTotals, centsToNumeric };
