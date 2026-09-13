const asyncHandler = require('../utils/asyncHandler');
const addressesService = require('../services/addresses.service');
const createHttpError = require('../utils/httpError');
const {
  validateCreateAddressPayload,
  validateUpdateAddressPayload,
  isUuid,
} = require('../utils/validators');

// A malformed :id is treated exactly like a well-formed id that doesn't
// belong to this user — both are a plain 404, so the response never hints
// at *why* the address can't be found.
function requireValidId(id) {
  if (!isUuid(id)) {
    throw createHttpError(404, 'Address not found.');
  }
}

const list = asyncHandler(async (req, res) => {
  const addresses = await addressesService.listAddresses(req.user.id);
  res.status(200).json({ status: 'ok', data: { addresses } });
});

const create = asyncHandler(async (req, res) => {
  const errors = validateCreateAddressPayload(req.body);
  if (errors.length) {
    throw createHttpError(400, errors.join(' '));
  }

  const address = await addressesService.createAddress(req.user.id, req.body);
  res.status(201).json({ status: 'ok', data: { address } });
});

const update = asyncHandler(async (req, res) => {
  requireValidId(req.params.id);

  const errors = validateUpdateAddressPayload(req.body);
  if (errors.length) {
    throw createHttpError(400, errors.join(' '));
  }

  const address = await addressesService.updateAddress(req.user.id, req.params.id, req.body);
  res.status(200).json({ status: 'ok', data: { address } });
});

const remove = asyncHandler(async (req, res) => {
  requireValidId(req.params.id);

  const result = await addressesService.deleteAddress(req.user.id, req.params.id);
  res.status(200).json({ status: 'ok', data: result });
});

module.exports = { list, create, update, remove };
