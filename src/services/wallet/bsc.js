const { ethers } = require('ethers');
const { getHDWallet } = require('./hdWallet');

// BEP20 ABI for USDT (same as ERC20)
const BEP20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

class BSCWalletService {
  constructor() {
    this.rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
    this.usdtContract = process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955';
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.usdtDecimals = 18; // BSC USDT has 18 decimals
  }
  
  // Generate address from private key (same as Ethereum)
  getAddressFromPrivateKey(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  }
  
  // Generate deposit address for user (uses same derivation as Ethereum)
  async generateDepositAddress(index) {
    const hdWallet = getHDWallet();
    const { privateKey } = hdWallet.deriveKey('bsc', index); // Uses ETH path
    const address = this.getAddressFromPrivateKey(privateKey);
    
    return {
      address,
      network: 'bsc',
      derivationIndex: index
    };
  }
  
  // Validate BSC address (same format as Ethereum)
  isValidAddress(address) {
    return ethers.isAddress(address);
  }
  
  // Get USDT balance for an address
  async getUSDTBalance(address) {
    try {
      const contract = new ethers.Contract(this.usdtContract, BEP20_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      return Number(balance) / Math.pow(10, this.usdtDecimals);
    } catch (error) {
      console.error('Error getting BSC USDT balance:', error);
      return 0;
    }
  }
  
  // Get BNB balance (needed for gas)
  async getBNBBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return Number(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error getting BNB balance:', error);
      return 0;
    }
  }
  
  // Get recent USDT transfers to an address
  async getUSDTTransfers(address, fromBlock = 'latest') {
    try {
      const contract = new ethers.Contract(this.usdtContract, BEP20_ABI, this.provider);
      
      const filter = contract.filters.Transfer(null, address);
      
      let startBlock;
      if (fromBlock === 'latest') {
        const currentBlock = await this.provider.getBlockNumber();
        startBlock = currentBlock - 10000;
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
      console.error('Error getting BSC USDT transfers:', error);
      return [];
    }
  }
  
  // Send USDT from hot wallet
  async sendUSDT(toAddress, amount, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = new ethers.Contract(this.usdtContract, BEP20_ABI, wallet);
      
      // Amount in smallest unit (18 decimals for BSC USDT)
      const amountInWei = ethers.parseUnits(amount.toString(), this.usdtDecimals);
      
      // Estimate gas
      const gasEstimate = await contract.transfer.estimateGas(toAddress, amountInWei);
      const feeData = await this.provider.getFeeData();
      
      const tx = await contract.transfer(toAddress, amountInWei, {
        gasLimit: gasEstimate * 120n / 100n,
        gasPrice: feeData.gasPrice
      });
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('Error sending BSC USDT:', error);
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
        confirmed: confirmations >= 15, // 15 confirmations for BSC
        success: receipt?.status === 1
      };
    } catch (error) {
      console.error('Error getting BSC transaction:', error);
      return null;
    }
  }
  
  // Get current block number
  async getCurrentBlock() {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Error getting BSC block:', error);
      return 0;
    }
  }
  
  // Get network fee estimate
  getNetworkFee() {
    return parseFloat(process.env.WITHDRAWAL_FEE_BSC) || 0.5;
  }
  
  // Get minimum withdrawal
  getMinWithdrawal() {
    return parseFloat(process.env.MIN_WITHDRAWAL) || 20;
  }
}

// Singleton
let instance = null;

module.exports = {
  BSCWalletService,
  getBSCWallet: () => {
    if (!instance) {
      instance = new BSCWalletService();
    }
    return instance;
  }
};
