import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

export function EmailVerificationBanner() {
  const { user, isAuthenticated, isEmailVerified, resendVerification } = useAuth();

  if (!isAuthenticated || isEmailVerified) {
    return null;
  }

  return (
    <div className="email-verification-banner">
      <div className="banner-content">
        <span className="banner-icon">📧</span>
        <span className="banner-text">
          Please verify your email to place bets and withdraw funds.
        </span>
        <Button size="sm" onClick={resendVerification}>
          Resend Email
        </Button>
      </div>
    </div>
  );
}

export default EmailVerificationBanner;
