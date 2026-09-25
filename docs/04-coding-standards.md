# FlowDesk — Coding Standards

## 1. Ngôn ngữ & Cú pháp

### TypeScript
- **Strict mode** bật — không tắt bất kỳ strict check nào
- Không dùng `any` — dùng `unknown` và narrow khi cần
- Không dùng `as any` — chỉ dùng `as Type` khi đã verify type là đúng
- Dùng `type` cho union/intersection, `interface` cho object shapes có thể extend
- Luôn khai báo return type cho public functions
- Dùng `const` thay `let` khi có thể, không dùng `var`

```typescript
// Đúng
function formatAmount(value: bigint): string { ... }
type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed';
interface ProposalRow { id: string; title: string; status: ProposalStatus; }

// Sai
function formatAmount(value) { ... }
const status: any = proposal.status;
```

### React
- Functional components với hooks — không dùng class components
- Props interface khai báo trước component, đặt tên `Props` hoặc `ComponentNameProps`
- Không dùng `React.FC` — khai báo props inline hoặc dùng destructuring
- Export named, không export default (trừ lazy-loaded routes)

```tsx
// Đúng
interface Props { title: string; onClose: () => void; }
export function MyModal({ title, onClose }: Props) { ... }

// Sai
const MyModal: React.FC<{ title: string }> = ({ title }) => { ... }
export default MyModal;
```

---

## 2. Quy tắc đặt tên

### Files & Directories

| Loại | Convention | Ví dụ |
|---|---|---|
| React component | PascalCase | `ProposalModal.tsx`, `Dashboard.tsx` |
| Hook | camelCase, tiền tố `use` | `useWorkspace.ts` |
| Utility | camelCase | `utils.ts`, `formatters.ts` |
| Type definitions | camelCase | `types.ts` |
| Server route | camelCase, số nhiều | `proposals.ts`, `vendors.ts` |
| DB module | camelCase | `db.ts` |
| Config | camelCase | `vite.config.ts`, `tailwind.config.js` |
| Doc | kebab-case | `01-project-overview.md` |

### Variables & Functions

```typescript
// Variables: camelCase
const activeWorkspace = ...;
const isLoading = ...;
const txHash = ...;

// Constants: UPPER_SNAKE_CASE
const CHAIN_ID = 5042002;
const MAX_RETRY_COUNT = 3;

// React components: PascalCase
function ProposalModal() { ... }

// Event handlers: tiền tố handle
const handleSubmit = async (e: React.FormEvent) => { ... };
const handleDelete = () => { ... };

// Boolean variables: is/has/can tiền tố
const isLoading = true;
const hasError = false;
const canExecute = proposal.status === 'approved';

// Async functions: động từ rõ ràng
async function loadProposals() { ... }
async function createWorkspace() { ... }
async function executeProposal() { ... }
```

### Database (PostgreSQL)

```sql
-- Tables: snake_case, số nhiều
workspaces, budget_categories, proposals, vendors

-- Columns: snake_case
owner_address, created_at, amount_usdc, workspace_id

-- Indexes: convention tablename_column
workspaces_owner, proposals_workspace

-- UUIDs: dùng gen_random_uuid()
```

### CSS/Tailwind

- Class order: layout → spacing → visual → interactive → responsive
- Không viết custom CSS trừ khi Tailwind không đáp ứng được
- CSS variables: `--kebab-case`

---

## 3. Cấu trúc thư mục

```
src/
├── components/         # UI components (one file per component)
│   ├── Dashboard.tsx
│   ├── ProposalModal.tsx
│   ├── ProposalsView.tsx
│   ├── SchedulesView.tsx
│   ├── SettingsView.tsx
│   ├── Sidebar.tsx
│   ├── VendorsView.tsx
│   ├── NotificationsView.tsx
│   ├── LandingPage.tsx
│   └── CreateWorkspaceModal.tsx
├── hooks/              # Custom React hooks
│   └── useWorkspace.ts
├── types.ts            # Shared TypeScript interfaces/types
├── utils.ts            # Pure utility functions
├── config.ts           # wagmi config
├── onchain-facts.ts    # Chain/contract constants (generated)
├── onchain-money.ts    # Money formatting/parsing
├── onchain-wait.ts     # Transaction wait utilities
├── App.tsx             # Root component (thin composition root)
├── main.tsx            # Entry point (providers only)
└── index.css           # Tailwind directives + CSS tokens

server/
├── index.ts            # Express app setup + server start
├── db.ts               # PostgreSQL pool + initDb + query helpers
└── routes/
    ├── workspaces.ts
    ├── proposals.ts
    ├── vendors.ts
    ├── schedules.ts
    ├── categories.ts
    ├── transactions.ts
    └── notifications.ts
```

