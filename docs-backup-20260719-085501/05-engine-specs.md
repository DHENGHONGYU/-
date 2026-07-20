# 05. 引擎规格

> **Status**: Current  
> **Version**: v2.5.0  
> **Last Updated**: 2026-07-05
>
> 本文档定义 V9 的分析引擎、交易引擎、评分模型与跨模块通信协议（DataBridge / Envelope）。  
> 目标读者：前端/全栈开发者、算法研究员、测试工程师。  
> 与规划基线的差异见 `docs/implementation/architecture-version-comparison.md`。

---

## 1. 引擎层定位

引擎层（L3）是**纯粹的业务计算层**，职责边界如下：

| 职责 | 属于引擎层 | 不属于引擎层 |
|------|-----------|-------------|
| 评分计算、信号生成、风控判断、池间流转校验、数据采集适配 | ✅ | |
| 直接操作 IndexedDB 原生 API | | ✅，由 L2 `src/data/db.ts` 统一封装 |
| 跨模块写操作 | | ✅，通过 `DataBridge.forward()` 委托 |
| UI 渲染、路由跳转、DOM 操作 | | ✅，由 L5/L4 负责 |
| 读取业务数据 | ✅（经 `dataLayer` 或 Service） | |

### 1.1 数据采集引擎（Fetcher）

数据采集引擎负责对接外部数据源（当前为本地 Python AKShare 服务），将原始数据清洗为 V9 内部模型，并经 `DataBridge.forward()` 写入 `Stock` 等存储。

```
L5/L4 apps/pages
    ↓ 调用 services/fetcher/fetcherService.ts
    ↓ src/config/fetcherConfig.ts  # 服务地址、维度、预设
L3  services/fetcher/
    ├── fetcherClient.ts      # HTTP 客户端
    ├── fetcherAdapter.ts     # AKShare 响应 → Stock
    ├── fetcherService.ts     # 高层 API + DataBridge 写入
    └── fetcherScheduler.ts   # 定时/事件/手动调度
    ↓ DataBridge.forward(source=MODULE_ID.fetcher)
L2  dataLayer / IndexedDB
```

**关键约束**：

- `fetcher` 是 `MODULE_ID` 之一，ACL 已授予其对 `stocks`、`daily_quotes` 的 `insert/update` 权限。
- 所有写操作必须使用 `ENVELOPE_ACTION.updateStock`、`insertStock` 或 `saveDailyQuotes`，禁止绕过 DataBridge。
- 配置层 `src/config/fetcherConfig.ts` 不依赖 `services/` 或 `core/`，仅提供类型与默认值。
- `daily_quotes` 存储单只标的最新 K线与历史行情，主键 `symbol`；`Stock.price` 由 `latest.close` 同步更新。
- **采集层只采集、不计算指标或判断趋势**；指标计算由 `AnalysisScheduler` / `v6ScoreService` 负责。

### 1.2 数据融合引擎（Data Fusion Engine）

数据融合引擎负责将多源数据融合为统一视图，是数据感知层的核心组件。

**设计目标**：
- **统一数据模型**：`UnifiedStockData` 聚合基础数据、K线、财务、评分、信号
- **数据质量感知**：融合时检查各数据源完整性
- **版本一致性**：保证融合数据的版本对齐
- **延迟加载**：按需加载非核心数据维度

**目录结构**：
```
src/services/analysis/
├── unifiedStockService.ts    # 统一数据视图服务
├── dataFusionEngine.ts       # 数据融合引擎
└── unifiedStockTypes.ts      # 统一数据类型定义
```

**UnifiedStockData Schema**：
```ts
interface UnifiedStockData {
  symbol: string;
  basic: StockBasic;
  kline: DailyQuotes | null;
  finance: StockFinance | null;
  v6Score: V6Score | null;
  intelligentScore: IntelligentScore | null;
  signals: TradingSignal[];
  dataQuality: StockDataQuality;
  lastFusedAt: number;
}
```

**融合流程**：
```
getUnifiedStockData(symbol)
  → 并行加载 basic + kline + v6Score + signals
  → 校验各数据源完整性，更新 dataQuality
  → 组装 UnifiedStockData
  → 返回（可选缓存）
```

**当前状态**：✅ 已实现。`UnifiedStockData` 类型定义于 `src/data/types.ts`，`getUnifiedStockView.useCase.ts` 已实现跨源融合查询。

### 1.3 数据流引擎（DataFlow Engine）

数据流引擎负责管理数据通道的订阅、缓存、定时刷新与优先级分发。

**设计目标**：
- **实时推送**：支持 SSE 推送 + 轮询回退
- **内存缓存**：10秒 TTL，最大 200 条目
- **通道元数据**：`refreshInterval`、`priority`、`persist` 配置
- **慢订阅者检测**：microtask 异步分发，超 16ms 警告
- **序列号追踪**：检测数据丢失

