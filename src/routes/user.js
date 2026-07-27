const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireEmailVerification } = require('../middleware/auth');
const { updateProfileValidation } = require('../utils/validators');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/leaderboard', apiLimiter, userController.getLeaderboard);
router.get('/profile/:username', apiLimiter, userController.getPublicProfile);

// Protected routes (auth required)
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, updateProfileValidation, userController.updateProfile);
router.get('/transactions', authenticate, userController.getTransactions);
router.get('/stats', authenticate, userController.getStats);

// Protected routes (auth + email verification required)
router.post('/deposit', authenticate, requireEmailVerification, userController.deposit);

module.exports = router;