### Quy tắc file size
- Component file: tối đa ~300 LOC. Nếu lớn hơn, tách sub-component.
- Route file: tối đa ~150 LOC. Tách business logic ra nếu cần.
- `App.tsx`: chỉ là composition root, không có business logic.

---

## 4. Async / Promise Patterns

```typescript
// Đúng — void trong useEffect
useEffect(() => {
  void loadData();
}, [dependency]);

// Đúng — try/catch trong async function
const handleCreate = async () => {
  setLoading(true);
  try {
    await apiFetch('/proposals', { method: 'POST', body: ... });
    toast.success('Created');
    onSuccess();
  } catch (err) {
    toast.error((err as Error).message ?? 'Failed');
  } finally {
    setLoading(false);
  }
};

// Đúng — wrapper không async cho event handlers khi cần
<button onClick={() => { void handleCreate(); }}>

// Sai — floating promise
useEffect(() => {
  loadData(); // thiếu void hoặc await
}, []);

// Sai — async trực tiếp trên onClick
<button onClick={handleCreate}> // handleCreate là async
```

---

## 5. Error Handling

```typescript
// API call trong frontend
try {
  const result = await apiFetch<Proposal[]>('/proposals?workspace_id=...');
  setProposals(result);
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  toast.error(message);
  setError(message);
}

// Backend route handler
router.get('/', async (req, res) => {
  try {
    const rows = await query(...);
    return res.json(rows);
  } catch (err) {
    console.error('[proposals:get]', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});
```

**Rules:**
- Không swallow errors silently (bắt xong bỏ qua)
- Backend: log đầy đủ, trả về generic message cho client (không leak stack trace)
- Frontend: luôn show error feedback cho user (toast hoặc inline)
- Blockchain errors: extract `.shortMessage` hoặc `.message` từ viem error

---

## 6. State Management

- Dùng React `useState` + `useEffect` cho local component state
- Dùng `useWorkspace` hook cho workspace-scoped shared state
- Không dùng global state manager (Redux, Zustand) — scope hiện tại không cần
- Server state: fetch trực tiếp trong component hoặc hook, không cache phức tạp
- Wagmi hooks (`useAccount`, `useBalance`, `useWriteContract`) cho onchain state

```typescript
// Đúng — clear loading/error/data pattern
const [proposals, setProposals] = useState<Proposal[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Sai — không có loading/error state
const [proposals, setProposals] = useState<Proposal[]>([]);
```

---

## 7. API Client Pattern

```typescript
// src/utils.ts — apiFetch wrapper
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

**Rules:**
- Luôn dùng `apiFetch` thay `fetch` trực tiếp
- Paths bắt đầu bằng `/` (không có `/api` prefix — wrapper tự thêm)
- Sử dụng generic type parameter cho type-safe response

---

## 8. Blockchain Code Rules

```typescript
// Luôn dùng onchain-facts cho addresses và chain info
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts';
const usdcFact = getUsdc(CHAIN_ID)!; // không hardcode địa chỉ

// Luôn dùng onchain-money cho amount parsing
import { parseAmount, formatUsdc } from '@/onchain-money';
const raw = parseAmount(CHAIN_ID, '5.00'); // không dùng parseUnits trực tiếp

// Luôn validate chain ID trước khi execute
if (chainId !== CHAIN_ID) {
  switchChain({ chainId: CHAIN_ID });
  return;
}

// Luôn chờ confirmation, không claim success từ txHash
const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
useEffect(() => {
  if (isSuccess && txHash) recordExecution(txHash);
}, [isSuccess, txHash]);

// Validate địa chỉ trước khi submit
if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
  setError('Invalid address');
  return;
}
```

---

## 9. Database Query Rules

```typescript
// Dùng parameterized queries — không interpolate string
// Đúng
await query('SELECT * FROM proposals WHERE workspace_id = $1', [id]);

// Sai — SQL injection risk
await query(`SELECT * FROM proposals WHERE workspace_id = '${id}'`);

// Lowercase địa chỉ ví trước khi lưu
String(owner_address).toLowerCase()

// Idempotent inserts dùng ON CONFLICT
await query(`
  INSERT INTO transactions (...) VALUES (...)
  ON CONFLICT (tx_hash) DO NOTHING
`, [...]);
```

---

## 10. Import Order

```typescript
// 1. Node built-ins
import { Router } from 'express';

// 2. External packages
import { useAccount, useWriteContract } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';

// 3. Internal aliases (@/)
import { getUsdc } from '@/onchain-facts';
import { parseAmount } from '@/onchain-money';

// 4. Relative imports
import { apiFetch } from '../utils';
import type { Proposal } from '../types';
```
