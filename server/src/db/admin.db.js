const { pool } = require('./pool');

function pageOptions({ page = 1, limit = 20 } = {}) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);
  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20,
  };
}

async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM users WHERE role = 'customer') AS total_customers,
      (SELECT count(*)::int FROM orders) AS total_orders,
      (SELECT count(*)::int FROM orders WHERE status = 'pending') AS pending_orders,
      (SELECT count(*)::int FROM orders WHERE status = 'confirmed') AS confirmed_orders,
      (SELECT count(*)::int FROM orders WHERE status IN ('cancelled', 'delivered')) AS closed_orders,
      (SELECT COALESCE(sum(p.amount), 0)::numeric(12,2)
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.status = 'captured' AND o.status = 'confirmed') AS total_revenue,
      (SELECT count(*)::int FROM payments WHERE status IN ('pending', 'authorized')) AS pending_payments,
      (SELECT count(*)::int FROM payments WHERE provider = 'manual_upi' AND status = 'pending') AS pending_manual_payments
  `);
  return rows[0];
}

async function listOrders({ page, limit, search = '' } = {}) {
  const options = pageOptions({ page, limit });
  const offset = (options.page - 1) * options.limit;
  const term = `%${String(search).trim()}%`;
  const values = [term, options.limit, offset];
  const { rows } = await pool.query(`
    SELECT o.id, o.order_number, o.status, o.total_amount, o.currency, o.created_at,
           u.id AS customer_id, u.first_name, u.last_name, u.email,
           COALESCE(string_agg(DISTINCT oi.product_name || ' / ' || oi.variant, ', '), '') AS products,
           COALESCE(sum(oi.quantity), 0)::int AS quantity,
           COALESCE(string_agg(DISTINCT p.status, ', '), 'none') AS payment_status
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE (o.order_number ILIKE $1 OR u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)
    GROUP BY o.id, u.id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT $2 OFFSET $3`, values);
  const count = await pool.query(`
    SELECT count(*)::int AS total
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE (o.order_number ILIKE $1 OR u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)`, [term]);
  return { rows, total: count.rows[0].total, ...options };
}

async function getOrder(orderId) {
  const orderResult = await pool.query(`
    SELECT o.*, u.id AS customer_id, u.first_name, u.last_name, u.email, u.phone
    FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [orderId]);
  if (!orderResult.rows[0]) return null;
  const [items, payments] = await Promise.all([
    pool.query(`SELECT product_name, variant, quantity, unit_price, total_price FROM order_items WHERE order_id = $1 ORDER BY created_at`, [orderId]),
    pool.query(
      `SELECT id, provider, provider_order_id, provider_payment_id, amount, currency, status, method,
              reference_id, verified_at, verified_by, rejected_at, rejected_by, rejection_reason,
              created_at, updated_at
       FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId]
    ),
  ]);
  return { order: orderResult.rows[0], items: items.rows, payments: payments.rows };
}

async function updateOrderStatus(orderId, status) {
  const { rows } = await pool.query(`UPDATE orders SET status = $2 WHERE id = $1 RETURNING *`, [orderId, status]);
  return rows[0] || null;
}

async function listCustomers({ page, limit, search = '' } = {}) {
  const options = pageOptions({ page, limit });
  const offset = (options.page - 1) * options.limit;
  const term = `%${String(search).trim()}%`;
  const { rows } = await pool.query(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at,
           count(DISTINCT o.id)::int AS order_count,
           COALESCE(sum(CASE WHEN o.status = 'confirmed' THEN o.total_amount ELSE 0 END), 0)::numeric(12,2) AS confirmed_spend
    FROM users u LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.role = 'customer'
      AND (u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)
    GROUP BY u.id
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT $2 OFFSET $3`, [term, options.limit, offset]);
  const count = await pool.query(`SELECT count(*)::int AS total FROM users WHERE role = 'customer' AND (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)`, [term]);
  return { rows, total: count.rows[0].total, ...options };
}

async function getCustomer(customerId) {
  const customerResult = await pool.query(`SELECT id, first_name, last_name, email, phone, role, created_at, updated_at FROM users WHERE id = $1 AND role = 'customer'`, [customerId]);
  if (!customerResult.rows[0]) return null;
  const orders = await pool.query(`SELECT id, order_number, status, total_amount, currency, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, [customerId]);
  return { customer: customerResult.rows[0], orders: orders.rows };
}

module.exports = { getStats, listOrders, getOrder, updateOrderStatus, listCustomers, getCustomer, pageOptions };
