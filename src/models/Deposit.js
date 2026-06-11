const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  depositAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DepositAddress',
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
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  fromAddress: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirming', 'completed', 'failed'],
    default: 'pending'
  },
  confirmations: {
    type: Number,
    default: 0
  },
  requiredConfirmations: {
    type: Number,
    default: 19
  },
  blockNumber: {
    type: Number
  },
  creditedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
depositSchema.index({ user: 1, createdAt: -1 });
depositSchema.index({ txHash: 1 }, { unique: true });
depositSchema.index({ status: 1 });
depositSchema.index({ depositAddress: 1 });
depositSchema.index({ network: 1, status: 1 });

// Virtual for explorer URL
depositSchema.virtual('explorerUrl').get(function() {
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

depositSchema.set('toJSON', { virtuals: true });
depositSchema.set('toObject', { virtuals: true });

const Deposit = mongoose.model('Deposit', depositSchema);

module.exports = Deposit;
