import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { ChevronDown, User, History, Wallet, LogOut } from 'lucide-react';

export function Header({ onSignIn, onSignUp, onOpenWallet, onOpenProfile, onOpenTransactions }) {
  const { user, isAuthenticated, signout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signout();
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🏎️</span>
          <span className="logo-text">BitWinner</span>
        </div>

        {isAuthenticated ? (
          <div className="user-section">
            <div className="wallet-balance" onClick={onOpenWallet}>
              <span className="crypto-icon">₮</span>
              <span className="balance">{user?.balance?.toFixed(2) || '0.00'}</span>
              <span className="currency">USDT</span>
            </div>

            <div className="user-menu">
              <button 
                className="user-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="user-avatar">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="username">{user?.username}</span>
                <ChevronDown size={16} />
              </button>

              {dropdownOpen && (
                <div className="user-dropdown">
                  <button onClick={() => { onOpenProfile(); setDropdownOpen(false); }}>
                    <User size={16} /> Profile
                  </button>
                  <button onClick={() => { onOpenTransactions(); setDropdownOpen(false); }}>
                    <History size={16} /> Transactions
                  </button>
                  <button onClick={() => { onOpenWallet(); setDropdownOpen(false); }}>
                    <Wallet size={16} /> Deposit
                  </button>
                  <div className="dropdown-divider" />
                  <button onClick={handleSignOut} className="danger">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="auth-buttons">
            <Button variant="ghost" onClick={onSignIn}>Sign In</Button>
            <Button onClick={onSignUp}>Sign Up</Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
