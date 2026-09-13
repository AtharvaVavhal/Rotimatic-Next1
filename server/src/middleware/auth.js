const sessionsDb = require('../db/sessions.db');
const { toSafeUser } = require('../utils/sanitize');
const { isUuid } = require('../utils/validators');
const createHttpError = require('../utils/httpError');
const { COOKIE_NAME } = require('../config/session');

/**
 * Gate for any endpoint that requires a signed-in user (used today by
 * GET /api/auth/me; intended for future protected endpoints too).
 *
 * 1. Reads the session cookie.
 * 2. Rejects a missing/malformed session id without touching the DB.
 * 3. Looks up the session, which also rejects it if expired
 *    (findActiveSessionWithUser filters on expires_at > now()).
 * 4. Loads the owning user in the same query (password_hash is never
 *    selected, so it cannot end up on req.user).
 * 5. Attaches the safe user + session id to the request.
 */
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies ? req.cookies[COOKIE_NAME] : undefined;

    if (!sessionId || !isUuid(sessionId)) {
      throw createHttpError(401, 'Not authenticated.');
    }

    const row = await sessionsDb.findActiveSessionWithUser(sessionId);
    if (!row) {
      throw createHttpError(401, 'Not authenticated.');
    }

    req.user = toSafeUser(row);
    req.sessionId = row.session_id;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
