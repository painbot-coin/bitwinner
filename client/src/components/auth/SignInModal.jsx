import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import toast from 'react-hot-toast';

export function SignInModal({ isOpen, onClose, onSwitchToSignUp, onForgotPassword }) {
  const { signin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signin(email, password);
      onClose();
      setEmail('');
      setPassword('');
    } catch (error) {
      const msg = error.errors?.[0]?.message || error.message || 'Sign in failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔐 Sign In">
      <form onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
        />
        <Button type="submit" loading={loading} className="btn-block">
          Sign In
        </Button>
      </form>
      
      <div className="auth-links">
        <button type="button" className="link-btn" onClick={onForgotPassword}>
          Forgot password?
        </button>
        <span className="auth-divider-text">
          Don't have an account?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToSignUp}>
            Sign Up
          </button>
        </span>
      </div>
    </Modal>
  );
}

export default SignInModal;
