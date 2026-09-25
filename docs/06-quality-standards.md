# FlowDesk — Quality Standards

## 1. Definition of Done

Một task/PR chỉ được coi là **Done** khi tất cả các tiêu chí sau đều đạt:

### Code Quality
- [ ] `bun run check` pass (zero lint errors, zero TypeScript errors)
- [ ] Không có `console.log`, `console.warn` debug còn sót lại
- [ ] Không có `TODO`, `FIXME`, `HACK` chưa được tạo issue
- [ ] Không có code bị comment out

### Functionality
- [ ] Feature hoạt động đúng theo spec trong `docs/01-project-overview.md`
- [ ] Tất cả UI states hoạt động: loading, empty, error, success
- [ ] Responsive trên mobile (≥375px) và desktop (≥1280px)
- [ ] Keyboard navigation hoạt động cho interactive elements

### Blockchain (nếu có)
- [ ] Tested trên Arc Testnet với ví thật
- [ ] Transaction success chỉ record sau confirmation
- [ ] Wrong chain state hiển thị và switch chain hoạt động
- [ ] Insufficient balance edge case được handle

### Security
- [ ] Không có sensitive data trong source code
- [ ] SQL queries dùng parameterized
- [ ] Input validation đầy đủ ở cả frontend và backend
- [ ] Địa chỉ ví validated trước khi dùng

### Documentation
- [ ] Function/component phức tạp có JSDoc comment
- [ ] README cập nhật nếu setup thay đổi

---

## 2. Linting & Type Checking

### Tool: oxlint

```bash
bun run lint       # Chạy oxlint với auto-fix
bun run typecheck  # Chạy tsc --noEmit
bun run check      # Chạy cả hai (dùng cái này)
```

**Quy tắc:**
- Zero errors — không có ngoại lệ
- Warnings được phép nhưng nên fix khi có thời gian
- Không dùng `// eslint-disable` hoặc `// oxlint-disable` trừ khi là false positive có documented reason
- `no-misused-promises` và `set-state-in-effect` tắt vì false positive trên data-fetching pattern

### TypeScript Strict Mode

```json
// tsconfig.json — không được tắt các flag này
{
  "strict": true,
  "noUncheckedIndexedAccess": false,
  "noImplicitOverride": true
}
```

---

## 3. Testing Strategy

### Manual Testing Checklist (Pre-PR)

**Workspace flow:**
- [ ] Tạo workspace mới
- [ ] Workspace xuất hiện trong dropdown
- [ ] Chuyển đổi giữa workspaces

**Proposal flow:**
- [ ] Tạo proposal với đầy đủ thông tin
- [ ] Validation lỗi hiển thị đúng (địa chỉ sai, amount = 0)
- [ ] Approve proposal
- [ ] Reject proposal với lý do
- [ ] Execute proposal trên Arc Testnet
- [ ] Tx hash hiển thị sau confirmation
- [ ] Wrong chain → switch chain → execute lại

**Vendor flow:**
- [ ] Thêm vendor với địa chỉ hợp lệ
- [ ] Duplicate address bị reject
- [ ] Xoá vendor
- [ ] Vendor xuất hiện trong proposal dropdown

**Schedule flow:**
- [ ] Tạo schedule weekly/biweekly/monthly
- [ ] Toggle active/paused
- [ ] Due badge hiển thị đúng
- [ ] Xoá schedule

**Budget categories:**
- [ ] Tạo category với monthly limit
- [ ] Progress bar hiển thị đúng
- [ ] Category xuất hiện trong proposal form

**Dashboard:**
- [ ] Stats đúng sau tạo proposal
- [ ] Recent transactions cập nhật sau execute

**Edge cases:**
- [ ] Wallet không kết nối → hiển thị connect prompt
- [ ] Network down → error state hiển thị
- [ ] Empty workspace → empty states hiển thị
- [ ] Mobile layout (375px)

### Automated Testing (Roadmap)

Hiện tại chưa có automated tests. Roadmap:

| Phase | Tests |
|---|---|
| v1.1 | Unit tests cho `utils.ts` (formatUsdc, parseUsdcInput, truncateAddress) |
| v1.2 | Integration tests cho server routes (supertest) |
| v2.0 | E2E tests cho critical paths (Playwright) |

