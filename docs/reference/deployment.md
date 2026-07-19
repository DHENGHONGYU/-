---
title: V9 部署运维基线
type: reference
domain: project
phase: deployment
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档体系版本: v2.0.0 | 本文档修订: rev.1 | 兼容 AGENTS.md: v1.4.3+ 定位: 定义 V9 纯前端应用的构建产物、部署配置、数据库升级、环境变量、CI/CD..."
tags: [devops, deployment, reference, project]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-218
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 部署运维基线

> **文档体系版本**: v2.0.0 | **本文档修订**: rev.1 | **兼容 AGENTS.md**: v1.4.3+
> **定位**: 定义 V9 纯前端应用的构建产物、部署配置、数据库升级、环境变量、CI/CD 门禁及回滚方案，补 H 类「部署」缺口。
> **相关文档**: [AGENTS.md](../../AGENTS.md) §八（数据库版本管理）、[runbook.md](../explanation/runbook.md)（日常运维）、[architecture/overview.md](../explanation/overview.md)（全局架构）

---

## 1. Vite 构建产物说明

V9 使用 Vite 构建系统（`vite.config.ts`），目标 `es2022`，输出至 `dist/` 目录。

### 1.1 构建配置要点

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `target` | `es2022` | 浏览器运行时目标，支持现代 ES 特性 |
| `outDir` | `dist` | 构建产物输出目录，纳入 `.gitignore` |
| `sourcemap` | `false` | 生产环境关闭 sourcemap（调试时改为 `'hidden'`） |
| `base` | （默认 `/`） | 部署至子路径时须显式配置 `base: '/subpath/'` |

### 1.2 代码分割（manualChunks）

产物按功能分 5 个 chunk，减少首屏加载：

| Chunk | 包含依赖 | 用途 |
|-------|----------|------|
| `vendor` | react, react-dom, react-router, zustand, dayjs | 核心框架（缓存命中最高） |
| `ui` | lucide-react, clsx, tailwind-merge, @heroicons/react | UI 组件与工具 |
| `charts` | recharts, lightweight-charts | 图表库（~662 kB 独立 chunk） |
| `pdf` | jspdf, jspdf-autotable | PDF 导出（懒加载） |
| `excel` | xlsx | Excel 处理（懒加载） |

### 1.3 产物目录结构

```
dist/
├── index.html              # 入口 HTML（含注入的 script/link 标签）
├── assets/
│   ├── index-*.js          # 主入口 chunk（含 App.tsx 业务代码）
│   ├── vendor-*.js         # 框架 chunk
│   ├── ui-*.js             # UI 组件 chunk
│   ├── charts-*.js         # 图表 chunk
│   ├── pdf-*.js            # PDF 导出 chunk
│   ├── excel-*.js          # Excel 处理 chunk
│   ├── index-*.css         # Tailwind + 全局样式（含 CSS 变量）
│   └── ...（各页面/组件懒加载 chunk）
├── icons/                  # PWA 图标（源自 public/icons）
├── manifest.json           # PWA 配置
└── health-report.json      # 架构健康报告（`build:health` 生成）
```

### 1.4 构建产物验证

构建完成后必须检查：

```bash
# 1. 确认产物存在
ls -la dist/index.html dist/assets/index-*.js dist/assets/index-*.css

# 2. 确认无 sourcemap（sourcemap: false 时）
find dist/assets -name '*.js.map' | wc -l  # 期望：0

# 3. 确认 chunk 完整性（5 个 manualChunks 均存在）
ls dist/assets/vendor-*.js dist/assets/ui-*.js dist/assets/charts-*.js \
   dist/assets/pdf-*.js dist/assets/excel-*.js

# 4. 产物大小基线（TODO：架构组定义各 chunk 阈值）
# du -sh dist/assets/*-*.js | sort -rh
```

> **TODO**: 架构组补充各 chunk 大小阈值（基线 ratchet），超出阈值触发 CI 告警。

---

## 2. 静态托管配置（HashRouter 适配）

### 2.1 为什么使用 HashRouter

V9 采用 `HashRouter`（`src/App.tsx`），而非 `BrowserRouter`：

- **纯前端部署**：无服务端路由支持，部署至任意静态托管（CDN / Nginx / GitHub Pages / Vercel）
- **路径兼容性**：`/#/trading/holdings` 形式的路径不会触发服务器 404
- **IndexedDB 安全**：单 origin 下避免路径变更导致数据隔离问题

