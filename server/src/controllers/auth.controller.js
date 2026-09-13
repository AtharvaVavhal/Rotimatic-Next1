const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const createHttpError = require('../utils/httpError');
const { validateSignupPayload, validateLoginPayload, isUuid } = require('../utils/validators');
const { COOKIE_NAME, buildCookieOptions } = require('../config/session');

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, buildCookieOptions());
}

function clearSessionCookie(res) {
  const { maxAge, ...clearOptions } = buildCookieOptions();
  res.clearCookie(COOKIE_NAME, clearOptions);
}

const signup = asyncHandler(async (req, res) => {
  const errors = validateSignupPayload(req.body);
  if (errors.length) {
    throw createHttpError(400, errors.join(' '));
  }

  const { user, session } = await authService.signup(req.body);

  setSessionCookie(res, session.id);
  res.status(201).json({ status: 'ok', data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const errors = validateLoginPayload(req.body);
  if (errors.length) {
    throw createHttpError(400, errors.join(' '));
  }

  const { user, session } = await authService.login(req.body);

  setSessionCookie(res, session.id);
  res.status(200).json({ status: 'ok', data: { user } });
});

const logout = asyncHandler(async (req, res) => {
  const sessionId = req.cookies ? req.cookies[COOKIE_NAME] : undefined;

  if (sessionId && isUuid(sessionId)) {
    await authService.logout(sessionId);
  }

  clearSessionCookie(res);
  res.status(200).json({ status: 'ok', data: { loggedOut: true } });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({ status: 'ok', data: { authenticated: true, user: req.user } });
});

module.exports = { signup, login, logout, me };
