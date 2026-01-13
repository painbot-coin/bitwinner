import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import toast from 'react-hot-toast';

export function SignUpModal({ isOpen, onClose, onSwitchToSignIn }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    
    if (trimmedPassword !== trimmedConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (trimmedPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    try {
      await signup(email.trim().toLowerCase(), username.trim(), trimmedPassword);
      onClose();
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      const msg = error.errors?.[0]?.message || error.message || 'Sign up failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🚀 Create Account">
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
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          minLength={3}
          maxLength={20}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          minLength={8}
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
          required
        />
        <Button type="submit" loading={loading} className="btn-block">
          Create Account
        </Button>
      </form>
      
      <div className="auth-links">
        <span className="auth-divider-text">
          Already have an account?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToSignIn}>
            Sign In
          </button>
        </span>
      </div>
    </Modal>
  );
}

export default SignUpModal;