**目录结构**：
```
src/core/dataflow/
├── dataflowEngine.ts      # 数据流引擎核心
├── dataflowTypes.ts       # 类型定义
└── defaultDataBuilder.ts  # 默认数据构建器
src/store/
└── dataflowStore.ts       # 状态管理
```

**当前状态**：🟡 部分实现。已支持 SSE/轮询、内存缓存、定时刷新、慢订阅者检测、通道 priority 字段；TTL/容量上限/按优先级排序分发待完善。详细字段与 API 见 `docs/DATAFLOW_DATA_DEFINITION.md`。

### 1.4 未来可扩展

| 扩展方向 | 说明 | 优先级 |
|----------|------|--------|
| Agent 调度层 | V10 的 `src/agents/` 用于多 Agent 协同；V9 当前以函数式服务层为主 | P2/P3 |
| Trading Gateway 抽象 | 将 `src/services/trading/` 抽象为 `ITradingGateway`，支持模拟/真实券商切换 | P3 |
| Sector Factor Updater | 定时轮询 `sector_scores`，输出板块轮动信号 | P2 |

---

## 2. 分析引擎

### 2.1 V6 九维评分引擎

#### 设计目标

为单只股票生成 0–5 分的综合评分与九维因子得分，支持**离线自动评分**与**联网 LLM 增强评分**两种模式。

#### 因子定义

因子集中配置在 `src/config/scoreFactors.ts`：

| 因子 key | 名称 | 权重 | 数据来源 | 当前实现状态 |
|----------|------|------|----------|-------------|
| valuation | 估值 | 1 | PE/PB/PS/PEG | 模拟随机数 |
| growth | 成长 | 1 | 营收/利润增速 | 模拟随机数 |
| profitability | 盈利 | 1 | ROE/毛利率/现金流 | 模拟随机数 |
| quality | 质量 | 1 | 资产负债表/治理 | 模拟随机数 |
| momentum | 动量 | 1 | 价格趋势/相对强度 | 模拟随机数 |
| volatility | 波动 | 1 | 波动率/回撤 | 模拟随机数 |
| liquidity | 流动性 | 1 | 成交量/市值/换手 | 模拟随机数 |
| industry | 行业 | 1 | 行业景气度 | 模拟随机数 |
| sentiment | 情绪 | 1 | 资金流向/事件催化 | 模拟随机数 |

> 当前 v0.9.0 使用随机数生成因子分（`src/services/scoring/v6ScoreService.ts`），用于验证端到端链路。真实数据接入后，权重与口径以 `scoreFactors.ts` 为唯一真相源。

#### 计算流程

```
用户选择股票
  → runV6Score(symbol)
  → dataLayer.stocks.get(symbol) 校验存在性
  → 按 FACTOR_NAMES 逐项打分
  → 算术平均得到综合分 score
  → 组装 V6Score 对象（symbol, score, factors, algorithmVersion, calculatedAt, dataVersion）
  → dataLayer.v6Scores.save(v6Score)
  → 返回 DataLayerResult<V6Score>
```

#### 接口签名

```ts
// src/services/scoring/v6ScoreService.ts
export async function runV6Score(
  symbol: string
): Promise<DataLayerResult<V6Score>>
```

---

### 2.2 V6 个股智能评分引擎（LLM 增强）

#### 设计目标

在用户上传研报/公告/ notes 后，调用大模型生成带**证据链**的九维评分；允许部分维度因数据缺失而为 `null`，最终综合分仅对有效维度加权平均。

#### 关键文件

| 文件 | 职责 |
|------|------|
| `src/services/scoring/intelligentScoreService.ts` | 编排：读取股票 → 构造 prompt → 调用 LLM → 解析 → 持久化 |
| `src/services/scoring/intelligentScorePrompt.ts` | 生成结构化 prompt，约束 LLM 返回 JSON Schema |
| `src/services/scoring/intelligentScoreSkill.ts` | 类型守卫与结果校验 |
| `src/services/llm/llmClient.ts` | 统一 LLM 调用客户端，处理配置、重试、错误 |

#### 输出 Schema

```ts
{
  dimensions: Array<{
    name: string        // 九维名称之一
    score: number | null
    rationale: string
    evidence: string[]
  }>
  summary: string      // 综合判断
  basis: string        // 依据说明
  missingFields: string[]
}
```

#### 加权逻辑

使用 `src/config/scoreFactors.ts` 中的 `calculateWeightedScore()`：仅对 `score !== null` 且因子 `enabled` 的维度参与加权；若全部缺失返回 `null`。

#### 异常与边界

| 场景 | 行为 |
|------|------|
| LLM 配置缺失 | `LlmConfigError`，返回 `{ success: false, error }` |
| LLM 返回非 JSON | 由 prompt 显式要求 JSON；解析失败时返回错误 |
| 股票不存在 | 返回错误，不触发 LLM 调用 |
| 全部维度缺失 | `overallScore` 为 `null` |

