import { useGame } from '../../context/GameContext';

export function RaceHistory() {
  const { history } = useGame();

  const formatRaceId = (num) => '#' + String(num).padStart(6, '0');

  if (history.length === 0) {
    return (
      <div className="history-section">
        <h3 className="section-title">Race History</h3>
        <p className="empty-state">No races yet</p>
      </div>
    );
  }

  // Count wins
  const redWins = history.filter(r => r.winner === 'red').length;
  const greenWins = history.filter(r => r.winner === 'green').length;

  return (
    <div className="history-section">
      <div className="history-header">
        <h3 className="section-title">Race History</h3>
        <div className="win-counters">
          <span className="win-counter red">🔴 {redWins}</span>
          <span className="win-counter green">🟢 {greenWins}</span>
        </div>
      </div>

      <div className="history-list">
        {history.map((race, index) => (
          <div 
            key={race.raceNumber || index} 
            className={`history-item ${race.winner}`}
            title={`Red: ${race.redTickets} | Green: ${race.greenTickets}`}
          >
            <span className="history-race-id">{formatRaceId(race.raceNumber)}</span>
            <span className="history-winner">
              {race.winner === 'red' ? '🔴' : race.winner === 'green' ? '🟢' : '🤝'}
            </span>
            <div className="history-stats">
              <span className="red-stat">{race.redTickets}</span>
              <span className="vs">vs</span>
              <span className="green-stat">{race.greenTickets}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RaceHistory;
