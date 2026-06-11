const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  raceNumber: {
    type: Number,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['betting', 'racing', 'finished'],
    default: 'betting'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  
  redTeam: {
    totalTickets: { type: Number, default: 0 },
    totalPool: { type: Number, default: 0 },
    bettors: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      tickets: Number,
      amount: Number
    }]
  },
  
  greenTeam: {
    totalTickets: { type: Number, default: 0 },
    totalPool: { type: Number, default: 0 },
    bettors: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      tickets: Number,
      amount: Number
    }]
  },
  
  result: {
    winner: {
      type: String,
      enum: ['red', 'green', 'tie', null],
      default: null
    },
    redTickets: Number,
    greenTickets: Number,
    totalPool: Number,
    houseFee: Number,
    distributedPool: Number
  },
  
  payouts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    team: String,
    tickets: Number,
    originalBet: Number,
    winnings: Number,
    totalReturn: Number
  }]
}, {
  timestamps: true
});

// Indexes
raceSchema.index({ raceNumber: -1 });
raceSchema.index({ status: 1 });
raceSchema.index({ createdAt: -1 });

const Race = mongoose.model('Race', raceSchema);

module.exports = Race;
