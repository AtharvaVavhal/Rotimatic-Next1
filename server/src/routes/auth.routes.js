const express = require('express');
const { signup, login, logout, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/signup', signupLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
