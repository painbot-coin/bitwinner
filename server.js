require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./src/config/database');
const routes = require('./src/routes');
const { socketAuth } = require('./src/middleware/auth');
const { User, Transaction, Race } = require('./src/models');
const { startDepositMonitor } = require('./src/services/blockchain/monitor');
const { startWithdrawalBroadcaster } = require('./src/services/blockchain/broadcaster');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://accounts.google.com", "https://apis.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com", "wss:", "ws:"],
      frameSrc: ["https://accounts.google.com"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Static files - serve React build in production, public folder in development
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// API routes
app.use('/api', routes);

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Game Configuration
const RACE_DURATION = parseInt(process.env.RACE_DURATION) || 10000;
const TICKET_PRICE = parseFloat(process.env.TICKET_PRICE) || 1;
const HOUSE_FEE = parseFloat(process.env.HOUSE_FEE) || 0.05;

// Game State
let currentRace = null;
let raceNumber = 0;
const connectedUsers = new Map();

// Initialize race
async function initializeRace() {
  const lastRace = await Race.findOne().sort({ raceNumber: -1 });
  raceNumber = lastRace ? lastRace.raceNumber : 0;
  startNewRace();
}

// Start new race
async function startNewRace() {
  raceNumber++;
  
  currentRace = {
    raceNumber,
    startTime: Date.now(),
    endTime: Date.now() + RACE_DURATION,
    redTeam: {
      tickets: 0,
      pool: 0,
      bettors: new Map()
    },
    greenTeam: {
      tickets: 0,
      pool: 0,
      bettors: new Map()
    },
    status: 'betting'
  };

  io.emit('newRace', {
    raceNumber: currentRace.raceNumber,
    duration: RACE_DURATION,
    ticketPrice: TICKET_PRICE
  });
}

// Get time remaining
function getTimeRemaining() {
  if (!currentRace) return 0;
  return Math.max(0, currentRace.endTime - Date.now());
}

// Process race end
async function processRaceEnd() {
  if (!currentRace || currentRace.status !== 'betting') return;
  
  currentRace.status = 'racing';
  io.emit('raceStarted', { raceNumber: currentRace.raceNumber });

  setTimeout(async () => {
    currentRace.status = 'finished';
    
    const redTotal = currentRace.redTeam.tickets;
    const greenTotal = currentRace.greenTeam.tickets;
    
    let winner = null;
    let loserPool = 0;
    let winnerBettors = new Map();
    let winnerTotalTickets = 0;

    if (redTotal > greenTotal) {
      winner = 'red';
      loserPool = currentRace.greenTeam.pool;
      winnerBettors = currentRace.redTeam.bettors;
      winnerTotalTickets = redTotal;
    } else if (greenTotal > redTotal) {
      winner = 'green';
      loserPool = currentRace.redTeam.pool;
      winnerBettors = currentRace.greenTeam.bettors;
      winnerTotalTickets = greenTotal;
    } else {
      winner = 'tie';
    }

    const results = {
      raceNumber: currentRace.raceNumber,
      winner,
      redTickets: redTotal,
      greenTickets: greenTotal,
      payouts: []
    };

    // Process payouts
    if (winner && winner !== 'tie' && winnerTotalTickets > 0) {
      const houseCut = loserPool * HOUSE_FEE;
      const distributablePool = loserPool - houseCut;

      for (const [oderId, bettor] of winnerBettors) {
        const share = bettor.tickets / winnerTotalTickets;
        const winnings = distributablePool * share;
        const originalBet = bettor.tickets * TICKET_PRICE;
        const totalReturn = originalBet + winnings;

        try {
          const user = await User.findById(bettor.oderId);
          if (user) {
            const balanceBefore = user.balance;
            user.balance += totalReturn;
            user.stats.totalWon += winnings;
            user.stats.wins += 1;
            await user.save();

            // Record win transaction
            await Transaction.create({
              user: user._id,
              type: 'win',
              amount: totalReturn,
              balanceBefore,
              balanceAfter: user.balance,
              raceId: currentRace.raceNumber.toString(),
              team: winner,
              tickets: bettor.tickets,
              description: `Won race #${currentRace.raceNumber}`
            });

            // Emit wallet update to user
            const socketId = connectedUsers.get(user._id.toString());
            if (socketId) {
              io.to(socketId).emit('walletUpdate', {
                balance: user.balance,
                stats: user.stats
              });
            }

            results.payouts.push({
              oderId: user._id,
              username: user.username,
              tickets: bettor.tickets,
              winnings: winnings.toFixed(2),
              totalReturn: totalReturn.toFixed(2)
            });
          }
        } catch (error) {
          console.error('Error processing payout:', error);
        }
      }
    } else if (winner === 'tie') {
      // Refund all bets
      const allBettors = [
        ...currentRace.redTeam.bettors.values(),
        ...currentRace.greenTeam.bettors.values()
      ];

      for (const bettor of allBettors) {
        try {
          const user = await User.findById(bettor.oderId);
          if (user) {
            const refund = bettor.tickets * TICKET_PRICE;
            const balanceBefore = user.balance;
            user.balance += refund;
            await user.save();

            await Transaction.create({
              user: user._id,
              type: 'refund',
              amount: refund,
              balanceBefore,
              balanceAfter: user.balance,
              raceId: currentRace.raceNumber.toString(),
              description: `Refund for tie in race #${currentRace.raceNumber}`
            });

            const socketId = connectedUsers.get(user._id.toString());
            if (socketId) {
              io.to(socketId).emit('walletUpdate', {
                balance: user.balance,
                stats: user.stats
              });
            }
          }
        } catch (error) {
          console.error('Error processing refund:', error);
        }
      }
    }

    // Update losers stats
    const loserTeam = winner === 'red' ? currentRace.greenTeam : currentRace.redTeam;
    if (winner !== 'tie' && loserTeam) {
      for (const [oderId, bettor] of loserTeam.bettors) {
        try {
          const user = await User.findById(bettor.oderId);
          if (user) {
            user.stats.losses += 1;
            user.stats.totalLost += bettor.tickets * TICKET_PRICE;
            await user.save();
          }
        } catch (error) {
          console.error('Error updating loser stats:', error);
        }
      }
    }

    // Save race to database
    try {
      await Race.create({
        raceNumber: currentRace.raceNumber,
        status: 'finished',
        startTime: new Date(currentRace.startTime),
        endTime: new Date(currentRace.endTime),
        redTeam: {
          totalTickets: redTotal,
          totalPool: currentRace.redTeam.pool,
          bettors: Array.from(currentRace.redTeam.bettors.values()).map(b => ({
            user: b.oderId,
            tickets: b.tickets,
            amount: b.tickets * TICKET_PRICE
          }))
        },
        greenTeam: {
          totalTickets: greenTotal,
          totalPool: currentRace.greenTeam.pool,
          bettors: Array.from(currentRace.greenTeam.bettors.values()).map(b => ({
            user: b.oderId,
            tickets: b.tickets,
            amount: b.tickets * TICKET_PRICE
          }))
        },
        result: {
          winner,
          redTickets: redTotal,
          greenTickets: greenTotal,
          totalPool: currentRace.redTeam.pool + currentRace.greenTeam.pool,
          houseFee: loserPool * HOUSE_FEE,
          distributedPool: loserPool * (1 - HOUSE_FEE)
        }
      });
    } catch (error) {
      console.error('Error saving race:', error);
    }

    io.emit('raceEnded', results);

    // Start new race after delay
    setTimeout(startNewRace, 2000);
  }, 1500);
}

// Game loop
function gameLoop() {
  if (!currentRace) return;
  
  const timeRemaining = getTimeRemaining();

  if (timeRemaining <= 0 && currentRace.status === 'betting') {
    processRaceEnd();
  }

  io.emit('gameState', {
    raceNumber: currentRace.raceNumber,
    timeRemaining: Math.max(0, timeRemaining),
    status: currentRace.status,
    redTickets: currentRace.redTeam.tickets,
    greenTickets: currentRace.greenTeam.tickets,
    redPool: currentRace.redTeam.pool,
    greenPool: currentRace.greenTeam.pool,
    ticketPrice: TICKET_PRICE
  });
}

// Socket.IO
io.use(socketAuth);

io.on('connection', async (socket) => {
  console.log('Socket connected:', socket.id);
  
  let user = socket.user;
  
  if (user) {
    connectedUsers.set(user._id.toString(), socket.id);
    socket.oderId = user._id.toString();
  }

  // Send initial state
  const history = await Race.find({ status: 'finished' })
    .sort({ raceNumber: -1 })
    .limit(20)
    .select('raceNumber result.winner result.redTickets result.greenTickets');

  socket.emit('init', {
    user: user ? user.toPrivateJSON() : null,
    raceNumber: currentRace?.raceNumber,
    timeRemaining: getTimeRemaining(),
    status: currentRace?.status || 'betting',
    redTickets: currentRace?.redTeam.tickets || 0,
    greenTickets: currentRace?.greenTeam.tickets || 0,
    redPool: currentRace?.redTeam.pool || 0,
    greenPool: currentRace?.greenTeam.pool || 0,
    ticketPrice: TICKET_PRICE,
    history: history.map(r => ({
      raceNumber: r.raceNumber,
      winner: r.result.winner,
      redTickets: r.result.redTickets,
      greenTickets: r.result.greenTickets
    }))
  });

  // Handle authentication update
  socket.on('authenticate', async (token) => {
    const { verifyAccessToken } = require('./src/utils/jwt');
    const decoded = verifyAccessToken(token);
    
    if (decoded) {
      user = await User.findById(decoded.id);
      if (user && user.isActive && !user.isBanned) {
        socket.user = user;
        socket.oderId = user._id.toString();
        connectedUsers.set(user._id.toString(), socket.id);
        
        socket.emit('authenticated', {
          user: user.toPrivateJSON()
        });
      }
    }
  });

  // Handle ticket purchase
  socket.on('buyTickets', async (data) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Please sign in to place bets' });
      return;
    }

    // Require email verification for betting
    if (!socket.user.isEmailVerified) {
      socket.emit('error', { message: 'Please verify your email to place bets' });
      return;
    }

    if (!currentRace || currentRace.status !== 'betting') {
      socket.emit('error', { message: 'Betting is closed for this race' });
      return;
    }

    const { redTickets = 0, greenTickets = 0 } = data;
    const totalTickets = redTickets + greenTickets;
    const totalCost = totalTickets * TICKET_PRICE;

    if (totalTickets <= 0) {
      socket.emit('error', { message: 'Please select at least 1 ticket' });
      return;
    }

    if (totalTickets > 1000) {
      socket.emit('error', { message: 'Maximum 1000 tickets per transaction' });
      return;
    }

    try {
      // Refresh user data
      user = await User.findById(socket.oderId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      if (user.balance < totalCost) {
        socket.emit('error', { message: 'Insufficient balance' });
        return;
      }

      // Deduct balance
      const balanceBefore = user.balance;
      user.balance -= totalCost;
      user.stats.totalWagered += totalCost;
      user.stats.gamesPlayed += 1;
      await user.save();

      // Add to race
      const oderId = user._id.toString();

      if (redTickets > 0) {
        currentRace.redTeam.tickets += redTickets;
        currentRace.redTeam.pool += redTickets * TICKET_PRICE;
        
        const existing = currentRace.redTeam.bettors.get(oderId);
        if (existing) {
          existing.tickets += redTickets;
        } else {
          currentRace.redTeam.bettors.set(oderId, {
            oderId,
            username: user.username,
            tickets: redTickets
          });
        }

        // Record bet transaction
        await Transaction.create({
          user: user._id,
          type: 'bet',
          amount: -redTickets * TICKET_PRICE,
          balanceBefore,
          balanceAfter: user.balance,
          raceId: currentRace.raceNumber.toString(),
          team: 'red',
          tickets: redTickets,
          description: `Bet on Red team - Race #${currentRace.raceNumber}`
        });
      }

      if (greenTickets > 0) {
        currentRace.greenTeam.tickets += greenTickets;
        currentRace.greenTeam.pool += greenTickets * TICKET_PRICE;
        
        const existing = currentRace.greenTeam.bettors.get(oderId);
        if (existing) {
          existing.tickets += greenTickets;
        } else {
          currentRace.greenTeam.bettors.set(oderId, {
            oderId,
            username: user.username,
            tickets: greenTickets
          });
        }

        await Transaction.create({
          user: user._id,
          type: 'bet',
          amount: -greenTickets * TICKET_PRICE,
          balanceBefore: balanceBefore - (redTickets * TICKET_PRICE),
          balanceAfter: user.balance,
          raceId: currentRace.raceNumber.toString(),
          team: 'green',
          tickets: greenTickets,
          description: `Bet on Green team - Race #${currentRace.raceNumber}`
        });
      }

      socket.emit('purchaseConfirmed', {
        redTickets,
        greenTickets,
        totalCost,
        newBalance: user.balance
      });

      socket.emit('walletUpdate', {
        balance: user.balance,
        stats: user.stats
      });

      io.emit('ticketUpdate', {
        redTickets: currentRace.redTeam.tickets,
        greenTickets: currentRace.greenTeam.tickets,
        redPool: currentRace.redTeam.pool,
        greenPool: currentRace.greenTeam.pool
      });

    } catch (error) {
      console.error('Buy tickets error:', error);
      socket.emit('error', { message: 'Failed to process bet' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    if (socket.oderId) {
      connectedUsers.delete(socket.oderId);
    }
  });
});

// Start game loop
setInterval(gameLoop, 100);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    await initializeRace();
    
    server.listen(PORT, () => {
      console.log(`BitWinner server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start blockchain services (only if wallet mnemonic is configured)
      if (process.env.WALLET_MNEMONIC && process.env.WALLET_MNEMONIC !== 'your-24-word-mnemonic-phrase-here') {
        try {
          startDepositMonitor(io);
          startWithdrawalBroadcaster(io);
          console.log('Blockchain services started');
        } catch (error) {
          console.error('Failed to start blockchain services:', error.message);
          console.log('Wallet features will be disabled');
        }
      } else {
        console.log('WALLET_MNEMONIC not configured - wallet features disabled');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
