# FlowDesk — Design System & UI/UX Guidelines

## 1. Design Principles

1. **Clarity over cleverness** — người dùng phải hiểu ngay họ đang làm gì và trạng thái hiện tại là gì.
2. **Action-oriented** — mỗi màn hình có một primary action rõ ràng.
3. **Trust through transparency** — mọi trạng thái blockchain (pending, confirming, confirmed, failed) đều hiển thị tường minh.
4. **Minimal cognitive load** — ít lựa chọn, ít distraction, nhiều focus.
5. **Desktop-first** — primary layout cho màn hình ≥1280px, responsive xuống tablet/mobile.

---

## 2. Color Tokens

Toàn bộ màu sắc được định nghĩa bằng CSS custom properties trong `src/index.css`. Không dùng màu Tailwind trực tiếp trên các thành phần chính — luôn dùng token.

```css
/* Background hierarchy */
--bg:               #0a1929   /* Page background — darkest */
--surface:          #0f2336   /* Card/panel surface */
--surface-strong:   #162d45   /* Elevated surface (modal, dropdown) */
--surface-muted:    #1a3450   /* Subtle fill (input bg, hover) */

/* Text hierarchy */
--ink:              #e8f4fd   /* Primary text */
--muted:            #7aa3c4   /* Secondary text, labels */
--subtle:           #4a7090   /* Tertiary text, placeholders */

/* Brand / interactive */
--accent:           #0ea5e9   /* Primary accent (sky-500) */
--accent-hover:     #0284c7   /* Hover state */
--accent-subtle:    rgba(14,165,233,0.12)  /* Subtle accent fill */

/* Semantic */
--success:          #10b981   /* Green — confirmed, approved */
--success-subtle:   rgba(16,185,129,0.12)
--warning:          #f59e0b   /* Amber — pending, due */
--warning-subtle:   rgba(245,158,11,0.12)
--danger:           #ef4444   /* Red — rejected, error */
--danger-subtle:    rgba(239,68,68,0.12)

/* Border */
--border:           rgba(255,255,255,0.07)  /* Default border */
--border-strong:    rgba(255,255,255,0.12)  /* Focused/active border */
```

### Sử dụng màu

```tsx
// Đúng — dùng token
className="bg-[var(--surface)] text-[var(--ink)] border-[var(--border)]"

// Sai — hardcode màu Tailwind
className="bg-slate-800 text-white border-slate-700"
```

---

## 3. Typography

```css
/* Font stack */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Scale */
--text-xs:   0.75rem / 1rem       /* 12px — labels, meta */
--text-sm:   0.875rem / 1.25rem   /* 14px — body small */
--text-base: 1rem / 1.5rem        /* 16px — body */
--text-lg:   1.125rem / 1.75rem   /* 18px — section headers */
--text-xl:   1.25rem / 1.75rem    /* 20px — page titles */
--text-2xl:  1.5rem / 2rem        /* 24px — hero numbers */
--text-3xl:  1.875rem / 2.25rem   /* 30px — landing hero */
```

### Hierarchy rules
- **Page title:** `text-xl font-semibold text-[var(--ink)]`
- **Section header:** `text-sm font-semibold text-[var(--muted)] uppercase tracking-wider`
- **Body:** `text-sm text-[var(--ink)]`
- **Label/meta:** `text-xs text-[var(--muted)]`
- **Mono (addresses, hashes):** `font-mono text-xs`

---

## 4. Spacing System

Dùng Tailwind spacing scale (4px base). Quy tắc:

| Context | Spacing |
|---|---|
| Giữa các section | `gap-6` (24px) hoặc `space-y-6` |
| Padding card/panel | `p-5` hoặc `p-6` |
| Padding button | `px-4 py-2` (default), `px-3 py-1.5` (sm) |
| Gap giữa icon và text | `gap-2` |
| Khoảng cách giữa form fields | `space-y-4` |
| Inner padding modal | `p-6` |

---

## 5. Component Patterns

### Button

```tsx
// Primary
<button className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium
  hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

// Secondary/Ghost
<button className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm
  hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors">

// Destructive
<button className="px-4 py-2 rounded-xl bg-[var(--danger-subtle)] text-[var(--danger)] text-sm
  hover:bg-red-500/20 transition-colors">

// Icon-only
<button className="w-8 h-8 rounded-lg flex items-center justify-center
  hover:bg-[var(--surface-muted)] text-[var(--muted)] transition-colors">
```

**Rules:**
- Luôn có `disabled` state (opacity-50 + cursor-not-allowed)
- Loading state dùng `<Loader2 size={14} className="animate-spin" />`
- Không dùng `onClick` async trực tiếp — wrap bằng `() => { void asyncFn(); }`

### Input / Form Field

```tsx
<input
  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]
    text-[var(--ink)] text-sm placeholder-[var(--subtle)]
    focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20
    transition-colors"
/>
```

### Card / Panel

```tsx
<div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5">
```

Elevated (modal, dropdown):
```tsx
<div className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] shadow-2xl">
```

### Badge / Status

