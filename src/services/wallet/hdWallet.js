const bip39 = require('bip39');
const hdkey = require('hdkey');
const crypto = require('crypto');

class HDWalletService {
  constructor() {
    this.mnemonic = process.env.WALLET_MNEMONIC;
    this.seed = null;
    this.masterKey = null;
    
    if (this.mnemonic) {
      this.initialize();
    }
  }
  
  initialize() {
    if (!this.mnemonic) {
      throw new Error('WALLET_MNEMONIC not configured');
    }
    
    if (!bip39.validateMnemonic(this.mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }
    
    this.seed = bip39.mnemonicToSeedSync(this.mnemonic);
    this.masterKey = hdkey.fromMasterSeed(this.seed);
  }
  
  // Generate a new mnemonic (for initial setup)
  static generateMnemonic() {
    return bip39.generateMnemonic(256); // 24 words
  }
  
  // Derive key for a specific network and index
  // Using BIP44 paths:
  // - Ethereum/BSC: m/44'/60'/0'/0/index
  // - TRON: m/44'/195'/0'/0/index
  deriveKey(network, index) {
    if (!this.masterKey) {
      this.initialize();
    }
    
    let path;
    switch (network) {
      case 'ethereum':
      case 'bsc':
        path = `m/44'/60'/0'/0/${index}`;
        break;
      case 'tron':
        path = `m/44'/195'/0'/0/${index}`;
        break;
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
    
    const derived = this.masterKey.derive(path);
    return {
      privateKey: derived.privateKey.toString('hex'),
      publicKey: derived.publicKey.toString('hex')
    };
  }
  
  // Get the next available derivation index
  async getNextIndex(network, DepositAddressModel) {
    const lastAddress = await DepositAddressModel
      .findOne({ network })
      .sort({ derivationIndex: -1 })
      .select('derivationIndex');
    
    return lastAddress ? lastAddress.derivationIndex + 1 : 0;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  HDWalletService,
  getHDWallet: () => {
    if (!instance) {
      instance = new HDWalletService();
    }
    return instance;
  }
};
