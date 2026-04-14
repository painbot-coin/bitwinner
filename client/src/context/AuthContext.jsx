import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socketService from '../services/socket';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const data = await api.getMe();
      if (data.success && data.user) {
        setUser(data.user);
        api.setAccessToken(data.accessToken);
        setAccessToken(data.accessToken);
        socketService.authenticate(data.accessToken);
      }
    } catch (error) {
      // Not logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    socketService.connect();
    checkSession();

    // Socket events for user updates
    socketService.on('authenticated', (data) => {
      setUser(data.user);
    });

    socketService.on('walletUpdate', (data) => {
      setUser(prev => prev ? { ...prev, balance: data.balance, stats: data.stats } : null);
    });

    return () => {
      socketService.disconnect();
    };
  }, [checkSession]);

  const signup = async (email, username, password) => {
    const data = await api.signup(email, username, password);
    if (data.success) {
      setUser(data.user);
      api.setAccessToken(data.accessToken);
      setAccessToken(data.accessToken);
      socketService.authenticate(data.accessToken);
      toast.success('Account created! Check your email to verify.');
    }
    return data;
  };

  const signin = async (email, password) => {
    const data = await api.signin(email, password);
    if (data.success) {
      setUser(data.user);
      api.setAccessToken(data.accessToken);
      setAccessToken(data.accessToken);
      socketService.authenticate(data.accessToken);
      toast.success('Signed in successfully!');
    }
    return data;
  };

  const googleAuth = async (credential) => {
    const data = await api.googleAuth(credential);
    if (data.success) {
      setUser(data.user);
      api.setAccessToken(data.accessToken);
      setAccessToken(data.accessToken);
      socketService.authenticate(data.accessToken);
      toast.success('Signed in with Google!');
    }
    return data;
  };

  const signout = async () => {
    try {
      await api.signout();
    } catch (error) {
      // Ignore errors
    }
    setUser(null);
    setAccessToken(null);
    api.setAccessToken(null);
    toast.success('Signed out successfully');
  };

  const signoutAll = async () => {
    try {
      await api.signoutAll();
      setUser(null);
      setAccessToken(null);
      api.setAccessToken(null);
      toast.success('Signed out from all devices');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const resendVerification = async () => {
    try {
      await api.resendVerification();
      toast.success('Verification email sent!');
    } catch (error) {
      toast.error(error.message || 'Failed to send email');
    }
  };

  const value = {
    user,
    loading,
    accessToken,
    isAuthenticated: !!user,
    isEmailVerified: user?.isEmailVerified || false,
    signup,
    signin,
    googleAuth,
    signout,
    signoutAll,
    resendVerification,
    updateUser,
    checkSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
