const mongoose = require('mongoose');

const depositAddressSchema = new mongoose.Schema({
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
  address: {
    type: String,
    required: true,
    unique: true
  },
  derivationIndex: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalDeposited: {
    type: Number,
    default: 0
  },
  lastDepositAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for user + network (one address per network per user)
depositAddressSchema.index({ user: 1, network: 1 }, { unique: true });
depositAddressSchema.index({ address: 1 });
depositAddressSchema.index({ derivationIndex: 1, network: 1 }, { unique: true });

const DepositAddress = mongoose.model('DepositAddress', depositAddressSchema);

module.exports = DepositAddress;