---

### 2.3 V4 行业评分引擎

#### 设计目标

对行业或板块进行七维评分，为个股「行业」因子与板块轮动策略提供输入。

#### 因子定义

配置于 `src/config/scoreFactors.ts` 的 `INDUSTRY_SCORE_FACTORS`：

| 因子 key | 名称 |
|----------|------|
| policyAlignment | 政策契合度 |
| scarcity | 稀缺性 |
| localization | 国产替代空间 |
| techAdvancement | 技术先进性 |
| prosperity | 行业景气度 |
| valuation | 估值吸引力 |
| sentiment | 情绪热度 |

#### 关键文件

| 文件 | 职责 |
|------|------|
| `src/services/scoring/industryScoreService.ts` | 行业评分编排与持久化 |
| `src/services/scoring/industryScorePrompt.ts` | LLM prompt |
| `src/services/scoring/industryScoreSkill.ts` | 类型守卫 |

---

### 2.4 板块轮动评分引擎（Sector Rotation Engine）

#### 设计目标

基于五因子十六指标模型，对行业板块进行量化轮动评分，为交易策略提供板块选择信号。

#### 五因子模型

| 因子 | 指标 | 权重 | 说明 |
|------|------|------|------|
| **景气度因子** | 营收增速、净利润增速、毛利率变化 | 25% | 行业基本面强弱 |
| **估值因子** | PE分位、PB分位、PS分位 | 20% | 估值吸引力 |
| **动量因子** | 相对强弱RS、价格趋势、量能变化 | 20% | 市场趋势方向 |
| **资金因子** | 北向资金占比、融资融券变化 | 15% | 资金流向 |
| **政策因子** | 政策契合度、新闻热度 | 20% | 外部催化 |

#### 十六指标明细

| 指标 | 计算方式 |
|------|----------|
| 营收增速 | YoY增长率 |
| 净利润增速 | YoY增长率 |
| 毛利率变化 | 当前毛利率 - 去年同期毛利率 |
| PE分位 | 当前PE在过去5年中的百分位 |
| PB分位 | 当前PB在过去5年中的百分位 |
| PS分位 | 当前PS在过去5年中的百分位 |
| 相对强弱RS | 板块指数 / 沪深300指数 |
| 价格趋势 | MA20/MA60 比率 |
| 量能变化 | 近20日均量 / 近60日均量 |
| 北向资金占比 | 北向资金持股比例 |
| 融资余额变化 | 融资余额YoY变化 |
| 融券余额变化 | 融券余额YoY变化 |
| 政策契合度 | LLM评估行业与当前政策契合度 |
| 新闻热度 | 近30天相关新闻数量 |
| 行业集中度 | CR5/CR10 |
| 技术壁垒 | 专利数量/研发投入占比 |

#### 轮动信号生成

```
runSectorRotation()
  → 获取所有行业评分
  → 按五因子模型加权计算综合得分
  → 排序选出TOP5强势行业
  → 对比上期TOP5，识别新进/退出行业
  → 生成轮动信号：rotate_in / rotate_out / hold
  → 持久化轮动记录
  → 返回轮动建议
```

#### 关键文件

| 文件 | 职责 |
|------|------|
| `src/services/analysis/rotationScoreService.ts` | 板块轮动评分计算（五因子十六指标模型已实现，上层展示待完善） |

#### 当前状态

| 状态 | 说明 |
|------|------|
| 🟡 五因子十六指标模型 | 已实现，上层展示待完善 |
| 🟡 行业评分 | V4行业评分已定义，部分可用 |
| 🟡 轮动信号 | 基础评分已实现，上层展示待完善 |

---

### 2.5 双策略评分引擎（Dual Strategy Engine）

#### 设计目标

支持「热门板块策略」与「价值洼地策略」两条独立选股路径，输出结构化的 `HotSectorScore` / `ValuePitScore`，并配套轮动信号检测引擎决定价值洼地候选的建仓或观察池流转。

#### 热门板块评分（HotSectorScore）

| 维度 | 说明 | 数据来源 |
|------|------|----------|
| **动量 Momentum** | 价格趋势与相对强度 | `daily_quotes`（MA20/MA60、涨幅） |
| **情绪 Sentiment** | 市场热度与资金流向 | 行业评分、新闻热度、资金净流入 |
| **技术 Technical** | 技术指标状态 | RSI、MACD、成交量突破 |
| **估值 Valuation** | 当前估值水平 | PE/PB 分位、PEG |
| **综合 Composite** | 四维加权总分 | HotSectorAnalyzer 内部加权 |

#### 价值洼地评分（ValuePitScore）

