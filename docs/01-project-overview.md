# FlowDesk — Project Overview

## 1. Mục tiêu dự án

FlowDesk giải quyết một vấn đề cụ thể và lặp lại hàng ngày của các onchain team, DAO, và công ty crypto-native: **quy trình thanh toán USDC thủ công, rời rạc, và không có audit trail**.

Hiện tại các team thường:
- Copy địa chỉ ví từ Notion/Google Sheet → paste vào MetaMask
- Không có bước approval trước khi chuyển tiền
- Không có lịch sử thực thi có thể tra cứu
- Không theo dõi được ngân sách theo danh mục
- Không có cơ chế recurring payment tự động

FlowDesk thay thế luồng đó bằng một chu trình có cấu trúc:

```
PROPOSE → APPROVE → EXECUTE → RECORD → OBSERVE
```

Mỗi khoản chi tiêu đều có người đề xuất, người phê duyệt, bằng chứng onchain, và được ghi nhận vào database để phân tích.

### Mục tiêu cụ thể

| Mục tiêu | Chỉ số thành công |
|---|---|
| Giảm thời gian xử lý một thanh toán | < 2 phút từ đề xuất đến execute |
| Loại bỏ thanh toán không được phê duyệt | 100% giao dịch phải qua approval |
| Traceability đầy đủ | Mọi payment đều có tx hash onchain |
| Quản lý ngân sách theo danh mục | Hiển thị spent vs. limit theo tháng |
| Recurring payment | Lên lịch tự động theo tuần/2 tuần/tháng |

---

## 2. Target Users

- **Onchain teams & DAO** trả lương contributor, grant, bounty bằng USDC
- **Crypto-native startups** thanh toán vendor và contractor
- **Freelance collectives** chia sẻ treasury chung
- **Web3 protocol teams** quản lý ecosystem fund

---

## 3. Tính năng cần xây dựng

### 3.1 Workspace Management
Mỗi team tạo một **Workspace** riêng. Workspace là đơn vị cô lập chứa toàn bộ dữ liệu của team (proposals, vendors, schedules, categories, transactions).

**Yêu cầu:**
- Tạo workspace mới bằng tên và địa chỉ ví owner
- Chuyển đổi giữa nhiều workspace
- Mỗi workspace có dashboard tổng quan riêng

---

### 3.2 Proposals (Đề xuất thanh toán)

Trung tâm của FlowDesk. Mọi khoản chi tiêu đều bắt đầu bằng một Proposal.

**Lifecycle:**
```
pending → approved → executed
pending → rejected
```

**Thông tin một Proposal:**
- `title` — mô tả ngắn mục đích thanh toán
- `description` — chi tiết tuỳ chọn
- `recipient` — địa chỉ ví nhận (0x...)
- `amount_usdc` — số tiền (USDC, 6 decimals)
- `category` — danh mục ngân sách (tuỳ chọn)
- `proposer_address` — ví người đề xuất
- `status` — `pending | approved | rejected | executed`
- `tx_hash` — hash giao dịch sau khi execute
- `approvals` — danh sách ví đã approve (JSONB array)

**Luồng chi tiết:**

1. **Tạo proposal** — người dùng kết nối ví, điền form, submit → lưu vào DB với `status = pending`
2. **Approve** — người có quyền approve click "Approve" → DB cập nhật `status = approved`, thêm ví vào `approvals[]`
3. **Reject** — click "Reject" + nhập lý do (optional) → `status = rejected`
4. **Execute** — chỉ thực hiện khi `status = approved` → gọi ERC-20 `transfer()` trên Arc Testnet → chờ `useWaitForTransactionReceipt` xác nhận → ghi `tx_hash` vào DB → `status = executed`
5. **Record** — sau khi tx confirmed, tạo bản ghi trong bảng `transactions`

**Validation:**
- Địa chỉ recipient phải là địa chỉ Ethereum hợp lệ (`/^0x[0-9a-fA-F]{40}$/`)
- Amount > 0
- Title không được rỗng
- Chain ID phải là Arc Testnet (5042002) trước khi execute

---

### 3.3 Vendors (Sổ địa chỉ)

