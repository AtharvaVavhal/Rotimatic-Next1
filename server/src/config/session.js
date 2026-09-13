const env = require('./env');

// Session lifetime: 7 days. Chosen as a reasonable balance for an
// e-commerce site — long enough to avoid annoying re-logins, short enough
// to bound the blast radius of a stolen cookie.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const COOKIE_NAME = 'rotimatic_session';

const isProduction = env.NODE_ENV === 'production';

/**
 * The session cookie carries nothing but an opaque, unguessable session id
 * (a PostgreSQL-generated UUID — see sessions.db.js) that is looked up
 * against the sessions table on every request. There is no embedded data
 * to protect from tampering the way a JWT would need, so the cookie is not
 * signed with SESSION_SECRET — signing would add no real protection here,
 * since any tampered value simply fails the exact-match DB lookup.
 *
 * sameSite/secure are environment-aware so this also works if the frontend
 * and backend end up deployed on different origins in production:
 *   - development: Lax + not Secure, so it works over plain http://localhost.
 *   - production: None + Secure, so the cookie can be sent cross-site over
 *     HTTPS (SameSite=None requires Secure or browsers drop it).
 */
function buildCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  };
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  buildCookieOptions,
};
