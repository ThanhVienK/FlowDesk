# FlowDesk — System Architecture

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (User)                           │
│                                                                 │
│  React App (Vite :5173)                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  UI Layer                                               │    │
│  │  Components → Views → App.tsx                          │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Application Layer                                      │    │
│  │  useWorkspace hook, apiFetch, wagmi hooks               │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Blockchain Adapter                                     │    │
│  │  wagmi + viem → MetaMask/wallet                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │ /api/* (Vite proxy)        │ RPC calls              │
└───────────┼────────────────────────────┼────────────────────────┘
            │                            │
            ▼                            ▼
┌────────────────────┐       ┌────────────────────────┐
│  Backend           │       │  Arc Testnet           │
│  Bun/Express :3001 │       │  (chain ID 5042002)    │
│                    │       │                        │
│  Routes            │       │  USDC ERC-20 contract  │
│  ├ /workspaces     │       │  (getUsdc(5042002))    │
│  ├ /proposals      │       │                        │
│  ├ /vendors        │       └────────────────────────┘
│  ├ /schedules      │
│  ├ /categories     │
│  ├ /notifications  │
│  └ /health         │
│                    │
│  DB layer (pg)     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  PostgreSQL        │
│  (remote host)     │
│  schema: flow_desk │
└────────────────────┘
```

---

## 2. Data Flow

### Tạo Proposal

```
User fills form
  → Frontend validates (address regex, amount > 0)
  → POST /api/proposals (Vite proxy)
  → Backend validates + INSERT INTO proposals
  → Return {id, status: 'pending'}
  → Frontend updates UI
```

### Execute Proposal

```
User clicks Execute
  → Frontend checks chainId === 5042002
    (if wrong → switchChain())
  → writeContract(USDC.transfer(recipient, amount))
  → Wallet popup → User signs
  → tx submitted → txHash returned
  → useWaitForTransactionReceipt polls for confirmation
  → isSuccess = true
  → PATCH /api/proposals/:id/record-execution {tx_hash}
  → Backend: UPDATE proposals SET status='executed', tx_hash=...
  → Backend: INSERT INTO transactions (idempotent ON CONFLICT)
  → Frontend: toast success + close modal + refresh
```

---

## 3. Source of Truth Map

| Entity | Canonical Source | Storage | Read Path | Sync Trigger |
|---|---|---|---|---|
| USDC balance | **Onchain** (Arc Testnet) | — | `useBalance` wagmi hook | On mount, on focus |
| Transaction existence | **Onchain** (tx hash) | PostgreSQL (cache) | DB read | After tx confirmation |
| Proposal status | **PostgreSQL** | DB | REST API | User action |
| Workspace data | **PostgreSQL** | DB | REST API | User action |
| Vendor address book | **PostgreSQL** | DB | REST API | User action |
| Schedules | **PostgreSQL** | DB | REST API | User action |
| Budget spent | **Derived** (from transactions) | PostgreSQL (aggregated) | DB SUM query | After tx record |
| Notifications | **Derived** (from proposals) | PostgreSQL | DB read | After proposal actions |

**Rules:**
- Không dùng PostgreSQL làm nguồn sự thật cho USDC balance
- Không claim transaction success chỉ từ DB — luôn verify onchain
- `transactions` table là indexed mirror của onchain events, rebuildable

---

## 4. Database Schema

### workspaces
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          TEXT NOT NULL CHECK (char_length(name) > 0)
owner_address TEXT NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX: workspaces_owner ON (owner_address)
```

### budget_categories
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name          TEXT NOT NULL
color         TEXT NOT NULL DEFAULT '#122d45'
monthly_limit BIGINT  -- micro-USDC, nullable
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE: (workspace_id, name)
```

### vendors
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name          TEXT NOT NULL
address       TEXT NOT NULL  -- Ethereum address, lowercase
category_id   UUID REFERENCES budget_categories(id) ON DELETE SET NULL
notes         TEXT
approved      BOOLEAN NOT NULL DEFAULT true
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE: (workspace_id, address)
```

### proposals
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
title             TEXT NOT NULL
description       TEXT
recipient         TEXT NOT NULL  -- Ethereum address, lowercase
amount_usdc       BIGINT NOT NULL CHECK (amount_usdc > 0)  -- micro-USDC
category_id       UUID REFERENCES budget_categories(id) ON DELETE SET NULL
proposer_address  TEXT NOT NULL  -- Ethereum address, lowercase
status            TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','executed'))
approvals         JSONB NOT NULL DEFAULT '[]'  -- array of addresses
rejection_reason  TEXT
tx_hash           TEXT  -- set after execution
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX: proposals_workspace ON (workspace_id, status, created_at DESC)
```

### schedules
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name          TEXT NOT NULL
recipient     TEXT NOT NULL  -- Ethereum address
amount_usdc   BIGINT NOT NULL CHECK (amount_usdc > 0)
frequency     TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly'))
category_id   UUID REFERENCES budget_categories(id) ON DELETE SET NULL
active        BOOLEAN NOT NULL DEFAULT true
next_run_at   TIMESTAMPTZ NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### transactions
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
proposal_id   UUID REFERENCES proposals(id) ON DELETE SET NULL
tx_hash       TEXT NOT NULL UNIQUE  -- dedup key
from_address  TEXT NOT NULL
to_address    TEXT NOT NULL
amount_usdc   BIGINT NOT NULL
category_id   UUID REFERENCES budget_categories(id) ON DELETE SET NULL
chain_id      INTEGER NOT NULL DEFAULT 5042002
indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE: (tx_hash)  -- idempotent insert
```

### notifications
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
type          TEXT NOT NULL  -- 'proposal_created' | 'proposal_approved' | etc.
message       TEXT NOT NULL
read          BOOLEAN NOT NULL DEFAULT false
ref_id        UUID  -- proposal_id or schedule_id
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 5. API Reference

Base URL: `http://localhost:3001` (direct) hoặc `/api` (qua Vite proxy)

### Workspaces

```
GET  /workspaces?owner=<address>
     → Workspace[]

POST /workspaces
     Body: { name: string, owner_address: string }
     → Workspace (201)

GET  /workspaces/:id/summary
     → {
         proposals: Proposal[],
         schedules: Schedule[],
         categories: CategoryWithSpent[],
         recentTransactions: Transaction[],
         totalSpentThisMonthUsdc: number,
         unreadNotifications: Notification[]
       }
```

### Proposals

```
GET  /proposals?workspace_id=<id>
     → Proposal[]

POST /proposals
     Body: {
       workspace_id, title, description?, recipient,
       amount_usdc, category_id?, proposer_address
     }
     → Proposal (201)

PATCH /proposals/:id/approve
     Body: { approver_address: string }
     → Proposal

PATCH /proposals/:id/reject
     Body: { approver_address: string, reason?: string }
     → Proposal

PATCH /proposals/:id/record-execution
     Body: { tx_hash: string }
     → Proposal
```

### Vendors

```
GET  /vendors?workspace_id=<id>
     → Vendor[]

POST /vendors
     Body: { workspace_id, name, address, category_id?, notes?, approved? }
     → Vendor (201)

DELETE /vendors/:id
     → { ok: true }
```

### Schedules

```
GET  /schedules?workspace_id=<id>
     → Schedule[]

POST /schedules
     Body: { workspace_id, name, recipient, amount_usdc, frequency, category_id?, start_date? }
     → Schedule (201)

PATCH /schedules/:id/toggle
     → Schedule (toggled active)

DELETE /schedules/:id
     → { ok: true }
```

### Categories

```
GET  /categories?workspace_id=<id>
     → Category[]

POST /categories
     Body: { workspace_id, name, color?, monthly_limit? }
     → Category (201)

DELETE /categories/:id
     → { ok: true }
```

### Notifications

```
GET  /notifications?workspace_id=<id>
     → Notification[]

PATCH /notifications/mark-all-read?workspace_id=<id>
     → { ok: true }
```

### Health

```
GET  /health
     → { ok: true }
```

---

## 6. Frontend Component Tree

```
App.tsx (root, providers, workspace state)
├── LandingPage (wallet not connected)
├── CreateWorkspaceModal (no workspaces)
├── Sidebar (nav, wallet info)
└── Main content area
    ├── Dashboard (default view)
    ├── ProposalsView
    │   └── ProposalModal (create or review/execute)
    ├── VendorsView
    ├── SchedulesView
    ├── NotificationsView
    └── SettingsView
```

### State lifting

`App.tsx` owns:
- `activeWorkspace` — workspace hiện tại
- `workspaces[]` — danh sách tất cả workspaces
- `vendors[]` — vendor list cho workspace hiện tại (passed to ProposalModal)
- `categories[]` — category list
- `currentView` — active navigation view
- `newProposalOpen` — modal state

`useWorkspace(workspaceId)` hook owns:
- `summary` — dashboard aggregation data
- `loadSummary()` — refresh trigger

---

## 7. Idempotency & Recovery

### Transactions
- `INSERT INTO transactions ... ON CONFLICT (tx_hash) DO NOTHING`
- Nếu `record-execution` PATCH bị gọi 2 lần cùng tx_hash → DB không duplicate

### Proposals
- `status` field chỉ có thể chuyển theo state machine (pending→approved, approved→executed, etc.)
- Backend validate state transition trước khi UPDATE

### Schedules (Roadmap — cron)
- Khi cron tạo proposal từ schedule, dùng `(schedule_id, date)` composite key để prevent duplicate

### Database Recovery
- Toàn bộ schema được rebuild từ `initDb()` — idempotent (`CREATE TABLE IF NOT EXISTS`)
- `transactions` table có thể re-index từ onchain events (tx_hash là dedup key)

---

## 8. Future Architecture (Roadmap)

### v1.1 — Multi-signer Approval
- Thêm `required_approvals` vào workspaces
- Proposals chỉ chuyển `approved` khi đủ N chữ ký

### v2.0 — Smart Contract Escrow
- Deploy `FlowDeskEscrow.sol` trên Arc Testnet
- Proposals lock USDC vào contract, release khi đủ approvals onchain
- Permissionless: không cần trust server để record execution

### v2.1 — Schedule Automation
- Cron job (worker) poll `schedules WHERE active = true AND next_run_at < now()`
- Tạo proposal tự động, notify approvers
- Sau approve, auto-execute hoặc require manual execute

### v3.0 — Multi-chain
- Extend `transactions.chain_id` để support Base, Arbitrum
- `getUsdc(chainId)` từ `@/onchain-facts` đã sẵn sàng multi-chain
