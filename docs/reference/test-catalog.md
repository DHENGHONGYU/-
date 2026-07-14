---
title: V9 测试目录与策略
description: 全量测试资产索引、运行命令、覆盖率基线与已知问题清单
status: draft
owner: 工程效能组 / QA
updated: 2026-07-12
version: v1.0.0
---

# V9 测试目录与策略

> **文档定位**：本文档是 V9 智能投研复盘系统全部测试资产的**单一真相源**（Single Source of Truth）。
> **适用范围**：所有新增模块的测试义务、CI 门禁配置、故障排查时的测试定位入口。
> **关联文档**：
> - [测试策略总览](../reference/testing-strategy.md) — 三层测试策略与改进路线
> - [AGENTS.md](../../AGENTS.md) — 四步集成回滚验证、事件监听清理模板
> - [运维基线](../ops/runbook.md) — CI/CD 流水线配置
> - [编码规范](../standards/coding-conventions.md) — 测试命名与目录约定

---

## 1. 测试金字塔

V9 采用四层测试金字塔，工具链与职责如下：

```
        ▲
       / \    视觉回归 (Playwright Snapshot)
      /   \   职责：关键页面像素级对比，防止 UI 漂移
     /─────\  规模：~20 个场景，基线存于 e2e/screenshots/
    /       \
   /─────────\  E2E (Playwright)
  /           \ 职责：核心用户路径端到端验证
 /             \规模：~17 个 spec，覆盖 5 舱关键流程
/───────────────\
/                 \ 集成测试 (Vitest + fake-indexeddb)
/                   \职责：跨模块契约、DataBridge、ACL、Widget 注册同步
/─────────────────────\规模：~15 个文件，含契约测试 suite
/                       \
/─────────────────────────\ 单元测试 (Vitest + jsdom)
/                           \职责：函数、Store、Service、组件、类型守卫
/                             \规模：~200 个文件，测试资产主体
─────────────────────────────
```

| 层级 | 范围 | 工具/环境 | 目标 | 门禁位置 |
|------|------|-----------|------|----------|
| **单元测试** | 函数、Store、Service、工具类、原子/分子组件 | Vitest + jsdom | 核心模块覆盖率 ≥ 70%，全局基线 80% | pre-commit / CI |
| **集成测试** | DataBridge、EventBus、ACL、Widget 注册三处同步、Store 跨 Tab 广播 | Vitest + fake-indexeddb | 模块间契约零违规 | CI |
| **E2E 测试** | 关键用户路径、路由跳转、驾驶舱渲染、表单提交 | Playwright (Chromium) | 核心流程全通过 | 发布前 |
| **视觉回归** | 驾驶舱、股票池看板、评分页关键截图 | Playwright `toHaveScreenshot` | 像素差异 ≤ 2% | 发布前 |

---

## 2. 测试目录结构

### 2.1 顶层布局

```
├── e2e/                          ← E2E & 视觉回归 (Playwright)
│   ├── *.spec.ts                 ← 端到端测试用例
│   ├── visual-regression.spec.ts ← 视觉回归主入口
│   ├── visual-regression.spec.ts-snapshots/ ← 基线截图
│   └── screenshots/              ← 运行时截图产物
│
├── tests/                        ← 单元 & 集成测试 (Vitest)
│   ├── setup.ts                  ← 全局测试前置 (vi.mock, cleanup)
│   ├── contracts/
│   │   ├── setup.ts              ← 契约测试前置
│   │   ├── contractValidator.ts  ← 契约断言工具
│   │   ├── databridge.contract.ts
│   │   ├── engine.contract.ts
│   │   ├── envelope.contract.ts
│   │   ├── fetcher.contract.ts
│   │   ├── store.contract.ts
│   │   ├── strategy.contract.ts
│   │   └── interface-contract.test.ts
│   ├── __tests__/
│   │   ├── types/                ← 类型测试 (Expect<Equals>)
│   │   ├── integration/          ← 集成测试
│   │   ├── regression/           ← 回归验证测试
│   │   ├── snapshot/             ← API/Schema 快照测试
│   │   ├── lib/                  ← 库函数测试
│   │   ├── orchestrator/         ← 编排器测试
│   │   ├── services/             ← 服务层补充测试
│   │   └── store/                ← Store 补充测试
│   ├── __mocks__/                ← 全局 mock
│   ├── fixtures/                 ← 测试数据集
│   ├── helpers/                  ← 测试辅助函数
│   ├── performance/              ← 性能基准测试
│   ├── remediation/              ← 修复不变量验证
│   ├── unit/                     ← 纯单元测试
│   ├── services/                 ← 服务层测试
│   └── utils/                    ← 工具函数测试
│
└── src/                          ← 源码共置测试（推荐）
    ├── **/*.test.ts              ← 与源码同目录的单元测试
    └── **/*.test.tsx             ← 组件测试
```