### 2.2 常见托管平台配置

#### 2.2.1 Nginx

```nginx
server {
    listen 80;
    server_name v9.local;
    root /var/www/v9/dist;
    index index.html;

    # 所有路径fallback到index.html（HashRouter 下实际上不需要，但防御性配置）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存（带 hash 的文件可长期缓存）
    location ~* \.(js|css|png|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html 不缓存（确保应用更新即时生效）
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

#### 2.2.2 Vercel / Netlify

```toml
# vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

```toml
# netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

> **HashRouter 场景下 rewrite 实际上不触发**，因为路径以 `#` 开头。但保留配置以兼容未来切换至 BrowserRouter 的扩展路径。

#### 2.2.3 GitHub Pages

GitHub Pages 天然支持单页应用（所有路径自动 fallback 到 `index.html`），无需额外配置。

### 2.3 部署子路径（非根域）

如需部署至 `https://example.com/v9/`：

1. 修改 `vite.config.ts`：`base: '/v9/'`
2. 重新构建：`npm run build`
3. 将 `dist/` 内容上传至服务器的 `/v9/` 目录

> **警告**：`base` 变更后必须全量回归测试（路由、图标路径、PWA manifest 均受影响）。

---

## 3. IndexedDB Schema 升级流程

V9 使用浏览器原生 IndexedDB 自管数据，Schema 版本由 `src/config/dbConfig.ts` 中的 `DB_VERSION` 控制。**当前版本：`27`**。

### 3.1 DB_VERSION 递增规则（AGENTS.md §八）

| 触发条件 | 动作 | 同步操作 |
|----------|------|----------|
| 新增 store（基线） | 递增 `DB_VERSION` | 在 `createSchema`（`src/data/db-schema.ts`）中添加 |
| 新增 store（增量） | 递增 `DB_VERSION` | 在对应版本 `Migration.up()`（`src/data/db-migrations.ts`）中添加 |
| 修改 store 索引 | 递增 `DB_VERSION` | 在 Migration 中执行 `deleteObjectStore` + `createObjectStore` |
| 新增 ENVELOPE_ACTION | 递增 `DB_VERSION` | 在 `DataBridge.routeToDB()` 中添加对应 case |

**铁律**：
- `DB_VERSION` 必须单调递增，**禁止回退**（浏览器会拒绝降级打开）。
- 禁止在 `createSchema` 和 `Migration.up()` 中同时添加同一 store（违反 DRY）。
- 新增 store 必须在 `STORE_NAME` 中注册，并在 `ACL_MATRIX` 中添加 read/write 白名单。

### 3.2 基线 store 与增量 store 区分

| 类型 | 创建位置 | 当前清单（示例） |
|------|----------|----------------|
| **基线 store**（首次安装即需） | `src/data/db-schema.ts` `createSchema` | stocks, v6Scores, orders, watchlists, signals, dailyQuotes, portfolios, customAgents 等（共 29 个） |
| **增量 store**（版本升级新增） | `src/data/db-migrations.ts` `Migration.up()` | rbac_users, rbac_roles, rbac_permissions, rbac_user_roles, rbac_role_permissions, rbac_permission_audit_logs（V24 新增） |

### 3.3 Schema 升级 SOP

```
1. 评估变更类型（新增 store / 修改索引 / 新增 action）
2. 在 dbConfig.ts 中递增 DB_VERSION
3. 新增 store → 判断基线/增量，选择 createSchema 或 Migration 位置
4. 在 STORE_NAME 中注册新 store
5. 在 ACL_MATRIX 中添加 read/write 白名单
6. 新增 ENVELOPE_ACTION → 在 DataBridge.routeToDB() 添加 case
7. 本地测试：Chrome DevTools → Application → IndexedDB → 确认版本与 store 列表
8. 运行 npm run audit:layers 确认无跨层违规
9. 提交前运行 pre-commit 全门禁
```

### 3.4 用户侧数据迁移

IndexedDB 升级由浏览器自动触发 `onupgradeneeded`：

- **旧数据保留**：升级逻辑必须显式迁移旧数据，禁止直接 `deleteObjectStore` 丢弃。
- **降级回滚**：若线上发现问题，**不可直接回退 DB_VERSION**。必须通过新 Migration 将 Schema 改回旧结构，并递增 DB_VERSION。

