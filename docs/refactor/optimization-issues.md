# FinSightV9 技术债优化建议 — GitHub Issues 任务描述

| 字段 | 值 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-08-04 |
| Issue 总数 | 10 个（P0: 3 / P1: 4 / P2: 3） |
| 上游报告 | [2026-08-04-tech-debt-remediation-report.md](./reports/2026-08-04-tech-debt-remediation-report.md) §4 |
| 重构方案 | [p0-refactor-plan.md](./p0-refactor-plan.md) |

---

## 使用说明

每个 Issue 已按 GitHub Markdown 格式编写，可直接复制到 GitHub Issue 创建页面。建议使用 `gh issue create` 命令批量创建：

```bash
# 示例：创建 Issue #1
gh issue create \
  --title "[P0] 建立类型契约三方同步机制" \
  --label "P0,tech-debt,refactor" \
  --assignee @TBD \
  --body-file docs/refactor/issue-01-body.md
```

---

## Issue #1 [P0] 建立类型契约三方同步机制

**Labels**: `P0` `tech-debt` `refactor` `governance`
**Milestone**: 技术债治理 Sprint 1
**Estimate**: 9 hours
**Dependencies**: 无

### 背景

本次技术债修复中 32% 的错误源于"类型契约漂移"——类型定义更新后，mock 数据、测试用例、调用方未同步更新。典型案例：
- `widget.types.ts` 放宽 `price` 为 `number | undefined` 后，`WatchlistWidget` 未同步
- `ProfileItem` 新增 `sentiment`/`relatedLayers` 字段后，`profileService.test.ts` mock 未补
- `PortfolioHolding` 放宽为可选后，`CoreResourcePanel` 未处理空值

### 任务描述

建立类型契约三方同步机制，从规范文档、本地门禁、CI 流水线三个层面强制类型变更时同步更新调用方与测试。

### 验收标准 (Acceptance Criteria)

- [ ] `CONTRIBUTING.md` 新增 §3.4 "类型变更三同步规则"章节，明确三方定义与同步要求
- [ ] PR 模板 (`.github/pull_request_template.md`) 新增 checkbox："✅ 已确认类型变更三方同步"
- [ ] `.husky/pre-commit` 增强：检测到 `src/types/**/*.ts` 变更时自动触发 `npm run tsc:test`
- [ ] `lint-staged` 配置：对 `src/types/**` 变更触发 `npm run tsc:prod`
- [ ] GitHub Actions 新增 `types-check` Job（独立于 unit-test Job）
- [ ] 分支保护规则将 `types-check` 设为必需状态检查
- [ ] 端到端验证：故意制造类型漂移（修改 `widget.types.ts` 不更新调用方），CI 阻断合并

### 关联文件

- `CONTRIBUTING.md`
- `.github/pull_request_template.md`
- `.husky/pre-commit`
- `.github/workflows/ci.yml`

### 详细方案

