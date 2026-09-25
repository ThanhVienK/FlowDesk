# FlowDesk — Git Workflow

## 1. Branching Strategy

Dùng **GitHub Flow** — đơn giản, phù hợp với team nhỏ và deploy liên tục.

```
main (production-ready, protected)
  └── feature/add-multisig-approval
  └── fix/proposal-amount-validation
  └── chore/update-dependencies
  └── docs/add-api-reference
```

### Branch naming

```
<type>/<short-description>
```

| Type | Dùng cho |
|---|---|
| `feature/` | Tính năng mới |
| `fix/` | Bug fix |
| `chore/` | Maintenance, dependency update, config |
| `docs/` | Chỉ thay đổi documentation |
| `refactor/` | Refactor không thay đổi behavior |
| `perf/` | Performance improvement |
| `test/` | Thêm hoặc sửa tests |

**Rules:**
- Tên branch: kebab-case, tiếng Anh, ngắn gọn (< 50 ký tự)
- Không commit trực tiếp lên `main` — luôn qua Pull Request
- Mỗi branch giải quyết một vấn đề/tính năng cụ thể
- Delete branch sau khi merge

---

## 2. Commit Convention

Dùng **Conventional Commits** (https://www.conventionalcommits.org).

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Khi nào dùng |
|---|---|
| `feat` | Tính năng mới |
| `fix` | Bug fix |
| `docs` | Chỉ thay đổi documentation |
| `style` | Format, whitespace, không ảnh hưởng logic |
| `refactor` | Refactor code không thêm feature, không fix bug |
| `perf` | Cải thiện performance |
| `test` | Thêm/sửa tests |
| `chore` | Build process, dependency update, tooling |
| `revert` | Revert commit trước |
| `ci` | CI/CD configuration |

### Scope (tuỳ chọn)

```
feat(proposals): add reject reason input
fix(auth): validate chain ID before execute
chore(deps): upgrade wagmi to 2.20.0
docs(api): document workspace endpoints
```

### Subject rules

- Viết tiếng Anh
- Lowercase chữ đầu
- Không có dấu chấm ở cuối
- Thì hiện tại (present tense): "add feature" không phải "added feature"
- Tối đa 72 ký tự
- Mô tả **what** và **why**, không phải **how**

### Ví dụ commit đúng

```bash
feat(proposals): add USDC amount validation before execute

fix(schedules): prevent negative next_run_at calculation

refactor(db): extract connection pool to separate module

docs(setup): add bun installation instructions for Windows

chore(deps): update vite to 6.1.0 to fix HMR regression

feat(dashboard): show monthly budget progress bars per category

Closes #42
```

### Ví dụ commit sai

```bash
fix stuff                    # quá mơ hồ
WIP                          # không mô tả
update code                  # không có ý nghĩa
Fixed the bug in proposals   # past tense, uppercase
feat: add new feature.       # có dấu chấm
```

---

## 3. Pull Request Process

### Tạo PR

1. Branch up-to-date với `main` (`git rebase main` hoặc `git merge main`)
2. Tất cả commits tuân theo Conventional Commits
3. `bun run check` pass (lint + typecheck không có error)
4. Mọi tính năng onchain phải test thủ công trên Arc Testnet trước khi tạo PR

### PR Title

Theo cùng format với commit message:
```
feat(proposals): add multisig approval threshold
fix(schedules): fix biweekly interval calculation
```

### PR Description Template

```markdown
## Summary
Mô tả ngắn những gì PR này làm và tại sao.

## Changes
- [ ] Thay đổi A
- [ ] Thay đổi B

## Testing
- [ ] Unit test / manual test steps
- [ ] Tested on Arc Testnet (nếu có blockchain changes)

## Screenshots (nếu có UI changes)

## Related Issues
Closes #XX
```

### Review Checklist

Reviewer phải kiểm tra:

**Code quality:**
- [ ] Code dễ đọc, có comment ở những chỗ phức tạp
- [ ] Không có `any`, `console.log` debug, hardcoded secrets
- [ ] Error handling đầy đủ (không swallow errors)
- [ ] TypeScript types đúng và đủ

**Security (quan trọng):**
- [ ] Không expose private key hoặc secret
- [ ] SQL queries dùng parameterized (không string interpolation)
- [ ] Địa chỉ ví được validate trước khi dùng
- [ ] Chain ID được kiểm tra trước khi execute transaction
- [ ] Không trust client-provided financial state

**Blockchain:**
- [ ] Transaction success chỉ được ghi nhận sau `useWaitForTransactionReceipt`
- [ ] Không hardcode contract address — dùng `getUsdc()` từ `@/onchain-facts`
- [ ] Amount parsing dùng `parseAmount()` từ `@/onchain-money`

**UX:**
- [ ] Loading states hiển thị đúng
- [ ] Error states hiển thị đúng
- [ ] Empty states có nội dung hướng dẫn
- [ ] Responsive trên mobile

### Merge Rules

- Tối thiểu 1 approval trước khi merge
- PR phải pass CI checks (nếu có)
- Squash merge nếu branch có nhiều WIP commits
- Merge commit message theo format: `feat(scope): description (#PR_NUMBER)`

---

## 4. Versioning

Dùng **Semantic Versioning** (semver): `MAJOR.MINOR.PATCH`

| Increment | Khi nào |
|---|---|
| MAJOR | Breaking changes (API thay đổi không backward-compatible) |
| MINOR | Tính năng mới, backward-compatible |
| PATCH | Bug fixes, backward-compatible |

Tag releases:
```bash
git tag -a v1.2.0 -m "feat: add multisig approval"
git push origin v1.2.0
```

---

## 5. Protected Files

Không bao giờ commit các file sau:

```
.env
.env.*
.env.local
.env.production
.circle/recovery_file*
*.pem
*.key
*_secret*
node_modules/
dist/
contracts/out/
```

Kiểm tra `.gitignore` trước mọi `git add -A`.

---

## 6. Hotfix Process

Khi cần fix khẩn trên production:

```bash
git checkout main
git pull origin main
git checkout -b fix/critical-bug-description

# ... fix ...

git commit -m "fix(scope): describe the critical fix"
# Tạo PR, review nhanh, merge ngay
```

Không bypass review process dù là hotfix — luôn cần ít nhất 1 người khác review.
