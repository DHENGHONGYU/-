---
title: trading-contract.md — 交易业务子域接口契约
type: reference
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `trading` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md`..."
tags: [backend, trading, contract]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-BACK-019
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-ARCH-043, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# trading-contract.md — 交易业务子域接口契约

> **定位**：定义 `trading` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **交易信号生成与策略执行**：基于行情数据（K 线、PE/PB、成交量、MACD/RSI）生成买入/卖出/观察/持有信号；支持核心稀缺、热点动量、价值 bargain 三策略分组，生成策略快照并持久化到 `strategy_snapshots`。
- **订单生命周期与风控编排**：提供观察池扫描、单股交易建议、创建买入/卖出订单等接口；内嵌风控检查（仓位上限、同标的冷却期、当日交易次数、数据新鲜度），通过 `DataBridge.forward()` 写入 IndexedDB。
- **组合构建与仓位管理**：基于主题配置与综合评分（V6 自动评分、智能评分、行业评分）构建目标投资组合；计算 FIFO 交易对、已实现盈亏、当前持仓、再平衡计划；提供仓位大小计算（半凯利公式 + 整手取整）。
- **AI 交易复盘与错误诊断**：生成六维交易复盘报告（交易摘要、错误分析、纪律分析、技能发展、行动计划、AI 深度洞察）；聚合交易错误检测、心理画像与风险画像。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）、`config/`、`types/` |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()` 或 `dataLayer`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）、`apps/`（App 分发器）、`cockpit/`（驾驶舱）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `useCase` | 上游：提供 AI 复盘用例、双策略用例、热点板块查询 | `useCase` → `trading`（调用） |
| `input` | 上游：提供热点板块类型定义 | `input` → `trading`（类型引用） |
| `llm` | 上游：提供 LLM 消息类型 | `llm` → `trading`（类型引用） |
| `scoring` | 上游：产出 V6/智能/行业评分，经 `dataLayer` 消费 | `scoring` → `trading`（间接数据） |
| `execution` | 下游：消费订单与执行计划 | `trading` → `execution`（订单/计划） |
| `portfolio` | 下游/同级：消费组合与持仓数据 | `trading` → `portfolio`（组合/持仓） |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

> 类型分散于 `src/services/trading/` 各模块，无集中 `types.ts`。以下提取核心公共接口。

