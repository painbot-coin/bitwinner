import { useGame } from '../../context/GameContext';

export function RaceTrack() {
  const { status, raceNumber, timeRemaining, redTickets, greenTickets, raceDuration } = useGame();

  const formatRaceId = (num) => '#' + String(num).padStart(6, '0');
  const formatTime = (ms) => (ms / 1000).toFixed(1);
  const progress = (timeRemaining / raceDuration) * 100;

  const getStatusText = () => {
    switch (status) {
      case 'betting': return 'BETTING OPEN';
      case 'racing': return 'RACING';
      case 'finished': return 'FINISHED';
      default: return 'WAITING';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'betting': return 'betting';
      case 'racing': return 'racing';
      case 'finished': return 'finished';
      default: return '';
    }
  };

  const getWinner = () => {
    if (status !== 'finished') return null;
    if (redTickets > greenTickets) return 'red';
    if (greenTickets > redTickets) return 'green';
    return 'tie';
  };

  const winner = getWinner();

  return (
    <div className="race-section">
      <div className="race-header">
        <span className="race-id">{formatRaceId(raceNumber)}</span>
        <span className={`status-badge ${getStatusClass()}`}>{getStatusText()}</span>
      </div>

      <div className="timer-section">
        <div className="timer-bar">
          <div 
            className="timer-progress" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span 
          className="timer-text"
          style={{ color: timeRemaining < 3000 ? '#ff4757' : '#ffd700' }}
        >
          {formatTime(timeRemaining)}s
        </span>
      </div>

      <div className="race-track">
        <div className="track red-track">
          <div className="track-label">
            <span className="team-emoji">🔴</span>
            <span>RED</span>
          </div>
          <div 
            className={`racer red-racer ${status === 'racing' ? 'racing' : ''} ${winner === 'red' ? 'winner' : ''}`}
          >
            🏎️
          </div>
          <div className="ticket-count">{redTickets}</div>
        </div>

        <div className="track green-track">
          <div className="track-label">
            <span className="team-emoji">🟢</span>
            <span>GREEN</span>
          </div>
          <div 
            className={`racer green-racer ${status === 'racing' ? 'racing' : ''} ${winner === 'green' ? 'winner' : ''}`}
          >
            🏎️
          </div>
          <div className="ticket-count">{greenTickets}</div>
        </div>
      </div>

      {winner && (
        <div className={`winner-announcement ${winner}`}>
          {winner === 'tie' ? '🤝 TIE!' : `${winner === 'red' ? '🔴' : '🟢'} ${winner.toUpperCase()} WINS!`}
        </div>
      )}
    </div>
  );
}

export default RaceTrack;
