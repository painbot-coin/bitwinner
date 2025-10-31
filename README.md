# BitWinner (BC.Game-style USDT Racing)

BitWinner is a crypto betting game where players race **Red** vs **Green** teams in short rounds (default: **10 seconds**). Players buy tickets for either team with **USDT**. When a race ends, the team with the higher ticket count wins and the winner-side bettors receive a share of the **loser pool**, minus a **house fee**.

In addition to betting, the app includes a production-style authentication system and a multi-network USDT wallet:
- **Unique user deposit addresses per network**
- **Deposit monitoring with confirmations**
- **Withdrawal processing from a master wallet**

> Wallet actions (betting, deposit address, withdrawals) require **email verification**.

## Quick Start (Development)

### 1. Configure environment
Copy `.env.example` to `.env` and fill in missing secrets:
- MongoDB
- Google OAuth (optional for login, but required for Google sign-in)
- SMTP (required for email verification emails; in `development`, the backend can auto-verify if SMTP is not configured)
- Blockchain keys (TRON/BSC/Ethereum RPC/APIs as needed)

### 2. Install dependencies
Server:
```powershell
npm install
```

Client:
```powershell
npm run client:install
```

### 3. Start services
Backend + React (both):
```powershell
npm run dev:full
```

Backend alone:
```powershell
npm run dev
```

React alone:
```powershell
npm run client
```

Open the app at:
- `http://localhost:5173`

## Main Technologies

- Backend: **Node.js + Express + Socket.IO**
- Database: **MongoDB** (Mongoose)
- Frontend: **React** (Vite)
- Wallet: **USDT** on:
  - TRON (TRC-20)
  - BNB Smart Chain (BEP-20)
  - Ethereum (ERC-20)
- Wallet architecture:
  - User deposit addresses are derived using **HD wallet** (`WALLET_MNEMONIC`)
  - Withdrawals are executed from a **master wallet** (HD index `0`)

## Game Rules (Server Logic)

- A new race starts automatically after each round.
- Each race lasts `RACE_DURATION` milliseconds (default: **10000**).
- During the `betting` phase, clients submit tickets through Socket.IO (`buyTickets`).
- When the timer finishes:
  - Winner is determined by:
    - `redTeam.tickets > greenTeam.tickets` => **red**
    - `greenTeam.tickets > redTeam.tickets` => **green**
    - equal => **tie**
  - If there is a winner (not tie):
    - Let `loserPool = pool of losing team`
    - `houseCut = loserPool * HOUSE_FEE`
    - `distributablePool = loserPool - houseCut`
    - Each winner bettor gets:
      - `originalBet + (distributablePool * bettorTickets / winnerTotalTickets)`
  - If it is a tie:
    - Everyone gets a **refund** of their ticket cost.

Winner/loser accounting is saved to MongoDB and winners/updates are pushed over Socket.IO.

## Wallet (USDT on Multiple Networks)

### 1. Unique Deposit Addresses

Endpoint:
`GET /api/wallet/deposit-address?network=tron|bsc|ethereum`

- Requires authentication + email verification.
- Your app stores/returns a unique `DepositAddress` for each `user + network`.
- If the user has no address yet, the backend derives one using the HD wallet service and stores:
  - `derivationIndex`
  - `address`

### 2. Deposit Monitoring

A background service polls each supported network for transfers to active deposit addresses.
- It creates a `Deposit` record
- It updates confirmation counts
- When confirmations reach the configured threshold, it credits the user balance

### 3. Withdrawals

Endpoint:
`POST /api/wallet/withdraw`

- Requires authentication + email verification.
- Validates network, address, amount, min withdrawal, cooldown, and limits.
- A background broadcaster periodically processes `pending` withdrawals by:
  - deriving the master wallet key (HD index `0`)
  - sending USDT on the selected network
  - updating `Withdrawal` and notifying the user in real-time

## API Endpoints (High Level)

