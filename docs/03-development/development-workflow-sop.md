# V9 智能投研复盘系统 — 开发工作流 SOP

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: 所有 FinSightV9 开发者（AI 辅助 + 人工编码）
> **关联文档**: AGENTS.md v1.4.5 | ARCHITECTURE.md | CHANGELOG.md

---

## 一、工作流总览

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 编码前（查询 → 设计 → 验证基线）                   │
│    ↓ 查询 AI 记忆 / 运行架构审计 / 确认四步集成顺序            │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: 编码中（开发 → 实时纠偏 → 本地测试）               │
│    ↓ 分层守护 / 颜色令牌 / JSDoc 补齐 / 复杂度监控            │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: 编码后（提交 → 门禁验证 → 覆盖率追踪）              │
│    ↓ Husky 14 步门禁 / 测试分层 / 文档同步                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Phase 1: 编码前（Prevent Errors）

### 2.1 查询 AI 记忆索引

```bash
# 查询是否有人处理过类似问题（避免重复踩坑）
node node_modules/tsx/dist/cli.mjs scripts/query-ai-memory.ts "widget 注册"
node node_modules/tsx/dist/cli.mjs scripts/query-ai-memory.ts "跨层调用"
```

**何时使用**：
- 准备新建 Widget / Store / Service 时
- 遇到不明所以的 lint/type 错误时
- 接手他人遗留代码时

### 2.2 确认基线绿

任何编码前，先确认当前分支基线全绿（≤ 30 秒）：

```bash
# 快速健康检查（只跑最严格的 4 项）
node node_modules/typescript/bin/tsc --noEmit && \
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts && \
node node_modules/tsx/dist/cli.mjs scripts/audit-mcp.ts && \
node node_modules/tsx/dist/cli.mjs scripts/audit-widget-registry.ts
```

**如果基线不绿**：先修复，再开始新功能开发。禁止在红牌基线上叠加新代码。

### 2.3 四步集成检查清单（新建模块必做）

新模块严禁直接在 `pages/` 或 `components/` 下新建孤立文件，必须按顺序：

| 步骤 | 目录 | 交付物 | 验证命令 |
|------|------|--------|----------|
| 1. 类型定义 | `src/types/modules/` 或 `src/data/types.ts` | Interface / Type | `npx tsc --noEmit` |
| 2. Store/状态 | `src/store/` | Zustand Store + `withBroadcast` | `vitest run` |
| 3. Builder/适配 | `src/services/` | Service + DataBridge 写入 | `audit:layers` |
| 4. UI 集成 | `src/pages/` 或 `src/components/` | 仅通过 Store 获取数据 | `audit:atomic` |

**一键生成 Widget（第 4 步辅助）**：
```bash
node node_modules/tsx/dist/cli.mjs scripts/scaffold-widget.ts
```

---

## 三、Phase 2: 编码中（Real-time Guardrails）

### 3.1 分层守护（最核心）

每次修改 import 路径后，手动触发：

```bash
# 扫描 877 个文件，0.1 秒出结果
node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts
```

**依赖方向规则速查表**（来自 AGENTS.md §一）：

```
pages/ + components/  →  store/ + services/（禁止直接调用 dataLayer/db）
store/                  →  services/ + core/
services/               →  core/ + data/ + lib/（白名单基础设施）
lib/                    →  core/ + config/（禁止依赖 services/store/pages）
core/                   →  禁止依赖 pages/components/apps/lib/
config/                 →  禁止依赖 services/pages/components/lib/
```

### 3.2 颜色令牌实时检查

```bash
# 只扫描你正在编辑的文件（3 秒）
npx eslint --config eslint.colors.config.js src/components/YourComponent.tsx
```

**禁止清单**：
- ❌ `text-red-500`、`bg-blue-100`、`#ef4444`、`border-gray-300`
- ✅ 使用 `COLOR_TOKENS` / `COLOR_SHADES` / `THEME_TOKENS` / `chartColors.ts`

**例外**：股票涨跌颜色（红涨绿跌）使用 `STOCK_COLOR_TOKENS`，豁免主题切换。

### 3.3 JSDoc 自动补齐

```bash
# 批量为新增函数补 JSDoc（5 秒）
node node_modules/tsx/dist/cli.mjs scripts/auto-fix-jsdoc.ts
```