Danh sách vendor/contractor thường xuyên nhận thanh toán, tránh phải gõ lại địa chỉ ví mỗi lần.

**Thông tin:**
- `name` — tên hiển thị (Alice, Acme Design Studio…)
- `address` — địa chỉ ví Ethereum (unique per workspace)
- `category` — danh mục mặc định
- `notes` — ghi chú tự do
- `approved` — flag whitelist (boolean)

**Tính năng:**
- Thêm, xoá vendor
- Khi tạo proposal, có thể chọn vendor từ dropdown thay vì gõ tay địa chỉ
- Hiển thị trạng thái approved/pending

---

### 3.4 Budget Categories (Danh mục ngân sách)

Phân loại chi tiêu để theo dõi ngân sách theo từng nhóm.

**Thông tin:**
- `name` — tên danh mục (Engineering, Marketing, Operations…)
- `color` — màu hex để phân biệt trực quan
- `monthly_limit` — giới hạn chi tiêu tháng (USDC, tuỳ chọn)
- `spent_this_month` — tổng đã chi trong tháng hiện tại (derived từ `transactions`)

**Tính năng:**
- Tạo/xoá danh mục
- Hiển thị progress bar spent vs. limit
- Cảnh báo khi vượt quá giới hạn

---

### 3.5 Schedules (Thanh toán định kỳ)

Lên lịch recurring payment để không quên trả lương/phí định kỳ.

**Thông tin:**
- `name` — tên lịch (Monthly salary Alice…)
- `recipient` — địa chỉ ví
- `amount_usdc` — số tiền
- `frequency` — `weekly | biweekly | monthly`
- `active` — bật/tắt lịch
- `next_run_at` — thời điểm kích hoạt tiếp theo

**Tính năng:**
- Tạo, bật/tắt, xoá schedule
- Hiển thị trạng thái: active, paused, due (quá hạn)
- Badge "DUE" khi `next_run_at` đã qua

> **Roadmap:** Cron job tự động tạo proposal khi schedule đến hạn (chưa implement).

---

### 3.6 Dashboard

Màn hình tổng quan khi vào workspace.

**Hiển thị:**
- Tổng chi tiêu tháng hiện tại (USDC)
- Số proposal đang pending
- Số schedule đang active
- Số vendor trong sổ địa chỉ
- Progress bar ngân sách theo danh mục
- 5 giao dịch gần nhất
- 5 proposal gần nhất

---

### 3.7 Transaction History

Lịch sử giao dịch đã được xác nhận onchain.

**Hiển thị:**
- Ngày giờ
- Recipient (rút gọn)
- Amount (USDC)
- Danh mục
- Tx hash với link đến explorer Arc Testnet
- Phân trang 20 bản ghi/trang

---

### 3.8 Notifications

Feed thông báo hoạt động trong workspace.

**Loại thông báo:**
- Proposal mới được tạo
- Proposal được approve/reject
- Proposal được execute

**Tính năng:**
- Badge số unread trên icon
- Mark all as read
- Thời gian tương đối (2 hours ago…)

---

### 3.9 Settings

Cài đặt workspace.

**Tính năng:**
- Đổi tên workspace
- Xem thông tin ví đang kết nối
- Thống kê tổng quan (tổng proposal, tổng chi tiêu)

---

## 4. Non-goals (Không xây dựng)

- Multi-signature threshold (quorum N-of-M) — v2 roadmap
- Token ngoài USDC
- Cross-chain bridging
- Smart contract escrow (hiện dùng EOA transfer)
- Mobile app

---

## 5. Vì sao Web3 là cần thiết

- Canonical financial state nằm onchain — không thể giả mạo
- USDC transfer là permissionless và irreversible — cần approval gate trước khi execute
- Tx hash là bằng chứng thanh toán không thể phủ nhận
- Arc (USDC-as-gas) loại bỏ friction ETH gas — team chỉ cần giữ USDC

---

## 6. Vì sao Arc phù hợp

- USDC là native gas token — không cần mua ETH riêng
- Sub-second finality — confirmation UI gần như tức thì
- Predictable fee — budget projection chính xác
- EVM-compatible — toàn bộ ERC-20 tooling hoạt động ngay
