const { ethers } = require('ethers');
const { getHDWallet } = require('./hdWallet');

// ERC20 ABI for USDT
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

class EthereumWalletService {
  constructor() {
    this.rpcUrl = process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY';
    this.usdtContract = process.env.ETH_USDT_CONTRACT || '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.usdtDecimals = 6; // USDT has 6 decimals
  }
  
  // Generate address from private key
  getAddressFromPrivateKey(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  }
  
  // Generate deposit address for user
  async generateDepositAddress(index) {
    const hdWallet = getHDWallet();
    const { privateKey } = hdWallet.deriveKey('ethereum', index);
    const address = this.getAddressFromPrivateKey(privateKey);
    
    return {
      address,
      network: 'ethereum',
      derivationIndex: index
    };
  }
  
  // Validate Ethereum address
  isValidAddress(address) {
    return ethers.isAddress(address);
  }
  
  // Get USDT balance for an address
  async getUSDTBalance(address) {
    try {
      const contract = new ethers.Contract(this.usdtContract, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      return Number(balance) / Math.pow(10, this.usdtDecimals);
    } catch (error) {
      console.error('Error getting ETH USDT balance:', error);
      return 0;
    }
  }
  
  // Get ETH balance (needed for gas)
  async getETHBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return Number(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error getting ETH balance:', error);
      return 0;
    }
  }
  
  // Get recent USDT transfers to an address using logs
  async getUSDTTransfers(address, fromBlock = 'latest') {
    try {
      const contract = new ethers.Contract(this.usdtContract, ERC20_ABI, this.provider);
      
      // Get Transfer events where 'to' is our address
      const filter = contract.filters.Transfer(null, address);
      
      let startBlock;
      if (fromBlock === 'latest') {
        const currentBlock = await this.provider.getBlockNumber();
        startBlock = currentBlock - 10000; // Last ~10000 blocks
      } else {
        startBlock = fromBlock;
      }
      
      const events = await contract.queryFilter(filter, startBlock);
      
      return events.map(event => ({
        txHash: event.transactionHash,
        from: event.args[0],
        to: event.args[1],
        amount: Number(event.args[2]) / Math.pow(10, this.usdtDecimals),
        blockNumber: event.blockNumber,
        confirmed: true
      }));
    } catch (error) {
      console.error('Error getting ETH USDT transfers:', error);
      return [];
    }
  }
  
  // Send USDT from hot wallet
  async sendUSDT(toAddress, amount, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = new ethers.Contract(this.usdtContract, ERC20_ABI, wallet);
      
      // Amount in smallest unit
      const amountInWei = BigInt(Math.floor(amount * Math.pow(10, this.usdtDecimals)));
      
      // Estimate gas
      const gasEstimate = await contract.transfer.estimateGas(toAddress, amountInWei);
      const feeData = await this.provider.getFeeData();
      
      const tx = await contract.transfer(toAddress, amountInWei, {
        gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      });
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('Error sending ETH USDT:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Get transaction details
  async getTransaction(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx) return null;
      
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;
      
      return {
        txHash,
        blockNumber: receipt?.blockNumber,
        confirmations,
        confirmed: confirmations >= 12, // 12 confirmations for ETH
        success: receipt?.status === 1
      };
    } catch (error) {
      console.error('Error getting ETH transaction:', error);
      return null;
    }
  }
  
  // Get current block number
  async getCurrentBlock() {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Error getting ETH block:', error);
      return 0;
    }
  }
  
  // Get network fee estimate
  getNetworkFee() {
    return parseFloat(process.env.WITHDRAWAL_FEE_ETH) || 5;
  }
  
  // Get minimum withdrawal
  getMinWithdrawal() {
    return parseFloat(process.env.MIN_WITHDRAWAL) || 20;
  }
}

// Singleton
let instance = null;

module.exports = {
  EthereumWalletService,
  getEthereumWallet: () => {
    if (!instance) {
      instance = new EthereumWalletService();
    }
    return instance;
  }
};
