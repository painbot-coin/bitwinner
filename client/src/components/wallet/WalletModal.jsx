import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const NETWORKS = [
  { id: 'tron', name: 'TRON', token: 'TRC-20', icon: '🔴', fee: 1 },
  { id: 'bsc', name: 'BSC', token: 'BEP-20', icon: '🟡', fee: 0.5 },
  { id: 'ethereum', name: 'Ethereum', token: 'ERC-20', icon: '🔵', fee: 5 },
];

export function WalletModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('deposit');
  const [selectedNetwork, setSelectedNetwork] = useState('tron');
  const [depositAddress, setDepositAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  
  // Withdraw state
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  // History state
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const currentNetwork = NETWORKS.find(n => n.id === selectedNetwork);

  useEffect(() => {
    if (isOpen && activeTab === 'deposit') {
      loadDepositAddress();
    } else if (isOpen && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, activeTab, selectedNetwork]);

  const loadDepositAddress = async () => {
    setLoadingAddress(true);
    try {
      const data = await api.getDepositAddress(selectedNetwork);
      if (data.success) {
        setDepositAddress(data.address);
      }
    } catch (error) {
      toast.error('Failed to load deposit address');
    } finally {
      setLoadingAddress(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const [depData, withData] = await Promise.all([
        api.getDeposits(),
        api.getWithdrawals(),
      ]);
      if (depData.success) setDeposits(depData.deposits);
      if (withData.success) setWithdrawals(withData.withdrawals);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const copyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      toast.success('Address copied!');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAddress.trim()) {
      toast.error('Please enter withdrawal address');
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 20) {
      toast.error('Minimum withdrawal is 20 USDT');
      return;
    }
    
    if (amount > (user?.balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    setWithdrawing(true);
    try {
      const data = await api.requestWithdrawal(selectedNetwork, amount, withdrawAddress);
      if (data.success) {
        toast.success('Withdrawal request submitted!');
        setWithdrawAddress('');
        setWithdrawAmount('');
      }
    } catch (error) {
      toast.error(error.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const setMaxWithdraw = () => {
    if (user) {
      setWithdrawAmount(user.balance.toString());
    }
  };

  const receiveAmount = Math.max(0, (parseFloat(withdrawAmount) || 0) - (currentNetwork?.fee || 0));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Wallet" size="lg">
      <div className="balance-display">
        <span className="balance-label">Available Balance</span>
        <span className="balance-amount">{user?.balance?.toFixed(2) || '0.00'} USDT</span>
      </div>

      {/* Tabs */}
      <div className="wallet-tabs">
        <button 
          className={`wallet-tab ${activeTab === 'deposit' ? 'active' : ''}`}
          onClick={() => setActiveTab('deposit')}
        >
          Deposit
        </button>
        <button 
          className={`wallet-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdraw')}
        >
          Withdraw
        </button>
        <button 
          className={`wallet-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {/* Network Selector */}
      {(activeTab === 'deposit' || activeTab === 'withdraw') && (
        <div className="network-selector">
          <label>Select Network</label>
          <div className="network-buttons">
            {NETWORKS.map(network => (
              <button
                key={network.id}
                className={`network-btn ${selectedNetwork === network.id ? 'active' : ''}`}
                onClick={() => setSelectedNetwork(network.id)}
              >
                <span className="network-icon">{network.icon}</span>
                <span className="network-name">{network.name} ({network.token})</span>
                <span className="network-fee">Fee: {network.fee} USDT</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Deposit Tab */}
      {activeTab === 'deposit' && (
        <div className="deposit-content">
          {loadingAddress ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Loading address...</span>
            </div>
          ) : depositAddress ? (
            <div className="deposit-address-section">
              <div className="qr-code">
                <QRCodeSVG value={depositAddress} size={150} />
              </div>
              <div className="address-info">
                <label>Deposit Address</label>
                <div className="address-copy">
                  <input type="text" value={depositAddress} readOnly />
                  <Button onClick={copyAddress}>📋 Copy</Button>
                </div>
                <p className="deposit-warning">
                  ⚠️ Only send <strong>USDT</strong> to this address on {currentNetwork?.name}. 
                  Minimum deposit: 10 USDT
                </p>
              </div>
            </div>
          ) : (
            <p className="error-state">Failed to load address</p>
          )}
        </div>
      )}

      {/* Withdraw Tab */}
      {activeTab === 'withdraw' && (
        <div className="withdraw-content">
          <div className="withdraw-form">
            <Input
              label="Withdrawal Address"
              type="text"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder={`Enter your ${currentNetwork?.name} address`}
            />
            <div className="form-group">
              <label>Amount (USDT)</label>
              <div className="amount-input-group">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  min="20"
                  step="0.01"
                />
                <button className="max-btn" onClick={setMaxWithdraw}>MAX</button>
              </div>
              <div className="amount-info">
                <span>Min: 20 USDT</span>
                <span>Fee: {currentNetwork?.fee} USDT</span>
                <span>You receive: {receiveAmount.toFixed(2)} USDT</span>
              </div>
            </div>
            <Button 
              onClick={handleWithdraw} 
              loading={withdrawing}
              className="btn-block"
            >
              Request Withdrawal
            </Button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-content">
          {loadingHistory ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Loading history...</span>
            </div>
          ) : (
            <div className="wallet-history-list">
              {[...deposits.map(d => ({ ...d, type: 'deposit' })), 
                ...withdrawals.map(w => ({ ...w, type: 'withdrawal' }))]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((tx, i) => (
                  <div key={i} className="history-item">
                    <div className="history-item-left">
                      <div className={`history-icon ${tx.type}`}>
                        {tx.type === 'deposit' ? '📥' : '📤'}
                      </div>
                      <div className="history-details">
                        <span className="history-type">
                          {tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </span>
                        <span className="history-network">{tx.network?.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="history-item-right">
                      <span className={`history-amount ${tx.type === 'deposit' ? 'positive' : 'negative'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{tx.amount?.toFixed(2)} USDT
                      </span>
                      <span className={`history-status ${tx.status}`}>{tx.status}</span>
                    </div>
                  </div>
                ))}
              {deposits.length === 0 && withdrawals.length === 0 && (
                <p className="empty-state">No transactions yet</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default WalletModal;
