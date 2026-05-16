const QRCode = require('qrcode');
const { User, DepositAddress, Deposit, Withdrawal, Transaction } = require('../models');
const { 
  getEnabledNetworks, 
  getNetworkConfig, 
  isValidAddress, 
  generateDepositAddress,
  getHDWallet
} = require('../services/wallet');

// Get supported networks
exports.getNetworks = async (req, res) => {
  try {
    const networks = getEnabledNetworks();
    
    res.json({
      success: true,
      networks
    });
  } catch (error) {
    console.error('Get networks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get networks'
    });
  }
};

// Get or create deposit address for user
exports.getDepositAddress = async (req, res) => {
  try {
    const { network } = req.query;
    
    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Network is required'
      });
    }
    
    // Validate network
    try {
      getNetworkConfig(network);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network'
      });
    }
    
    // Check if user already has an address for this network
    let depositAddress = await DepositAddress.findOne({
      user: req.user._id,
      network
    });
    
    if (!depositAddress) {
      // Generate new address
      const hdWallet = getHDWallet();
      const nextIndex = await hdWallet.getNextIndex(network, DepositAddress);
      
      const addressData = await generateDepositAddress(network, nextIndex);
      
      depositAddress = new DepositAddress({
        user: req.user._id,
        network,
        address: addressData.address,
        derivationIndex: nextIndex
      });
      
      await depositAddress.save();
    }
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(depositAddress.address, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    const networkConfig = getNetworkConfig(network);
    
    res.json({
      success: true,
      address: depositAddress.address,
      network,
      networkName: networkConfig.name,
      token: networkConfig.token,
      minDeposit: networkConfig.minDeposit,
      qrCode
    });
  } catch (error) {
    console.error('Get deposit address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposit address'
    });
  }
};

