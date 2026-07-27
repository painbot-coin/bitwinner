const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate, requireEmailVerification } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { body, query, param } = require('express-validator');

// Validation middleware
const validateNetwork = query('network')
  .optional()
  .isIn(['tron', 'bsc', 'ethereum'])
  .withMessage('Invalid network');

const validateWithdrawal = [
  body('network')
    .isIn(['tron', 'bsc', 'ethereum'])
    .withMessage('Invalid network'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  body('toAddress')
    .notEmpty()
    .withMessage('Withdrawal address is required')
    .isString()
    .trim()
];

// Withdrawal rate limiter (stricter than general API)
const withdrawalLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 withdrawal requests per hour
  message: {
    success: false,
    message: 'Too many withdrawal requests. Please try again later.'
  }
});

// Public routes
router.get('/networks', apiLimiter, walletController.getNetworks);

// Protected routes (require auth)
router.get('/summary', authenticate, walletController.getWalletSummary);
router.get('/deposits', authenticate, validateNetwork, walletController.getDeposits);
router.get('/withdrawals', authenticate, validateNetwork, walletController.getWithdrawals);

// Protected routes (require auth + email verification)
router.get(
  '/deposit-address',
  authenticate,
  requireEmailVerification,
  query('network').isIn(['tron', 'bsc', 'ethereum']).withMessage('Invalid network'),
  walletController.getDepositAddress
);

router.post(
  '/withdraw',
  authenticate,
  requireEmailVerification,
  withdrawalLimiter,
  validateWithdrawal,
  walletController.requestWithdrawal
);

router.delete(
  '/withdrawals/:withdrawalId',
  authenticate,
  param('withdrawalId').isMongoId().withMessage('Invalid withdrawal ID'),
  walletController.cancelWithdrawal
);

module.exports = router;