### 2.2 共置 vs 集中原则

| 策略 | 位置 | 适用场景 |
|------|------|----------|
| **共置（推荐）** | `src/{layer}/ModuleName.test.ts` | 新增 Store、Service、组件、核心工具。与源码同目录，便于维护与重构时同步更新。 |
| **集中** | `tests/` 根或子目录 | 跨模块集成测试、E2E、契约测试、性能测试、fixtures 与 helpers。 |

> **决策规则**：单模块内聚测试 → 共置；跨模块契约/端到端/性能 → 集中。

---

## 3. 关键测试文件清单

### 3.1 按舱室分类（Pages & Apps）

| 舱室 | 测试文件 | 说明 |
|------|----------|------|
| **Input (输入舱)** | `tests/InputApp.test.tsx`<br>`tests/BulkImportPanel.test.tsx`<br>`tests/StockSearch.test.tsx`<br>`src/pages/analysis/HotSectorPage.test.tsx`<br>`tests/data-collector.test.ts`<br>`tests/batchImportService.test.ts`<br>`e2e/input-data-collection.spec.ts`<br>`e2e/input-stock-pool.spec.ts`<br>`e2e/bulk-import-full.spec.ts` | 采集向导、批量导入、股票搜索、数据收集器 |
| **Analysis (分析舱)** | `tests/AnalysisApp.test.tsx`<br>`src/pages/analysis/StockAnalysisPage.test.tsx`<br>`src/pages/analysis/SectorAnalysisPage.test.tsx`<br>`src/pages/analysis/ValuePitPage.test.tsx`<br>`tests/IndustryScorePage.test.tsx`<br>`tests/IntelligentScorePage.test.tsx`<br>`e2e/analysis-scoring.spec.ts`<br>`e2e/analysis-extended.spec.ts`<br>`e2e/stock-score.spec.ts` | 个股/板块/行业/价值投资分析页 |
| **Trading (交易舱)** | `src/apps/trading/TradingApp.test.tsx`<br>`tests/PoolBoard.test.tsx`<br>`tests/PoolList.test.tsx`<br>`e2e/trading.spec.ts`<br>`e2e/trade-review.spec.ts`<br>`e2e/pool-group.spec.ts` | 交易舱壳、股票池看板、交易复盘 |
| **Output (输出舱)** | `tests/OutputApp.test.tsx`<br>`src/pages/output/__tests__/OutputHubPage.test.tsx`<br>`e2e/output-cabin.spec.ts`<br>`e2e/output-command.spec.ts` | 输出舱壳、报告中心 |
| **Command (指令舱)** | `tests/CommandApp.test.tsx`<br>`tests/ConfigApp.test.tsx`<br>`src/pages/command/agent/AgentHubPage.test.tsx`<br>`src/pages/command/agent/AgentRegistryPage.test.tsx`<br>`src/pages/command/agent/__tests__/*.test.tsx`<br>`src/pages/command/__tests__/MCPServerDashboardPage.test.tsx`<br>`e2e/mcp-verify.spec.ts` | 系统配置、Agent 中心、MCP 仪表板 |
| **Cockpit (驾驶舱)** | `src/cockpit/CockpitShell.test.tsx`<br>`src/cockpit/core/widgetEngine.test.ts`<br>`src/cockpit/core/widgetRegistry.test.ts`<br>`src/cockpit/core/widgetRegistrySync.test.ts`<br>`src/cockpit/widgets/*.test.tsx` | 驾驶舱壳、Widget 引擎、全部 Widget |