// Get user's deposit history
exports.getDeposits = async (req, res) => {
  try {
    const { page = 1, limit = 20, network } = req.query;
    
    const query = { user: req.user._id };
    if (network) {
      query.network = network;
    }
    
    const deposits = await Deposit.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Deposit.countDocuments(query);
    
    res.json({
      success: true,
      deposits: deposits.map(d => ({
        id: d._id,
        network: d.network,
        amount: d.amount,
        txHash: d.txHash,
        status: d.status,
        confirmations: d.confirmations,
        requiredConfirmations: d.requiredConfirmations,
        explorerUrl: d.explorerUrl,
        createdAt: d.createdAt,
        creditedAt: d.creditedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get deposits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposits'
    });
  }
};

// Request withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { network, amount, toAddress } = req.body;
    
    // Validate inputs
    if (!network || !amount || !toAddress) {
      return res.status(400).json({
        success: false,
        message: 'Network, amount, and address are required'
      });
    }
    
    // Validate network
    let networkConfig;
    try {
      networkConfig = getNetworkConfig(network);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network'
      });
    }
    
    // Validate address
    if (!isValidAddress(network, toAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal address'
      });
    }
    
    // Validate amount
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    if (withdrawAmount < networkConfig.minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ${networkConfig.minWithdrawal} USDT`
      });
    }
    
    // Check balance
    const user = await User.findById(req.user._id);
    if (user.balance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Check withdrawal cooldown for new accounts
    const cooldownHours = parseInt(process.env.WITHDRAWAL_COOLDOWN_HOURS) || 24;
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    if (accountAge < cooldownHours * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil((cooldownHours * 60 * 60 * 1000 - accountAge) / (60 * 60 * 1000));
      return res.status(400).json({
        success: false,
        message: `New accounts must wait ${hoursLeft} hours before withdrawing`
      });
    }
    
    // Check rate limit (max withdrawals per hour)
    const maxPerHour = parseInt(process.env.MAX_WITHDRAWALS_PER_HOUR) || 3;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentWithdrawals = await Withdrawal.countDocuments({
      user: user._id,
      createdAt: { $gte: oneHourAgo }
    });
    
    if (recentWithdrawals >= maxPerHour) {
      return res.status(429).json({
        success: false,
        message: `Maximum ${maxPerHour} withdrawals per hour. Please try again later.`
      });
    }
    
    // Check daily limit
    const maxDaily = parseFloat(process.env.MAX_WITHDRAWAL_DAILY) || 10000;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyWithdrawals = await Withdrawal.aggregate([
      {
        $match: {
          user: user._id,
          createdAt: { $gte: oneDayAgo },
          status: { $ne: 'failed' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const dailyTotal = dailyWithdrawals[0]?.total || 0;
    if (dailyTotal + withdrawAmount > maxDaily) {
      return res.status(400).json({
        success: false,
        message: `Daily withdrawal limit is ${maxDaily} USDT. You have ${maxDaily - dailyTotal} USDT remaining.`
      });
    }
    
    // Calculate fee and amount after fee
    const networkFee = networkConfig.withdrawalFee;
    const amountAfterFee = withdrawAmount - networkFee;
    
    if (amountAfterFee <= 0) {
      return res.status(400).json({
        success: false,
        message: `Amount must be greater than network fee (${networkFee} USDT)`
      });
    }
    
    // Create withdrawal and deduct balance in transaction
    const session = await Withdrawal.startSession();
    session.startTransaction();
    
    try {
      // Deduct balance
      const balanceBefore = user.balance;
      user.balance -= withdrawAmount;
      await user.save({ session });
      
      // Create withdrawal record
      const withdrawal = new Withdrawal({
        user: user._id,
        network,
        amount: withdrawAmount,
        toAddress,
        networkFee,
        amountAfterFee,
        status: 'pending',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      await withdrawal.save({ session });
      
      // Create transaction record
      await Transaction.create([{
        user: user._id,
        type: 'withdrawal',
        amount: -withdrawAmount,
        balanceBefore,
        balanceAfter: user.balance,
        status: 'pending',
        description: `Withdrawal to ${network.toUpperCase()} - ${toAddress.substring(0, 10)}...`,
        paymentMethod: network,
        walletAddress: toAddress
      }], { session });
      
      await session.commitTransaction();
      
      res.json({
        success: true,
        message: 'Withdrawal request submitted',
        withdrawal: {
          id: withdrawal._id,
          network,
          amount: withdrawAmount,
          networkFee,
          amountAfterFee,
          toAddress,
          status: 'pending'
        },
        newBalance: user.balance
      });
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request'
    });
  }
};

// Get user's withdrawal history
exports.getWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20, network, status } = req.query;
    
    const query = { user: req.user._id };
    if (network) query.network = network;
    if (status) query.status = status;
    
    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Withdrawal.countDocuments(query);
    
    res.json({
      success: true,
      withdrawals: withdrawals.map(w => ({
        id: w._id,
        network: w.network,
        amount: w.amount,
        networkFee: w.networkFee,
        amountAfterFee: w.amountAfterFee,
        toAddress: w.toAddress,
        status: w.status,
        txHash: w.txHash,
        explorerUrl: w.explorerUrl,
        failureReason: w.failureReason,
        createdAt: w.createdAt,
        processedAt: w.processedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawals'
    });
  }
};

// Get wallet summary
exports.getWalletSummary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get deposit addresses
    const depositAddresses = await DepositAddress.find({ user: user._id });
    
    // Get pending deposits
    const pendingDeposits = await Deposit.find({
      user: user._id,
      status: { $in: ['pending', 'confirming'] }
    });
    
    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      user: user._id,
      status: { $in: ['pending', 'processing'] }
    });
    
    // Calculate totals
    const totalDeposited = await Deposit.aggregate([
      { $match: { user: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalWithdrawn = await Withdrawal.aggregate([
      { $match: { user: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amountAfterFee' } } }
    ]);
    
    res.json({
      success: true,
      balance: user.balance,
      depositAddresses: depositAddresses.map(a => ({
        network: a.network,
        address: a.address,
        totalDeposited: a.totalDeposited
      })),
      pendingDeposits: pendingDeposits.map(d => ({
        network: d.network,
        amount: d.amount,
        confirmations: d.confirmations,
        requiredConfirmations: d.requiredConfirmations
      })),
      pendingWithdrawals: pendingWithdrawals.map(w => ({
        network: w.network,
        amount: w.amountAfterFee,
        status: w.status
      })),
      totals: {
        deposited: totalDeposited[0]?.total || 0,
        withdrawn: totalWithdrawn[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet summary'
    });
  }
};

// Cancel pending withdrawal (only if still pending)
exports.cancelWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    
    const withdrawal = await Withdrawal.findOne({
      _id: withdrawalId,
      user: req.user._id,
      status: 'pending'
    });
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found or cannot be cancelled'
      });
    }
    
    const session = await Withdrawal.startSession();
    session.startTransaction();
    
    try {
      // Update withdrawal status
      withdrawal.status = 'cancelled';
      await withdrawal.save({ session });
      
      // Refund user
      const user = await User.findById(req.user._id).session(session);
      const balanceBefore = user.balance;
      user.balance += withdrawal.amount;
      await user.save({ session });
      
      // Create refund transaction
      await Transaction.create([{
        user: user._id,
        type: 'refund',
        amount: withdrawal.amount,
        balanceBefore,
        balanceAfter: user.balance,
        status: 'completed',
        description: 'Withdrawal cancelled by user'
      }], { session });
      
      await session.commitTransaction();
      
      res.json({
        success: true,
        message: 'Withdrawal cancelled and refunded',
        newBalance: user.balance
      });
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel withdrawal'
    });
  }
};
