require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
};

const missing = Object.entries(env)
  .filter(([key, value]) => key !== 'NODE_ENV' && key !== 'PORT' && !value)
  .map(([key]) => key);

if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn(
    `[config] Missing environment variables: ${missing.join(', ')}. ` +
      'See .env.example. Some functionality will be limited until these are set.'
  );
}

module.exports = env;
