---
title: usecase-contract.md — 业务用例编排接口契约
type: reference
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `useCase` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md`..."
tags: [project, contract, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-202
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17

covers_code:
  - src/services/useCase/createExecutionPlan.useCase.test.ts


---
# usecase-contract.md — 业务用例编排接口契约

> **定位**：定义 `useCase` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **业务用例编排**：将分散在各 service 子域的长流程业务逻辑抽取为独立的 UseCase 单元，遵循 Clean Architecture Use Case Interactor 模式。涵盖交易执行计划创建、投资组合再平衡、双策略运行、交易复盘报告生成等。
- **跨域调用协调**：作为 Service 层之间的合法中介，封装对 `fetcher` / `input` / `scoring` / `trading` / `analysis` 等域的跨域调用，避免 Service 之间直接耦合。
- **数据融合与视图组装**：统一股票视图（`UnifiedStockView`）融合多源数据（基础信息、K线、V6评分、智能评分、行业评分、轮动评分、信号、持仓），提供可配置的分层视图（`ScoreView` / `TradingView`）。
- **板块分析与策略数据聚合**：并行加载板块轮动评分与行业评分，空数据时自动触发默认计算，排序后返回合并结果。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）及同层 `services/` 其他子域 |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()` 或 `dataLayer` 提供的 API） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `trading` | 上游/下游：调用仓位计算、风控检查、交易复盘生成；接收交易信号 | `trading` → `useCase`（positionSizer / riskEngine / tradeReviewAI） |
| `fetcher` | 上游：委托获取股票基础数据与 K线数据 | `fetcher` → `useCase`（fetcherOrchestrator） |
| `scoring` | 上游：调用热门板块分析、价值洼地分析、轮动信号检测 | `scoring` → `useCase`（hotSectorAnalyzer / valuePitAnalyzer / rotationSignalDetector） |
| `analysis` | 上游：获取板块轮动评分与行业评分 | `analysis` → `useCase`（sectorAnalysisEngine） |
| `input` | 上游：获取热门板块数据 | `input` → `useCase`（hotSectorService） |
| `llm` | 上游：异步复盘时调用 LLM 深度洞察 | `llm` → `useCase`（llmGateway） |
| `data` | 下游：通过 `dataLayer` 读取多源数据，通过 `DataBridge` 写入执行计划 | `useCase` → `data` |
| `core` | 下游：使用 `DataBridge`、`EnvelopeFactory`、`runInTransaction`、`freshnessGuard` | `useCase` → `core` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/useCase/createExecutionPlan.useCase.ts

export interface CreateExecutionPlanInput {
  readonly signal: Signal
  readonly accountType?: AccountType
  readonly source?: 'mcp' | 'manual' | 'strategy'
}

export type ExecutionPlanErrorCode =
  | 'NOT_TRADE_SIGNAL'
  | 'PRICE_MISSING'
  | 'RISK_BLOCKED'
  | 'PERSISTENCE_FAILED'
  | 'UNKNOWN_ERROR'

export interface CreateExecutionPlanResult {
  success: boolean
  plan?: ExecutionPlan
  error?: string
  errorCode?: ExecutionPlanErrorCode
}

// 文件：src/services/useCase/fetcherOrchestrator.useCase.ts

export interface FetchBasicDataInput { symbol: string }
export interface FetchKlineDataInput { symbol: string; options?: FetchKlineOptions }

// 文件：src/services/useCase/fetchSectorAnalysis.useCase.ts

export interface FetchSectorAnalysisInput { _filter?: undefined }
export interface FetchSectorAnalysisResult {
  success: boolean
  rotationScores: RotationSectorScore[]
  industryScores: IndustryScore[]
  error?: string
}

// 文件：src/services/useCase/getUnifiedStockView.useCase.ts

export interface UnifiedStockView {
  stock: Stock
  quotes?: DailyQuotes
  v6Score?: V6Score
  intelligentScore?: IntelligentScore
  industryScore?: IndustryScore
  rotationScore?: RotationSectorScore
  signal?: Signal
  holding?: PortfolioHolding
  quality: { completeness: number; freshness: number; missing: string[] }
  fusedAt: number
}

export interface FusionOptions {
  includeQuotes?: boolean
  includeV6Score?: boolean
  includeIntelligentScore?: boolean
  includeIndustryScore?: boolean
  includeRotationScore?: boolean
  includeSignal?: boolean
  includeHolding?: boolean
}

// 文件：src/services/useCase/hotSectorQuery.useCase.ts

export interface HotSectorQueryInput { topN?: number }
export interface HotSectorQueryResult { hotSectors: HotSector[] }

// 文件：src/services/useCase/rebalancePortfolio.useCase.ts

export interface RebalanceOptions {
  now?: number
  cashReservePct?: number
  maxHoldingWeight?: number
  rebalanceThreshold?: number
}

// 文件：src/services/useCase/runDualStrategy.useCase.ts