**JSDoc 强制项**：
- 所有新增公共函数、组件、Hook、Store
- 复杂泛型必须有 `@template` 说明
- 参数/返回值类型必须有 `@param` / `@returns`

### 3.4 复杂度实时监控

```bash
# 扫描当前代码复杂度，超过阈值会标红
node node_modules/tsx/dist/cli.mjs scripts/complexity-scan.ts
```

**阈值规则**：
- 禁止深层嵌套（> 4 层）
- 禁止长链式条件（> 3 个 `&&`/`||`）
- 禁止过长函数（> 100 行）

---

## 四、Phase 3: 编码后（Commit & Quality Gates）

### 4.1 Husky 预提交 14 步门禁

```bash
git add -A && git commit -m "feat(scope): 描述"
```

门禁自动运行（按顺序，任意一步失败即阻断）：

| 步骤 | 门禁名称 | 目的 | 阻断性 |
|------|----------|------|--------|
| 1 | lint-staged | 暂存区 ESLint --fix | ✅ 阻断 |
| 2 | lint:colors | 颜色硬编码扫描 | ✅ 阻断 |
| 3 | tsc:prod | TypeScript 零错误 | ✅ 阻断 |
| 4 | audit:layers | 跨层调用检查 | ✅ 阻断 |
| 5 | audit:atomic | 原子组件边界 | ✅ 阻断 |
| 6 | file:check | 文档规范检查 | ✅ 阻断 |
| 7 | audit:docs | 代码-文档同步 | ✅ 阻断 |
| 8 | verify:tokens | 设计令牌映射 | ✅ 阻断 |
| 9 | audit:tokens | 令牌消费检查 | ✅ 阻断 |
| 10 | audit:jsdoc | JSDoc 覆盖（基线采集） | ⚠️ 警告 |
| 11 | audit:complexity | 代码复杂度（基线采集） | ⚠️ 警告 |
| 12 | audit:widget-registry | Widget 三处注册一致性 | ✅ 阻断 |
| 13 | audit:ai-output | AI 输出三道校验 | ✅ 阻断 |
| 14 | audit:path-match | 文档目录-内容匹配 | ⚠️ 警告 |

**如果门禁失败**：
1. 不要 `--no-verify` 跳过（除非修复的是门禁本身的问题）
2. 阅读错误信息，修复对应文件
3. 重新 `git add` 并提交

### 4.2 测试分层策略

| 层级 | 测试类型 | 范围 | 运行命令 | 目标覆盖率 |
|------|----------|------|----------|------------|
| L1 | 单元测试 | 函数/纯逻辑 | `vitest run --reporter=verbose` | ≥ 80% |
| L2 | 集成测试 | 跨模块交互 | `vitest run src/mcp/__tests__/` | ≥ 60% |
| L3 | E2E 测试 | 用户操作流程 | `playwright test` | 关键路径覆盖 |
| L4 | 崩溃恢复 | 模拟进程中断 | 手动 + 脚本验证 | 核心数据不丢 |
| L5 | 门禁回归 | tsc + audit + lint | `npm run regression` | 100% 通过 |

**快速测试（仅运行与你修改相关的测试）**：
```bash
node node_modules/vitest/vitest.mjs related --run
```

**全量测试（提交前必做）**：
```bash
node node_modules/vitest/vitest.mjs run
```

### 4.3 覆盖率追踪

```bash
# 生成覆盖率报告
node node_modules/vitest/vitest.mjs run --coverage

# 查看历史趋势
node node_modules/tsx/dist/cli.mjs scripts/audit-tests.ts
```

**当前基线**：330 个测试文件（194 在 src/，136 在 tests/），目标持续增加。

---

## 五、高频命令速查表

### 5.1 开发日常（每日 ≥ 5 次）

| 命令 | 耗时 | 用途 |
|------|------|------|
| `node node_modules/typescript/bin/tsc --noEmit` | ~10s | 类型检查 |
| `node node_modules/tsx/dist/cli.mjs scripts/audit-layer-calls.ts` | ~0.1s | 分层审计 |
| `npx eslint --config eslint.colors.config.js src/...` | ~3s | 颜色合规 |
| `node node_modules/vitest/vitest.mjs related --run` | ~2s | 相关测试 |
| `node node_modules/tsx/dist/cli.mjs scripts/complexity-scan.ts` | ~2s | 复杂度扫描 |