---

## 4. Performance Standards

### Frontend
- Lighthouse Performance score ≥ 85 trên desktop
- First Contentful Paint < 2s (local dev)
- Không có N+1 re-renders — dùng `React.memo`, `useCallback` khi cần
- Không fetch lại data không cần thiết — cache ở component state
- Image (nếu có): sử dụng WebP, lazy loading

### Backend
- API response time < 200ms cho read endpoints (không tính DB latency)
- Không có unbounded queries — tất cả SELECT có LIMIT
- Pagination cho danh sách lớn (20 items/page)
- Connection pool: max 8 connections

### Database Indexes

Tất cả các index đã khai báo trong `initDb()`:

```sql
workspaces_owner        ON workspaces (owner_address)
proposals_workspace     ON proposals (workspace_id, status, created_at DESC)
```

Index cần thêm khi data lớn:
```sql
vendors (workspace_id)
schedules (workspace_id, active, next_run_at)
transactions (workspace_id, indexed_at DESC)
notifications (workspace_id, read, created_at DESC)
```

### RPC Usage
- Không gọi RPC trên mỗi page load
- Balance check: chỉ gọi khi cần (trước khi execute)
- Transaction status: chỉ poll khi đang có tx pending
- Wagmi `useBalance` chỉ enable khi wallet connected

---

## 5. Security Standards

### Authentication & Authorization
- Hiện tại: wallet address là identity — ai có địa chỉ trùng với `owner_address` thì có quyền
- Không có server-side auth — đây là MVP, production cần JWT/session
- Không expose endpoint admin mà không có auth check

### Input Validation

| Input | Frontend | Backend |
|---|---|---|
| Địa chỉ ví | Regex `/^0x[0-9a-fA-F]{40}$/` | Regex check |
| USDC amount | > 0, parse number | bigint > 0 |
| Text fields | `trim()`, length check | `trim()`, length check |
| UUIDs | — | dùng làm SQL params |

### SQL Security
- Tất cả queries dùng parameterized (`$1, $2, ...`)
- Không string interpolation trong SQL
- Không expose raw DB errors đến client

### Blockchain Security
- Chain ID hardcoded = 5042002, check trước mọi tx
- Contract address từ `getUsdc()` — không nhận từ user input
- Amount: tính từ server/onchain-facts, không trust client amount cho critical flows
- Private keys: không bao giờ đọc, log, hoặc store

### Secrets Management
- Secrets chỉ trong `.env` (gitignored)
- Server đọc qua `process.env.*`
- Không có secret trong source code, config, hoặc log
- `.env.example` chứa tên biến nhưng không có giá trị thật

### CORS
- Backend: `cors({ origin: '*' })` cho dev
- Production: phải restrict origin đến domain cụ thể

---

## 6. Error Monitoring (Roadmap)

Hiện tại: `console.error` trong backend, toast trong frontend.

Production roadmap:
- Sentry (hoặc tương đương) cho frontend error tracking
- Structured logging (pino) cho backend
- Alerting khi error rate tăng đột biến

---

## 7. Deployment Checklist

Trước khi deploy lên production:

**Environment:**
- [ ] `DATABASE_URL` trỏ đúng production DB
- [ ] CORS origin restricted đến production domain
- [ ] `NODE_ENV=production`
- [ ] SSL/TLS bật cho DB connection

**Database:**
- [ ] Migrations đã chạy
- [ ] Connection pool size phù hợp với load
- [ ] Backup strategy đã có

**Frontend:**
- [ ] Production build pass (`npm run build`)
- [ ] Không có `localhost` hardcode trong source
- [ ] Analytics/error monitoring cài đặt

**Security:**
- [ ] `.env` không bao giờ được public
- [ ] Rate limiting trên API (chưa implement)
- [ ] Header security (helmet.js — chưa implement)
- [ ] Dependency audit (`npm audit`)

**Blockchain:**
- [ ] Chain ID đúng (mainnet vs testnet)
- [ ] Contract addresses đúng network
- [ ] Explorer links đúng network
