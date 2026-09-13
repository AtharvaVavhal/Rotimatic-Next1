const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createOrder, verify, webhook } = require('../controllers/payments.controller');

const router = express.Router();

router.post('/webhook', webhook);
router.use(requireAuth);
router.post('/create-order', createOrder);
router.post('/verify', verify);

module.exports = router;
