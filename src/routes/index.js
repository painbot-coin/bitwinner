const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./user');
const walletRoutes = require('./wallet');

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/wallet', walletRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'BitWinner API is running',
    timestamp: new Date().toISOString()
  });
});

// Public config (non-sensitive settings for frontend)
router.get('/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    ticketPrice: parseFloat(process.env.TICKET_PRICE) || 1,
    raceDuration: parseInt(process.env.RACE_DURATION) || 10000
  });
});

module.exports = router;
