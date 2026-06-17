const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund', 'bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  description: String,
  
  // For deposits/withdrawals
  paymentMethod: String,
  externalTransactionId: String,
  walletAddress: String,
  
  // For bets
  raceId: String,
  team: {
    type: String,
    enum: ['red', 'green', null]
  },
  tickets: Number,
  
  // Metadata
  ip: String,
  userAgent: String
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ raceId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