| 维度 | 说明 | 数据来源 |
|------|------|----------|
| **催化 Catalyst** | 潜在催化剂与事件驱动 | 新闻/公告/研报关键词、行业政策 |
| **估值 Valuation** | 低估值吸引力 | PE/PB 分位、DCF 安全边际 |
| **筹码 Chip** | 股东结构集中度 | 换手率、机构持仓变化 |
| **轮动 Rotation** | 板块轮动评分 | `rotationScoreService.ts` 五因子模型 |
| **流动性 Liquidity** | 成交活跃度 | 近 20 日成交额/市值、换手率 |

#### 轮动信号检测

对 `ValuePitScore` 评分处于 3.0–4.0 区间的候选，检测以下三条件：

1. **成交量放大**：近 5 日均量 / 近 20 日均量 ≥ 1.5；
2. **资金净流入**：主力或北向连续 N 日净流入；
3. **技术金叉**：MACD 金叉或价格站上 MA20/MA60。

命中全部条件 → 生成 `buy_rotation` 交易信号；未命中 → 加入观察池候选。

#### 关键文件

| 文件 | 职责 |
|------|------|
| `src/services/trading/hotSectorAnalyzer.ts` | 热门板块策略五维评分 |
| `src/services/trading/valuePitAnalyzer.ts` | 价值洼地策略五维评分 |
| `src/services/trading/rotationSignalDetector.ts` | 价值洼地轮动信号检测 |
| `src/services/trading/dualStrategyEngine.ts` | 编排上述服务，输出 `DualStrategyResult` |
| `src/config/dualStrategyRules.ts` | 双策略阈值与轮动信号条件配置 |

#### 当前状态

| 状态 | 说明 |
|------|------|
| 🔴 双策略评分类型 | `HotSectorScore` / `ValuePitScore` 类型与 Store 待新增 |
| 🔴 热门板块分析器 | `hotSectorAnalyzer.ts` 待实现 |
| 🔴 价值洼地分析器 | `valuePitAnalyzer.ts` 待实现 |
| 🔴 轮动信号检测 | `rotationSignalDetector.ts` 待实现 |
| 🔴 驾驶舱 Widget | `HotSectorWidget` / `ValuePitWidget` 待实现 |

---

## 3. 输入舱服务层

输入舱本身属于 L4 应用层，但其核心逻辑已下沉到 L3 服务层：

```
src/services/input/
├── inputService.ts          # 搜索、导入/导出候选池
├── batchImportService.ts    # 批量文本解析与入库
└── hotSectorService.ts      # 热门板块推荐与关联股票

src/config/fetcherConfig.ts  # 采集配置

src/services/fetcher/
├── fetcherClient.ts         # HTTP 客户端
├── fetcherAdapter.ts        # AKShare 响应 → Stock
├── fetcherService.ts        # 高层 API + DataBridge 写入
└── fetcherScheduler.ts      # 定时/事件/手动调度
```

**关键约束**：

- 输入舱写操作使用 `source: 'input-cabin'`，action 限定为 `INSERT_STOCK`、`UPDATE_STOCK`、`BULK_IMPORT`、`SAVE_DAILY_QUOTES`。
- `Stock.dataQuality` 由 `fetcherService` 或 `inputService` 在采集/导入后更新。
- 批量导入的解析状态（valid/duplicate/invalid）由 `batchImportService` 返回，UI 仅负责展示。

---

## 4. 交易引擎

### 3.1 定位

交易引擎基于评分结果、市场数据与交易规则生成买卖信号，经风控检查后产生模拟订单，并在交易完成后进行错误识别与复盘分析。**研究体系不依赖交易层**：删除 `src/apps/trading/` 与 `src/services/trading/` 后，选股、评分、复盘功能保持完整。

### 3.2 目录结构

```
src/services/trading/
├── tradingService.ts       # 订单 CRUD（已落地）
├── signalGenerator.ts      # 买卖信号生成（已落地）
├── positionSizer.ts        # 仓位计算（Kelly + 金字塔，已落地）
├── riskEngine.ts           # 风控检查（已落地）
├── positionComputer.ts     # FIFO 配对+持仓构建纯函数（已落地，v2.5.0 新增）
├── pnlComputer.ts          # 盈亏汇总计算纯函数（已落地，v2.5.0 新增）
├── riskComputer.ts         # 风险指标计算纯函数（已落地，v2.5.0 新增）
├── tradeErrorClassifier.ts # 12 类交易错误检测（待建）
└── tradeReviewAI.ts        # 复盘报告与 AI 洞察（待建）

src/services/useCase/
├── createExecutionPlan.useCase.ts     # 创建执行计划 UseCase（已落地，v2.5.0 新增）
├── executePlan.useCase.ts             # 执行计划执行 UseCase（已落地）
├── fetchSectorAnalysis.useCase.ts     # 板块分析数据加载 UseCase（已落地，v2.5.0 新增）
├── fetcherOrchestrator.useCase.ts     # 数据采集编排 UseCase（已落地）
├── generateTradeReview.useCase.ts     # 交易复盘生成 UseCase（已落地）
├── getUnifiedStockView.useCase.ts     # 统一数据视图查询 UseCase（已落地）
├── hotSectorQuery.useCase.ts          # 热门板块查询 UseCase（已落地）
├── rebalancePortfolio.useCase.ts      # 组合再平衡 UseCase（已落地）
├── runDualStrategy.useCase.ts         # 双策略编排 UseCase（已落地）
├── strategySnapshotSave.useCase.ts    # 策略快照保存 UseCase（已落地）
└── submitOrder.useCase.ts             # 提交订单 UseCase（已落地）
```

