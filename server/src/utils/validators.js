const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIN_PASSWORD_LENGTH = 8;
const MAX_ORDER_QUANTITY = 10;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Returns an array of human-readable error messages (empty if valid).
 */
function validateSignupPayload(body = {}) {
  const errors = [];

  if (!isNonEmptyString(body.firstName)) errors.push('firstName is required.');
  if (!isNonEmptyString(body.lastName)) errors.push('lastName is required.');

  if (!isNonEmptyString(body.email)) {
    errors.push('email is required.');
  } else if (!isValidEmail(body.email)) {
    errors.push('email must be a valid email address.');
  }

  if (!isNonEmptyString(body.password)) {
    errors.push('password is required.');
  } else if (body.password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
    errors.push('phone must be a string.');
  }

  return errors;
}

function validateLoginPayload(body = {}) {
  const errors = [];

  if (!isNonEmptyString(body.email)) errors.push('email is required.');
  if (!isNonEmptyString(body.password)) errors.push('password is required.');

  return errors;
}

const PROFILE_FIELDS = ['firstName', 'lastName', 'phone'];

/**
 * PATCH /api/users/me — a partial update, but every field that IS present
 * must be a non-empty string (no blanking a field out), and at least one
 * field must be present at all. id/email/password_hash/timestamps are not
 * in this whitelist, so they can never be accepted here regardless of what
 * the request body contains.
 */
function validateUpdateProfilePayload(body = {}) {
  const errors = [];
  let hasAnyField = false;

  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined) {
      hasAnyField = true;
      if (!isNonEmptyString(body[field])) errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (!hasAnyField) {
    errors.push(`At least one of ${PROFILE_FIELDS.join(', ')} must be provided.`);
  }

  return errors;
}

const ADDRESS_REQUIRED_FIELDS = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'postalCode', 'country'];
const ADDRESS_STRING_FIELDS = [...ADDRESS_REQUIRED_FIELDS, 'addressLine2'];

function validateCreateAddressPayload(body = {}) {
  const errors = [];

  for (const field of ADDRESS_REQUIRED_FIELDS) {
    if (!isNonEmptyString(body[field])) errors.push(`${field} is required.`);
  }

  if (body.addressLine2 !== undefined && body.addressLine2 !== null && typeof body.addressLine2 !== 'string') {
    errors.push('addressLine2 must be a string.');
  }

  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') {
    errors.push('isDefault must be a boolean.');
  }

  return errors;
}

/**
 * PATCH /api/addresses/:id — partial update. Any field present must be
 * valid; at least one recognized field must be present. id/user_id/
 * created_at are not in this whitelist and so can never be accepted here.
 */
function validateUpdateAddressPayload(body = {}) {
  const errors = [];
  let hasAnyField = false;

  for (const field of ADDRESS_STRING_FIELDS) {
    if (body[field] === undefined) continue;
    hasAnyField = true;

    if (field === 'addressLine2') {
      if (body[field] !== null && typeof body[field] !== 'string') {
        errors.push('addressLine2 must be a string.');
      }
    } else if (!isNonEmptyString(body[field])) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (body.isDefault !== undefined) {
    hasAnyField = true;
    if (typeof body.isDefault !== 'boolean') errors.push('isDefault must be a boolean.');
  }

  if (!hasAnyField) {
    errors.push('At least one field must be provided.');
  }

  return errors;
}

function validateCreateOrderPayload(body = {}) {
  const errors = [];

  if (!isNonEmptyString(body.variant)) {
    errors.push('variant is required.');
  }
  if (!Number.isInteger(body.quantity)) {
    errors.push('quantity must be an integer.');
  } else if (body.quantity < 1) {
    errors.push('quantity must be greater than zero.');
  } else if (body.quantity > MAX_ORDER_QUANTITY) {
    errors.push(`quantity cannot exceed ${MAX_ORDER_QUANTITY}.`);
  }
  if (!isUuid(body.addressId)) {
    errors.push('addressId must be a valid UUID.');
  }

  return errors;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  isNonEmptyString,
  isValidEmail,
  isUuid,
  validateSignupPayload,
  validateLoginPayload,
  validateUpdateProfilePayload,
  validateCreateAddressPayload,
  validateUpdateAddressPayload,
  MAX_ORDER_QUANTITY,
  validateCreateOrderPayload,
};
