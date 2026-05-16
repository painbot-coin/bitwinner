const { User, Transaction } = require('../models');

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toPrivateJSON()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    const user = req.user;
    
    if (username && username !== user.username) {
      // Check if username is taken
      const existing = await User.findOne({
        username: { $regex: new RegExp(`^${username}$`, 'i') },
        _id: { $ne: user._id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      
      user.username = username;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toPrivateJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Get transaction history
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    
    const query = { user: req.user._id };
    if (type) {
      query.type = type;
    }
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions'
    });
  }
};

// Get user stats
exports.getStats = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      stats: {
        balance: user.balance,
        totalWagered: user.stats.totalWagered,
        totalWon: user.stats.totalWon,
        totalLost: user.stats.totalLost,
        profitLoss: user.stats.totalWon - user.stats.totalLost,
        gamesPlayed: user.stats.gamesPlayed,
        wins: user.stats.wins,
        losses: user.stats.losses,
        winRate: user.stats.gamesPlayed > 0 
          ? ((user.stats.wins / user.stats.gamesPlayed) * 100).toFixed(2) 
          : 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats'
    });
  }
};

// Deposit (simulation for demo)
exports.deposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;
    
    if (!amount || amount <= 0 || amount > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deposit amount (1-10000 USDT)'
      });
    }
    
    const balanceBefore = user.balance;
    user.balance += amount;
    await user.save();
    
    // Create transaction record
    await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount,
      balanceBefore,
      balanceAfter: user.balance,
      status: 'completed',
      description: 'Demo deposit',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: `Deposited ${amount} USDT successfully`,
      balance: user.balance
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process deposit'
    });
  }
};

// Get public user profile
exports.getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'profit', limit = 10 } = req.query;
    
    let sortField;
    switch (type) {
      case 'wins':
        sortField = { 'stats.wins': -1 };
        break;
      case 'wagered':
        sortField = { 'stats.totalWagered': -1 };
        break;
      case 'profit':
      default:
        sortField = { 'stats.totalWon': -1 };
    }
    
    const users = await User.find({ isActive: true, isBanned: false })
      .sort(sortField)
      .limit(parseInt(limit))
      .select('username avatar stats');
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      stats: {
        totalWon: user.stats.totalWon,
        wins: user.stats.wins,
        gamesPlayed: user.stats.gamesPlayed
      }
    }));
    
    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard'
    });
  }
};
