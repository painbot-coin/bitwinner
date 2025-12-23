import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

export function ProfileModal({ isOpen, onClose }) {
  const { user, signoutAll } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await api.getSessions();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const revokeSession = async (sessionId) => {
    if (!confirm('Revoke this session?')) return;
    try {
      await api.revokeSession(sessionId);
      toast.success('Session revoked');
      loadSessions();
    } catch (error) {
      toast.error('Failed to revoke session');
    }
  };

  const handleSignOutAll = async () => {
    if (!confirm('Sign out from all devices?')) return;
    await signoutAll();
    onClose();
  };

  const getDeviceIcon = (device) => {
    switch (device) {
      case 'Mobile': return <Smartphone size={20} />;
      case 'Tablet': return <Tablet size={20} />;
      default: return <Monitor size={20} />;
    }
  };

  const profit = (user?.stats?.totalWon || 0) - (user?.stats?.totalLost || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="👤 Profile" size="lg">
      <div className="profile-header">
        <div className="profile-avatar">
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="profile-info">
          <h4>{user?.username}</h4>
          <p>{user?.email}</p>
          <span className={`email-badge ${user?.isEmailVerified ? 'verified' : 'unverified'}`}>
            {user?.isEmailVerified ? '✓ Verified' : '⚠ Unverified'}
          </span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{user?.balance?.toFixed(2) || '0'}</span>
          <span className="stat-label">Balance (USDT)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{user?.stats?.gamesPlayed || 0}</span>
          <span className="stat-label">Games Played</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{user?.stats?.wins || 0}</span>
          <span className="stat-label">Wins</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: profit >= 0 ? '#2ed573' : '#ff4757' }}>
            {profit.toFixed(2)}
          </span>
          <span className="stat-label">Profit/Loss</span>
        </div>
      </div>

      {/* Sessions Section */}
      <div className="sessions-section">
        <div className="section-header">
          <h4>🔐 Active Sessions</h4>
          <Button variant="danger" size="sm" onClick={handleSignOutAll}>
            Sign Out All
          </Button>
        </div>

        <div className="sessions-list">
          {loadingSessions ? (
            <div className="loading-state">
              <div className="spinner" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="empty-state">No active sessions</p>
          ) : (
            sessions.map(session => (
              <div key={session.id} className={`session-item ${session.isCurrent ? 'current' : ''}`}>
                <div className="session-info">
                  <div className="session-icon">
                    {getDeviceIcon(session.device)}
                  </div>
                  <div className="session-details">
                    <span className="session-device">
                      {session.browser} on {session.os}
                      {session.isCurrent && <span className="session-current-badge">Current</span>}
                    </span>
                    <span className="session-meta">
                      {session.ip} • {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button 
                    className="session-revoke"
                    onClick={() => revokeSession(session.id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ProfileModal;