```tsx
// Pending
<span className="px-2 py-0.5 rounded-full text-xs font-medium
  bg-[var(--warning-subtle)] text-[var(--warning)]">pending</span>

// Approved
<span className="... bg-[var(--success-subtle)] text-[var(--success)]">approved</span>

// Rejected
<span className="... bg-[var(--danger-subtle)] text-[var(--danger)]">rejected</span>

// Executed
<span className="... bg-[var(--accent-subtle)] text-[var(--accent)]">executed</span>
```

### Modal

- Dùng `framer-motion` `AnimatePresence` + `motion.div`
- Backdrop: `bg-[#0a1929]/60 backdrop-blur-sm`
- Container: `max-w-md rounded-2xl p-6`
- Close button: icon-only `X` top-right
- Click backdrop để đóng (stopPropagation trên nội dung)

### Skeleton Loading

```tsx
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-[var(--surface-muted)] rounded w-3/4" />
  <div className="h-4 bg-[var(--surface-muted)] rounded w-1/2" />
</div>
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <IconComponent size={40} className="text-[var(--subtle)] mb-3" />
  <p className="text-[var(--muted)] text-sm font-medium">No items yet</p>
  <p className="text-[var(--subtle)] text-xs mt-1">Description of what to do</p>
</div>
```

---

## 6. Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)   │  Main Content Area        │
│  ─────────────────────   │  ──────────────────────── │
│  Logo + Workspace name   │  Page Header              │
│  Nav items               │    Title + Actions        │
│  ─────────────────────   │  ─────────────────        │
│  Wallet info             │  Content                  │
│  (bottom)                │                           │
└─────────────────────────────────────────────────────┘
```

**Sidebar:** `w-60 flex-shrink-0` — fixed width, không collapse trên desktop.

**Main:** `flex-1 overflow-auto` — scroll độc lập với sidebar.

**Page header:** `flex items-center justify-between mb-6`

**Content max-width:** Không giới hạn trên desktop. Form/modal: `max-w-md`.

---

## 7. Blockchain UX Guidelines

### 7.1 Trước khi ký giao dịch
- Hiển thị rõ: recipient address, amount, token, chain
- Show warning nếu sai chain ("Wrong network — switch to Arc Testnet")
- Không bao giờ submit transaction mà không có user confirmation

### 7.2 Transaction States

| State | UI |
|---|---|
| Idle | Button "Execute" bình thường |
| Wallet pending | Button disabled + spinner + "Confirm in wallet…" |
| Confirming | Button disabled + spinner + "Confirming…" |
| Success | Toast green + explorer link + close modal |
| Failed | Toast red + error message |
| Wrong chain | Button "Switch to Arc Testnet" (orange) |

### 7.3 Địa chỉ ví
- Hiển thị rút gọn: `0x1234…abcd` (4 ký tự đầu, 4 cuối)
- Luôn lowercase khi lưu vào DB
- Validate regex trước khi submit: `/^0x[0-9a-fA-F]{40}$/`

### 7.4 USDC Amount
- Input: dạng thập phân thân thiện ("5.00", "100")
- Lưu DB: micro-USDC integer (5 USDC = 5,000,000)
- Hiển thị: "$5.00 USDC" hoặc "$1,234.56 USDC"
- Dùng `parseUsdcInput()` và `formatUsdc()` từ `src/utils.ts`

### 7.5 Transaction hash
- Hiển thị rút gọn: `0x1234…abcd`
- Luôn kèm link đến explorer: `buildTxExplorerUrl(CHAIN_ID, txHash)`
- Không bao giờ claim "success" chỉ vì có txHash — phải qua `useWaitForTransactionReceipt`

---

## 8. Responsive Breakpoints

| Breakpoint | Tailwind | Behavior |
|---|---|---|
| Mobile | default (< 768px) | Sidebar ẩn, single column |
| Tablet | `md:` (768px) | Sidebar thu gọn hoặc overlay |
| Desktop | `lg:` (1024px) | Full sidebar + content layout |
| Wide | `xl:` (1280px) | Primary target |

---

## 9. Accessibility

- Tất cả interactive element có `focus-visible` ring
- Màu text phải đạt tối thiểu WCAG AA contrast (4.5:1 trên background)
- Icon-only buttons có `aria-label`
- Form inputs có `<label>` liên kết hoặc `aria-label`
- Error messages liên kết với input bằng `aria-describedby`
- Loading states dùng `aria-busy` hoặc `aria-label` mô tả
- Không dùng màu sắc là tín hiệu duy nhất (luôn kết hợp với text/icon)

---

## 10. Animation Guidelines

- Dùng `framer-motion` cho modal, panel slide-in, page transitions
- Duration: 150–200ms cho micro-interactions, 300ms cho transitions lớn
- Easing: `[0.16, 1, 0.3, 1]` (ease-out-expo) cho modal/slide
- Không animate khi `prefers-reduced-motion` (framer-motion tự handle qua `useReducedMotion`)
- Spinner: `animate-spin` Tailwind trên `<Loader2>` icon
