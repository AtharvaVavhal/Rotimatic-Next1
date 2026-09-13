const express = require('express');
const { getMe, updateMe } = require('../controllers/users.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', updateMe);

module.exports = router;