### 3.2 按服务子域分类（Services）

| 子域 | 测试文件 |
|------|----------|
| **analysis** | `src/services/analysis/analysisService.test.ts`<br>`src/services/analysis/__tests__/dataFreshnessGuard.test.ts`<br>`src/services/analysis/__tests__/scoreDocService.test.ts`<br>`src/services/analysis/__tests__/scoreTrendService.test.ts` |
| **backtest** | `src/services/backtest/BacktestEngine.test.ts`<br>`src/services/export/__tests__/backtestExportService.test.ts` |
| **collection** | `src/services/collection/collectionWizardPersistence.test.ts`<br>`src/services/data-collector/collectionReportService.test.ts`<br>`src/services/data-collector/MarketDataAdapter.test.ts`<br>`src/services/data-collector/missingReportDetector.test.ts`<br>`src/services/data-collector/TaskScheduler.test.ts` |
| **execution** | `src/services/execution/executionLogService.test.ts`<br>`src/services/execution/executionPlanService.test.ts` |
| **fetcher** | `src/services/fetcher/fetcherAdapter.test.ts`<br>`src/services/fetcher/fetcherClient.test.ts`<br>`src/services/fetcher/fetcherInterceptor.test.ts`<br>`src/services/fetcher/strategyDataAdapter.test.ts`<br>`src/services/fetcher/strategyDataAdapter.normalize.test.ts` |
| **llm** | `src/services/llm/llmClient.test.ts`<br>`src/services/llm/llmClient.multimodel.test.ts` |
| **news** | `src/services/news/stockLinker.test.ts`<br>`src/services/news/__tests__/sentimentTrendEngine.test.ts`<br>`tests/newsService.test.ts` |
| **portfolio** | `src/services/portfolio/portfolioService.test.ts`<br>`tests/portfolioBuilder.test.ts` |
| **scoring (V6 引擎)** | `src/services/scoring/hotSectorAnalyzer.test.ts`<br>`src/services/scoring/industryScoreSkill.test.ts`<br>`src/services/scoring/intelligentScoreSkill.test.ts`<br>`src/services/scoring/rotationSignalDetector.test.ts`<br>`src/services/scoring/v6-engine/calculators/*.test.ts`<br>`src/services/scoring/v6-engine/enhancer.test.ts`<br>`src/services/scoring/v6-engine/factorContributions.test.ts` |
| **trading** | `tests/tradingService.test.ts`<br>`tests/positionSizer.test.ts` |
| **通用** | `src/services/contracts.test.ts`<br>`src/services/errorBus.test.ts`<br>`src/services/resilience.test.ts` |

### 3.3 按 Store 分类（49 个 Zustand Store，含测试者 26+）

| 舱室 | Store 测试文件 |
|------|----------------|
| Input | `src/store/inputHubStore.test.ts`<br>`tests/__tests__/store/inputHubStore.enhanced.test.ts`<br>`src/store/poolStore.test.ts` |
| Analysis | `src/store/stockAnalysisStore.test.ts`<br>`src/store/industryScoreStore.test.ts`<br>`src/store/intelligentScoreStore.test.ts`<br>`src/store/sectorAnalysisStore.test.ts`<br>`src/store/hotSectorStore.test.ts`<br>`src/store/scoreDocStore.test.ts` |
| Trading | `src/store/orderStore.test.ts`<br>`src/store/positionStore.test.ts`<br>`src/store/holdingsStore.test.ts`<br>`src/store/portfolioStore.test.ts`<br>`src/store/riskStore.test.ts`<br>`src/store/dualStrategyStore.test.ts`<br>`src/store/rotationSignalStore.test.ts`<br>`src/store/multiFactorScreeningStore.test.ts` |
| Output | `src/store/outputStore.test.ts`<br>`tests/outputStore.test.ts` |
| Command | `src/store/agentStore.test.ts`<br>`src/store/commandStore.test.ts`<br>`src/store/localKnowledgeStore.test.ts`<br>`src/store/pageStore.test.ts` |
| 通用 | `src/store/analysisNewsStore.test.ts`<br>`src/store/backtestStore.test.ts`<br>`src/store/dataflowStore.test.ts`<br>`src/store/disciplineStore.test.ts`<br>`src/store/engineStore.test.ts`<br>`src/store/executionStore.test.ts`<br>`src/store/marketDataStore.test.ts`<br>`src/store/signalStore.test.ts`<br>`src/store/signalQualityStore.test.ts`<br>`tests/storeSubscriptions.test.ts` |