```typescript
// src/services/trading/tradingService.ts
export interface CreateOrderInput {
  symbol: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  accountType?: 'paper' | 'real'
}

export interface TradeAdvice {
  signal: TradingSignal
  sizing: PositionSizingResult
  risk: RiskCheckResult
}

// src/services/trading/positionSizer.ts
export interface PositionSizingInput {
  direction: SignalDirection
  price: number
  portfolioValue: number
  currentHoldingShares?: number
  currentHoldingValue?: number
  currentTotalPositionValue?: number
  winRate?: number
  profitLossRatio?: number
}

export interface PositionSizingResult {
  action: 'buy' | 'sell' | 'hold'
  targetShares: number
  targetValue: number
  positionPct: number
  kellyPct: number
  roundedDown: boolean
  cappedBy: 'single' | 'total' | 'min' | 'max' | 'none'
}

// src/services/trading/riskEngine.ts
export interface OrderRiskInput {
  symbol: string
  direction: SignalDirection
  quantity: number
  price: number
  portfolioValue: number
  source?: 'mcp' | 'manual' | 'strategy'
}

export interface RiskCheckResult {
  ok: boolean
  warnings: string[]
  blocks: string[]
}

// src/services/trading/scoringAdapter.ts
export interface CompositeScoreView {
  symbol: string
  v6Score: number | null
  intelligentScore: number | null
  industryScore: number | null
  valuationScore: number | null
  composite: number | null
  rationale: string
  scoredAt: number | null
}

export interface ScoringAdapterOptions {
  weights?: { v6: number; intelligent: number; industry: number }
  fallbackToV6?: boolean
}

// src/services/trading/portfolioService.ts
export interface PortfolioInput {
  stocks: Stock[]
  orders: Order[]
}

// src/services/trading/portfolioBuilder.ts
export interface PortfolioBuilderInput {
  theme: ThemeConfig
  stocks: Stock[]
  totalPortfolioValue?: number
  currentHoldings?: Record<string, number>
  scoringOptions?: Parameters<typeof getCompositeScores>[1]
  ruleConfig?: StrategyRuleConfig
}

export interface PortfolioBuilderOptions {
  minPrice?: number
  skipThemeMatch?: boolean
}

export interface StrategyPortfolioResult {
  portfolio: Portfolio
  strategyResult: StrategyResult
}

// src/services/trading/strategySnapshotService.ts
export interface StrategyGroupItem {
  symbol: string
  name: string
  composite: number
  l3v: number
  l1Score?: number
  l3fScore?: number
  l7Score?: number
  resonance?: number
  classification: 'core' | 'hot' | 'value'
  reasons: string[]
}

export interface ClassifyStocksInput {
  stocks: Stock[]
  v6Scores: V6Score[]
  rotationScores: RotationSectorScore[]
}

// src/services/trading/watchlistMoversService.ts —— 已于 2026-08-15 删除（死代码）
// 历史保留接口定义（仅供历史文档参考，源文件已不存在）：
// export interface WatchlistMover {
//   name: string
//   code: string
//   price: number
//   changePercent: number
// }
// export interface WatchlistMoversResult {
//   gainers: WatchlistMover[]
//   losers: WatchlistMover[]
//   mostActive: WatchlistMover[]
// }

// src/services/trading/positionComputer.ts
export interface MatchedTradePair extends TradePair {
  buyDate: string
  sellDate: string
  quantity: number
  realizedAmount: number
}

export interface SymbolTradePair {
  symbol: string
  buyOrders: Order[]
  sellOrders: Order[]
  totalBuy: number
  totalSell: number
  realizedPnl: number
  openPositions: number
  avgCostPrice: number
  pairs: MatchedTradePair[]
}

export interface PositionItem {
  symbol: string
  quantity: number
  avgCost: number
  costValue: number
  direction: 'buy' | 'sell'
  firstBuyAt: number
  lastChangedAt: number
}

// src/services/trading/tradeReviewAI.types.ts（核心复盘类型）
export interface TradeSummary {
  totalTrades: number
  profitableTrades: number
  losingTrades: number
  winRate: number
  profitLossRatio: number
  avgProfit: number
  avgLoss: number
  totalPnL: number
  totalPnLPercent: number
  disciplineScore: number
  totalErrors: number
}

export interface ErrorAnalysis {
  topErrors: Array<{ name: string; severity: string; count: number; psychologicalRoot: string }>
  errorTrend: string
  psychologicalProfile: PsychologicalProfile
  riskProfile: RiskProfile
}

export interface DisciplineAnalysis {
  planAdherenceRate: number
  stopLossExecutionRate: number
  positionManagementScore: number
  emotionControlScore: number
  overallScore: number
  improvements: string[]
}

export interface SkillDevelopment {
  currentLevel: string
  prioritySkills: Array<{ skill: string; importance: 'high' | 'medium' | 'low'; reason: string }>
  recommendedResources: RecommendedResource[]
  userId: string
  dimensions: Array<{ code: SkillDimensionCode; name: string; description: string; currentLevel: SkillLevel; targetLevel: SkillLevel; score: number; gap: number }>
  milestones: Array<{ id: string; title: string; description: string; skillDimension: SkillDimensionCode; targetLevel: SkillLevel; criteria: string[]; achieved: boolean; achievedAt?: number; targetDate: string }>
  learningPath: Array<{ order: number; title: string; description: string; resources: Array<{ type: 'book' | 'course' | 'article' | 'video'; title: string; url?: string }>; exercises: string[]; estimatedHours: number; completed: boolean }>
  overallLevel: SkillLevel
  updatedAt: number
}

export interface ActionPlan {
  immediate: string[]
  shortTerm: string[]
  longTerm: string[]
}

export interface AIDeepInsight {
  pnlAttribution: string[]
  dataPatterns: string[]
  personalizedAdvice: string[]
}

export interface TradeReviewReport {
  generatedAt: number
  summary: TradeSummary
  errorAnalysis: ErrorAnalysis
  disciplineAnalysis: DisciplineAnalysis
  skillDevelopment: SkillDevelopment
  actionPlan: ActionPlan
  aiInsight: AIDeepInsight
  aiInsightSource?: 'llm' | 'rule'
}

export interface TradeReviewRecord {
  id: string
  generatedAt: number
  report: TradeReviewReport
  tradeErrors: TradeError[]
  disciplineScore: number
  skillRoadmap: string[]
  psychologicalProfile: PsychologicalProfile | null
}

export interface PsychologicalProfile {
  primaryType: PsychologicalProfileType
  name: string
  characteristics: string[]
  rootCause: string
  improvementDirection: string
}

export interface RiskProfile {
  riskAppetite: 'conservative' | 'moderate' | 'aggressive'
  maxDrawdown: number
  concentrationLevel: 'low' | 'medium' | 'high'
  suggestions: string[]
}

export interface SkillDimensionDefinition {
  readonly code: SkillDimensionCode
  readonly name: string
  readonly relatedErrors: readonly TradeErrorType[]
  readonly description: string
}

export interface SyncReviewOptions {
  now?: number
}

export interface TradeReviewOptions {
  llmConfig?: import('@/config/llmConfig').PartialLlmConfig
  onProgress?: (phase: string, message: string) => void
  now?: number
}

export interface TradePair {
  buyId: string
  sellId: string
  profitPct: number
  holdDays: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `scanWatchingSignals()` | `() => Promise<TradingSignal[]>` | 扫描观察池全部股票，生成交易信号并持久化 | `DataBridge` 写入失败返回空数组 |
| `adviseForStock(stock)` | `(stock: Stock) => Promise<DataLayerResult<TradeAdvice>>` | 为单只股票生成交易建议（信号+仓位+风控） | 返回 `DataLayerResult` 错误对象 |
| `createBuyOrder(stock, quantity?)` | `(stock: Stock, quantity?: number) => Promise<DataLayerResult<Order>>` | 创建买入订单（含风控检查） | 风控未通过或写入失败返回错误 |
| `createSellOrder(stock, quantity?)` | `(stock: Stock, quantity?: number) => Promise<DataLayerResult<Order>>` | 创建卖出订单（含风控检查） | 同上 |
| `getWatchlistStocks()` | `() => Promise<DataLayerResult<Stock[]>>` | 获取观察池股票列表 | `DataBridge` 查询失败返回错误 |
| `getOrders()` | `() => Promise<DataLayerResult<Order[]>>` | 获取全部订单流水 | `DataBridge` 查询失败返回错误 |
| `loadPortfolioInput()` | `() => Promise<PortfolioInput>` | 从 IndexedDB 加载组合构建所需数据 | 抛出异常 |
| `buildPortfolioFromRealData()` | `() => Promise<StrategyPortfolioResult>` | 基于真实数据构建核心组合与策略筛选结果 | 抛出异常 |
| `buildThemePortfolio(input, options?)` | `(input: PortfolioBuilderInput, options?: PortfolioBuilderOptions) => Promise<Portfolio>` | 按主题与评分构建目标投资组合 | 抛出异常 |
| `buildStrategyFilteredPortfolio(input, options?)` | `(input: PortfolioBuilderInput, options?: PortfolioBuilderOptions) => Promise<StrategyPortfolioResult>` | 先经策略引擎筛选，再构建主题组合 | 抛出异常 |
| `calculatePosition(input)` | `(input: PositionSizingInput) => PositionSizingResult` | 纯函数：计算目标仓位（半凯利+约束） | 纯计算，无副作用 |
| `checkOrderRisk(input)` | `(input: OrderRiskInput) => Promise<RiskCheckResult>` | 异步风控检查：冷却期、仓位、次数等 | 返回 `blocks`/`warnings` |
| `generateSignalsForSymbol(symbol)` | `(symbol: string) => Promise<TradingSignal[]>` | 基于行情数据生成单股交易信号 | 数据不足返回 `watch` 信号 |
| `pickStrongestSignal(signals)` | `(signals: TradingSignal[]) => TradingSignal \| undefined` | 从信号组中挑选最强信号 | 纯计算 |
| `getCompositeScore(stock, options?)` | `(stock: Stock, options?: ScoringAdapterOptions) => Promise<CompositeScoreView>` | 聚合 V6/智能/行业评分为单一视图 | `logger.warn` 记录读取失败 |
| `getCompositeScores(stocks, options?)` | `(stocks: Stock[], options?: ScoringAdapterOptions) => Promise<CompositeScoreView[]>` | 批量获取综合评分 | 同上 |
| `classifyStocks(input)` | `(input: ClassifyStocksInput) => StrategyGroupItem[]` | 按三策略分类股票 | 纯计算 |
| `saveStrategySnapshot(input, trigger?)` | `(input: ClassifyStocksInput, trigger?: string) => Promise<DataLayerResult<StrategySnapshot>>` | 保存策略快照到 IndexedDB | `DataLayer` 写入失败返回错误 |
| `getLatestSnapshot()` | `() => Promise<DataLayerResult<StrategySnapshot \| undefined>>` | 获取最新策略快照 | `DataLayer` 查询失败返回错误 |
| `listSnapshots(limit?)` | `(limit?: number) => Promise<DataLayerResult<StrategySnapshot[]>>` | 列出历史策略快照 | `DataLayer` 查询失败返回错误 |
| ~~`computeWatchlistMovers(watchlist, topN?)`~~ | ~~`(watchlist: WatchlistData[], topN?: number) => WatchlistMoversResult`~~ | ~~纯函数：计算自选股异动榜~~ | **已删除（2026-08-15 死代码清理）** |
| `buildTradePairs(orders)` | `(orders: Order[]) => SymbolTradePair[]` | FIFO 配对计算交易对与已实现盈亏 | 纯计算 |
| `buildPositions(tradePairs)` | `(tradePairs: SymbolTradePair[]) => PositionItem[]` | 从交易对派生当前持仓列表 | 纯计算 |
| `generateReview(...)` | `(...) => Promise<TradeReviewReport>` | AI 交易复盘报告（Facade，来自 useCase） | 由 useCase 处理 |
| `generateReviewAsync(...)` | `(...) => Promise<TradeReviewReport>` | 异步版 AI 交易复盘报告（Facade） | 由 useCase 处理 |
| `generatePsychologicalProfile(...)` | `(...) => PsychologicalProfile` | 生成心理画像 | 纯计算 |
| `generateRiskProfile(...)` | `(...) => RiskProfile` | 生成风险画像 | 纯计算 |

### 2.3 事件接口

> 当前子域未通过 `EventBus` 发布事件。数据回流通过 `DataBridge` 写入 IndexedDB 后，由 `store/` 层订阅并广播。

---

## 3. 数据流

```
[外部行情 / 数据采集层 (data-collector/fetcher)]
        ↓
