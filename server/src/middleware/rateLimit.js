const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Every request from the automated test suite shares one loopback IP, so
// the real limits would start rejecting valid test traffic well before any
// individual test is exercising the limiter on purpose. Disabling
// enforcement under NODE_ENV=test (set by `npm test`) is limited to that
// environment and never relaxes the limiter in development/production.
const skipInTest = () => env.NODE_ENV === 'test';

/**
 * Applied only to POST /api/auth/login and POST /api/auth/signup (see
 * routes/auth.routes.js) — not globally. See README's "Rate limiting"
 * note for the production caveat (in-memory store, per-process).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { status: 'error', message: 'Too many login attempts. Please try again later.' },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { status: 'error', message: 'Too many signup attempts. Please try again later.' },
});

/**
 * Applied to authenticated payment-initiation/verification endpoints
 * (POST /api/payments/create-order, POST /api/payments/verify — see
 * routes/payments.routes.js). These are behind requireAuth already, so
 * this isn't guarding against anonymous abuse — it's bounding how many
 * gateway calls / signature checks one account can trigger per window,
 * since both paths call out to Razorpay and do crypto comparisons.
 */
const paymentsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { status: 'error', message: 'Too many payment requests. Please try again later.' },
});

module.exports = { loginLimiter, signupLimiter, paymentsLimiter };