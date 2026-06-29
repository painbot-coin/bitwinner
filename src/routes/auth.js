const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { 
  authLimiter, 
  signupLimiter, 
  passwordResetLimiter 
} = require('../middleware/rateLimiter');
const {
  signupValidation,
  signinValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation
} = require('../utils/validators');

// Public routes
router.post('/signup', signupLimiter, signupValidation, authController.signup);
router.post('/signin', authLimiter, signinValidation, authController.signin);
router.post('/google', authLimiter, authController.googleAuth);
router.post('/refresh', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// Protected routes
router.post('/signout', authenticate, authController.signout);
router.post('/signout-all', authenticate, authController.signoutAll);
router.post('/resend-verification', authenticate, authController.resendVerification);
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);
router.get('/me', optionalAuth, authController.getMe);

// Session management
router.get('/sessions', authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

module.exports = router;
