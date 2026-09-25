# FlowDesk — Treasury Spending Workflows

## Product
**FlowDesk** is a Web3 treasury spending workflow tool for onchain teams. It replaces the error-prone manual loop of copying wallet addresses from Notion docs, pasting them into MetaMask, and manually approving USDC transfers. Every disbursement goes through a structured Propose → Approve → Execute → Record cycle backed by Arc (USDC-native gas) on Arc Testnet.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind + wagmi v2 + ConnectKit
- **Backend**: Bun + Express, connected to live PostgreSQL
- **Database**: External PostgreSQL at `DATABASE_URL` (env var)
- **Blockchain**: Arc Testnet (chain ID 5042002), USDC ERC-20 transfers

## Key workflows
1. Connect wallet → Create workspace
2. Create proposal (title, recipient, USDC amount, category)
3. Approve or reject proposal
4. Execute approved proposal → ERC-20 USDC transfer on Arc Testnet → confirmation via `useWaitForTransactionReceipt` → DB record idempotent
5. Schedule recurring payments (weekly/biweekly/monthly)
6. Manage vendors (address book) and budget categories
7. Activity feed with unread notifications

## Backend API (http://localhost:3001)
- `GET/POST /workspaces` — workspace CRUD
- `GET /workspaces/:id/summary` — dashboard aggregation
- `GET/POST /proposals`, `PATCH /:id/approve`, `PATCH /:id/reject`, `PATCH /:id/record-execution`
- `GET/POST/DELETE /vendors`
- `GET/POST/PATCH/DELETE /schedules`, `PATCH /:id/toggle`
- `GET/POST/DELETE /categories`
- `GET /notifications`, `PATCH /mark-all-read`

## DB Schema (PostgreSQL, schema: flow_desk)
Tables: workspaces, budget_categories, vendors, proposals, schedules, transactions, notifications

## Deployed contracts
None — uses native ERC-20 USDC token contract on Arc Testnet via `getUsdc(5042002)`.

## Arc Testnet USDC
Address resolved from `getUsdc(5042002)` in `@/onchain-facts`. Chain ID: 5042002.

## Source of truth
- Wallet balances: onchain (RPC)
- Proposals, schedules, vendors, categories: PostgreSQL (app state)
- Executed transactions: PostgreSQL (indexed after onchain confirmation)
- Notifications: PostgreSQL (derived, rebuildable)
