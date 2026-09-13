/**
 * Single source of truth for the "safe" user shape returned by any API
 * response. password_hash (and anything else sensitive) never passes
 * through this — callers only ever get back what this function lists.
 */
function toSafeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Same idea as toSafeUser: the one place that decides what an address
 * looks like on the wire. user_id is deliberately omitted — a caller only
 * ever sees their own addresses (enforced in the db layer), so it adds
 * nothing the client needs.
 */
function toSafeAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSafeOrder(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    subtotal: row.subtotal,
    shippingAmount: row.shipping_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    currency: row.currency,
    shippingAddress: {
      fullName: row.shipping_full_name,
      phone: row.shipping_phone,
      addressLine1: row.shipping_address_line1,
      addressLine2: row.shipping_address_line2,
      city: row.shipping_city,
      state: row.shipping_state,
      postalCode: row.shipping_postal_code,
      country: row.shipping_country,
    },
    items: items.map((item) => ({
      productName: item.product_name || item.productName,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: item.unit_price || item.unitPrice,
      totalPrice: item.total_price || item.totalPrice,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { toSafeUser, toSafeAddress, toSafeOrder };
