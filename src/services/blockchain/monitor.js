const { DepositAddress, Deposit, User, Transaction } = require('../../models');
const { getWalletService, getNetworkConfig, NETWORKS } = require('../wallet');

class DepositMonitor {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.pollInterval = parseInt(process.env.DEPOSIT_POLL_INTERVAL) || 30000; // 30 seconds
    this.processedTxs = new Set();
  }
  
  // Start monitoring all networks
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Deposit monitor started');
    
    // Start polling for each network
    this.pollAllNetworks();
    this.intervalId = setInterval(() => this.pollAllNetworks(), this.pollInterval);
  }
  
  // Stop monitoring
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Deposit monitor stopped');
  }
  
  // Poll all networks for new deposits
  async pollAllNetworks() {
    const networks = Object.keys(NETWORKS).filter(n => NETWORKS[n].enabled);
    
    for (const network of networks) {
      try {
        await this.pollNetwork(network);
      } catch (error) {
        console.error(`Error polling ${network}:`, error);
      }
    }
    
    // Also check pending deposits for confirmations
    await this.checkPendingDeposits();
  }
  
  // Poll a specific network for new deposits
  async pollNetwork(network) {
    const walletService = getWalletService(network);
    
    // Get all active deposit addresses for this network
    const addresses = await DepositAddress.find({ 
      network, 
      isActive: true 
    }).populate('user');
    
    for (const depositAddress of addresses) {
      try {
        // Get recent transfers to this address
        const transfers = await walletService.getUSDTTransfers(depositAddress.address);
        
        for (const transfer of transfers) {
          await this.processTransfer(depositAddress, transfer, network);
        }
      } catch (error) {
        console.error(`Error checking address ${depositAddress.address}:`, error);
      }
    }
  }
  
  // Process a single transfer
  async processTransfer(depositAddress, transfer, network) {
    // Skip if already processed
    if (this.processedTxs.has(transfer.txHash)) {
      return;
    }
    
    // Check if deposit already exists in database
    const existingDeposit = await Deposit.findOne({ txHash: transfer.txHash });
    if (existingDeposit) {
      this.processedTxs.add(transfer.txHash);
      return;
    }
    
    const networkConfig = getNetworkConfig(network);
    const minDeposit = networkConfig.minDeposit;
    
    // Skip if below minimum
    if (transfer.amount < minDeposit) {
      console.log(`Deposit below minimum: ${transfer.amount} < ${minDeposit}`);
      return;
    }
    
    // Create deposit record
    const deposit = new Deposit({
      user: depositAddress.user._id,
      depositAddress: depositAddress._id,
      network,
      amount: transfer.amount,
      txHash: transfer.txHash,
      fromAddress: transfer.from,
      status: 'confirming',
      confirmations: 0,
      requiredConfirmations: networkConfig.confirmations,
      blockNumber: transfer.blockNumber
    });
    
    await deposit.save();
    this.processedTxs.add(transfer.txHash);
    
    console.log(`New deposit detected: ${transfer.amount} USDT on ${network} for user ${depositAddress.user.username}`);
    
    // Notify user via WebSocket
    this.notifyUser(depositAddress.user._id.toString(), 'depositDetected', {
      amount: transfer.amount,
      network,
      txHash: transfer.txHash,
      status: 'confirming',
      confirmations: 0,
      requiredConfirmations: networkConfig.confirmations
    });
  }
  
  // Check pending deposits for confirmations
  async checkPendingDeposits() {
    const pendingDeposits = await Deposit.find({
      status: { $in: ['pending', 'confirming'] }
    }).populate('user');
    
    for (const deposit of pendingDeposits) {
      try {
        await this.checkDepositConfirmations(deposit);
      } catch (error) {
        console.error(`Error checking deposit ${deposit.txHash}:`, error);
      }
    }
  }
  
  // Check confirmations for a specific deposit
  async checkDepositConfirmations(deposit) {
    const walletService = getWalletService(deposit.network);
    
    // Get transaction details
    const txInfo = await walletService.getTransaction(deposit.txHash);
    
    if (!txInfo) {
      return;
    }
    
    // Update confirmations
    const currentBlock = await walletService.getCurrentBlock();
    const confirmations = deposit.blockNumber 
      ? currentBlock - deposit.blockNumber 
      : (txInfo.confirmations || 0);
    
    deposit.confirmations = confirmations;
    
    // Check if confirmed
    if (confirmations >= deposit.requiredConfirmations && deposit.status !== 'completed') {
      await this.creditDeposit(deposit);
    } else {
      await deposit.save();
      
      // Notify user of confirmation progress
      this.notifyUser(deposit.user._id.toString(), 'depositConfirming', {
        txHash: deposit.txHash,
        confirmations,
        requiredConfirmations: deposit.requiredConfirmations
      });
    }
  }
  
  // Credit deposit to user's balance
  async creditDeposit(deposit) {
    const session = await Deposit.startSession();
    session.startTransaction();
    
    try {
      // Update deposit status
      deposit.status = 'completed';
      deposit.creditedAt = new Date();
      await deposit.save({ session });
      
      // Update user balance
      const user = await User.findById(deposit.user._id).session(session);
      const balanceBefore = user.balance;
      user.balance += deposit.amount;
      await user.save({ session });
      
      // Create transaction record
      await Transaction.create([{
        user: user._id,
        type: 'deposit',
        amount: deposit.amount,
        balanceBefore,
        balanceAfter: user.balance,
        status: 'completed',
        description: `Deposit via ${deposit.network.toUpperCase()}`,
        paymentMethod: deposit.network,
        externalTransactionId: deposit.txHash,
        walletAddress: deposit.fromAddress
      }], { session });
      
      // Update deposit address stats
      await DepositAddress.findByIdAndUpdate(
        deposit.depositAddress,
        {
          $inc: { totalDeposited: deposit.amount },
          lastDepositAt: new Date()
        },
        { session }
      );
      
      await session.commitTransaction();
      
      console.log(`Deposit credited: ${deposit.amount} USDT to ${user.username}`);
      
      // Notify user
      this.notifyUser(user._id.toString(), 'depositCompleted', {
        amount: deposit.amount,
        network: deposit.network,
        txHash: deposit.txHash,
        newBalance: user.balance
      });
      
      // Also send wallet update
      this.notifyUser(user._id.toString(), 'walletUpdate', {
        balance: user.balance,
        stats: user.stats
      });
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Error crediting deposit:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Notify user via WebSocket
  notifyUser(userId, event, data) {
    if (this.io) {
      // Find user's socket and emit
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

function getDepositMonitor(io) {
  if (!instance) {
    instance = new DepositMonitor(io);
  }
  return instance;
}

function startDepositMonitor(io) {
  const monitor = getDepositMonitor(io);
  monitor.start();
  return monitor;
}

module.exports = {
  DepositMonitor,
  getDepositMonitor,
  startDepositMonitor
};
