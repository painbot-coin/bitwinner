const { TronWeb } = require('tronweb');
const { getHDWallet } = require('./hdWallet');

class TronWalletService {
  constructor() {
    this.network = process.env.TRON_NETWORK || 'mainnet';
    this.apiKey = process.env.TRON_API_KEY;
    this.usdtContract = process.env.TRON_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    
    const fullHost = this.network === 'mainnet' 
      ? 'https://api.trongrid.io'
      : 'https://api.shasta.trongrid.io';
    
    this.tronWeb = new TronWeb({
      fullHost,
      headers: this.apiKey ? { 'TRON-PRO-API-KEY': this.apiKey } : {}
    });
  }
  
  // Generate address from private key
  getAddressFromPrivateKey(privateKey) {
    return TronWeb.address.fromPrivateKey(privateKey);
  }
  
  // Generate deposit address for user
  async generateDepositAddress(index) {
    const hdWallet = getHDWallet();
    const { privateKey } = hdWallet.deriveKey('tron', index);
    const address = this.getAddressFromPrivateKey(privateKey);
    
    return {
      address,
      network: 'tron',
      derivationIndex: index
    };
  }
  
  // Validate TRON address
  isValidAddress(address) {
    return TronWeb.isAddress(address);
  }
  
  // Get USDT balance for an address
  async getUSDTBalance(address) {
    try {
      this.tronWeb.setAddress(address);
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      const balance = await contract.balanceOf(address).call();
      // USDT on TRON has 6 decimals
      return Number(balance) / 1e6;
    } catch (error) {
      console.error('Error getting TRON USDT balance:', error);
      return 0;
    }
  }
  
  // Get TRX balance (needed for gas)
  async getTRXBalance(address) {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      return balance / 1e6; // TRX has 6 decimals
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }
  
  // Get recent USDT transfers to an address
  async getUSDTTransfers(address, limit = 50) {
    try {
      const url = this.network === 'mainnet'
        ? `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`
        : `https://api.shasta.trongrid.io/v1/accounts/${address}/transactions/trc20`;
      
      const response = await fetch(`${url}?limit=${limit}&contract_address=${this.usdtContract}`, {
        headers: this.apiKey ? { 'TRON-PRO-API-KEY': this.apiKey } : {}
      });
      
      const data = await response.json();
      
      if (!data.data) return [];
      
      return data.data
        .filter(tx => tx.to === address && tx.token_info?.symbol === 'USDT')
        .map(tx => ({
          txHash: tx.transaction_id,
          from: tx.from,
          to: tx.to,
          amount: Number(tx.value) / 1e6,
          timestamp: tx.block_timestamp,
          confirmed: true // TronGrid only returns confirmed
        }));
    } catch (error) {
      console.error('Error getting TRON USDT transfers:', error);
      return [];
    }
  }
  
  // Send USDT from hot wallet
  async sendUSDT(toAddress, amount, privateKey) {
    try {
      const tronWeb = new TronWeb({
        fullHost: this.network === 'mainnet' 
          ? 'https://api.trongrid.io'
          : 'https://api.shasta.trongrid.io',
        privateKey,
        headers: this.apiKey ? { 'TRON-PRO-API-KEY': this.apiKey } : {}
      });
      
      const contract = await tronWeb.contract().at(this.usdtContract);
      
      // Amount in smallest unit (6 decimals)
      const amountInSun = Math.floor(amount * 1e6);
      
      const tx = await contract.transfer(toAddress, amountInSun).send({
        feeLimit: 100000000, // 100 TRX max fee
        callValue: 0
      });
      
      return {
        success: true,
        txHash: tx
      };
    } catch (error) {
      console.error('Error sending TRON USDT:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Get transaction details
  async getTransaction(txHash) {
    try {
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      
      return {
        txHash,
        blockNumber: txInfo.blockNumber,
        confirmed: !!txInfo.blockNumber,
        success: txInfo.receipt?.result === 'SUCCESS'
      };
    } catch (error) {
      console.error('Error getting TRON transaction:', error);
      return null;
    }
  }
  
  // Get current block number
  async getCurrentBlock() {
    try {
      const block = await this.tronWeb.trx.getCurrentBlock();
      return block.block_header.raw_data.number;
    } catch (error) {
      console.error('Error getting TRON block:', error);
      return 0;
    }
  }
  
  // Get network fee estimate
  getNetworkFee() {
    return parseFloat(process.env.WITHDRAWAL_FEE_TRON) || 1;
  }
  
  // Get minimum withdrawal
  getMinWithdrawal() {
    return parseFloat(process.env.MIN_WITHDRAWAL) || 20;
  }
}

// Singleton
let instance = null;

module.exports = {
  TronWalletService,
  getTronWallet: () => {
    if (!instance) {
      instance = new TronWalletService();
    }
    return instance;
  }
};
