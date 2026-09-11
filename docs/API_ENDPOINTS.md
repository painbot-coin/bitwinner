# API Endpoints

This document lists the backend endpoints implemented in `src/routes`.

Base URL:
`http://localhost:3000/api`

## Config / Health

- `GET /api/health`
  - Returns `{ success, message, timestamp }`
- `GET /api/config`
  - Returns frontend config like:
    - `googleClientId`
    - `ticketPrice`
    - `raceDuration`

## Auth (`src/routes/auth.js`)

Public:
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/google`
- `GET /api/auth/verify-email/:token`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Protected:
- `POST /api/auth/signout`
- `POST /api/auth/signout-all`
- `POST /api/auth/resend-verification`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`

## Wallet (`src/routes/wallet.js`)

Public:
- `GET /api/wallet/networks`

Protected:
- `GET /api/wallet/summary`
- `GET /api/wallet/deposits?network=tron|bsc|ethereum&page=1&limit=20`
- `GET /api/wallet/withdrawals?network=tron|bsc|ethereum&page=1&limit=20`

Protected + email verification:
- `GET /api/wallet/deposit-address?network=tron|bsc|ethereum`
- `POST /api/wallet/withdraw`
  - body: `{ network, amount, toAddress }`
- `DELETE /api/wallet/withdrawals/:withdrawalId`

## User (`src/routes/user.js`)

Public:
- `GET /api/user/leaderboard`
- `GET /api/user/profile/:username`

Protected:
- `GET /api/user/me`
- `PUT /api/user/me`
- `GET /api/user/transactions`
- `GET /api/user/stats`

Email verification required for:
- `POST /api/user/deposit` (legacy deposit route; wallet flow primarily uses `/api/wallet/*`)

