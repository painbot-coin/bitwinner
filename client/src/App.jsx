import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import Header from './components/layout/Header';
import EmailVerificationBanner from './components/layout/EmailVerificationBanner';
import RaceTrack from './components/game/RaceTrack';
import BettingPanel from './components/game/BettingPanel';
import RaceHistory from './components/game/RaceHistory';
import SignInModal from './components/auth/SignInModal';
import SignUpModal from './components/auth/SignUpModal';
import ProfileModal from './components/auth/ProfileModal';
import WalletModal from './components/wallet/WalletModal';
import './styles/index.css';

function AppContent() {
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  const switchToSignUp = () => {
    setSignInOpen(false);
    setSignUpOpen(true);
  };

  const switchToSignIn = () => {
    setSignUpOpen(false);
    setSignInOpen(true);
  };

  return (
    <div className="app">
      <Header
        onSignIn={() => setSignInOpen(true)}
        onSignUp={() => setSignUpOpen(true)}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenTransactions={() => {}}
      />

      <main className="main-content">
        <div className="game-container">
          <EmailVerificationBanner />
          
          <div className="game-area">
            <RaceTrack />
            <RaceHistory />
          </div>

          <BettingPanel onSignIn={() => setSignInOpen(true)} />
        </div>
      </main>

      {/* Modals */}
      <SignInModal
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSwitchToSignUp={switchToSignUp}
        onForgotPassword={() => {}}
      />
      <SignUpModal
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onSwitchToSignIn={switchToSignIn}
      />
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <WalletModal
        isOpen={walletOpen}
        onClose={() => setWalletOpen(false)}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #2d2d44',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </AuthProvider>
  );
}

export default App;
