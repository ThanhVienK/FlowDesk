# FlowDesk — Vercel Deployment Guide

## Kiến trúc trên Vercel

Vercel không chạy long-running Node.js server. Thay vào đó:

```
Browser
  │
  ├── GET /          → Vercel CDN → dist/index.html  (React SPA)
  ├── GET /assets/*  → Vercel CDN → dist/assets/*    (JS/CSS bundles)
  │
  └── /api/*         → Vercel Serverless Function    (api/index.ts)
                         └── Express app (routes, DB, pg pool)
```

File `api/index.ts` wrap toàn bộ Express app thành một Vercel serverless function. Mỗi request đến `/api/*` khởi động (hoặc reuse) một instance của function này.

```
vercel.json rewrites:
  /api/(.*) → api/index.ts   ← serverless function
  /*        → /index.html    ← SPA fallback
```

## Local Dev vs Production

| | Local Dev | Vercel Production |
|---|---|---|
| Frontend | Vite dev server `:5173` | Vercel CDN (static) |
| Backend | `bun run server` `:3001` | Serverless function `api/index.ts` |
| API routing | Vite proxy `/api → :3001` | `vercel.json` rewrite `/api/* → api/index.ts` |
| DB connection | `.env` → `DATABASE_URL` | Vercel Environment Variable |

## Bước deploy

### 1. Push code lên GitHub
Code đã ở `https://github.com/levantuy/flowdesk`

### 2. Import project vào Vercel

1. Vào https://vercel.com → **Add New Project**
2. Import GitHub repo `levantuy/flowdesk`
3. Framework Preset: **Vite** (Vercel tự detect)
4. Build Command: `npm run build` (đã có trong package.json)
5. Output Directory: `dist`

### 3. Cấu hình Environment Variables

Trong Vercel dashboard → **Settings → Environment Variables**, thêm:

| Name | Value | Environment |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:Kjsv%238523@103.172.236.16:5346/postgres?schema=flow_desk` | Production, Preview, Development |

**Lưu ý quan trọng:** Không commit giá trị này vào source code. Chỉ đặt trong Vercel dashboard.

### 4. Deploy

Click **Deploy**. Vercel sẽ:
1. `npm install --legacy-peer-deps`
2. `npm run build` → tạo `dist/`
3. Deploy `dist/` lên CDN
4. Deploy `api/index.ts` thành serverless function

### 5. Kiểm tra sau deploy

```bash
# Health check
curl https://your-app.vercel.app/api/health
# → {"ok":true}

# API endpoint
curl "https://your-app.vercel.app/api/workspaces?owner=0x..."
# → []
```

## Cold Start

Serverless function có "cold start" ~200-500ms lần đầu tiên sau idle. Sau lần đầu, các request tiếp theo nhanh hơn (warm instance).

DB connection pool được khởi tạo một lần per cold start nhờ pattern:
```typescript
let dbReady = false;
const dbInit = initDb().then(() => { dbReady = true; });

export default async function handler(req, res) {
  if (!dbReady) await dbInit; // chờ lần đầu, skip các lần sau
  ...
}
```

## Giới hạn của Vercel Serverless

| Giới hạn | Vercel Hobby | Vercel Pro |
|---|---|---|
| Function timeout | 10s | 60s |
| Function memory | 1024 MB | 3008 MB |
| Concurrent executions | 6 | Unlimited |
| Bandwidth | 100 GB/tháng | 1 TB/tháng |

Với traffic nhỏ (< 100 users), Hobby plan là đủ.

## Rollback

Mọi deployment đều được lưu trong Vercel dashboard. Rollback về version cũ chỉ cần 1 click trong **Deployments** tab.

## Preview Deployments

Mỗi Pull Request tự động tạo một Preview URL (ví dụ: `flowdesk-git-feature-xyz.vercel.app`). Rất tiện để review trước khi merge vào main.

## Troubleshooting

### `/api/*` trả về 404
- Kiểm tra `vercel.json` có đúng rewrite không
- Kiểm tra file `api/index.ts` tồn tại
- Xem Function Logs trong Vercel dashboard

### Database connection error
- Kiểm tra `DATABASE_URL` trong Vercel Environment Variables
- Đảm bảo PostgreSQL server cho phép connection từ Vercel IPs (hoặc `0.0.0.0/0`)
- Xem logs: Vercel dashboard → Functions → Logs

### CORS error
- `cors({ origin: '*' })` trong `api/index.ts` cho phép tất cả origins
- Production nên restrict: `cors({ origin: 'https://your-app.vercel.app' })`