### 3.3 当前实现（v0.9.3）

- `tradingConfig.ts`：交易引擎全部阈值与参数集中配置（信号阈值、Kelly 参数、风控阈值）。
- `signalGenerator.ts`：基于 K 线计算 MA20/MA60、RSI14、量比、MACD 方向，生成 `buy_dip`、`buy_pivot`、`sell_profit_taking`、`sell_trailing_stop`、`hold`、`watch` 及同方向共振 `composite` 信号。
- `positionSizer.ts`：采用 1/4 Kelly 公式计算目标仓位，按整手取整，并受单笔/总仓位上限约束。
- `riskEngine.ts`：在下单前校验价格/数量、数据新鲜度、同标的冷却期、当日交易次数、单笔/总仓位上限、卖出持仓充足性。
- `tradingService.ts`：买入/卖出订单创建已接入风控检查；新增 `scanWatchingSignals`、`adviseForStock` 为 UI 提供信号+仓位+风控一体化建议。
- `themeRegistry.ts`（`src/config/`）：定义“第四次工业革命稀缺核心资源”等主题，提供行业代码/sector/代码白名单/主题标签匹配规则。
- `scoringAdapter.ts`：聚合 V6 自动评分、V6 个股智能评分、V4 行业评分为统一 `CompositeScoreView`。
- `portfolioBuilder.ts`：按主题筛选 → 评分过滤 → 排序 → 等权分配 → 生成持仓明细与再平衡计划；提供 `buildCoreResourcePortfolio()` 便捷函数。
- `CoreResourcePanel.tsx`：交易舱“核心稀缺主题组合”面板，展示目标持仓、当前权重、再平衡计划。
- `TradingApp.tsx`：展示观察池交易建议（信号、建议仓位、风控阻塞/提示），支持按建议数量买入/卖出，支持扫描全部信号，支持构建核心稀缺组合。
- `positionComputer.ts`（v2.5.0 新增）：纯函数模块，FIFO 配对（`buildTradePairs`）+ 持仓构建（`buildPositions`）。TradePair 类型体系统一：规范 `TradePair` 类型定义于 `tradeReviewAI.types.ts`，`MatchedTradePair extends TradePair` 增加持仓计算特有字段（buyDate/sellDate/quantity/realizedAmount），`SymbolTradePair` 用于按 symbol 聚合交易对与持仓信息（含配对明细 `pairs: MatchedTradePair[]`），`PositionItem` 表示当前持仓项。`positionComputer.ts` 重新导出 `TradePair` 类型，消费方可从该模块直接导入。
- `pnlComputer.ts`（v2.5.0 新增）：纯函数模块，盈亏汇总（`computePnLSummary`），导出 `PnLSummary` 类型，含胜率/盈亏比/月度盈亏/日度曲线。
- `riskComputer.ts`（v2.5.0 新增）：纯函数模块，风险指标（`computeRiskMetrics`），导出 `RiskMetrics` 类型，含 VaR/最大回撤/波动率/夏普比率/集中度。
- `createExecutionPlanUseCase`（v2.5.0 新增）：创建执行计划 UseCase，5 步业务流程（获取股价→仓位计算→风控检查→构造计划→持久化），输入 `CreateExecutionPlanInput`，输出 `CreateExecutionPlanResult`。
- `fetchSectorAnalysisUseCase`（v2.5.0 新增）：板块分析数据加载 UseCase，4 步流程（并行查询→空数据默认计算→排序→返回合并结果），输入 `FetchSectorAnalysisInput`，输出 `FetchSectorAnalysisResult`。
- 订单 Schema：`id / symbol / direction / quantity / price / amount / status / accountType / createdAt`。
- 新增单测：`tests/signalGenerator.test.ts`、`tests/positionSizer.test.ts`、`tests/riskEngine.test.ts`、`tests/themeRegistry.test.ts`、`tests/scoringAdapter.test.ts`、`tests/portfolioBuilder.test.ts`、`tests/CoreResourcePanel.test.ts`。

### 3.4 信号生成器（SignalGenerator）

