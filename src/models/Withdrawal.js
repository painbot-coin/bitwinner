const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  network: {
    type: String,
    enum: ['tron', 'bsc', 'ethereum'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  toAddress: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  txHash: {
    type: String,
    default: null
  },
  networkFee: {
    type: Number,
    default: 0
  },
  amountAfterFee: {
    type: Number,
    default: 0
  },
  failureReason: {
    type: String,
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ txHash: 1 });
withdrawalSchema.index({ network: 1, status: 1 });

// Virtual for explorer URL
withdrawalSchema.virtual('explorerUrl').get(function() {
  if (!this.txHash) return null;
  
  switch (this.network) {
    case 'tron':
      return `https://tronscan.org/#/transaction/${this.txHash}`;
    case 'bsc':
      return `https://bscscan.com/tx/${this.txHash}`;
    case 'ethereum':
      return `https://etherscan.io/tx/${this.txHash}`;
    default:
      return null;
  }
});

withdrawalSchema.set('toJSON', { virtuals: true });
withdrawalSchema.set('toObject', { virtuals: true });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
