---
title: release-notes
type: reference
domain: project
phase: deployment
tier: important
status: active
maintainer: V9 Architecture Team
summary: "release-notes - reference documentation (project)"
tags: [project, release, reference, changelog, deployment]
version: v1.1.0
last_updated: 2026-08-05
code_version: 2.0.0
doc_id: V9-DOC-PROJ-104
referenced_by: [V9-DOC-PROJ-174, V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.1.0
    changes: 新增 v0.9.7 db.ts 100% 覆盖率提升记录
    date: 2026-08-05
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# 发布说明

> 本文件面向用户与开发者，汇总每个已发布版本的核心变更、质量指标与升级须知。

---

## v0.9.7 — db.ts 覆盖率提升至 100% + 防御性代码分支治理

**发布日期**：2026-08-05

### 概要

本次版本聚焦 **`src/data/db.ts` V6Database 类的测试覆盖率从 4.68% 分支覆盖率提升至 100% 全维度覆盖**，通过 64 个针对性测试用例覆盖所有正常/异常路径，并按"不可达分支消除优先级 1（redundant condition removal）"重构 `withTransaction.settleOnce` 内冗余的 `value instanceof Error` 检查。本次变更同步消除一个不可达分支（line 126）并补齐 `tx.oncomplete` 回调覆盖（line 131-133）。

### 质量指标

| 指标 | 改进前 | 改进后 | 变化 |
|------|--------|--------|------|
| Statements 覆盖率 | 36.79% | 100% (212/212) | +63.21pp |
| Branches 覆盖率 | 4.68% (3/64) | 100% (62/62) | +95.32pp |
| Functions 覆盖率 | — | 100% (53/53) | — |
| Lines 覆盖率 | — | 100% (195/195) | — |
| 测试用例总数（db.ts 相关） | 0 | 64 | +64 |
| 双向测试验证（3 文件） | — | 205 passed (205) | — |

> 注：分支总数从 64 减至 62，因重构移除了 `settleOnce` 内冗余的 `value instanceof Error` 三元表达式（含 2 个分支 location）。

### 核心变更

#### 1. 新增 `src/data/db.v6database.test.ts` 测试套件（64 用例）

通过 Mock IDBDatabase 构造可控测试环境，覆盖 V6Database 全部 12 个方法的所有路径：

| 方法 | 覆盖路径 | 用例数 |
|------|---------|--------|
| `init()` | 未初始化 / 已初始化跳过 / 失败 Error / 失败非 Error | 4 |
| `ready()` | 已就绪直接返回 / 未就绪等待 Promise | 2 |
| `close()` | db 存在 / db 为 null / close 抛 Error / close 抛非 Error | 4 |
| `withTransaction()` | 回调成功 resolve + tx.oncomplete / 回调 reject Error / 回调 reject 非 Error / tx.onabort / tx.onerror Error / tx.onerror 非 Error / 双 settle 幂等 / ensureDB 抛错 / 外层 catch 非 Error | 9 |
| `getDatabase()` / `ensureDB()` | 成功返回 / 未初始化抛错 | 2 |
| `get()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error / 未初始化 | 5 |
| `getAll()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error | 4 |
| `getAllByIndex()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error | 4 |
| `put()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error | 4 |
| `delete()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error | 4 |
| `clear()` | onsuccess / onerror Error / onerror 非 Error / catch 非 Error | 4 |
| `deleteByIndex()` | 成功删除多条 / request.onerror Error / request.onerror 非 Error / tx.onerror Error / tx.onerror 非 Error / tx.onabort / catch 非 Error | 7 |
| `reset()` | 成功 / catch Error / catch 非 Error | 3 |
| `export()` | 成功 / catch Error / catch 非 Error | 3 |
| `import()` | 带数据 / 不带数据（?? false 路径）/ catch Error / catch 非 Error | 4 |
| `close()` 函数 | 调用单例 db.close() | 1 |

**测试隔离策略**：
- `beforeEach` 使用 `vi.resetAllMocks()` 重置所有 mock 实现（避免 `mockImplementation` 跨测试污染）
- `afterEach` 调用 `testDb.close()` 清理 V6Database 单例状态
- 使用 `vi.hoisted` 提升 mock 对象确保 `vi.mock` 工厂可访问
- 通过 `mocks.requests` 数组按索引访问每次创建的 IDBRequest，避免状态串扰

#### 2. 重构 `src/data/db.ts` 消除不可达分支

**位置**：`withTransaction` 内的 `settleOnce` 闭包函数（[db.ts#L120-L131](file:///d:/FinSightV9/src/data/db.ts#L120-L131)）

**问题**：原代码在 `settleOnce` 的 reject 分支中包含 `value instanceof Error ? value : new Error(String(value))` 三元检查。然而所有 3 个调用点都已通过 `instanceof` 检查保证了传入的 value 是 Error 实例：
- line 135: `settleOnce('reject', new Error('Transaction aborted'))` — 直接 new Error
- line 138: `settleOnce('reject', tx.error instanceof Error ? tx.error : new Error(String(tx.error)))` — 已包装
- line 150: `settleOnce('reject', err instanceof Error ? err : new Error(String(err)))` — 已包装

因此 `value instanceof Error` 的 false 分支（`new Error(String(value))`）不可达，覆盖率永远无法达到 100%。

**重构方案**（遵循项目规则：不可达分支消除优先级 1 - redundant condition removal）：

```typescript
// 重构前
reject(value instanceof Error ? value : new Error(String(value)))

// 重构后
// 所有调用点（tx.onabort / tx.onerror / callback catch）已通过 instanceof 检查
// 保证 value 为 Error 实例，直接断言避免冗余分支
reject(value as Error)
```

#### 3. 补齐 `tx.oncomplete` 回调覆盖

**位置**：[db.ts#L131-L133](file:///d:/FinSightV9/src/data/db.ts#L131-L133)

**问题**：`withTransaction` 内的 `tx.oncomplete` 回调（`logger.info('[DB] withTransaction completed')`）从未被任何测试触发，导致函数覆盖率停留在 98.11% (52/53)。

**修复**：在"回调成功 resolve"测试用例中，于 await 后主动触发 `mocks.mockTx.oncomplete!()`，验证回调日志输出：
```typescript
it('回调成功 resolve（覆盖 settleOnce resolve, kind=resolve + tx.oncomplete 回调）', async () => {
  await testDb.init()
  const promise = testDb.withTransaction(['stocks'], 'readonly', () => 'success')
  await new Promise((r) => setTimeout(r, 0))
  mocks.mockTx.oncomplete!()
  expect(await promise).toBe('success')
  expect(mockLogger.info).toHaveBeenCalledWith('[DB] withTransaction completed')
})
```

### 双向测试验证

为确保重构未引入回归，运行 3 个相关测试文件进行双向交叉验证：

| 测试文件 | 用例数 | 状态 |
|---------|-------|------|
| `src/data/db.v6database.test.ts` | 64 | ✓ 全部通过 |
| `src/data/db.test.ts` | 6 | ✓ 全部通过 |
| `src/data/dataLayer.test.ts` | 135 | ✓ 全部通过 |
| **合计** | **205** | **✓ 100% 通过** |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/data/db.v6database.test.ts` | V6Database 类单元测试（64 用例，覆盖全部 12 个方法） |

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `src/data/db.ts` | `withTransaction.settleOnce` 移除冗余 `value instanceof Error` 检查（line 126），改为 `value as Error` 断言；添加注释说明重构理由 |
| `docs/reference/release-notes.md` | 新增 v0.9.7 版本记录 |

### 覆盖率报告

详细 HTML 覆盖率报告：`docs/reports/coverage/db/index.html`

### 升级须知

- **无破坏性变更**。`settleOnce` 是 `withTransaction` 内的闭包函数，外部 API 完全不变。
- `withTransaction` 的 reject 行为保持一致：所有调用点已通过 `instanceof` 检查保证 value 为 Error，重构后行为等价。
- 防御性编程原则未减弱：调用点的 `instanceof` 包装仍然保留，仅移除了 `settleOnce` 内的冗余二次检查。

---

## v0.9.5 — P0 质量改进：L2 状态层补齐 + 动态质量分析引擎

**发布日期**：2026-06-29

### 概要

本次版本聚焦 **P0 质量改进**，核心目标是将 L2 状态层（Store）覆盖率从 52.6% 提升至 90.0%，并通过自研动态质量分析引擎实现代码库质量的量化追踪。同步补齐 4 个分析舱页面的 Store 迁移，新增 66 个单元测试，综合评分从 D 级提升至 B 级。

### 核心变更

#### 1. P0-1 Store 补齐（4 个 Store 迁移）

| 页面 | Store | 测试用例 | 说明 |
|------|-------|----------|------|
| `analysis/NewsPage.tsx` | `newsStore.ts`（扩展） | — | 新增 V9 track + `loadWithFilter` action |
| `ScoreDocPage.tsx` | `scoreDocStore.ts`（新建） | 9 个 | 完整状态管理 + 测试 |
| `IntelligentScorePage.tsx` | `intelligentScoreStore.ts`（新建） | 28 个 | Hook 重构为纯常量导出 |
| `IndustryScorePage.tsx` | `industryScoreStore.ts`（新建） | 29 个 | Hook 重构，状态下沉 |

- 新增测试总计 **66 个**，项目累计 **345 个**
- 所有 Store 遵循统一模式：类型定义 → Store 创建 → Action 实现 → 单元测试覆盖

#### 2. 动态质量分析引擎

- 新建 `scripts/quality/quality-config.ts`，从代码库实时扫描采集质量指标
- 生成 7 张动态分析图表（覆盖率趋势、模块热力图、测试分布、硬编码扫描、死代码分布、Store 迁移进度、综合评分雷达）
- 导出结构化 JSON 报告，支持 CI 集成与历史趋势对比

### 质量指标

| 指标 | 改进前 | 改进后 | 变化 |
|------|--------|--------|------|
| Store 覆盖率 | 52.6% | 90.0% | +37.4pp |
| 综合评分 | 55.1 (D) | 81.4 (B) | +26.3 |
| 测试用例总数 | 279 | 345 | +66 |
| TypeScript 编译 | 0 errors | 0 errors | — |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/store/scoreDocStore.ts` | ScoreDocPage 专用 Store |
| `src/store/intelligentScoreStore.ts` | IntelligentScorePage 专用 Store |
| `src/store/industryScoreStore.ts` | IndustryScorePage 专用 Store |
| `tests/stores/scoreDocStore.test.ts` | scoreDocStore 单元测试（9 用例） |
| `tests/stores/intelligentScoreStore.test.ts` | intelligentScoreStore 单元测试（28 用例） |
| `tests/stores/industryScoreStore.test.ts` | industryScoreStore 单元测试（29 用例） |
| `scripts/quality/quality-config.ts` | 动态质量分析引擎 |
| `scripts/reports/chart_dynamic_01.png` ~ `chart_dynamic_07.png` | 7 张动态分析图表 |
| `scripts/reports/dynamic_analysis_report.json` | 结构化质量快照 |

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `src/store/analysisNewsStore.ts` | 新增 V9 track 与 `loadWithFilter` action |
| `src/pages/analysis/NewsPage.tsx` | 迁移至扩展 newsStore |
| `src/pages/analysis/ScoreDocPage.tsx` | 迁移至 scoreDocStore |
| `src/pages/analysis/IntelligentScorePage.tsx` | 迁移至 intelligentScoreStore |
| `src/pages/analysis/IndustryScorePage.tsx` | 迁移至 industryScoreStore |
| `src/hooks/cabin/useIntelligentScorePage.ts` | 重构为纯常量导出 |
| `src/hooks/cabin/useIndustryScorePage.ts` | 重构为纯常量导出 |

### 升级须知

- 无破坏性变更。所有页面行为保持不变，仅状态管理层从页面内局部状态下沉至全局 Store。
- `useIntelligentScorePage` 与 `useIndustryScorePage` 两个 Hook 的公共 API 不变，内部实现改为从 Store 读取。

---

## v0.9.6 — 文档体系清理

**发布日期**：2026-06-29

### 概要

本次版本聚焦**文档体系整理与健康度维护**，删除约 212 个文件/目录，修复 44 处文档断裂链接，更新 .gitignore 规则。清理范围涵盖临时调试产物、已完成的迁移文档、已废弃的旧文档、过程性审计报告，保留核心架构规范与实施文档。

### 清理内容

#### 1. 临时产物清理

| 类型 | 删除内容 | 文件数 |
|------|---------|--------|
| Playwright MCP 调试快照 | `.playwright-mcp/` | 49 |
| 迁移验证截图 | `screenshots/` | 16 |
| 审计产物 | `component-audit-data.json`、`component-audit-report.txt` | 2 |
| Python 缓存 | `docs/audit/assets/__pycache__/` | — |
| Python 虚拟环境 | `.venv/` | ~90 |

#### 2. 迁移过程文档清理

| 文件 | 理由 |
|------|------|
| `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性 PoC 验证，已完成 |
| `../explanation/v6pro-to-v9-migration-analysis.md` | 一次性验收确认，已完成 |
| `./v6-to-v9-migration-spec.md` | 迁移已完成，参考价值低 |
| `../00-meta/development-log.md` | 一次性修复报告 |
| `scripts/fix/apply-multi-match-fixes.ts` | 一次性迁移脚本 |

#### 3. 已废弃文档清理

- `docs/explanation/implementation/deprecated/` 目录 9 个文件全部删除（已被替代文档覆盖）
- 13 份旧版/重复文档（数据字典 v1.0、数据资产清单 v1.0.1、架构缺陷清单、docs/release-notes.md 等）

#### 4. 过程性审计报告清理

- 27 份过程性文档（report-1~12 快照、completeness-profile-batch1~5、fix plan 等）

### 文档链接修复

修复 11 个文档中的 44 处断裂 Markdown 链接，确保文档交叉引用完整性。

### .gitignore 更新

| 变更 | 说明 |
|------|------|
| 新增 `.venv/`、`venv/`、`__pycache__/`、`*.pyc` | 防止 Python 虚拟环境被提交 |
| `/*.md` → `*.report.md` 等精确模式 | 避免误忽略 README 等重要文件 |
| 删除 `temp/backup/` | 已被 `temp/` 覆盖 |

### 升级须知

- 无代码变更，不影响编译和运行
- `.venv/` 如需重建：`python -m venv .venv && pip install -r python/data_service/requirements.txt`

- 动态质量分析引擎为独立 Python 脚本，不影响前端构建流程。

---