> TODO(架构组): 剩余 ~23 个 Store 尚未补充单元测试，按优先级分批补齐。详见 `npm run audit:tests` 输出。

### 3.4 组件层测试（Atoms / Molecules / Organisms / Templates）

| 层级 | 已覆盖组件 |
|------|-----------|
| **Atoms** | `src/components/atoms/Badge.test.tsx`<br>`src/components/atoms/Button.test.tsx`<br>`src/components/atoms/Card.test.tsx`<br>`src/components/atoms/Checkbox.test.tsx`<br>`src/components/atoms/Input.test.tsx`<br>`src/components/atoms/Label.test.tsx`<br>`src/components/atoms/Progress.test.tsx`<br>`src/components/atoms/Separator.test.tsx`<br>`src/components/atoms/Sheet.test.tsx`<br>`src/components/atoms/Skeleton.test.tsx`<br>`src/components/atoms/StockPriceChange.test.tsx`<br>`src/components/atoms/Switch.test.tsx`<br>`src/components/atoms/Textarea.test.tsx`<br>`src/components/atoms/Toast.test.tsx`<br>`src/components/atoms/Tooltip.test.tsx` |
| **Molecules** | `src/components/molecules/DataState.test.tsx`<br>`src/components/molecules/Dialog.test.tsx`<br>`src/components/molecules/ErrorState.test.tsx`<br>`src/components/molecules/Tabs.test.tsx` |
| **Organisms** | `src/components/organisms/analysis/hub/AnalysisTemplateCards.test.tsx`<br>`src/components/organisms/analysis/score/ScoreFactorWaterfall.test.tsx`<br>`src/components/organisms/analysis/score/__tests__/*.test.tsx`<br>`src/components/organisms/shared/*.test.tsx` |
| **Templates** | `src/components/templates/PageContainer.test.tsx`<br>`src/components/templates/PageHeader.test.tsx` |

> TODO(设计系统): organisms 层级覆盖不足，特别是 `cockpit/` 与 `charts/` 子目录的复杂组件。优先补齐 `ErrorBoundary`、`ScoreFactorDeltaPanel`。

### 3.5 核心层与数据层测试

| 层级 | 测试文件 |
|------|----------|
| **core** | `src/core/acl.test.ts`<br>`src/core/databridge.test.ts`<br>`src/core/dataflow/defaultDataBuilder.test.ts`<br>`src/core/envelope.test.ts`<br>`src/core/fallbackQueue.test.ts`<br>`src/core/feedbackOrchestrator.test.ts`<br>`src/core/memoryCache.test.ts`<br>`src/core/routeGuard.test.tsx` |
| **data** | `src/config/dbConfig.test.ts`<br>`tests/dataLayer.test.ts`<br>`tests/db-connection.test.ts`<br>`tests/db-migrations.test.ts`<br>`tests/db-schema.test.ts`<br>`tests/db-utils.test.ts`<br>`tests/queryBuilder.test.ts` |
| **lib** | `tests/logger.test.ts`<br>`tests/useDebounce.test.ts`<br>`tests/__tests__/lib/*.test.ts` |
| **agents** | `src/agents/agentComponentRegistry.test.ts`<br>`src/agents/__tests__/agentRuntime.mcp.test.ts` |

---

## 4. 已知排除测试（`test:clean` 排除清单）

