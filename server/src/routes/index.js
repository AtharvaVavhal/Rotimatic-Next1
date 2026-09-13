const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const addressesRoutes = require('./addresses.routes');
const ordersRoutes = require('./orders.routes');
const paymentsRoutes = require('./payments.routes');

const router = express.Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/addresses', addressesRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);

module.exports = router;