信号生成器输出覆盖价值投资者主要交易场景。参数集中配置于 `src/config/tradingConfig.ts`（已建），禁止引擎层硬编码。

#### 买入信号

| 信号 | 默认触发条件 | 置信度 |
|------|-------------|--------|
| `buy_safety_margin` | PE 历史百分位 < 25% 且 PB 历史百分位 < 20% | 0.4–0.9 |
| `buy_dip` | 价格 < MA20 的 8% 且 RSI < 30 | 0.3–0.8 |
| `buy_pivot` | 突破阻力位 + 量比 > 1.5 + MACD 红柱 | 0.5–0.85 |
| `buy_breakout` | 业绩超预期 > 20% | 0.4–0.75 |

#### 卖出信号

| 信号 | 默认触发条件 | 置信度 |
|------|-------------|--------|
| `sell_overvalued` | PE > 75% 分位 或 PB > 80% 分位 | 0.3–0.7 |
| `sell_stop_loss` | 跌破固定止损线 7% | 0.6–0.9 |
| `sell_trailing_stop` | 从最高点回撤 10% | 0.5–0.8 |
| `sell_profit_taking` | 价格 > MA20 的 15% 且 RSI > 70 | 0.4–0.75 |
| `sell_fundamental` | 基本面恶化信号 | 0.5–0.9 |
| `hold` / `watch` | 无明确信号 / 有迹象但不确认 | 0.1–0.3 |

#### 综合共振

当单个标的同时触发多个独立信号时，生成 `Composite Signal`：

```
compositeConfidence = min(1.0, baseConfidence + 0.2 * (signalCount - 1))
```

每个信号附带快照：PE/PB 历史百分位、价格/MA20/MA60 比率、量比、RSI14、MACD 方向、支撑/阻力位。

### 3.5 仓位管理器（PositionSizer）

#### Kelly 公式

$$f^* = \frac{bp - q}{b}$$

- $p$：胜率，$q = 1 - p$：败率，$b$：盈亏比。
- 默认采用 **1/4 Kelly**（`kellyFraction = 0.25`）。
- 单只标的目标仓位通常落在 **3%–15%**。

#### 金字塔加仓

| 策略 | 规则 |
|------|------|
| 正金字塔 | 底仓 50% → 加仓 25% → 加仓 12.5%；仅浮盈 > 5% 时加仓；单票总仓位 ≤ 25%。 |
| 倒金字塔 | 基准价 1× → -5% 买 1.2× → -10% 买 1.5× → -20% 买 2× → -30% 买 3×；需设定最大补仓跌幅阈值。 |

#### 组合风险监控

| 指标 | 预警阈值 |
|------|----------|
| 赫芬达尔指数（集中度） | > 20% |
| 平均浮亏 | > 10% |

### 3.6 风控引擎（RiskEngine）

在生成订单前执行以下检查：

| 检查项 | 默认阈值 | 超限行为 |
|--------|----------|----------|
| 单票仓位上限 | 25% | 拒绝下单 |
| 组合仓位上限 | 80% | 拒绝下单 |
| 每日最大交易次数 | 5 次 | 拒绝下单 |
| 同标的冷却时间 | 24 小时 | 拒绝下单 |
| 数据时效性 | > 48 小时标记 stale | 提示并降权信号置信度 |

### 3.7 交易错误分类器（TradeErrorClassifier）

基于交易数据自动检测 12 类高频错误：

| 错误类型 | 触发条件示例 | 心理根源 | 默认等级 |
|----------|-------------|----------|----------|
| 追涨杀跌 | 入场价高于计划价 > 5% 或入场后回撤 > 3% | FOMO + 从众 | critical/major |
| 提前止盈 | 利润捕捉率 < 50% 且最大浮盈 ≥ 实际盈利 1.5 倍 | 损失厌恶 | major |
| 扛单不止损 | 实际亏损 > 计划止损 1.5 倍 | 希望/否认 | critical |
| 逆势加仓 | 亏损中继续加仓 | 锚定效应 + 赌徒谬误 | major |
| 贪鱼尾 | 利润大幅回吐 | 贪婪 | minor |
| 违反计划 | `planFollowed === false` | 冲动控制障碍 | major |
| 重仓豪赌 | 单票仓位远超风险预算 | 过度自信 | critical |
| 报复性交易 | 连续亏损后高频交易 | 情绪波动 | major |
| FOMO 入场 | 错过主升浪后冲动追入 | 社交焦虑 | major |
| 忽视止损 | 未执行预设止损 | 侥幸心理 | critical |
| 犹豫错过 | 信号触发但未入场 | 近因效应 | minor |
| 过度交易 | 交易次数远超计划 | 交易成瘾 | warning |

#### 纪律评分

$$纪律评分 = 100 - critical \times 15 - major \times 8 - minor \times 3$$

