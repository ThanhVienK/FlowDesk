# FlowDesk Documentation

Tài liệu đầy đủ của dự án FlowDesk — Web3 Treasury Spending Workflow Tool.

## Danh sách tài liệu

| File | Nội dung |
|---|---|
| [01-project-overview.md](./01-project-overview.md) | Mục tiêu, target users, mô tả chi tiết từng tính năng, vì sao Web3/Arc |
| [02-tech-stack.md](./02-tech-stack.md) | Toàn bộ tech stack, tooling, environment variables, port assignments |
| [03-design-system.md](./03-design-system.md) | Color tokens, typography, spacing, component patterns, blockchain UX, accessibility |
| [04-coding-standards.md](./04-coding-standards.md) | TypeScript/React rules, naming conventions, file structure, async patterns, error handling |
| [05-git-workflow.md](./05-git-workflow.md) | Branching strategy, commit convention, PR process, versioning |
| [06-quality-standards.md](./06-quality-standards.md) | Definition of Done, testing checklist, performance, security standards, deployment checklist |
| [07-architecture.md](./07-architecture.md) | System architecture, data flow, source of truth map, DB schema, API reference |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/levantuy/flowdesk.git
cd flowdesk

# 2. Install
npm install --legacy-peer-deps

# 3. Tạo .env
echo "DATABASE_URL=postgres://user:password@host:port/dbname?schema=flow_desk" > .env

# 4. Chạy backend (terminal 1)
bun run server

# 5. Chạy frontend (terminal 2)
npm run dev

# 6. Mở http://localhost:5173
```

Chi tiết: xem [README.md](../README.md) ở root project.
