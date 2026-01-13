import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import Button from '../ui/Button';
import toast from 'react-hot-toast';

export function BettingPanel({ onSignIn }) {
  const { user, isAuthenticated, isEmailVerified } = useAuth();
  const { status, ticketPrice, buyTickets } = useGame();
  const [redTickets, setRedTickets] = useState(0);
  const [greenTickets, setGreenTickets] = useState(0);

  const totalCost = (redTickets + greenTickets) * ticketPrice;
  const canBet = isAuthenticated && 
                 isEmailVerified &&
                 totalCost > 0 && 
                 totalCost <= (user?.balance || 0) && 
                 status === 'betting';

  const handleBet = () => {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    
    if (!isEmailVerified) {
      toast.error('Please verify your email to place bets');
      return;
    }

    if (redTickets === 0 && greenTickets === 0) {
      toast.error('Please select at least 1 ticket');
      return;
    }

    buyTickets(redTickets, greenTickets);
    setRedTickets(0);
    setGreenTickets(0);
  };

  const setMaxTickets = (team) => {
    if (!user) return;
    const otherCost = team === 'red' ? greenTickets * ticketPrice : redTickets * ticketPrice;
    const available = user.balance - otherCost;
    const maxTickets = Math.floor(available / ticketPrice);
    
    if (team === 'red') {
      setRedTickets(Math.max(0, maxTickets));
    } else {
      setGreenTickets(Math.max(0, maxTickets));
    }
  };

  return (
    <div className="betting-section">
      <h3 className="section-title">Place Your Bets</h3>
      
      <div className="betting-grid">
        {/* Red Team */}
        <div className="bet-card red">
          <div className="bet-header">
            <span className="team-icon">🔴</span>
            <span className="team-name">RED TEAM</span>
          </div>
          <div className="bet-input-group">
            <button 
              className="bet-btn minus"
              onClick={() => setRedTickets(Math.max(0, redTickets - 1))}
            >
              -
            </button>
            <input
              type="number"
              value={redTickets}
              onChange={(e) => setRedTickets(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
            />
            <button 
              className="bet-btn plus"
              onClick={() => setRedTickets(redTickets + 1)}
            >
              +
            </button>
          </div>
          <div className="bet-quick-btns">
            <button onClick={() => setRedTickets(redTickets + 10)}>+10</button>
            <button onClick={() => setRedTickets(redTickets + 50)}>+50</button>
            <button onClick={() => setMaxTickets('red')}>MAX</button>
          </div>
        </div>

        {/* Green Team */}
        <div className="bet-card green">
          <div className="bet-header">
            <span className="team-icon">🟢</span>
            <span className="team-name">GREEN TEAM</span>
          </div>
          <div className="bet-input-group">
            <button 
              className="bet-btn minus"
              onClick={() => setGreenTickets(Math.max(0, greenTickets - 1))}
            >
              -
            </button>
            <input
              type="number"
              value={greenTickets}
              onChange={(e) => setGreenTickets(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
            />
            <button 
              className="bet-btn plus"
              onClick={() => setGreenTickets(greenTickets + 1)}
            >
              +
            </button>
          </div>
          <div className="bet-quick-btns">
            <button onClick={() => setGreenTickets(greenTickets + 10)}>+10</button>
            <button onClick={() => setGreenTickets(greenTickets + 50)}>+50</button>
            <button onClick={() => setMaxTickets('green')}>MAX</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bet-summary">
        <div className="summary-row">
          <span>Red Tickets:</span>
          <span className="red-text">{redTickets}</span>
        </div>
        <div className="summary-row">
          <span>Green Tickets:</span>
          <span className="green-text">{greenTickets}</span>
        </div>
        <div className="summary-row total">
          <span>Total Cost:</span>
          <span>{totalCost} USDT</span>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="login-prompt">
          <p>Sign in to place bets</p>
          <Button onClick={onSignIn}>Sign In</Button>
        </div>
      ) : (
        <Button 
          onClick={handleBet} 
          disabled={!canBet}
          className="btn-block place-bet-btn"
        >
          {status !== 'betting' ? 'Betting Closed' : 'Place Bet'}
        </Button>
      )}
    </div>
  );
}

export default BettingPanel;