export interface RunDualStrategyInput {
  stocks: Stock[]
  ruleConfig?: DualStrategyRuleConfig
  persistScores?: boolean
}
export type RunDualStrategyOptions = RunDualStrategyInput

// 从 trading 子域导入的类型
import type { TradeReviewReport, TradeReviewOptions, AIDeepInsight } from '@/services/trading/tradeReviewAI.types'
import type { PartialLlmConfig } from '@/config/llmConfig'
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `createExecutionPlanUseCase` | `(input: CreateExecutionPlanInput) => Promise<CreateExecutionPlanResult>` | 根据交易信号获取股价、计算仓位、执行风控检查，构造 `ExecutionPlan` 并通过 `DataBridge` 持久化 | `logger.error` + 统一错误码返回 |
| `fetchBasicDataUseCase` | `(input: FetchBasicDataInput) => Promise<DataLayerResult<Stock>>` | 委托 `fetcherService` 获取股票基础数据 | `logger` + 返回错误结果 |
| `fetchKlineDataUseCase` | `(input: FetchKlineDataInput) => Promise<DataLayerResult<Stock>>` | 委托 `fetcherService` 获取 K线数据 | `logger` + 返回错误结果 |
| `fetchSectorAnalysisUseCase` | `(input: FetchSectorAnalysisInput) => Promise<FetchSectorAnalysisResult>` | 并行查询板块轮动评分与行业评分，空数据时自动触发默认计算 | `logger.error` + 返回错误结果 |
| `generateTradeReviewUseCase` | `(orders: Order[], now?: number) => TradeReviewReport` | 同步生成交易复盘报告（无 LLM 增强） | 纯计算，无副作用 |
| `generateTradeReviewAsyncUseCase` | `(orders: Order[], options?: TradeReviewOptions) => Promise<TradeReviewReport>` | 异步生成交易复盘报告，支持 LLM 深度洞察（失败时降级为规则模板） | `logger.error` + 降级为规则模板 |
| `getUnifiedStockViewUseCase` | `(symbol: string, options?: FusionOptions) => Promise<DataLayerResult<UnifiedStockView>>` | 融合多源数据（基础信息、K线、评分、信号、持仓）为统一视图 | `logger.error` + 返回错误结果 |
| `getUnifiedStockViewsUseCase` | `(symbols: string[], options?: FusionOptions) => Promise<DataLayerResult<UnifiedStockView[]>>` | 批量融合多个股票的统一视图 | `logger.warn` + 返回错误结果 |
| `getUnifiedStockViewsByStatusUseCase` | `(status: string, options?: FusionOptions) => Promise<DataLayerResult<UnifiedStockView[]>>` | 按研究状态筛选股票后批量融合 | `logger.error` + 返回错误结果 |
| `getScoreViewUseCase` | `(symbol: string) => Promise<DataLayerResult<{stock, v6Score, intelligentScore, industryScore, completeness}>>` | 简化评分视图（不包含 K线、信号、持仓） | `logger.error` + 返回错误结果 |
| `getTradingViewUseCase` | `(symbol: string) => Promise<DataLayerResult<{stock, quotes, v6Score, signal, holding, completeness}>>` | 交易专用视图（包含 K线、信号、持仓） | `logger.error` + 返回错误结果 |
| `hotSectorQueryUseCase` | `(input?: HotSectorQueryInput) => Promise<Result<HotSectorQueryResult>>` | 查询热门板块并按 score 降序返回 | `tryResult` + `logger.error` |
| `rebalancePortfolioUseCase` | `(portfolioId: string, orders: Order[], options?: RebalanceOptions) => Promise<Portfolio \| undefined>` | 事务内执行投资组合再平衡：持仓更新、市值重算、再平衡计划生成 | `logger.error` + 返回 `undefined` |
| `runDualStrategyUseCase` | `(input: RunDualStrategyInput) => Promise<DataLayerResult<DualStrategyResult>>` | 并行执行热门板块策略与价值洼地策略，生成轮动信号与观察列表 | `logger` + 返回错误结果 |

### 2.3 事件接口

本用例子域**未直接发布/订阅 EventBus 事件**。所有状态变更通过函数返回值（`Promise<Result<...>>`）向上游传递。如需事件驱动，由消费方（`store/` 层）在获取结果后自行触发。各用例内部使用 `logger.info` / `logger.warn` / `logger.error` 记录关键分支日志。

---

## 3. 数据流

### 典型用例：创建执行计划（`createExecutionPlanUseCase`）

```
[外部输入：交易信号 Signal]
    ↓
createExecutionPlanUseCase()
    ├── 1. DataBridge.query<Stock>() ← dataLayer.stocks
    ├── 2. DataBridge.query<Order[]>() ← dataLayer.orders
    ├── 3. trading/positionSizer.calculatePosition() → 仓位计算
    ├── 4. trading/riskEngine.checkOrderRisk() → 风控检查
    ├── 5. 构造 ExecutionPlan 对象
    ↓ (DataBridge.forward())
DataBridge → routeToDB() → dataLayer → IndexedDB (STORE_NAME.executionPlans)
    ↓ (函数返回)
调用方（store/ 或页面组件）
```

