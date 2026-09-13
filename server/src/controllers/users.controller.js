const asyncHandler = require('../utils/asyncHandler');
const usersService = require('../services/users.service');
const createHttpError = require('../utils/httpError');
const { validateUpdateProfilePayload } = require('../utils/validators');

const getMe = asyncHandler(async (req, res) => {
  const user = await usersService.getProfile(req.user.id);
  res.status(200).json({ status: 'ok', data: { user } });
});

const updateMe = asyncHandler(async (req, res) => {
  const errors = validateUpdateProfilePayload(req.body);
  if (errors.length) {
    throw createHttpError(400, errors.join(' '));
  }

  const user = await usersService.updateProfile(req.user.id, req.body);
  res.status(200).json({ status: 'ok', data: { user } });
});

module.exports = { getMe, updateMe };
