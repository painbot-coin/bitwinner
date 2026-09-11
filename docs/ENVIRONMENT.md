# Environment Variables (.env)

This project uses `dotenv` on the backend. Example values are in `.env.example`.

## Server & Database

- `PORT` (default: `3000`)
- `NODE_ENV` (`development` / `production`)
- `MONGODB_URI` (required)
- `REDIS_URL` (used by deposit monitoring; optional if you do not run that part)

## JWT

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN` (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN` (default: `7d`)

## Google OAuth (optional)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Configure redirect/origins in Google Cloud Console so the origin used by your frontend is allowed.

## Email (SMTP)

Wallet actions require email verification. Emails are sent using Nodemailer with SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

If SMTP is NOT configured, the backend can auto-verify users in `development` (so you can test without setting up email).

## Game Settings

- `TICKET_PRICE` (default: `1`)
- `HOUSE_FEE` (default: `0.05`)
- `RACE_DURATION` (default: `10000` ms)

## USDT Wallet & HD Keys (critical)

- `WALLET_MNEMONIC` (must stay secret)

Wallet networks:
- `TRON_NETWORK` (e.g. `mainnet`)
- `TRON_API_KEY`
- `TRON_USDT_CONTRACT` (official USDT contract on TRON)

- `BSC_RPC_URL`
- `BSC_USDT_CONTRACT` (official USDT contract on BSC)

- `ETH_RPC_URL`
- `ETH_USDT_CONTRACT` (official USDT contract on Ethereum)

Deposit/withdraw limits:
- `MIN_DEPOSIT`
- `MIN_WITHDRAWAL`
- `MAX_WITHDRAWAL_DAILY`
- `WITHDRAWAL_FEE_TRON`
- `WITHDRAWAL_FEE_BSC`
- `WITHDRAWAL_FEE_ETH`
- `REQUIRED_CONFIRMATIONS`
- `WITHDRAWAL_COOLDOWN_HOURS`
- `MAX_WITHDRAWALS_PER_HOUR`