见 [p0-refactor-plan.md §一](./p0-refactor-plan.md#一p0-a类型契约三方同步机制)

---

## Issue #2 [P0] ESLint no-unsafe-member-access 升级为 error

**Labels**: `P0` `tech-debt` `lint` `type-safety`
**Milestone**: 技术债治理 Sprint 1
**Estimate**: 16 hours
**Dependencies**: 无

### 背景

本次修复中 14% 的错误是 `unknown` 类型防御不足导致。当前 ESLint 配置中 `@typescript-eslint/no-unsafe-member-access` 为 `warn` 级别，不阻断提交，导致历史 `unsafe` 用法持续累积。

### 任务描述

将 `@typescript-eslint/no-unsafe-*` 系列 5 个规则升级为 `error` 级别，配套批量修复历史违规用法，强制新代码必须防御性处理 `unknown` 类型。

### 验收标准 (Acceptance Criteria)

- [ ] 生成 `docs/reports/eslint-unsafe-baseline.md` 基线报告，包含按目录分类统计
- [ ] 编写 `scripts/audit/fix-unsafe-member-access.cjs` 自动修复脚本，支持 `--dry-run` 与 `--execute` 模式
- [ ] 分批修复至少 60% 的 `unsafe` 用法（按目录分批，每批 ≤ 20 文件）
- [ ] 每批提交后 `npm run test` 全部通过
- [ ] `eslint.config.js` 中以下 5 个规则均升级为 `error`：
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-argument`
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-call`
  - `@typescript-eslint/no-unsafe-return`
- [ ] `package.json` 的 `lint` 脚本将 `--max-warnings 2000` 改为 `--max-warnings 0`
- [ ] 复杂用例（第三方 API 响应、动态数据结构）有明确处理策略（Zod 校验/类型守卫/eslint-disable 带理由）
- [ ] CI lint Job 通过

### 关联文件

- `eslint.config.js`
- `package.json`
- `src/services/fetcher/**`（第三方 API 响应层）
- `src/services/scoring/v6-engine/enhancer.ts`（已知违规重灾区）

### 详细方案

见 [p0-refactor-plan.md §二](./p0-refactor-plan.md#二p0-beslint-no-unsafe-member-access-升级为-error)

---

## Issue #3 [P0] 安全格式化工具统一收口

**Labels**: `P0` `tech-debt` `refactor` `financial-safety`
**Milestone**: 技术债治理 Sprint 1
**Estimate**: 21 hours
**Dependencies**: 无

### 背景

本次修复发现 `safeFormatNumber` 在多个 Widget 组件中被错误调用。当前状态：
- ✅ API 入口已收口：`src/lib/format.ts` re-export `safeFormat.ts` 的 4 个函数
- ✅ 4 个文件已正确使用：WatchlistWidget / MarketIndicesWidget / CoreResourcePanel / ScoreSnapshot
- ❌ **100 个文件仍直接调用 `.toFixed()`**，存在运行时 TypeError 风险

典型问题：`src/components/cabin/ScoreItem.tsx` 中 `score.toFixed(2)` 当 `score` 为 `null` 会抛出 `TypeError`。

### 任务描述

完成 `.toFixed()` 调用的全面迁移，编写 ESLint 自定义规则禁止金融数据展示目录直接调用 `.toFixed()`，并补全 `safeFormat` 工具函数的边界用例测试。

### 验收标准 (Acceptance Criteria)

- [ ] 编写 `scripts/audit/scan-tofixed-usage.cjs` 扫描脚本，输出 `docs/reports/tofixed-migration-audit.md` 分类报告
- [ ] 100 个 `.toFixed()` 文件完成分类：`MUST_MIGRATE` / `SHOULD_MIGRATE` / `OPTIONAL`
- [ ] 所有 `MUST_MIGRATE` 类文件（金融数据展示，约 60-70 个）迁移到 `safeFormatNumber`/`safeFormatPercent`
- [ ] 所有 `SHOULD_MIGRATE` 类文件（图表 tooltip，约 20-30 个）迁移到 `safeFormatNumber`
- [ ] 编写 `scripts/quality/eslint-plugin-no-raw-tofixed.js` 自定义 ESLint 规则
- [ ] 规则在 `src/components` / `src/cockpit` / `src/apps` 目录生效
- [ ] 规则单元测试覆盖至少 5 个用例（正例/反例/边界）
- [ ] 在 `src/lib/format.test.ts` 补充 6 种边界用例：null/undefined/NaN/Infinity/负数/大数
- [ ] `src/lib/safeFormat.ts` 行覆盖率 100%、分支覆盖率 100%
- [ ] 端到端验证：`npm run lint && npm run tsc:prod && npm run tsc:test && npm run test` 全绿

### 关联文件

- `src/lib/format.ts`（API 入口）
- `src/lib/safeFormat.ts`（实现模块）
- `src/lib/format.test.ts`（单元测试）
- `src/components/cabin/ScoreItem.tsx`（典型违规）
- `src/components/chart/**`（图表组件）
- `eslint.config.js`（规则注册）

### 详细方案

见 [p0-refactor-plan.md §三](./p0-refactor-plan.md#三p0-c安全格式化工具统一收口)

---

## Issue #4 [P1] 修复 12 个预存失败测试

**Labels**: `P1` `tech-debt` `test`
**Milestone**: 技术债治理 Sprint 2
**Estimate**: 16 hours
**Dependencies**: 无

### 背景

当前测试通过率 99.86%（8717/8751），但有 12 个失败用例需单独排查。失败用例均为预存问题，与本次技术债修复无关。

### 失败测试清单

| # | 测试文件 | 失败用例数 | 失败原因摘要 |
|---|---------|----------|------------|
| 1 | `tests/e2e-verify-25stocks.integration.test.ts` | 1 | 池流转率断言（expected 100, received 0）— 需真实数据 |
| 2 | `src/services/useCase/generateTradeReview.useCase.test.ts` | 1 | useCase 边界条件断言 |
| 3 | `tests/__tests__/scripts/audit-dead-code.test.ts` | 1 | 白名单基线漂移 |
| 4 | `src/services/fetcher/fetcherClient.test.ts` | 1 | checkFetcherHealth mock 配置 |
| 5 | `tests/ui-components.test.tsx` | 3 | Toggle 组件 onPressedChange/variant/size 断言 |
| 6 | `src/mcp/__tests__/servers.test.ts` | 1 | DataFetcherServer.listTools |
| 7 | `tests/sevenDimConfig.integration.test.tsx` | 1 | checkbox 角色查找失败（UI 重构） |
| 8 | `src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx` | 2 | KPI 负值渲染断言 |
| 9 | `tests/__tests__/scripts/daily-doc-validation.test.ts` | 1 | doc-cross-ref-sync 基线漂移 |

### 任务描述

逐个排查并修复 12 个预存失败测试用例，使测试通过率达到 100%。对于无法修复的（如需真实数据的 e2e 测试），按项目记忆约束标记 `describe.skip` 并配 `DEBT-FROZEN-Px` 还款计划。

### 验收标准 (Acceptance Criteria)

- [ ] `tests/ui-components.test.tsx` 的 3 个 Toggle 用例修复（断言对齐当前组件 API）
- [ ] `tests/sevenDimConfig.integration.test.tsx` 的 checkbox 角色查找修复（UI 重构后角色变更）
- [ ] `src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx` 的 2 个 KPI 用例修复
- [ ] `src/services/useCase/generateTradeReview.useCase.test.ts` 边界条件修复
- [ ] `tests/__tests__/scripts/audit-dead-code.test.ts` 白名单基线更新
- [ ] `tests/__tests__/scripts/daily-doc-validation.test.ts` doc-cross-ref-sync 基线更新
- [ ] `src/services/fetcher/fetcherClient.test.ts` mock 配置修复
- [ ] `src/mcp/__tests__/servers.test.ts` DataFetcherServer.listTools 修复
- [ ] `tests/e2e-verify-25stocks.integration.test.ts` 标记 `describe.skip` + `FROZEN` 时间戳 + `DEBT-FROZEN-P1` 还款计划
- [ ] `npm run test` 通过率达到 100%（排除 FROZEN 用例）

### 关联文件

见上表

---

## Issue #5 [P1] 引入类型测试单独提取模式

**Labels**: `P1` `tech-debt` `test` `type-safety`
**Milestone**: 技术债治理 Sprint 2
**Estimate**: 6 hours
**Dependencies**: 无

### 背景

本次 `tests/__tests__/types/profile-types.spec.ts` 暴露了类型测试与单元测试混在一起的问题。类型测试（编译期断言）与运行时单元测试（vitest）执行机制不同，混在一起会导致：
- CI 难以单独阻断类型回归
- 类型测试失败被运行时测试通过掩盖
- 类型测试无法独立加速

### 任务描述

将类型测试从单元测试中分离，建立独立的类型测试目录、脚本、CI Job，使类型回归在合并前被发现。

### 验收标准 (Acceptance Criteria)

- [ ] 类型测试统一放置在 `tests/__tests__/types/*.spec.ts` 目录
- [ ] 现有 `tests/__tests__/types/profile-types.spec.ts` 已在该目录（确认）
- [ ] 扫描全项目其他位置的类型测试（如 `src/**/*.spec.ts` 中包含 `assertNever`/`Equals`/`isXxx`），迁移到该目录
- [ ] `package.json` 新增 `test:types` 脚本：`vitest run tests/__tests__/types/`
- [ ] GitHub Actions 新增 `types-test` Job，独立于 `unit-test` Job
- [ ] 分支保护规则将 `types-test` 设为必需状态检查
- [ ] 在 `docs/guidelines/` 添加类型测试编写规范

### 关联文件

- `tests/__tests__/types/profile-types.spec.ts`
- `package.json`
- `.github/workflows/ci.yml`

---

## Issue #6 [P1] Docker 构建链补齐

**Labels**: `P1` `tech-debt` `devops` `docker`
**Milestone**: 技术债治理 Sprint 2
**Estimate**: 5 hours
**Dependencies**: 无

### 背景

本次创建了 `Dockerfile.prod` + `nginx.conf` + `.dockerignore`，但本机无 Docker 无法验证。生产部署链路需要 CI 自动化验证，避免配置漂移。

### 任务描述

在 GitHub Actions 中添加 Docker 镜像构建 Job，每次 PR 自动构建并验证镜像可启动，添加镜像大小基线检查与 staging smoke test。

### 验收标准 (Acceptance Criteria)

- [ ] GitHub Actions 新增 `docker-build` Job：每次 PR 自动执行 `docker build -f Dockerfile.prod .`
- [ ] Job 验证镜像启动后 `/healthz` 返回 200
- [ ] 添加镜像大小基线检查：镜像 > 200MB 时报警（不阻断，仅 warning）
- [ ] 部署到 staging 后运行 smoke test：`curl /healthz` 返回 200，`curl /` 返回 HTML 含 `<div id="root">`
- [ ] `Dockerfile.prod` 添加 `LABEL` 元数据（version/build-date/git-sha）
- [ ] 在 `docs/guides/` 添加 Docker 部署指南

### 关联文件

- `Dockerfile.prod`
- `nginx.conf`
- `.dockerignore`
- `.github/workflows/ci.yml`

---

## Issue #7 [P1] mock 数据集中管理

**Labels**: `P1` `tech-debt` `test` `refactor`
**Milestone**: 技术债治理 Sprint 2
**Estimate**: 10 hours
**Dependencies**: Issue #1（类型契约三方同步机制）

### 背景

本次多处测试文件需要补全 mock 字段（如 `ProfileItem` 加 `sentiment`/`relatedLayers`，`Order` 加新字段，`CollectionConfig` 完整字段），散落维护成本高。每次类型变更需修改 N 个测试文件的 mock。

### 任务描述

将散落在测试文件中的 mock 对象集中到 `tests/fixtures/` 目录，建立类型安全的 fixture 工厂，类型变更时只需修改 fixture，所有测试自动同步。

### 验收标准 (Acceptance Criteria)

- [ ] 建立 `tests/fixtures/` 目录结构：
  - `tests/fixtures/profile.ts` — `ProfileItem` / `StockProfile` 工厂
  - `tests/fixtures/order.ts` — `Order` / `TradeRecord` 工厂
  - `tests/fixtures/collection.ts` — `CollectionConfig` / `AddStockInput` 工厂
  - `tests/fixtures/portfolio.ts` — `PortfolioHolding` / `Portfolio` 工厂
  - `tests/fixtures/index.ts` — 统一导出
- [ ] 每个工厂函数返回类型与 `src/types/**` 严格对齐
- [ ] 提供 `createXxx(overrides?: Partial<Xxx>)` 签名，支持部分覆盖
- [ ] 迁移至少 10 个测试文件使用 fixture（优先迁移本次修复涉及的文件）
- [ ] 添加 fixture 单元测试：验证每个工厂返回值符合类型契约
- [ ] 在 `docs/guides/` 添加 fixture 编写规范

### 关联文件

- `tests/services/profileService.test.ts`
- `tests/__tests__/services/trading-use-cases.test.ts`
- `tests/__tests__/integration/infrastructure-extreme.test.ts`
- `src/data/types/types.profile.ts`
- `src/data/types/types.portfolio.ts`

---

## Issue #8 [P2] 类型定义文档化

**Labels**: `P2` `tech-debt` `docs` `type-safety`
**Milestone**: 技术债治理 Sprint 3
**Estimate**: 12 hours
**Dependencies**: 无

### 背景

`src/types/modules/*.types.ts` 中的类型定义缺乏 JSDoc 注释，新成员难以理解每个字段的业务含义、可选性原因、上游数据源。本次修复中多次出现"为什么这个字段是可选的"疑问。

### 任务描述

为 `src/types/modules/*.types.ts` 添加完整 JSDoc 注释，使用 `typedoc` 生成类型文档并发布到 GitHub Pages，建立类型文档与代码同步更新机制。

### 验收标准 (Acceptance Criteria)

- [ ] 为以下核心类型文件添加 JSDoc 注释：
  - `src/types/modules/widget.types.ts`（每个字段说明业务含义 + 可选性原因）
  - `src/types/modules/collection.types.ts`
  - `src/data/types/types.profile.ts`
  - `src/data/types/types.portfolio.ts`
- [ ] 注释模板包含：`@description` / `@example` / `@see`（关联文档）
- [ ] 可选字段必须说明"为何可选"（上游数据源可能不返回 / 用户可空 / 计算字段）
- [ ] 集成 `typedoc` 到 `package.json`：`"docs:types": "typedoc --out docs/api-types src/types"`
- [ ] GitHub Actions 添加 `docs-publish` Job：推送 `docs/api-types` 到 GitHub Pages
- [ ] 文档生成脚本在 CI 中验证（确保新增类型必有注释）

### 关联文件

- `src/types/modules/widget.types.ts`
- `src/types/modules/collection.types.ts`
- `src/data/types/types.profile.ts`
- `src/data/types/types.portfolio.ts`
- `package.json`

---

## Issue #9 [P2] 提交门禁增强

**Labels**: `P2` `tech-debt` `governance` `git`
**Milestone**: 技术债治理 Sprint 3
**Estimate**: 6 hours
**Dependencies**: Issue #1（类型契约三方同步机制）

### 背景

项目记忆已记录多项提交门禁约束（如 `git add -A` 禁用、`git commit --only` 关键提交、暂存文件数验证），但这些约束尚未自动化执行，依赖人工记忆。

### 任务描述

将项目记忆中的提交门禁约束自动化，通过 pre-commit hook 与 lint-staged 配置强制执行，减少人为失误。

### 验收标准 (Acceptance Criteria)

- [ ] `.husky/pre-commit` 添加暂存文件数验证：`git diff --cached --name-only | wc -l` 与目标数比对
- [ ] 暂存文件数超过阈值（如 30）时 warning 提示
- [ ] 检测到跨目录混合提交时阻断（如 `src/` 与 `docs/` 同时变更）
- [ ] 检测到 `git add -A` 模式（暂存区包含 .env / credentials）时阻断
- [ ] 关键目录（`src/lib/format.ts`、`src/types/**`）变更触发关联回归测试
- [ ] 在 `docs/guides/` 添加提交门禁使用指南
- [ ] 提供 `--no-verify` 逃生口文档（仅在紧急情况使用，需 PR Review 备注）

### 关联文件

- `.husky/pre-commit`
- `.lintstagedrc`
- `package.json`
- `scripts/git/`（新增门禁脚本目录）

---

## Issue #10 [P2] 财务字段空安全自动化检测

**Labels**: `P2` `tech-debt` `lint` `financial-safety`
**Milestone**: 技术债治理 Sprint 3
**Estimate**: 8 hours
**Dependencies**: Issue #3（安全格式化工具统一收口）

### 背景

项目记忆已记录"财务字段必须使用 `safeFormatNumber`，禁止直接 `.toFixed()`"，但缺少自动化检测。本次修复中发现 `WatchlistWidget` 等组件仍直接调用 `.toFixed()`，存在运行时 TypeError 风险。

### 任务描述

编写 ESLint 自定义规则 `v9/no-raw-tofixed-for-financial-fields`，针对 `price/change/changePercent/score/volume/amount` 等财务字段强制使用 `safeFormatNumber`，并通过单元测试覆盖 6 种边界用例。

### 验收标准 (Acceptance Criteria)

- [ ] 编写 ESLint 自定义规则 `scripts/quality/eslint-plugin-no-raw-tofixed-financial.js`
- [ ] 规则识别财务字段模式：变量名为 `price|change|changePercent|score|volume|amount|amount|turnover|pe|pb` 等
- [ ] 当检测到 `financialField.toFixed(N)` 时报错："财务字段 {{field}} 必须使用 safeFormatNumber"
- [ ] 规则支持配置：自定义财务字段列表、白名单目录
- [ ] 单元测试覆盖 6 种边界用例：
  - 财务字段直接 `.toFixed()` → error
  - 财务字段经 `isValidNumber` 守卫后 `.toFixed()` → pass
  - 财务字段经 `safeFormatNumber` 包装 → pass
  - 非财务字段 `.toFixed()` → pass
  - 计算表达式 `(a + b).toFixed()` → pass
  - 数字字面量 `.toFixed()` → pass
- [ ] 规则注册到 `eslint.config.js`，在 `src/components` / `src/cockpit` / `src/apps` 生效
- [ ] 规则文档添加到 `docs/guidelines/eslint-rules.md`

### 关联文件

- `scripts/quality/eslint-plugin-no-raw-tofixed-financial.js`
- `eslint.config.js`
- `src/lib/safeFormat.ts`
- `docs/guidelines/eslint-rules.md`

---

## 附录：Issue 创建命令汇总

```bash
# 批量创建 Issue（需先准备每个 Issue 的 body 文件）
gh issue create --title "[P0] 建立类型契约三方同步机制" --label "P0,tech-debt,refactor,governance" --milestone "技术债治理 Sprint 1" --body-file issue-01.md
gh issue create --title "[P0] ESLint no-unsafe-member-access 升级为 error" --label "P0,tech-debt,lint,type-safety" --milestone "技术债治理 Sprint 1" --body-file issue-02.md
gh issue create --title "[P0] 安全格式化工具统一收口" --label "P0,tech-debt,refactor,financial-safety" --milestone "技术债治理 Sprint 1" --body-file issue-03.md
gh issue create --title "[P1] 修复 12 个预存失败测试" --label "P1,tech-debt,test" --milestone "技术债治理 Sprint 2" --body-file issue-04.md
gh issue create --title "[P1] 引入类型测试单独提取模式" --label "P1,tech-debt,test,type-safety" --milestone "技术债治理 Sprint 2" --body-file issue-05.md
gh issue create --title "[P1] Docker 构建链补齐" --label "P1,tech-debt,devops,docker" --milestone "技术债治理 Sprint 2" --body-file issue-06.md
gh issue create --title "[P1] mock 数据集中管理" --label "P1,tech-debt,test,refactor" --milestone "技术债治理 Sprint 2" --body-file issue-07.md
gh issue create --title "[P2] 类型定义文档化" --label "P2,tech-debt,docs,type-safety" --milestone "技术债治理 Sprint 3" --body-file issue-08.md
gh issue create --title "[P2] 提交门禁增强" --label "P2,tech-debt,governance,git" --milestone "技术债治理 Sprint 3" --body-file issue-09.md
gh issue create --title "[P2] 财务字段空安全自动化检测" --label "P2,tech-debt,lint,financial-safety" --milestone "技术债治理 Sprint 3" --body-file issue-10.md

# 创建里程碑
gh api repos/:owner/:repo/milestones -f title="技术债治理 Sprint 1" -f due_on="2026-08-18T00:00:00Z"
gh api repos/:owner/:repo/milestones -f title="技术债治理 Sprint 2" -f due_on="2026-09-01T00:00:00Z"
gh api repos/:owner/:repo/milestones -f title="技术债治理 Sprint 3" -f due_on="2026-09-15T00:00:00Z"

# 创建标签
gh label create "P0" --color "B60205" --description "优先级 P0，本 sprint 必须完成"
gh label create "P1" --color "D93F0B" --description "优先级 P1，下个 sprint 完成"
gh label create "P2" --color "FBCA04" --description "优先级 P2，持续优化"
gh label create "tech-debt" --color "5319E7" --description "技术债"
gh label create "financial-safety" --color "0E8A16" --description "金融数据安全"
```

## 工作量汇总

| 优先级 | Issue 数 | 工时合计 |
|--------|---------|---------|
| P0 | 3 | 46 hours |
| P1 | 4 | 37 hours |
| P2 | 3 | 26 hours |
| **总计** | **10** | **109 hours**（约 14 人天） |
