# Project Overview

## Goal (based on your idea)

Build a **BC.Game-style** experience:
- **Red vs Green** teams
- Tickets placed during a short round
- Each race runs for **10 seconds** (configurable)
- **Unlimited races** back-to-back
- Winner is based on who sold more tickets
- Winner bettors share the **loser pool** (minus a house fee)
- Tie refunds all bettors

## How the system is structured

### 1. Realtime game layer (Socket.IO)
- The server holds an in-memory `currentRace` state while betting is open.
- Clients connect, authenticate via token, and listen to:
  - `init` (initial game state + latest history)
  - `gameState` (live ticket counts + timer)
  - `newRace` (start of next betting window)
  - `raceStarted` / `raceEnded`
  - `purchaseConfirmed` / `error`

### 2. Persistent game history (MongoDB)
- When a race finishes, the result is saved to MongoDB.
- Frontend reads recent finished races from the `init` payload.

### 3. Crypto wallet & accounting layer
- A unique `DepositAddress` is stored for each user and each network.
- Deposits are detected by polling chain transfers to those addresses.
- Confirmations are tracked until the deposit is creditable.
- Withdrawals are stored as `pending` requests and processed by a broadcaster.

## Wallet model (USDT-only design)

Your app treats funds as **USDT**, even though the user can choose networks:
- Deposit: user sends USDT on TRON/BSC/Ethereum to their derived address
- Credit: the backend increases the user’s unified USDT balance
- Withdraw: user specifies a network + destination address, and the broadcaster sends USDT there