> **TODO**: 架构组补充 `db-migrations.ts` 中数据迁移的模板代码（读取旧 store → 转换 → 写入新 store）。

---

## 4. 环境变量管理

### 4.1 环境变量规则

V9 使用 Vite 环境变量系统，**所有前端可见变量必须以 `VITE_` 前缀声明**（Vite 仅暴露 `VITE_` 前缀变量到客户端）。

### 4.2 当前环境变量清单（`.env.example`）

| 变量 | 开发值 | 生产值 | 说明 |
|------|--------|--------|------|
| `VITE_DATA_SOURCE_TYPE` | `mock` | `rest` / `websocket` | 数据源类型 |
| `VITE_API_BASE_URL` | `/api` | `https://api.example.com` | REST API 基础地址 |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | `wss://api.example.com/ws` | WebSocket 地址 |
| `VITE_LLM_BASE_URL` | `https://api.deepseek.com` | （用户自配） | LLM 接口地址 |
| `VITE_LLM_MODEL` | `deepseek-chat` | （用户自配） | 默认 LLM 模型 |
| `VITE_AKSHARE_BASE_URL` | `http://localhost:8000` | （用户自配） | 本地 Python 采集服务 |

### 4.3 安全规则

- **禁止在 `.env` 中存放真实 API Key**：LLM API Key 通过 UI 配置页加密存储于 `localStorage`（`localStorageManager.setEncrypted/getEncrypted`）。
- **`VITE_` 前缀变量会暴露到前端 bundle**：任何含 `VITE_` 前缀的变量在构建后均可通过浏览器 DevTools 查看，**禁止存放敏感凭证**。
- **环境变量文件纳入 `.gitignore`**：`.env`、`.env.local`、`.env.*.local` 已配置忽略。

### 4.4 构建环境切换

```bash
# 开发环境（默认使用 .env）
npm run dev

# 生产构建（使用 .env.production 或 CI 注入）
# VITE_DATA_SOURCE_TYPE=rest npm run build
```

> **TODO**: 工程效能组补充 CI/CD 环境变量注入方案（GitHub Actions / Vercel 环境变量面板）。

---

## 5. CI/CD 门禁（Husky pre-commit / pre-push）

V9 使用 Husky v9 管理 Git 钩子，**所有代码提交和推送必须通过 12 道门禁**（pre-commit 10 道 + pre-push 2 道）。禁止 `--no-verify` 绕过。

### 5.1 pre-commit 门禁（10 道）

| 序号 | 门禁 | 命令 | 失败处置 |
|------|------|------|----------|
| 1 | lint-staged | `npx lint-staged` | 自动修复 ESLint 问题，不可自动修复的需手动修复 |
| 2 | 颜色硬编码检查 | `npm run lint:colors` | 发现 UI 层 HEX/Tailwind 颜色硬编码 → 改为令牌引用 |
| 3 | 生产类型检查 | `npm run tsc:prod` | TypeScript 错误 → 修复类型 |
| 4 | 分层调用审计 | `npm run audit:layers` | 跨层调用违规 → 调整 import 路径 |
| 5 | 原子组件边界审计 | `npm run audit:atomic` | 原子层级越界 → 调整组件位置 |
| 6 | 文件规范检查 | `npm run file:check` | 文件命名/目录违规 → 重命名或迁移 |
| 7 | 文档同步审计 | `npm run audit:docs` | 文档与代码不同步 → 补文档或回链 README |
| 8 | 设计令牌映射校验 | `npm run verify:tokens` | 令牌映射异常 → 同步 design-tokens/tokens.json |
| 9 | 令牌消费审计 | `npm run audit:tokens` | 新增令牌违规 → 使用令牌替代硬编码 |
| 10 | JSDoc 覆盖检查 | `npm run audit:jsdoc` | 新增公共函数缺 JSDoc → 补充注释（基线采集，当前不阻断） |
| 11 | 代码复杂度检查 | `npm run audit:complexity` | 深层嵌套/长链/重复条件 → 重构（基线采集，当前不阻断） |

> **注**：第 10-11 道当前为「基线采集」模式，不阻断提交，但会在 `command/health` 仪表盘展示趋势。

### 5.2 pre-push 门禁（2 道）

