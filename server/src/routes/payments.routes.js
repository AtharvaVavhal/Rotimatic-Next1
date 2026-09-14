const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { paymentsLimiter } = require('../middleware/rateLimit');
const { createOrder, verify, webhook } = require('../controllers/payments.controller');
const manualPayments = require('../controllers/manualPayments.controller');

const router = express.Router();

router.post('/webhook', webhook);
// Public: the client's configured UPI ID / QR reference is not sensitive
// (it is meant to be displayed at checkout, same as a printed QR poster).
router.get('/manual/config', manualPayments.config);

router.use(requireAuth);
router.post('/create-order', paymentsLimiter, createOrder);
router.post('/verify', paymentsLimiter, verify);
router.post('/manual', manualPayments.submit);

module.exports = router;