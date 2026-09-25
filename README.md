# FlowDeskx

**Web3 treasury spending workflow tool** — Propose → Approve → Execute → Record USDC payments on Arc Testnet.

## Local Setup

### Requirements
- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.1+ (used for the backend server)
- PostgreSQL database (or use the connection string in `.env`)

### 1. Clone & install

```bash
git clone https://github.com/levantuy/flowdesk.git
cd flowdesk
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because `vite-plugin-node-polyfills` has a peer dep declaration for Vite 2–5 while this project uses Vite 6. The plugin works correctly with Vite 6.

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://user:password@host:port/dbname?schema=flow_desk
```

Replace with your actual PostgreSQL connection string.

### 3. Run database migrations

The backend auto-creates tables on first start via the `initDb()` call in `server/db.ts`. No separate migration step needed.

### 4. Start the backend

```bash
bun run server
```

Backend runs on `http://localhost:3001`.

### 5. Start the frontend

In a second terminal:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 6. Open the app

Visit [http://localhost:5173](http://localhost:5173), connect your wallet (MetaMask or any wagmi-compatible wallet), and create a workspace.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 + Tailwind CSS |
| Wallet | wagmi v2 + ConnectKit + viem |
| Backend | Bun + Express 5 |
| Database | PostgreSQL (any provider) |
| Blockchain | Arc Testnet (chain ID 5042002), USDC ERC-20 |

## Key Features

- **Proposals** — structured USDC payment requests with recipient, amount, category
- **Approve / Reject** — explicit approval gate before any funds move
- **Execute** — ERC-20 USDC transfer on Arc Testnet, waits for onchain confirmation before recording
- **Vendors** — address book for recurring recipients
- **Schedules** — recurring payment definitions (weekly / biweekly / monthly)
- **Budget categories** — monthly spend tracking vs. limits
- **Dashboard** — spending stats, budget progress, recent activity
- **Notifications** — unread activity feed

## Tech Notes

- `.env` is gitignored — never committed
- Backend reads `DATABASE_URL` from environment via `process.env`
- USDC address on Arc Testnet is resolved from `@/onchain-facts` (not hardcoded)
- Transaction success is only recorded after `useWaitForTransactionReceipt` confirms onchain inclusion
