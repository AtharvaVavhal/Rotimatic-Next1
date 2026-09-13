const { FRONTEND_URL } = require('./env');

const allowedOrigins = FRONTEND_URL ? [FRONTEND_URL] : [];

/**
 * Origin allowlist built from FRONTEND_URL only — no wildcard.
 * Requests with no Origin header (curl, server-to-server, health checks)
 * are allowed through since they cannot be spoofed via a browser CORS bypass.
 */
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

module.exports = corsOptions;