以下 8 个测试文件因**外部依赖不稳定**、**环境敏感**或**遗留债务**被 `npm run test:clean` 显式排除。CI 使用 `test:clean` 作为绿色基线；`test:known` 用于单独验证这些问题文件。

| # | 文件路径 | 排除原因 | 修复优先级 | Owner |
|---|----------|----------|-----------|-------|
| 1 | `src/store/agentStore.test.ts` | LLM 多模型切换涉及外部 API Key 与网络抖动，Mock 未完全隔离 | P1 | Store 组 |
| 2 | `src/services/fetcher/fetcherClient.test.ts` | 数据源适配器涉及网络 I/O，fake-indexeddb 与并发请求竞态 | P1 | Fetcher 组 |
| 3 | `src/services/llm/llmClient.multimodel.test.ts` | 多模型 Provider 切换依赖环境变量，CI 无密钥时跳过逻辑导致空跑 | P1 | LLM 组 |
| 4 | `tests/fetcher/dataSourceProvider.test.ts` | 第三方数据源 Provider 接口变更频繁，契约测试待补齐 | P2 | Fetcher 组 |
| 5 | `tests/ui-components.test.tsx` | 旧版 UI 组件测试，已迁移至 `src/components/**` 共置测试，存在重复断言 | P2 | 前端组 |
| 6 | `tests/agentModule.integration.test.tsx` | Agent 模块重构中，集成点待稳定（MCP Server 动态注册变更） | P2 | Agent 组 |
| 7 | `tests/engine.test.ts` | 引擎 L0-L8 全链路测试过重，需拆分为分层单元测试（已有 `v6-engine/calculators/*.test.ts`） | P1 | 引擎组 |
| 8 | `tests/sectorScoreService.test.ts` | 板块评分涉及实时行情数据，Mock 数据与真实数据结构漂移 | P2 | Scoring 组 |

**运行命令对照**：

```powershell
# CI 绿色基线（排除上述 8 个）
npm run test:clean

# 单独运行已知问题文件（调试用）
npm run test:known

# 全量运行（含已知问题，可能失败）
npm test -- --run
```

> **注**：`test:clean` 与 `test:known` 的排除清单必须在 `package.json` 中**双向同步**——新增排除文件时，两脚本须同时更新。审计脚本 `audit:tests` 会自动校验此一致性。

---

## 5. 覆盖率基线

### 5.1 全局目标

| 指标 | 目标值 | 当前状态 | 说明 |
|------|--------|----------|------|
| **Statements** | ≥ 80% | 🟡 待测量 | 全局基线，自主修复阈值（见 AGENTS.md §十） |
| **Branches** | ≥ 75% | 🟡 待测量 | 条件分支覆盖 |
| **Functions** | ≥ 80% | 🟡 待测量 | 函数入口覆盖 |
| **Lines** | ≥ 80% | 🟡 待测量 | 行覆盖 |

### 5.2 分层阈值（`vite.config.ts` 硬性配置）

以下阈值写入 Vitest `coverage.thresholds`，未达标即 CI 失败：

| 目录 | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `src/core/**` | 55 | 75 | 60 | 55 |
| `src/data/**` | 35 | 35 | 35 | 35 |
| `src/lib/**` | 70 | 65 | 80 | 70 |
| `src/services/**` | 70 | 65 | 70 | 70 |

> **说明**：`src/data/**` 阈值较低（35%），因 IndexedDB 迁移与 Schema 创建逻辑多为声明式，测试 ROI 低；`src/core/**` 侧重分支覆盖（75%），因 ACL、Envelope、RouteGuard 的条件分支直接影响安全。

### 5.3 覆盖率报告生成

```powershell
# 生成 HTML + JSON + TEXT 报告
npm run coverage
# 输出：coverage/ 目录（已纳入 .gitignore）

# CI 场景（ Istanbul provider，兼容 Windows forks 池）
npm run test:ci
```

---

## 6. 测试数据与 Mock 策略

### 6.1 Mock 分层