### Public
- `GET /api/config` (frontend config like `googleClientId`, `ticketPrice`, `raceDuration`)
- `GET /api/health`

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/google`
- `GET /api/auth/verify-email/:token`
- `POST /api/auth/resend-verification`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/signout`
- `POST /api/auth/signout-all`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`

### Wallet
- `GET /api/wallet/networks` (public)
- `GET /api/wallet/summary` (protected)
- `GET /api/wallet/deposit-address?network=...` (protected + email verified)
- `GET /api/wallet/deposits` (protected)
- `GET /api/wallet/withdrawals` (protected)
- `POST /api/wallet/withdraw` (protected + email verified)
- `DELETE /api/wallet/withdrawals/:withdrawalId` (protected + email verified)

### User
- `GET /api/user/leaderboard` (public)
- `GET /api/user/profile/:username` (public)
- `GET /api/user/me` (protected)
- `PUT /api/user/me` (protected)

## Security Notes (Important)

- `WALLET_MNEMONIC` must be treated as a secret (it can control your master wallet).
- Wallet endpoints enforce `requireEmailVerification`.
- For production, change JWT secrets and disable development auto-verify behavior by configuring SMTP.

# BitWinner - Crypto Racing Game

A production-ready BC.Game-style crypto betting game with user authentication, where players bet on Red vs Green team races using USDT.

## Features

### Authentication
- **Email/Password Sign Up & Sign In** - Secure registration with validation
- **Google OAuth 2.0** - One-click sign in with Google
- **JWT Authentication** - Access tokens + refresh tokens for security
- **Email Verification** - Verify email addresses
- **Password Reset** - Forgot password flow with email
- **Session Management** - Multiple device sessions, sign out all

### Game
- **Real-time Racing** - 10-second races with live updates via Socket.IO
- **Two Teams** - Red Team vs Green Team - bet on either or both!
- **USDT Currency** - All transactions in USDT (Tether)
- **Ticket System** - Buy tickets for your chosen team(s)
- **Winner Takes All** - Team with more tickets wins
- **Proportional Payouts** - Winners split the loser's pool based on ticket share
- **Race History** - Track recent race results
- **Transaction History** - Full history of all bets, wins, deposits

### Security
- **Helmet.js** - Security headers
- **Rate Limiting** - Prevent brute force attacks
- **Password Hashing** - bcrypt with 12 rounds
- **CORS Protection** - Configured for production
- **Input Validation** - express-validator
- **Account Lockout** - After failed login attempts

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO, MongoDB/Mongoose
- **Authentication**: JWT, Google OAuth 2.0, bcryptjs
- **Frontend**: Vanilla JavaScript, CSS3
- **Email**: Nodemailer
- **Security**: Helmet, express-rate-limit, express-validator

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Configuration

Edit `.env` file with your settings:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/bitwinner

# JWT Secrets (generate strong random strings!)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (for verification emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to "APIs & Services" > "Credentials"
4. Create "OAuth 2.0 Client ID"
5. Add authorized JavaScript origins: `http://localhost:3000`
6. Add authorized redirect URIs: `http://localhost:3000`
7. Copy Client ID to `.env` and `public/app.js`

## Running the Game

```bash
# Make sure MongoDB is running first!

# Production
npm start

# Development (with auto-reload)
npm run dev
```

Then open http://localhost:3000 in your browser.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/google` - Google OAuth
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/signout` - Sign out
- `POST /api/auth/signout-all` - Sign out all devices
- `GET /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### User
- `GET /api/user/me` - Get profile
- `PUT /api/user/me` - Update profile
- `GET /api/user/transactions` - Transaction history
- `GET /api/user/stats` - User statistics
- `POST /api/user/deposit` - Deposit (demo)
- `GET /api/user/leaderboard` - Top players

## Game Rules

1. Each race lasts **10 seconds**
2. Buy tickets for Red Team, Green Team, or **both**
3. Each ticket costs **1 USDT**
4. The team with **more total tickets wins**
5. Winners split the losing team's pool (minus 5% house fee)
6. If it's a **tie**, all bets are refunded
7. Races run **continuously** - unlimited rounds!

## How Payouts Work

1. All ticket purchases go into team pools
2. When race ends, team with more tickets wins
3. Winners get their original bet back PLUS share of loser's pool
4. Share is proportional to how many tickets you bought
5. 5% house fee is deducted from loser's pool before distribution

**Example:**
- Red Team: 100 tickets (100 USDT pool)
- Green Team: 60 tickets (60 USDT pool)
- Red wins! Distributable pool: 60 × 0.95 = 57 USDT
- If you bought 10 red tickets (10% of red team):
  - Your 10 USDT back + 5.7 USDT winnings = **15.7 USDT total**

## Project Structure

```
bitwinner/
├── server.js              # Main server with game logic
├── src/
│   ├── config/
│   │   └── database.js    # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js        # JWT authentication
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Transaction.js
│   │   └── Race.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── user.js
│   └── utils/
│       ├── jwt.js
│       ├── email.js
│       └── validators.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env
├── .env.example
└── package.json
```

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use strong, unique JWT secrets
3. Configure proper MongoDB connection string
4. Set up SSL/TLS (HTTPS)
5. Configure proper CORS origins
6. Set up email service for verification
7. Consider using PM2 or similar process manager

## License

MIT
