const usersDb = require('../db/users.db');
const { toSafeUser } = require('../utils/sanitize');
const createHttpError = require('../utils/httpError');

async function getProfile(userId) {
  const user = await usersDb.findUserById(userId);
  if (!user) throw createHttpError(404, 'User not found.');
  return toSafeUser(user);
}

async function updateProfile(userId, body) {
  const updates = {};
  if (body.firstName !== undefined) updates.firstName = body.firstName.trim();
  if (body.lastName !== undefined) updates.lastName = body.lastName.trim();
  if (body.phone !== undefined) updates.phone = body.phone.trim();

  const updated = await usersDb.updateUserProfile(userId, updates);
  if (!updated) throw createHttpError(404, 'User not found.');
  return toSafeUser(updated);
}

module.exports = { getProfile, updateProfile };
