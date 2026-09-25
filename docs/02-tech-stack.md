# FlowDesk — Tech Stack

## Frontend

| Layer | Technology | Version | Lý do chọn |
|---|---|---|---|
| Framework | React | 18.3 | Component model, ecosystem, wagmi support |
| Language | TypeScript | ~7.0 | Type safety, IDE support, refactor confidence |
| Build tool | Vite | ^6.0 | HMR nhanh, ESM native, plugin ecosystem |
| Styling | Tailwind CSS | ^3.4 | Utility-first, consistent spacing/color tokens |
| Animation | Framer Motion | ^11 | Smooth modal, page transitions |
| Icons | Lucide React | ^0.468 | Consistent icon set, tree-shakeable |
| Notifications | Sonner | ^1.7 | Toast thông báo minimal, accessible |
| Utility | clsx + tailwind-merge | latest | Conditional class merging |

## Blockchain / Web3

| Layer | Technology | Version | Lý do chọn |
|---|---|---|---|
| Blockchain | Arc Testnet | chain ID 5042002 | USDC-native gas, sub-second finality |
| Wagmi | wagmi | ^2.19 | React hooks cho EVM, được maintain tốt |
| Viem | viem | ^2.56 | Type-safe Ethereum client |
| Wallet UI | ConnectKit | ^1.9 | UX wallet connect đẹp, hỗ trợ nhiều wallet |
| USDC | ERC-20 (native Arc) | — | `getUsdc(5042002)` từ `@/onchain-facts` |

## Backend

| Layer | Technology | Version | Lý do chọn |
|---|---|---|---|
| Runtime | Bun | ^1.1 | Fast startup, `.env` auto-load, TypeScript native |
| Framework | Express | ^5.2 | Mature, flexible, middleware ecosystem |
| CORS | cors | ^2.8 | Cross-origin cho Vite proxy |
| DB Client | node-postgres (pg) | ^8.23 | Mature PostgreSQL client, connection pooling |

## Database

| Layer | Technology | Lý do chọn |
|---|---|---|
| Database | PostgreSQL | Relational integrity, JSONB, UUID, indexes |
| Schema | Raw SQL (initDb) | Transparent, no ORM magic, easy to audit |
| Connection | pg.Pool (max 8) | Connection pooling tránh exhaustion |

## Tooling

| Tool | Dùng cho |
|---|---|
| oxlint | Linting TypeScript/React (fast Rust-based linter) |
| oxlint-tsgolint | Type-aware lint rules |
| Foundry (forge) | Compile/test Solidity contracts |
| GitHub CLI (gh) | Push to GitHub từ sandbox |
| Bun | Package manager + runtime cho backend |
| npm | Package manager cho frontend (local dev) |

## Dev Environment

```
/home/user/app/
├── src/              # Frontend React source
├── server/           # Backend Bun/Express source
├── contracts/        # Solidity contracts (Foundry)
├── scripts/          # Build/deploy scripts
├── docs/             # Documentation (this folder)
├── lib/              # Foundry dependencies (forge-std)
├── .env              # Environment variables (gitignored)
├── vite.config.ts    # Vite config + proxy to :3001
├── tailwind.config.js
├── tsconfig.json
└── foundry.toml
```

## Environment Variables

| Variable | Dùng cho | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Backend |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy | Optional |
| `RPC_PROXY_TOKEN` | Auth token cho RPC proxy | Optional |
| `RPC_PROXY_CHAINS` | Danh sách chain keys hỗ trợ | Optional |

Mọi biến môi trường đều được đọc qua `process.env.*` trong backend, không hardcode trong source. File `.env` không được commit (gitignored).

## Proxy Setup (local dev)

Vite dev server (`:5173`) proxy `/api/*` sang backend (`:3001`):

```
Browser → :5173/api/workspaces → Vite Proxy → :3001/workspaces
```

Path rewrite: `/api` prefix bị bỏ trước khi forward đến backend. Frontend gọi `/api/workspaces`, backend nhận `/workspaces`.

## Port Assignments

| Service | Port |
|---|---|
| Vite dev server | 5173 |
| Backend Express | 3001 |
| PostgreSQL | 5346 (remote) |

## Blockchain Configuration

```typescript
// Chain: Arc Testnet
CHAIN_ID = 5042002

// USDC address — luôn resolve từ onchain-facts, không hardcode
const usdcFact = getUsdc(CHAIN_ID); // { address, decimals }

// Explorer base
buildTxExplorerUrl(CHAIN_ID, txHash)
```
