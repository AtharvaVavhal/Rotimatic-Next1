const { pool } = require('./pool');

function exec(executor) {
  return executor || pool;
}

async function findShippingAddressForUser(addressId, userId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT full_name, phone, address_line1, address_line2, city, state, postal_code, country
     FROM addresses
     WHERE id = $1 AND user_id = $2`,
    [addressId, userId]
  );
  return rows[0] || null;
}

async function insertOrder(data, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO orders
       (user_id, order_number, status, subtotal, shipping_amount, tax_amount, total_amount, currency,
        shipping_full_name, shipping_phone, shipping_address_line1, shipping_address_line2,
        shipping_city, shipping_state, shipping_postal_code, shipping_country)
     VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      data.userId,
      data.orderNumberSeed,
      data.subtotal,
      data.shippingAmount,
      data.taxAmount,
      data.totalAmount,
      data.currency,
      data.shippingFullName,
      data.shippingPhone,
      data.shippingAddressLine1,
      data.shippingAddressLine2,
      data.shippingCity,
      data.shippingState,
      data.shippingPostalCode,
      data.shippingCountry,
    ]
  );
  return rows[0];
}

async function finalizeOrderNumber(id, executor) {
  const { rows } = await exec(executor).query(
    `UPDATE orders
     SET order_number = 'ROT-' || id::text
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function insertOrderItem(data, executor) {
  const { rows } = await exec(executor).query(
    `INSERT INTO order_items (order_id, product_name, variant, quantity, unit_price, total_price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.orderId, data.productName, data.variant, data.quantity, data.unitPrice, data.totalPrice]
  );
  return rows[0];
}

async function listOrdersByUser(userId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT o.id, o.order_number, o.status, o.subtotal, o.shipping_amount, o.tax_amount,
            o.total_amount, o.currency, o.created_at, o.updated_at,
            COALESCE(json_agg(
              json_build_object(
                'productName', oi.product_name,
                'variant', oi.variant,
                'quantity', oi.quantity,
                'unitPrice', oi.unit_price,
                'totalPrice', oi.total_price
              ) ORDER BY oi.created_at
            ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC, o.id DESC`,
    [userId]
  );
  return rows;
}

async function findOrderForUser(orderId, userId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT * FROM orders
     WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  return rows[0] || null;
}

/**
 * Admin-facing lookup with no owning-user restriction. Only used from the
 * admin/manual-payment confirmation path, never exposed to a customer route.
 */
async function findOrderById(orderId, executor) {
  const { rows } = await exec(executor).query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return rows[0] || null;
}

async function listOrderItems(orderId, executor) {
  const { rows } = await exec(executor).query(
    `SELECT product_name, variant, quantity, unit_price, total_price
     FROM order_items
     WHERE order_id = $1
     ORDER BY created_at`,
    [orderId]
  );
  return rows;
}

module.exports = {
  findShippingAddressForUser,
  insertOrder,
  finalizeOrderNumber,
  insertOrderItem,
  listOrdersByUser,
  findOrderForUser,
  findOrderById,
  listOrderItems,
};