| 分数 | 等级 |
|------|------|
| 90–100 | 优秀 |
| 70–89 | 良好 |
| 50–69 | 警示 |
| < 50 | 危险 |

### 3.8 复盘引擎（TradeReviewAI）

#### 六维复盘报告

1. **交易摘要**：总交易数、盈利笔数、错误数、纪律评分、胜率、盈亏比。
2. **错误分析**：TOP5 错误、错误趋势、心理画像、风险画像。
3. **纪律分析**：计划遵守率、止损执行率、仓位管理评分、情绪控制评分、薄弱环节。
4. **技能发展**：当前水平、优先技能排序、推荐学习资源、刻意练习清单。
5. **行动计划**：立即执行（本周）、短期（1 个月）、长期（3 个月）。
6. **AI 深度洞察**：盈亏归因、数据规律、个性化建议。

#### 入场/出场质量评分

| 维度 | 指标 | 评分逻辑 |
|------|------|----------|
| 入场质量 | MAE（最大不利偏移） | 入场后无大幅回撤得分高 |
| 出场质量 | 利润捕捉率 | 捕捉到最大利润 70% 以上得分高 |
| 择时等级 | A/B/C/D | 综合入场与出场质量 |

### 3.9 订单 Schema 扩展（v1.0.0）

为支持复盘与错误识别，订单表需扩展以下字段：

```ts
interface Order {
  // 基础字段（已存在）
  id: string
  symbol: string
  direction: OrderDirection
  quantity: number
  price: number
  amount: number
  status: OrderStatus
  accountType: AccountType
  createdAt: number

  // 复盘扩展字段
  planStopLoss?: number       // 计划止损价
  planTakeProfit?: number     // 计划止盈价
  planPositionPct?: number    // 计划仓位占比
  planFollowed?: boolean      // 是否遵守计划
  maxDrawdown?: number        // 最大回撤
  maxFloatingProfit?: number  // 最大浮盈
  profitCaptureRate?: number  // 利润捕捉率
  errors?: string[]           // 错误标签
  reviewNoteId?: string       // 关联复盘笔记
}
```

### 3.10 数据新鲜度保障

| 数据维度 | 目标频率 | 最大允许滞后 |
|----------|----------|--------------|
| K 线/价格 | 日频 | ≤ 1 天 |
| 重大事项/新闻 | 日频 | ≤ 1 天 |
| 行业竞品/关联指数 | 3 日 | ≤ 3 天 |
| 研报 | 日频 | ≤ 1 天 |

> 数据时效性校验作为信号生成与评分计算的前置步骤；> 48 小时的数据标记为 `stale` 并触发重新采集或降权。

---

## 4. 数据通信协议：DataBridge / Envelope

### 4.1 为什么需要 Envelope

| 问题 | Envelope 解决方案 |
|------|-------------------|
| 跨层调用混乱 | 所有写操作统一为 `StandardEnvelope`，明确 source/target/action |
| 调试困难 | `traceId` + `timestamp` 实现全链路追踪 |
| 权限失控 | ACL 矩阵在 `DataBridge.forward()` 执行前校验模块-Store-操作三元组 |
| 数据血缘缺失 | 每个 envelope 自动写入 `research_logs` 审计日志 |

### 4.2 信封结构

```ts
// src/core/envelope.ts
interface StandardEnvelope {
  meta: {
    source: ModuleId      // 发起模块，如 'stockpool'
    target: EnvelopeTarget // 'db' | 'analyzer' | 'ui' | 'tradinghub' | 'system'
    action: EnvelopeAction // 'INSERT_STOCK' | 'SAVE_SCORES' | ...
    traceId: string        // 全链路追踪 ID
    timestamp: number      // 毫秒时间戳
  }
  payload: unknown         // 业务数据
}
```

### 4.3 动作清单

定义于 `src/config/dbConfig.ts`：

| Action | Target Store | 说明 |
|--------|-------------|------|
| INSERT_STOCK | stocks | 新增股票 |
| UPDATE_STOCK | stocks | 更新股票（含池间流转） |
| DELETE_STOCK | stocks | 删除股票 |
| SAVE_SCORES | v6_scores | 保存 V6 评分 |
| SAVE_INTELLIGENT_SCORES | intelligent_scores | 保存智能评分 |
| SAVE_INDUSTRY_SCORES | industry_scores | 保存行业评分 |
| INSERT_ORDER | orders | 新增订单 |
| UPDATE_ORDER | orders | 更新订单 |
| DELETE_ORDER | orders | 删除订单 |
| INSERT_SIGNAL | signals | 保存交易信号 |
| SAVE_DAILY_QUOTES | daily_quotes | 保存日行情/K线 |
| RESET_ALL | — | 重置数据库 |
| IMPORT_ALL | — | 批量导入 |
| EXPORT_ALL | — | 导出数据 |

