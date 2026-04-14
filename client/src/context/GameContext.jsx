import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import socketService from '../services/socket';
import toast from 'react-hot-toast';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [gameState, setGameState] = useState({
    status: 'waiting',
    raceNumber: 0,
    timeRemaining: 10000,
    redTickets: 0,
    greenTickets: 0,
    redPool: 0,
    greenPool: 0,
  });
  const [history, setHistory] = useState([]);
  const [ticketPrice, setTicketPrice] = useState(1);
  const [raceDuration, setRaceDuration] = useState(10000);

  useEffect(() => {
    // Socket event handlers
    const handleInit = (data) => {
      setGameState({
        status: data.status,
        raceNumber: data.raceNumber,
        timeRemaining: data.timeRemaining,
        redTickets: data.redTickets,
        greenTickets: data.greenTickets,
        redPool: data.redPool,
        greenPool: data.greenPool,
      });
      if (data.history) {
        setHistory(data.history);
      }
      if (data.ticketPrice) {
        setTicketPrice(data.ticketPrice);
      }
      if (data.raceDuration) {
        setRaceDuration(data.raceDuration);
      }
    };

    const handleGameState = (data) => {
      setGameState(prev => ({
        ...prev,
        status: data.status,
        timeRemaining: data.timeRemaining,
        redTickets: data.redTickets,
        greenTickets: data.greenTickets,
        redPool: data.redPool,
        greenPool: data.greenPool,
      }));
    };

    const handleRaceStarted = (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'racing',
        raceNumber: data.raceNumber,
      }));
    };

    const handleRaceEnded = (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
      }));
      
      // Add to history
      setHistory(prev => [{
        raceNumber: data.raceNumber,
        winner: data.winner,
        redTickets: data.result.redTickets,
        greenTickets: data.result.greenTickets,
        redPool: data.result.redPool,
        greenPool: data.result.greenPool,
      }, ...prev.slice(0, 49)]);
    };

    const handleNewRace = (data) => {
      setGameState({
        status: 'betting',
        raceNumber: data.raceNumber,
        timeRemaining: data.timeRemaining,
        redTickets: 0,
        greenTickets: 0,
        redPool: 0,
        greenPool: 0,
      });
    };

    const handlePurchaseConfirmed = (data) => {
      toast.success(`Purchased ${data.redTickets + data.greenTickets} tickets!`);
    };

    const handleError = (data) => {
      toast.error(data.message || 'An error occurred');
    };

    socketService.on('init', handleInit);
    socketService.on('gameState', handleGameState);
    socketService.on('raceStarted', handleRaceStarted);
    socketService.on('raceEnded', handleRaceEnded);
    socketService.on('newRace', handleNewRace);
    socketService.on('purchaseConfirmed', handlePurchaseConfirmed);
    socketService.on('error', handleError);

    return () => {
      socketService.off('init', handleInit);
      socketService.off('gameState', handleGameState);
      socketService.off('raceStarted', handleRaceStarted);
      socketService.off('raceEnded', handleRaceEnded);
      socketService.off('newRace', handleNewRace);
      socketService.off('purchaseConfirmed', handlePurchaseConfirmed);
      socketService.off('error', handleError);
    };
  }, []);

  const buyTickets = useCallback((redTickets, greenTickets) => {
    socketService.buyTickets(redTickets, greenTickets);
  }, []);

  const value = {
    ...gameState,
    history,
    ticketPrice,
    raceDuration,
    buyTickets,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export default GameContext;
