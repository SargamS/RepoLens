const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();

// Light rate limiting on unauthenticated OAuth entry points.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', authLimiter, authController.login);
router.get('/callback', authLimiter, authController.callback);
router.get('/me', authController.me);
router.post('/logout', authController.logout);

module.exports = router;