### 4.4 ACL 矩阵

```ts
// src/config/dbConfig.ts ACL_MATRIX
fetcher    → 写 stocks
stockpool  → 读写 stocks / 读 v6_scores
analyzer   → 读 stocks/v6_scores/intelligent_scores/industry_scores / 写三种 score
tradinghub → 读 stocks/v6_scores/orders/signals / 写 orders/signals
system     → 全部
user       → 读写 stocks/orders
```

### 4.5 执行流程

```
EnvelopeFactory.create(meta, payload)
  → dataBridge.forward(envelope)
    1. EnvelopeFactory.validate(envelope)
    2. inferStore(action) + inferOperation(action)
    3. aclEngine.assert({ module, store, operation })
    4. writeAuditLog(envelope, store)
    5. routeToDB(envelope, store) 或 routeToManager(envelope)
    6. broadcast(target, envelope) + eventBus.emit(`${target}:changed`)
```

### 4.6 错误处理

| 错误类型 | 来源 | 处理原则 |
|----------|------|----------|
| `EnvelopeError` | 信封格式非法 / action 未知 / DB 路由失败 | 向上抛错，调用方必须显式捕获 |
| `AclError` | 模块无权限执行某操作 | 向上抛错，禁止静默放行 |
| 审计日志失败 | `writeAuditLog` | 记录 warn，不阻断主流程 |
| 订阅者异常 | `broadcast` | 捕获并记录 error，不中断其他订阅者 |

---

## 5. 池间流转引擎

### 5.1 流转状态

`src/config/dbConfig.ts` 定义：

```ts
candidate → screened → deepDive → watching → archived
```

### 5.2 校验规则

由 `src/core/poolTransitionEngine.ts` 负责：

- 禁止逆向跳转（如 `archived → candidate` 必须经恢复操作）。
- 目标状态必须是预定义值之一。
- 触发流转时须通过 `DataBridge.forward(UPDATE_STOCK)` 更新 `researchStatus`。

### 5.3 事件通知

流转成功后，通过 `eventBus.emit('stocks:changed')` 通知订阅了该通道的 UI 组件刷新列表。

---

## 6. 实现约束

1. **禁止引擎层直接写 DB**：所有写操作必须使用 `DataBridge.forward()`。
2. **禁止引擎层硬编码阈值**：评分阈值、风控参数来自 `src/config/`。
3. **禁止静默容错**：`?? []` / `|| 0` 等隐式兜底在引擎层被禁止；缺失数据应显式返回 `null` 或错误。
4. **复杂度标注**：任何 O(n²) 以上算法必须加注释说明并给出优化路径。
5. **测试要求**：引擎函数必须附带单元测试，覆盖成功路径与主要异常路径。

---

## 7. 当前偏差与下一步

| 偏差 | 影响 | 计划 |
|------|------|------|
| V6 自动评分仍部分依赖随机数/模拟数据 | 评分质量取决于真实数据完整度 | Phase 2 持续接入 AKShare/真实数据 |
| LLM 评分依赖外部网络 | 离线不可用 | 已设计回退到自动评分，需在 UI 层显式提示 |
| 信号系统未与评分引擎联动 | 交易信号主要基于技术指标，未充分融合 V6 评分 | Phase 2 将 V6 评分作为信号因子输入 |
| 🟢 已修复：输入舱 `inputConfig.ts` 已落地 | 搜索/导入/质量规则已集中配置 | 持续补充高级筛选与批量规则 |

---

## 8. 版本比对

本文档当前版本为 `v0.9.0-docs-review`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `docs/implementation/architecture-version-comparison.md`

主要变化：

1. 新增第 3 节「输入舱服务层」，明确输入舱服务目录、数据协议与约束。
2. 交易引擎目录结构更新为已落地状态（signalGenerator/positionSizer/riskEngine）。
3. `EnvelopeAction` 清单增加 `SAVE_DAILY_QUOTES`、`INSERT_SIGNAL`。
4. ACL 矩阵更新 tradinghub 对 `signals` 的读写权限。
5. 偏差清单更新，移除已完成的交易风控项与输入舱配置项；新增信号-评分联动项。
6. v2.5.0：交易引擎目录新增 `positionComputer.ts`/`pnlComputer.ts`/`riskComputer.ts`（纯函数模块）。
7. v2.5.0：新增 `src/services/useCase/` 目录，含 11 个 UseCase 文件（createExecutionPlan/executePlan/fetchSectorAnalysis/fetcherOrchestrator/generateTradeReview/getUnifiedStockView/hotSectorQuery/rebalancePortfolio/runDualStrategy/strategySnapshotSave/submitOrder）。
8. v2.5.0：补充 TradePair 类型体系统一说明（`MatchedTradePair extends TradePair`，`SymbolTradePair` 按 symbol 聚合）。