| 序号 | 门禁 | 命令 | 说明 |
|------|------|------|------|
| 1 | 核心单元测试 | `npm run test:clean` | 排除已知不稳定用例，确保核心功能通过 |
| 2 | 生产构建验证 | `npm run build` | 验证构建产物可成功生成 |

> `test:clean` 排除列表（`package.json` 中定义）：`agentStore.test.ts`、`fetcherClient.test.ts`、`llmClient.multimodel.test.ts`、`dataSourceProvider.test.ts`、`ui-components.test.tsx`、`agentModule.integration.test.tsx`、`engine.test.ts`、`sectorScoreService.test.ts`。这些用例在 `test:known` 中单独运行。

### 5.3 门禁配置位置

- `.husky/pre-commit` — 预提交脚本（10 道门禁）
- `.husky/pre-push` — 预推送脚本（2 道门禁）
- `.lintstagedrc` / `package.json` `lint-staged` — 暂存区文件 ESLint 配置

### 5.4 自定义 Hook 添加 SOP

新增 Git 钩子须遵循：

1. 在 `.husky/` 目录下创建脚本（如 `commit-msg`），确保 `set -e` 以错误阻断提交
2. 脚本须输出清晰的 `[序号/总数] 步骤名称` 提示
3. 在本文档「门禁列表」表中登记新增门禁
4. 更新 `../explanation/overview.md` §7 门禁数量
5. 通知全团队避免 `git commit --no-verify` 绕过

---

## 6. 生产构建 Checklist

每次发布生产版本前，由发布责任人逐项勾选：

### 6.1 代码与门禁

- [ ] **12 道门禁全绿**：pre-commit 10 道 + pre-push 2 道全部通过
- [ ] **类型检查零错误**：`npx tsc --noEmit` 通过
- [ ] **分层审计零违规**：`npm run audit:layers` 输出 `0 violations, 0 warnings`
- [ ] **颜色硬编码零违规**：`npm run lint:colors` 输出 `0 hardcoded colors`
- [ ] **文档同步零漂移**：`npm run audit:docs` 通过

### 6.2 架构健康

- [ ] **健康度达标**：`/command/health` 综合评分 ≥ 基线 93
- [ ] **7 项指标均达标**：跨层调用 0、颜色硬编码 0、深层嵌套 0、长链 0、重复条件 0、JSDoc 缺失 0、文档同步 0
- [ ] **健康报告生成**：`npm run build:health` → `public/health-report.json` 已更新

### 6.3 构建产物

- [ ] **`npm run build` 成功**：无 Rollup/Vite 构建错误
- [ ] **产物完整性**：`dist/index.html` + `dist/assets/` 存在，5 个 manualChunks 均生成
- [ ] **产物大小审计**：各 chunk 大小未超基线阈值（TODO：架构组定义阈值）
- [ ] **sourcemap 关闭**：生产构建无 `.js.map` 文件

### 6.4 数据与配置

- [ ] **DB_VERSION 检查**：若本次发布涉及 Schema 变更，确认 `DB_VERSION` 已递增且 Migration 逻辑正确
- [ ] **环境变量检查**：生产环境变量（`.env.production`）已配置，无 `VITE_` 前缀敏感凭证泄露
- [ ] **路由注册检查**：新增页面已在 `routes.ts` 和 `./06-routing-specs.md` 同步
- [ ] **PWA 配置检查**：`manifest.json` 和图标文件在 `public/` 中且被正确复制到 `dist/`

### 6.5 文档与沟通

- [ ] **CHANGELOG 更新**：根 `CHANGELOG.md` 已记录本次发布摘要
- [ ] **文档索引同步**：`docs/README.md` 已更新（如有新增文档）
- [ ] **README 回链**：本文档已回链至 `docs/README.md` H 类「运维」锚点

---

## 7. `npm run build` 产物验证

### 7.1 验证命令脚本

```bash
#!/bin/bash
# scripts/verify-build.sh — 构建产物验证（TODO：工程效能组实现）

set -e

echo "?? 验证构建产物..."

# 1. 入口文件
[ -f "dist/index.html" ] || { echo "? 缺少 dist/index.html"; exit 1; }

# 2. 主 chunk
[ -f "dist/assets/index-"*.js ] || { echo "? 缺少主 JS chunk"; exit 1; }
[ -f "dist/assets/index-"*.css ] || { echo "? 缺少主 CSS chunk"; exit 1; }

# 3. manualChunks 完整性
for chunk in vendor ui charts pdf excel; do
  [ -f "dist/assets/$chunk-"*.js ] || { echo "? 缺少 $chunk chunk"; exit 1; }
done

# 4. sourcemap 检查
if [ "$(find dist/assets -name '*.js.map' | wc -l)" -ne 0 ]; then
  echo "?? 发现 sourcemap 文件（生产应关闭）"
fi

# 5. PWA 资源
[ -f "dist/manifest.json" ] || echo "?? 缺少 manifest.json"
[ -d "dist/icons" ] || echo "?? 缺少 icons/ 目录"

echo "? 构建产物验证通过"
```