### 5.2 提交前（每次 commit 前）

| 命令 | 耗时 | 用途 |
|------|------|------|
| `git add -A && git commit -m "..."` | ~30s-2min | 触发全部 14 步门禁 |
| `node node_modules/vitest/vitest.mjs run` | ~10s | 全量测试 |

### 5.3 定期维护（每周/每月）

| 命令 | 频率 | 用途 |
|------|------|------|
| `node node_modules/tsx/dist/cli.mjs scripts/audit-dead-code.ts` | 每周 | 死代码清理 |
| `node node_modules/tsx/dist/cli.mjs scripts/audit-mcp.ts` | 每次 MCP 变更 | Server 利用率 |
| `node node_modules/tsx/dist/cli.mjs scripts/audit-widget-registry.ts` | 每次 Widget 变更 | 注册一致性 |
| `node node_modules/tsx/dist/cli.mjs scripts/anomaly-detector.ts` | 每周 | 质量异常检测 |
| `node node_modules/tsx/dist/cli.mjs scripts/build-health-report.ts` | 每月 | 构建健康报告 |

---

## 六、特殊场景处理

### 6.1 门禁脚本本身出错（如 `verify:tokens` 脚本崩溃）

**原则**：门禁脚本的 bug 不应阻断业务代码提交。

**处理流程**：
1. 确认错误是脚本问题而非代码问题（查看错误堆栈）
2. 修复脚本或临时从 `.husky/pre-commit` 中注释掉该步骤
3. 提交修复脚本的 PR
4. 恢复门禁步骤

### 6.2 紧急修复（hotfix）

```bash
# 在明确知道后果的情况下，可跳过门禁
git commit --no-verify -m "hotfix(scope): 紧急修复描述"
# 但必须在 24 小时内补回门禁验证
```

### 6.3 AI 辅助编码时的注意事项

1. **AI 生成代码后，必须运行 `audit:layers`** — AI 容易误写跨层 import
2. **AI 修改颜色后，必须运行 `lint:colors`** — AI 容易硬编码 Tailwind 颜色
3. **AI 新增函数后，必须运行 `audit:jsdoc`** — AI 生成的 JSDoc 经常不完整
4. **AI 重构后，必须运行 `audit:widget-registry`** — AI 容易漏注册 Widget

---

## 七、工具链地图

```
代码质量
  ├── TypeScript: tsc --noEmit
  ├── ESLint: eslint + eslint.colors.config.js
  ├── Complexity: scripts/complexity-scan.ts
  └── JSDoc: scripts/auto-fix-jsdoc.ts + audit-jsdoc.ts

架构守护
  ├── 分层: scripts/audit-layer-calls.ts
  ├── 原子: scripts/audit-atomic.ts
  ├── MCP: scripts/audit-mcp.ts
  └── Widget: scripts/audit-widget-registry.ts

测试
  ├── 单元/集成: vitest
  ├── E2E: playwright
  ├── 覆盖率: vitest --coverage
  └── 回归: npm run regression

文档
  ├── 同步: scripts/audit-doc-sync.ts
  ├── 规范: scripts/check-docs.ts
  ├── 版本: scripts/audit-version-drift.ts
  └── 路径: scripts/audit-path-match.ts

AI 辅助
  ├── 记忆: scripts/query-ai-memory.ts
  ├── 脚手架: scripts/scaffold-widget.ts
  └── 异常: scripts/anomaly-detector.ts
```

---

## 八、更新与维护

- **本 SOP 版本**与 **AGENTS.md 版本**绑定，AGENTS.md 升级时同步修订
- **新增门禁步骤** → 更新 §4.1 表格
- **新增脚本** → 更新 §5 速查表和 §7 工具链地图
- **变更提交流程** → 需经过 `audit:docs` 验证文档同步

---

> **最后验证**：本文档生成后，运行以下命令确认 SOP 与当前工具链一致：
> ```bash
> node node_modules/tsx/dist/cli.mjs scripts/check-docs.ts && \
> node node_modules/tsx/dist/cli.mjs scripts/audit-doc-sync.ts
> ```
