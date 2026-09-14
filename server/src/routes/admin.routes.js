const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const controller = require('../controllers/admin.controller');
const manualPayments = require('../controllers/manualPayments.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/stats', controller.stats);
router.get('/orders', controller.orders);
router.get('/orders/:id', controller.order);
router.patch('/orders/:id', controller.updateOrder);
router.get('/customers', controller.customers);
router.get('/customers/:id', controller.customer);
router.get('/payment-settings', controller.paymentSettings);
router.patch('/payment-settings', controller.updatePaymentSettings);
// Manual UPI/QR payments only — provider is enforced server-side
// (findManualPaymentById filters on provider = 'manual_upi'), so these can
// never confirm/reject a Razorpay payment.
router.post('/payments/:id/confirm', manualPayments.confirm);
router.post('/payments/:id/reject', manualPayments.reject);
module.exports = router;