### 7.2 产物大小基线（TODO）

> **TODO**: 架构组定义各 chunk 大小阈值基线（如 `vendor < 500KB`、`index < 300KB`），存入 `.build-baseline.json`，配合 CI 自动化比对。

### 7.3 手动验证步骤

构建完成后，执行以下手动验证：

1. `npm run preview` 启动预览服务器，访问 `http://localhost:4173/`
2. 确认首页加载正常（Network 面板无 404）
3. 确认路由跳转正常（如 `/trading/holdings`、`/analysis`）
4. 确认 IndexedDB 初始化正常（DevTools → Application → IndexedDB → 版本与 store 列表正确）
5. 确认 PWA manifest 可访问（`http://localhost:4173/manifest.json`）

---

## 8. 回滚方案

### 8.1 代码回滚（Git 层面）

| 场景 | 操作 | 验证 |
|------|------|------|
| 最新提交未 push | `git reset --hard HEAD~1` | 重跑 pre-commit 门禁 |
| 已 push 到远端 | `git revert <commit>` 生成反向提交 | 重跑 pre-push 门禁（`test:clean` + `build`） |
| 紧急回滚（多提交） | `git revert <oldest>^..<newest>` | 全量回归测试（L3 套件） |

回滚后必须执行（AGENTS.md §二）：

```bash
npx tsc --noEmit              # 类型安全
npm run audit:docs            # 文档同步
npm run audit:layers          # 跨层违规
npm run test -- --run         # 单元测试
```

### 8.2 构建产物回滚（部署层面）

```bash
# 1. 回退到上一个稳定版本的 Git 标签
git checkout <last-stable-tag>

# 2. 重新构建
npm ci && npm run build

# 3. 替换服务器 dist/ 目录（rsync/scp）
rsync -avz --delete dist/ user@server:/var/www/v9/

# 4. 验证：访问首页 → 确认版本号（如有）
```

### 8.3 IndexedDB 数据回滚（?? 高风险）

IndexedDB **不支持直接回滚版本**。若 Schema 升级导致数据损坏：

1. **不降级 DB_VERSION**（浏览器拒绝打开低版本数据库）
2. **编写修复 Migration**：在 `db-migrations.ts` 中新增高版本 Migration，将异常数据修复或迁移回旧结构
3. **极端情况**：引导用户「清除浏览器数据 → 重新初始化」（数据丢失，仅作最后手段）

> **TODO**: 架构组制定 IndexedDB 数据备份/恢复策略（如导出 JSON 备份、定期快照）。

### 8.4 文档回滚

- 文档回滚不归此方案管辖，参见 `../00-meta/governance.md` §3「文档生命周期」：标记 `DEPRECATED_` → 迁入 `docs/07-archive/` → 保留期 6 月。

---

## 9. 相关文档与引用

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `../../AGENTS.md` | 工程分层契约、数据库版本管理 §八、回滚验证流程 §二 |
| 运维手册 | [runbook.md](../explanation/runbook.md) | 日常运维、故障处置、健康监控 |
| 全局架构 | [architecture/overview.md](../explanation/overview.md) | 分层架构、数据流、三级加载链 |
| 文档治理 | [governance.md](../00-meta/governance.md) | 文档生命周期、保鲜规则、DoD |
| 路由规格 | [02-design/06-routing-specs.md](../explanation/design/06-routing-specs.md) | 路由注册、三级加载链详细规格 |
| 引擎规格 | [02-design/05-engine-specs.md](05-engine-specs.md) | L0-L8 引擎分层、确定性层定义 |

---

_本文档由文档治理整改（P1）创建，基于 AGENTS.md v1.4.3 与项目实际构建配置编写。待 TODO 项由架构组/工程效能组逐步补全后，由 docs 治理组审核并标记 status: ready。_