| 层级 | 工具/位置 | 用途 |
|------|-----------|------|
| **全局 Mock** | `tests/__mocks__/` | 第三方库全局替换（如 `nanoid`、`dayjs`） |
| **Fixtures** | `tests/fixtures/` | 领域对象静态数据集（orders、portfolios、signals、store-mock-data） |
| **Factories** | `tests/unit/mockFactories.ts` | 动态生成假数据的工厂函数 |
| **Helpers** | `tests/helpers/` | LLM Mock Fetch、Widget 测试工具 |
| **局部 Mock** | 测试文件内 `vi.mock()` | 模块级精细控制 |

### 6.2 IndexedDB Mock

使用 `fake-indexeddb` 替代真实 IndexedDB，配置于 `tests/setup.ts`：

```typescript
// tests/setup.ts 片段
import 'fake-indexeddb/auto'

// 每个测试前重置数据库状态，防止跨测试污染
beforeEach(async () => {
  // TODO: 补充具体重置逻辑
})
```

### 6.3 LLM / Fetcher Mock

| 场景 | 策略 |
|------|------|
| LLM 调用 | `tests/helpers/llmMockFetch.ts` 提供统一的 `mockLlmResponse()`，拦截 `fetch` 并返回结构化假数据 |
| 行情数据 | `tests/mockStockData.ts` 提供静态 K 线与报价数据 |
| 数据源 Provider | `tests/fixtures/store-mock-data.ts` 中的预置数据集 |

---

## 7. 测试清理模板

### 7.1 定时器清理（强制）

AGENTS.md §三 规定：测试中使用 `vi.useFakeTimers()` 必须在 `afterEach` 中 `vi.useRealTimers()`。

```typescript
// ✅ 标准模板：fakeTimers 清理
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('ModuleName', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()   // ← 必须配对
  })

  it('should handle delayed action', () => {
    // ...
    vi.advanceTimersByTime(1000)
    // ...
  })
})
```

### 7.2 事件监听清理（强制）

```typescript
// ✅ 标准模板：EventBus 订阅清理
import { EventBus } from '@/core/eventBus'

describe('StoreWithBroadcast', () => {
  it('should broadcast on update', () => {
    const handler = vi.fn()
    const unsubscribe = EventBus.subscribe('store:update', handler)

    // ... 触发更新 ...

    expect(handler).toHaveBeenCalled()
    unsubscribe()  // ← 测试内显式清理
  })
})
```

### 7.3 DOM 清理（强制）

```typescript
// ✅ 标准模板：@testing-library/react 清理
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 已全局配置于 tests/setup.ts，无需每文件重复
// afterEach(() => cleanup())
```

### 7.4 Store 状态重置

```typescript
// ✅ 标准模板：Zustand Store 重置
import { act } from '@testing-library/react'

describe('analysisStore', () => {
  beforeEach(() => {
    act(() => {
      useAnalysisStore.setState(initialState, true) // true = replace 而非 merge
    })
  })
})
```

---

## 8. 视觉回归测试流程

### 8.1 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 工具 | Playwright `toHaveScreenshot` | 像素级对比 |
| 容差 | `maxDiffPixelRatio: 0.02` | 允许 2% 像素差异，避免字体/动画微差误报 |
| 阈值 | `threshold: 0.2` | 单像素色差阈值 |
| 浏览器 | Desktop Chrome | 单一浏览器减少基线数量 |
| 基线目录 | `e2e/visual-regression.spec.ts-snapshots/` | 已纳入版本控制 |

### 8.2 运行命令

```powershell
# 运行视觉回归测试（与基线对比）
npm run test:e2e:visual

# 更新基线（UI 变更已确认后）
npm run test:e2e:visual:update

# 查看可视化报告
npm run test:e2e:ui
```

### 8.3 场景清单（`e2e/visual-regression.spec.ts`）

| # | 场景 | 说明 |
|---|------|------|
| 1 | 驾驶舱全屏渲染 | CockpitShell + 默认 Widget 布局 |
| 2 | 分析舱评分页 | 智能评分瀑布图 + 因子贡献 |
| 3 | 输入舱采集向导 | 多步骤表单 |
| 4 | 交易舱持仓看板 | 表格 + 卡片混合布局 |
| 5 | 暗色模式切换 | 主题令牌暗色变体验证 |

