const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { create, list, get } = require('../controllers/orders.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/', create);
router.get('/', list);
router.get('/:id', get);

module.exports = router;