### 典型用例：统一股票视图（`getUnifiedStockViewUseCase`）

```
[外部输入：股票代码 symbol]
    ↓
getUnifiedStockViewUseCase(symbol, FusionOptions)
    ├── dataLayer.stocks.get(symbol)
    ├── dataLayer.dailyQuotes.get(symbol)       （可选）
    ├── dataLayer.v6Scores.get(symbol)        （可选）
    ├── dataLayer.intelligentScores.getLatestBySymbol(symbol) （可选）
    ├── dataLayer.industryScores.listByCode(sector)           （可选）
    ├── dataLayer.rotationScores.list()                     （可选）
    ├── dataLayer.signals.listBySymbol(symbol)                （可选）
    ↓
融合为 UnifiedStockView（含 quality 指标：完整度/新鲜度/缺失列表）
    ↓ (函数返回)
调用方（store/ 或页面组件）
```

> 注意：`getUnifiedStockView` 系列用例**只读不写**，不经过 `DataBridge.forward()`，直接通过 `dataLayer` 读取。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ & core/ & data/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（info / warn / error） |
| dataBridge | `@/core/databridge` | 创建执行计划时持久化数据 |
| EnvelopeFactory | `@/core/envelope` | 构造 DataBridge 信封 |
| runInTransaction | `@/core/transaction` | 组合再平衡时的事务控制 |
| freshnessGuard | `@/core/freshnessGuard` | 复盘报告与再平衡的 freshness 校验 |
| dataLayer | `@/data/dataLayer` | 统一视图用例直接读取多源数据 |
| data/db | `@/data/db` | 生成 `generateId`（`runDualStrategyUseCase`） |
| contracts / tryResult | `@/services/contracts` | `hotSectorQueryUseCase` 的 Result 封装 |

### 4.2 同层服务依赖（services/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| trading/positionSizer | `@/services/trading/positionSizer` | 仓位计算（Kelly 公式） |
| trading/riskEngine | `@/services/trading/riskEngine` | 风控检查 |
| trading/tradeReviewAI.* | `@/services/trading/tradeReviewAI.*` | 交易复盘报告生成（错误分类、五维规则、LLM 洞察） |
| fetcher/fetcherService | `@/services/fetcher/fetcherService` | 委托获取基础数据与 K线 |
| analysis/sectorAnalysisEngine | `@/services/analysis/sectorAnalysisEngine` | 获取/计算板块轮动评分与行业评分 |
| input/hotSectorService | `@/services/input/hotSectorService` | 获取热门板块列表 |
| scoring/hotSectorAnalyzer | `@/services/scoring/hotSectorAnalyzer` | 热门板块策略评分 |
| scoring/valuePitAnalyzer | `@/services/scoring/valuePitAnalyzer` | 价值洼地策略评分 |
| scoring/rotationSignalDetector | `@/services/scoring/rotationSignalDetector` | 轮动信号检测 |
| llm/llmGateway | `@/services/llm/llmGateway` | LLM 深度洞察调用 |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `accountType` | `'paper'` | 账户类型（paper / real） | `CreateExecutionPlanInput` |
| `cashReservePct` | 0.05 | 现金储备比例 | `@/constants/execution.constants` |
| `maxHoldingWeight` | 0.25 | 单标的权重上限 | `@/constants/execution.constants` |
| `rebalanceThreshold` | 0.05 | 再平衡触发阈值（权重偏差） | `@/constants/execution.constants` |
| `portfolioValue` | — | 组合净值（用于仓位计算） | `@/config/tradingConfig` → `getEffectiveTradingConfig()` |
| `ruleConfig` | 默认规则 | 双策略规则配置 | `@/config/dualStrategyRules` |
| `llmConfig` | — | LLM 覆盖配置（异步复盘用） | `@/config/llmConfig` |
| `FusionOptions` | 详见 `DEFAULT_OPTIONS` | 统一视图数据源开关 | `getUnifiedStockView.useCase.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/useCase/createExecutionPlan.useCase.test.ts` | 风控阻断/通过场景、边界数值（极值股价、NaN、Infinity）、数据缺失、特殊字符、并发请求、数据库操作异常、风控引擎异常、信号方向等 15+ 个 describe 套件 |
| 集成测试 | 建议补充：`tests/services/useCase.integration.test.ts` | DataBridge 交互、跨域调用（trading/fetcher/scoring）、Store 联动 |
| Mock 策略 | 测试内联 mock | `DataBridge` / `positionSizer` / `riskEngine` / `tradingConfig` 等依赖使用 `vi.mock` 隔离 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 确认 `getUnifiedStockView` 系列用例直接访问 `dataLayer` 而非 `DataBridge` 是否符合架构规范（当前为只读融合，未写入）。
> 2. 补充剩余用例的单元测试（当前仅 `createExecutionPlan` 有测试）。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
