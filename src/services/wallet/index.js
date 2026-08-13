const { getTronWallet } = require('./tron');
const { getEthereumWallet } = require('./ethereum');
const { getBSCWallet } = require('./bsc');
const { getHDWallet, HDWalletService } = require('./hdWallet');

// Supported networks configuration
const NETWORKS = {
  tron: {
    name: 'TRON',
    symbol: 'TRX',
    token: 'USDT (TRC-20)',
    explorerUrl: 'https://tronscan.org',
    minDeposit: parseFloat(process.env.MIN_DEPOSIT) || 10,
    minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL) || 20,
    withdrawalFee: parseFloat(process.env.WITHDRAWAL_FEE_TRON) || 1,
    confirmations: 19,
    enabled: true
  },
  bsc: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    token: 'USDT (BEP-20)',
    explorerUrl: 'https://bscscan.com',
    minDeposit: parseFloat(process.env.MIN_DEPOSIT) || 10,
    minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL) || 20,
    withdrawalFee: parseFloat(process.env.WITHDRAWAL_FEE_BSC) || 0.5,
    confirmations: 15,
    enabled: true
  },
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    token: 'USDT (ERC-20)',
    explorerUrl: 'https://etherscan.io',
    minDeposit: parseFloat(process.env.MIN_DEPOSIT) || 10,
    minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL) || 20,
    withdrawalFee: parseFloat(process.env.WITHDRAWAL_FEE_ETH) || 5,
    confirmations: 12,
    enabled: true
  }
};

// Get wallet service for a specific network
function getWalletService(network) {
  switch (network) {
    case 'tron':
      return getTronWallet();
    case 'bsc':
      return getBSCWallet();
    case 'ethereum':
      return getEthereumWallet();
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

// Validate address for a specific network
function isValidAddress(network, address) {
  const wallet = getWalletService(network);
  return wallet.isValidAddress(address);
}

// Get network configuration
function getNetworkConfig(network) {
  if (!NETWORKS[network]) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return NETWORKS[network];
}

// Get all enabled networks
function getEnabledNetworks() {
  return Object.entries(NETWORKS)
    .filter(([_, config]) => config.enabled)
    .map(([key, config]) => ({
      id: key,
      ...config
    }));
}

// Generate deposit address for user
async function generateDepositAddress(network, index) {
  const wallet = getWalletService(network);
  return wallet.generateDepositAddress(index);
}

// Get USDT balance for an address
async function getUSDTBalance(network, address) {
  const wallet = getWalletService(network);
  return wallet.getUSDTBalance(address);
}

// Get recent transfers to an address
async function getUSDTTransfers(network, address, fromBlock) {
  const wallet = getWalletService(network);
  return wallet.getUSDTTransfers(address, fromBlock);
}

// Send USDT
async function sendUSDT(network, toAddress, amount, privateKey) {
  const wallet = getWalletService(network);
  return wallet.sendUSDT(toAddress, amount, privateKey);
}

// Get transaction details
async function getTransaction(network, txHash) {
  const wallet = getWalletService(network);
  return wallet.getTransaction(txHash);
}

// Get current block number
async function getCurrentBlock(network) {
  const wallet = getWalletService(network);
  return wallet.getCurrentBlock();
}

module.exports = {
  NETWORKS,
  getWalletService,
  isValidAddress,
  getNetworkConfig,
  getEnabledNetworks,
  generateDepositAddress,
  getUSDTBalance,
  getUSDTTransfers,
  sendUSDT,
  getTransaction,
  getCurrentBlock,
  getHDWallet,
  HDWalletService
};