> TODO(前端组): 当前仅覆盖 5 个场景，目标扩展至 20 个，覆盖全部舱室首屏与关键交互态。

---

## 9. 回滚验证流程（四步集成回滚专用）

当执行 AGENTS.md §二「四步集成」的回滚操作时，必须按以下顺序验证：

```powershell
# 1. 类型安全
npx tsc --noEmit

# 2. 文档同步
npm run audit:docs

# 3. 接口签名一致性（若涉及路由或数据字典变更）
# 手动更新 docs/02-design/06-routing-specs.md 或 DATA_DICTIONARY_INDEX.md

# 4. 架构合规
npm run audit:layers

# 5. 单元测试通过（clean 基线）
npm run test:clean

# 6. 可选：E2E 回归（重大回滚时）
npm run test:e2e
```

**验证清单**：

- [ ] `tsc --noEmit` 0 errors
- [ ] `audit:docs` 0 drift
- [ ] `audit:layers` 0 violations
- [ ] `test:clean` 0 failures
- [ ] 路由/字典文档已同步（若涉及）

---

## 10. 运行命令速查

```powershell
# ── 单元测试 ──
npm run test              # 全量运行（Vitest run）
npm run test:watch        # 监听模式
npm run test:ci           # CI 模式 + 覆盖率
npm run test:staged       # 仅与 git staged 文件相关的测试
npm run test:clean        # 排除已知问题文件的绿色基线
npm run test:known        # 仅运行已知问题文件（调试）

# ── E2E & 视觉回归 ──
npm run test:e2e          # Playwright 全量 E2E
npm run test:e2e:ui       # Playwright UI 模式（可视化调试）
npm run test:e2e:visual   # 视觉回归测试
npm run test:e2e:visual:update  # 更新视觉基线

# ── 覆盖率 ──
npm run coverage          # 生成覆盖率报告

# ── 测试审计 ──
npm run audit:tests       # 测试文件合规性扫描
```

---

## 11. 已知问题与 TODO

| # | 问题 | Owner | 优先级 |
|---|------|-------|--------|
| 1 | 8 个排除测试文件待修复（见 §4） | 各子域组 | P1-P2 |
| 2 | ~23 个 Store 缺少单元测试 | Store 组 | P2 |
| 3 | organisms 层级组件测试覆盖不足 | 前端组 | P2 |
| 4 | 视觉回归场景仅 5 个，目标 20 个 | 前端组 | P3 |
| 5 | `tests/engine.test.ts` 待拆分为分层测试 | 引擎组 | P1 |
| 6 | `src/data/**` 覆盖率仅 35%，需评估是否提升 | 数据组 | P3 |
| 7 | E2E 测试目前仅覆盖 Chromium，需评估 Safari/Firefox | QA | P3 |

---

## 12. 附录

### A. 依赖版本

| 包 | 版本 | 用途 |
|----|------|------|
| `vitest` | `^2.1.0` | 测试运行器 |
| `@testing-library/react` | `^16.3.2` | React 组件测试 |
| `@testing-library/jest-dom` | `^6.9.1` | DOM 断言扩展 |
| `@testing-library/user-event` | `^14.6.1` | 用户交互模拟 |
| `@playwright/test` | `^1.61.1` | E2E & 视觉回归 |
| `fake-indexeddb` | `^6.2.5` | IndexedDB Mock |
| `jsdom` | `^25.0.0` | DOM 环境 |
| `@vitest/coverage-istanbul` | `2.1.9` | 覆盖率（Istanbul provider） |

### B. 相关文档索引

- [三层测试策略](../reference/testing-strategy.md)
- [AGENTS.md §二 — 四步集成与回滚验证](../../AGENTS.md)
- [AGENTS.md §三 — 事件监听清理模板](../../AGENTS.md)
- [AGENTS.md §七 — 验证命令速查](../../AGENTS.md)
- [编码规范](../standards/coding-conventions.md)
- [运维基线](../ops/runbook.md)