DataLayer.stocks / DataLayer.dailyQuotes
        ↓
tradingService.scanWatchingSignals() / signalGenerator.generateSignalsForSymbol()
        ↓ (DataBridge.forward() 或 dataLayer.signals.save)
DataBridge → routeToDB() → dataLayer → IndexedDB (signals / orders / strategy_snapshots)
        ↓ (Store 订阅)
tradingStore / orderStore / signalStore / portfolioStore / positionStore / strategySnapshotStore
        ↓
pages/trading/* / apps/trading/* / cockpit/widgets (PortfolioOverviewWidget, SignalMonitorWidget, etc.)
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（portfolio、风控、评分、快照、复盘） |
| nanoid | `nanoid` | 生成唯一 ID（订单、信号、组合） |

> 注：本子域未直接消费 `eventBus`、`format`、`errors` 等 lib 模块；错误以返回值或异常方式传递。

### 4.2 跨子域依赖（services/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| `useCase` | `@/services/useCase/generateTradeReview.useCase` | AI 交易复盘报告用例 |
| `useCase` | `@/services/useCase/runDualStrategy.useCase` | 双策略运行用例 |
| `useCase` | `@/services/useCase/hotSectorQuery.useCase` | 热点板块查询用例 |
| `input` | `@/services/input/hotSectorService` | 热点板块类型引用 |
| `llm` | `@/services/llm/llmTypes` | LLM 消息类型（复盘增强） |

### 4.3 核心 / 数据 / 配置依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| `dataBridge` | `@/core/databridge` | 订单/信号写入与查询 |
| `EnvelopeFactory` | `@/core/envelope` | 构建信封 |
| `dataLayer` | `@/data/dataLayer` | 直接查询 stocks、orders、quotes、scores、snapshots |
| `dbConfig` | `@/config/dbConfig` | 模块 ID、信封动作、Store 名称、订单状态常量 |
| `tradingConfig` | `@/config/tradingConfig.ts` | 交易配置（风控、凯利、信号阈值） |
| `thresholds` | `@/config/thresholds.ts` | 信号生成、复盘、风控阈值常量 |
| `themeRegistry` | `@/config/themeRegistry.ts` | 主题配置与匹配 |
| `strategyRules` | `@/config/strategyRules.ts` | 策略规则配置 |
| `mathConstants` | `@/config/mathConstants.ts` | 年化交易日、VaR Z 值、毫秒每天 |

### 4.4 配置项

| 配置名 | 来源 | 说明 |
|--------|------|------|
| `tradingConfig.risk` | `src/config/tradingConfig.ts` | 组合净值、单笔/总仓位上限、最大日交易次数、冷却期、数据新鲜度 |
| `tradingConfig.kelly` | `src/config/tradingConfig.ts` | 半凯利比例、默认胜率/盈亏比、最小/最大仓位、整手单位 |
| `tradingConfig.signalThresholds` | `src/config/tradingConfig.ts` | 信号生成阈值（RSI、量比、MACD、PE/PB） |
| `SIGNAL_GENERATOR_THRESHOLDS` | `src/config/thresholds.ts` | 技术指标计算最小样本数 |
| `TRADE_REVIEW_AI_THRESHOLDS` | `src/config/thresholds.ts` | 复盘评分阈值 |
| `RISK_THRESHOLDS` | `src/config/thresholds.ts` | 风险计算阈值 |
| `CORE_RESOURCE_THEME` | `src/config/themeRegistry.ts` | 默认主题配置（第四次工业革命稀缺核心资源） |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/trading/*.test.ts`（共 8 个） | 纯函数与业务逻辑，覆盖交易复盘、技能发展、维度定义、LLM 增强、画像生成、报告生成、工具函数、观察池异动榜 |
| 集成测试 | `tests/services/trading.integration.test.ts` | **待补充**：建议覆盖 DataBridge 订单写入、Store 联动、信号生成端到端 |
| Mock 策略 | `__mocks__/tradingService.ts` | **待补充**：隔离外部行情与 dataLayer 依赖 |

**现有测试清单**：
- `tradeReviewAI.test.ts`
- `tradeReviewAI.dimensions.test.ts`
- `tradeReviewAI.llmEnhancer.test.ts`
- `tradeReviewAI.profileGenerator.test.ts`
- `tradeReviewAI.reportGenerator.test.ts`
- `tradeReviewAI.skillDevelopment.test.ts`
- `tradeReviewAI.utils.test.ts`
- ~~`watchlistMoversService.test.ts`~~（已删除，2026-08-15 死代码清理）

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 确认 `useCase` / `input` / `llm` 跨子域依赖是否符合 `../../AGENTS.md` 分层规则（当前 `services/` 存在互调）。
> 2. 将分散的测试文件归拢至 `__tests__/` 目录，或补充集成测试。
> 3. 补充 `__mocks__/tradingService.ts` Mock 实现。
> 4. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
