const { Withdrawal, User, Transaction } = require('../../models');
const { getWalletService, getNetworkConfig, getHDWallet } = require('../wallet');

class WithdrawalBroadcaster {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.processInterval = parseInt(process.env.WITHDRAWAL_PROCESS_INTERVAL) || 60000; // 1 minute
    this.isProcessing = false;
  }
  
  // Start processing withdrawals
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Withdrawal broadcaster started');
    
    // Process pending withdrawals periodically
    this.processPendingWithdrawals();
    this.intervalId = setInterval(() => this.processPendingWithdrawals(), this.processInterval);
  }
  
  // Stop processing
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Withdrawal broadcaster stopped');
  }
  
  // Process all pending withdrawals
  async processPendingWithdrawals() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const pendingWithdrawals = await Withdrawal.find({
        status: 'pending'
      }).populate('user').sort({ createdAt: 1 }); // Process oldest first
      
      for (const withdrawal of pendingWithdrawals) {
        try {
          await this.processWithdrawal(withdrawal);
        } catch (error) {
          console.error(`Error processing withdrawal ${withdrawal._id}:`, error);
          
          // Mark as failed if error
          withdrawal.status = 'failed';
          withdrawal.failureReason = error.message;
          await withdrawal.save();
          
          // Refund user
          await this.refundWithdrawal(withdrawal);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  // Process a single withdrawal
  async processWithdrawal(withdrawal) {
    console.log(`Processing withdrawal ${withdrawal._id} for ${withdrawal.user.username}`);
    
    // Update status to processing
    withdrawal.status = 'processing';
    await withdrawal.save();
    
    // Notify user
    this.notifyUser(withdrawal.user._id.toString(), 'withdrawalProcessing', {
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
      network: withdrawal.network
    });
    
    // Get wallet service and HD wallet
    const walletService = getWalletService(withdrawal.network);
    const hdWallet = getHDWallet();
    
    // Get master wallet private key (index 0)
    const { privateKey } = hdWallet.deriveKey(withdrawal.network, 0);
    
    // Send USDT
    const result = await walletService.sendUSDT(
      withdrawal.toAddress,
      withdrawal.amountAfterFee,
      privateKey
    );
    
    if (result.success) {
      // Update withdrawal with tx hash
      withdrawal.status = 'completed';
      withdrawal.txHash = result.txHash;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      
      console.log(`Withdrawal completed: ${result.txHash}`);
      
      // Notify user
      this.notifyUser(withdrawal.user._id.toString(), 'withdrawalCompleted', {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amountAfterFee,
        network: withdrawal.network,
        txHash: result.txHash,
        explorerUrl: withdrawal.explorerUrl
      });
    } else {
      throw new Error(result.error || 'Transaction failed');
    }
  }
  
  // Refund a failed withdrawal
  async refundWithdrawal(withdrawal) {
    const session = await Withdrawal.startSession();
    session.startTransaction();
    
    try {
      // Update user balance
      const user = await User.findById(withdrawal.user._id).session(session);
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
        description: `Withdrawal refund - ${withdrawal.failureReason || 'Failed'}`,
        paymentMethod: withdrawal.network
      }], { session });
      
      await session.commitTransaction();
      
      console.log(`Withdrawal refunded: ${withdrawal.amount} USDT to ${user.username}`);
      
      // Notify user
      this.notifyUser(user._id.toString(), 'withdrawalFailed', {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        reason: withdrawal.failureReason,
        refunded: true,
        newBalance: user.balance
      });
      
      this.notifyUser(user._id.toString(), 'walletUpdate', {
        balance: user.balance,
        stats: user.stats
      });
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Error refunding withdrawal:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Notify user via WebSocket
  notifyUser(userId, event, data) {
    if (this.io) {
      const sockets = this.io.sockets.sockets;
      for (const [_, socket] of sockets) {
        if (socket.user && socket.user._id.toString() === userId) {
          socket.emit(event, data);
        }
      }
    }
  }
}

// Singleton instance
let instance = null;

function getWithdrawalBroadcaster(io) {
  if (!instance) {
    instance = new WithdrawalBroadcaster(io);
  }
  return instance;
}

function startWithdrawalBroadcaster(io) {
  const broadcaster = getWithdrawalBroadcaster(io);
  broadcaster.start();
  return broadcaster;
}

module.exports = {
  WithdrawalBroadcaster,
  getWithdrawalBroadcaster,
  startWithdrawalBroadcaster
};
