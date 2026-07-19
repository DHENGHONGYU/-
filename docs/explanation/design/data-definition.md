---
title: data-definition
type: explanation
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "Widget 数据定义说明（类型源�?widget.types.ts），含各组件数据结构�?
tags: [data, data-definition, definition, plan, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-004
referenced_by: [V9-DOC-PROJ-174, V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

> **Version**: v1.2.0  
> **Last Updated**: 2026-07-06  
> **Maintainer**: 架构资产治理�?
# Cockpit Widget 框架数据字典

> **Date**�?026-06-26
> 模块范围：`src/types/modules/widget.types.ts` · `src/constants/cockpit.constants.ts` · `src/cockpit/core/widgetRegistry.ts`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应�?constants 文件引用�?
---

## 一、TypeScript 接口定义

### 1.1 MarketData �?标准化市场数�?
**来源**: `src/types/modules/widget.types.ts:63-92`
**用�?*: 所�?Widget 统一消费的数据接口，�?MarketDataAdapter 转换后提�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | �?| 数据生成时间（毫秒时间戳�?|
| `indices` | `MarketIndexData[]` | �?| 大盘指数数据列表 |
| `sectors` | `SectorHeatmapData[]` | �?| 板块热力图数据列�?|
| `fundFlows` | `FundFlowData[]` | �?| 资金流向数据列表 |
| `sentiment` | `SentimentData` | �?| 市场情绪数据 |
| `watchlist` | `WatchlistData[]` | �?| 自选股列表 |
| `portfolio` | `PortfolioData` | �?| 持仓概览数据 |
| `tradeReview` | `TradeReviewData` | �?| AI 交易复盘数据 |
| `analysisScores` | `AnalysisScores` | �?| 投资画像 / 分析评分数据 |
| `modelComparison` | `ModelComparison` | �?| AI 大模型对比数�?|
| `stockPool` | `StockPool` | �?| 股票池管理与监控数据 |
| `chatHistory` | `ChatHistory` | �?| 个股深度分析 / 市场分析聊天数据 |
| `hotSectors` | `HotSectorData[]` | �?| 热门板块策略评分数据 |
| `valuePit` | `ValuePitData[]` | �?| 价值洼地策略评分数�?|

### 1.2 MarketIndexData �?大盘指数数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | �?| 指数代码，如 `000001`（上证）、`399001`（深证） |
| `name` | `string` | �?| 指数名称，如 `上证指数` |
| `price` | `number` | �?| 当前点位 |
| `change` | `number` | �?| 涨跌�?|
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `high` | `number` | �?| 日内最�?|
| `low` | `number` | �?| 日内最�?|
| `volume` | `string` | �?| 成交�?|

### 1.3 SectorHeatmapData �?板块热力图数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 板块名称 |
| `code` | `string` | �?| 板块代码 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `turnover` | `string` | �?| 成交�?|
| `fundFlow` | `number \| null` | �?| 资金流向（净流入为正，净流出为负，null 表示无数据） |

### 1.4 FundFlowData �?资金流向数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `string` | �?| 资金类型 key，见 `FUND_FLOW_TYPES` |
| `name` | `string` | �?| 资金类型显示�?|
| `value` | `number` | �?| 净流入金额 |
| `unit` | `string` | �?| 金额单位，如 `亿` |

### 1.5 SentimentData �?市场情绪数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `fearGreedIndex` | `number` | �?| 恐惧贪婪指数 0-100 |
| `fearGreedLabel` | `string` | �?| 恐惧贪婪标签，如 `极度恐惧` |
| `totalStocks` | `number` | �?| 总股票数 |
| `up` | `number` | �?| 上涨家数 |
| `down` | `number` | �?| 下跌家数 |
| `flat` | `number` | �?| 平盘家数 |
| `limitUp` | `number` | �?| 涨停家数 |
| `limitDown` | `number` | �?| 跌停家数 |

### 1.6 WatchlistData �?自选股数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 股票名称 |
| `code` | `string` | �?| 股票代码 |
| `price` | `number` | �?| 最新价 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|

### 1.7 PortfolioData �?持仓概览数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAssets` | `string` | �?| 总资�?|
| `availableFunds` | `string` | �?| 可用资金 |
| `todayPnL` | `string` | �?| 今日盈亏 |
| `todayPnLPercent` | `number` | �?| 今日盈亏比例�?�?|
| `totalPnL` | `string` | �?| 累计盈亏 |
| `totalPnLPercent` | `number` | �?| 累计盈亏比例�?�?|
| `holdings` | `number` | �?| 持仓股票�?|

### 1.8 TradeReviewData �?AI 交易复盘数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalTrades` | `number` | �?| 总交易次�?|
| `profitable` | `number` | �?| 盈利次数 |
| `losing` | `number` | �?| 亏损次数 |
| `winRate` | `number` | �?| 胜率 0-1 |
| `profitLossRatio` | `number` | �?| 盈亏�?|
| `disciplineScore` | `number` | �?| 纪律评分 0-100 |

### 1.9 AnalysisScores �?投资画像 / 分析评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `profile` | `InvestmentProfile` | �?| 用户投资画像 |
| `kai` | `KaiScore` | �?| KAI 选股综合评分 |

### 1.10 InvestmentProfile �?投资画像

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tags` | `string[]` | �?| 用户标签列表，如 `["老股�?, "择时"]` |
| `metrics` | `ProfileMetric[]` | �?| 核心指标卡片列表 |

### 1.11 ProfileMetric �?投资画像指标

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 指标名称，见 `INVESTMENT_PROFILE_METRICS` |
| `score` | `number` | �?| 指标评分 0-100 |
| `description` | `string` | �?| 指标说明 |
| `icon` | `string` | �?| 图标标识 |

### 1.12 KaiScore �?KAI 选股综合评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalScore` | `number` | �?| 综合评分 0-100 |
| `sentiment` | `number` | �?| 情绪�?0-100 |
| `trend` | `number` | �?| 趋势�?0-100 |
| `flow` | `number` | �?| 流量�?0-100 |
| `dimensions` | `KaiDimension[]` | �?| 六大类维度评�?|
| `detailDistribution` | `KaiDetailItem[]` | �?| 维度细项分布�?|

### 1.13 KaiDimension �?KAI 评分维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 维度名称，见 `KAI_DIMENSION_NAMES` |
| `score` | `number` | �?| 维度得分 0-100 |
| `weight` | `number` | �?| 权重 0-1 |
| `status` | `string` | �?| 评分状态文�?|
| `color` | `string` | �?| 颜色标签，来�?`SCORE_LEVELS` |

### 1.14 KaiDetailItem �?KAI 维度细项

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dimensionName` | `string` | �?| 所属维度名�?|
| `itemName` | `string` | �?| 细项名称 |
| `score` | `number` | �?| 细项得分 0-100 |
| `weight` | `number` | �?| 细项权重 0-1 |
| `color` | `string` | �?| 颜色标签 |

### 1.15 ModelComparison �?模型对比数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `leftModel` | `ModelInfo` | �?| 左侧模型信息 |
| `rightModel` | `ModelInfo` | �?| 右侧模型信息 |
| `dimensions` | `CompareDimension[]` | �?| 对比维度列表 |
| `riskHint` | `string` | �?| 风险提示文本 |

### 1.16 ModelInfo �?模型信息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 模型 ID，见 `LLM_MODEL_VERSIONS` |
| `name` | `string` | �?| 模型名称 |
| `version` | `string` | �?| 模型版本�?|
| `score` | `number` | �?| 模型综合得分 |

### 1.17 CompareDimension �?模型对比维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 维度名称 |
| `leftScore` | `number` | �?| 左侧模型得分 |
| `rightScore` | `number` | �?| 右侧模型得分 |
| `weight` | `number` | �?| 维度权重 0-1 |

### 1.18 StockPool �?股票池数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `stocks` | `StockPoolItem[]` | �?| 股票列表 |
| `total` | `number` | �?| 总条�?|
| `page` | `number` | �?| 当前页码 |
| `pageSize` | `number` | �?| 每页条数 |

### 1.19 StockPoolItem �?股票池条�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | �?| 股票代码 |
| `name` | `string` | �?| 股票名称 |
| `price` | `number` | �?| 最新价 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `turnover` | `string` | �?| 成交�?|
| `turnoverRate` | `string` | �?| 换手�?|
| `statusColor` | `string` | �?| 状态颜色条，来�?`STOCK_POOL_STATUS_COLORS` |
| `statusLabel` | `string` | �?| 状态标签文�?|

### 1.20 ChatHistory �?聊天历史

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `target` | `string` | �?| 当前选中的标的代码或 `market` |
| `targetType` | `'stock' \| 'market'` | �?| 标的类型 |
| `messages` | `ChatMessage[]` | �?| 消息列表 |

### 1.21 ChatMessage �?聊天消息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 消息唯一标识 |
| `role` | `'user' \| 'assistant'` | �?| 消息角色 |
| `content` | `string` | �?| 消息内容（Markdown 格式�?|
| `timestamp` | `number` | �?| 消息时间�?|

### 1.21A HotSectorData �?热门板块策略评分

**来源**: `src/types/modules/widget.types.ts:337-354`
**用�?*: 热门板块策略评分数据，用于驾驶舱 Widget 展示

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `name` | `string` | �?| 股票名称 |
| `score` | `number` | �?| 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'ignore'` | �?| 动作建议 |
| `dimensions` | `{ momentum: number; sentiment: number; technical: number; valuation: number; composite: number }` | �?| 五维评分 |

### 1.21B ValuePitData �?价值洼地策略评�?
**来源**: `src/types/modules/widget.types.ts:357-377`
**用�?*: 价值洼地候选、五维评分与轮动信号状�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `name` | `string` | �?| 股票名称 |
| `score` | `number` | �?| 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'wait' \| 'ignore'` | �?| 动作建议 |
| `rotationSignal` | `boolean` | �?| 轮动信号是否触发 |
| `dimensions` | `{ catalyst: number; valuation: number; chip: number; rotation: number; liquidity: number; composite: number }` | �?| 六维评分 |

### 1.22 DataSourceConfig �?Widget 数据源配�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `DataSourceType` | �?| 数据源类型，�?§2.1 |
| `mode` | `CollectionMode` | �?| 采集模式，见 §2.2 |
| `interval` | `number` | �?| 轮询间隔（毫秒） |
| `endpoint` | `string` | �?| API 端点 |
| `params` | `Record<string, unknown>` | �?| 额外请求参数 |
| `enabled` | `boolean` | �?| 是否启用 |

### 1.23 WidgetConfig �?Widget 实例配置

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | �?| 实例唯一标识 |
| `widgetId` | `string` | �?| Widget 模板 ID |
| `size` | `{ cols: number; rows: number }` | �?| 网格尺寸 |
| `position` | `{ x: number; y: number }` | �?| 网格位置 |
| `title` | `string` | �?| 显示标题 |
| `settings` | `Record<string, unknown>` | �?| 自定义设�?|
| `visible` | `boolean` | �?| 是否可见 |
| `collapsed` | `boolean` | �?| 是否折叠 |
| `dataSource` | `DataSourceConfig` | �?| 数据源配�?|

### 1.24 WidgetMeta �?Widget 模板元数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| Widget 模板 ID |
| `name` | `string` | �?| 显示名称 |
| `category` | `string` | �?| 分类 |
| `description` | `string` | �?| 功能描述 |
| `defaultSize` | `{ cols: number; rows: number }` | �?| 默认网格尺寸 |
| `defaultConfig` | `Record<string, unknown>` | �?| 默认配置 |
| `defaultDataSource` | `DataSourceConfig` | �?| 默认数据源配�?|

### 1.25 WidgetRuntimeState �?Widget 运行时状�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | �?| 实例 ID |
| `widgetId` | `string` | �?| Widget 模板 ID |
| `status` | `'idle' \| 'loading' \| 'ready' \| 'error'` | �?| 当前状�?|
| `error` | `string` | �?| 错误信息 |
| `lastRefresh` | `number` | �?| 上次刷新时间 |

### 1.26 CollectionTask �?采集任务定义

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | �?| 任务唯一标识 |
| `widgetId` | `string` | �?| 关联 Widget ID |
| `instanceId` | `string` | �?| 关联实例 ID |
| `dataSource` | `DataSourceConfig` | �?| 数据源配�?|
| `status` | `CollectionTaskStatus` | �?| 当前状态，�?§2.3 |
| `error` | `string` | �?| 错误信息 |
| `lastRun` | `number` | �?| 上次执行时间 |
| `nextRun` | `number` | �?| 下次执行时间 |
| `runCount` | `number` | �?| 执行次数 |
| `successCount` | `number` | �?| 成功次数 |
| `failCount` | `number` | �?| 失败次数 |

### 1.27 WidgetTemplate �?Widget 注册模板（widgetRegistry�?
**来源**: `src/cockpit/core/widgetRegistry.ts:9-14`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `meta` | `WidgetMeta` | �?| Widget 元数�?|
| `component` | `() => Promise<{ default: React.ComponentType }>` | �?| 懒加载组件工厂函�?|
| `configPanel` | `() => Promise<{ default: React.ComponentType }>` | �?| 配置面板懒加载工厂函�?|

### 1.28 WidgetRegistry 已注�?Widget 清单

| widgetId | 名称 | 分类 | 组件文件 |
|----------|------|------|---------|
| `marketIndices` | 市场指数 | market | `MarketIndicesWidget.tsx` |
| `sectorHeatmap` | 板块热力�?| market | `SectorHeatmapWidget.tsx` |
| `fundFlow` | 资金流向 | market | `FundFlowWidget.tsx` |
| `marketSentiment` | 市场情绪 | market | `MarketSentimentWidget.tsx` |
| `watchlist` | 自选股 | market | `WatchlistWidget.tsx` |
| `portfolioOverview` | 持仓概览 | portfolio | `PortfolioOverviewWidget.tsx` |
| `aiTradeReview` | AI 交易复盘 | strategy | `AITradeReviewWidget.tsx` |
| `investmentProfile` | 投资画像 | analysis | `InvestmentProfileWidget.tsx` |
| `stockPool` | 股票池监�?| analysis | `StockPoolWidget.tsx` |
| `kaiScore` | KAI 综合评分 | analysis | `KaiScoreWidget.tsx` |
| `modelCompare` | 大模型对�?| analysis | `ModelCompareWidget.tsx` |
| `stockChat` | 深度分析助手 | analysis | `StockChatWidget.tsx` |
| `hotSector` | 热门板块策略 | strategy | `HotSectorWidget.tsx` |
| `valuePit` | 价值洼地策�?| strategy | `ValuePitWidget.tsx` |
| `agentPerformance` | 智能体性能追踪 | 系统监控 | `AgentPerformanceWidget.tsx` |
| `engineStatus` | 引擎状态监�?| 系统监控 | `EngineStatusWidget.tsx` |
| `systemArchitecture` | 系统架构视图 | 系统监控 | `SystemArchitectureWidget.tsx` |
| `pnlAnalysis` | 盈亏分析 | 交易分析 | `PnLAnalysisWidget.tsx` |
| `positionControl` | 仓位控制 | 投资组合 | `PositionControlWidget.tsx` |
| `riskMonitor` | 风险监控 | 系统监控 | `RiskMonitorWidget.tsx` |
| `signalMonitor` | 信号监控 | 交易分析 | `SignalMonitorWidget.tsx` |

---

## 二、枚举常量定�?
### 2.1 DataSourceType �?数据源类�?
**来源**: `src/types/modules/widget.types.ts:12` + `src/constants/cockpit.constants.ts:163-167`

| 枚举�?| 常量引用 | 描述 |
|--------|---------|------|
| `'mock'` | `DATA_SOURCE_TYPE.MOCK` | 模拟数据�?|
| `'rest'` | `DATA_SOURCE_TYPE.REST` | REST API 数据�?|
| `'websocket'` | `DATA_SOURCE_TYPE.WEBSOCKET` | WebSocket 实时推�?|

### 2.2 CollectionMode �?采集模式

**来源**: `src/constants/cockpit.constants.ts:170-174`

| 枚举�?| 常量引用 | 描述 |
|--------|---------|------|
| `'polling'` | `COLLECTION_MODE.POLLING` | 定时轮询 |
| `'once'` | `COLLECTION_MODE.ONCE` | 单次采集 |
| `'streaming'` | `COLLECTION_MODE.STREAMING` | 流式推�?|

### 2.3 CollectionTaskStatus �?采集任务状�?
**来源**: `src/types/modules/widget.types.ts:329`

| 枚举�?| 描述 |
|--------|------|
| `'pending'` | 等待执行 |
| `'running'` | 执行�?|
| `'paused'` | 已暂�?|
| `'error'` | 错误 |
| `'completed'` | 已完�?|

### 2.4 WIDGET_SIZE �?Widget 网格尺寸

**来源**: `src/constants/cockpit.constants.ts:7-13`

| 常量引用 | cols | rows | 用�?|
|---------|------|------|------|
| `WIDGET_SIZE.FULL_WIDTH` | 4 | 2 | 全宽 Widget |
| `WIDGET_SIZE.HALF_WIDTH` | 2 | 2 | 半宽 Widget |
| `WIDGET_SIZE.THIRD_WIDTH` | 1 | 2 | 1/3 �?Widget |
| `WIDGET_SIZE.LARGE_HEIGHT` | 4 | 3 | 大高�?Widget |
| `WIDGET_SIZE.CHAT_HEIGHT` | 4 | 4 | 聊天 Widget |

### 2.5 MARKET_INDEX_CODES �?大盘指数代码

**来源**: `src/constants/cockpit.constants.ts:15-20`

| 常量引用 | 代码 | 名称 |
|---------|------|------|
| `MARKET_INDEX_CODES.SHANGHAI` | `000001` | 上证指数 |
| `MARKET_INDEX_CODES.SHENZHEN` | `399001` | 深证成指 |
| `MARKET_INDEX_CODES.CHINEXT` | `399006` | 创业板指 |
| `MARKET_INDEX_CODES.STAR` | `000688` | 科创50 |

### 2.6 FUND_FLOW_TYPES �?资金流向类型

**来源**: `src/constants/cockpit.constants.ts:29-33`

| 常量引用 | �?| 显示�?|
|---------|------|------|
| `FUND_FLOW_TYPES.MAIN` | `main` | 主力净流入 |
| `FUND_FLOW_TYPES.RETAIL` | `retail` | 散户净流入 |
| `FUND_FLOW_TYPES.NORTH` | `north` | 北向净流入 |

### 2.7 SENTIMENT_LEVELS �?市场情绪分级

**来源**: `src/constants/cockpit.constants.ts:51-57`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SENTIMENT_LEVELS.EXTREME_FEAR` | 0-20 | 极度恐惧 | `bg-red-600` |
| `SENTIMENT_LEVELS.FEAR` | 20-40 | 恐惧 | `bg-red-400` |
| `SENTIMENT_LEVELS.NEUTRAL` | 40-60 | 中�?| `bg-yellow-400` |
| `SENTIMENT_LEVELS.GREEDY` | 60-80 | 贪婪 | `bg-green-400` |
| `SENTIMENT_LEVELS.EXTREME_GREEDY` | 80-100 | 极度贪婪 | `bg-green-600` |

### 2.8 STOCK_COLOR_TOKENS �?股票涨跌颜色映射（A 股标准：红涨绿跌�?
**来源**: `src/constants/cockpit.constants.ts:62-81`

| 常量引用 | 含义 | HEX �?| Tailwind 类名 |
|---------|------|--------|-------------|
| `STOCK_COLOR_TOKENS.UP` | 上涨 | `#ef4444` | `text-red-500` |
| `STOCK_COLOR_TOKENS.DOWN` | 下跌 | `#22c55e` | `text-green-500` |
| `STOCK_COLOR_TOKENS.NEUTRAL` | 平盘 | `#9ca3af` | `text-gray-400` |

### 2.9 SCORE_LEVELS �?评分等级映射

**来源**: `src/constants/cockpit.constants.ts:86-92`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SCORE_LEVELS.EXCELLENT` | 80-100 | 优秀 | `#22c55e` |
| `SCORE_LEVELS.GOOD` | 60-80 | 良好 | `#3b82f6` |
| `SCORE_LEVELS.AVERAGE` | 40-60 | 一�?| `#f59e0b` |
| `SCORE_LEVELS.POOR` | 20-40 | 较弱 | `#f97316` |
| `SCORE_LEVELS.BAD` | 0-20 | �?| `#ef4444` |

### 2.10 KAI_DIMENSION_NAMES �?KAI 评分维度

**来源**: `src/constants/cockpit.constants.ts:97-104`

| 常量引用 | 中文�?|
|---------|--------|
| `KAI_DIMENSION_NAMES.COMPETITIVENESS` | 竞争�?|
| `KAI_DIMENSION_NAMES.TECHNICAL` | 技术面 |
| `KAI_DIMENSION_NAMES.FUNDAMENTAL` | 基本�?|
| `KAI_DIMENSION_NAMES.SENTIMENT` | 情绪�?|
| `KAI_DIMENSION_NAMES.FUND_FLOW` | 资金�?|
| `KAI_DIMENSION_NAMES.INDUSTRY` | 行业�?|

### 2.11 LLM_MODEL_VERSIONS �?AI 大模型版�?
**来源**: `src/constants/cockpit.constants.ts:109-114`

| 常量引用 | ID | 名称 | 版本 |
|---------|------|------|------|
| `LLM_MODEL_VERSIONS.KAILLM_V2_1` | `kaillm-v2.1` | KAILLM v2.1 | v2.1 |
| `LLM_MODEL_VERSIONS.KAILLM_V2_0` | `kaillm-v2.0` | KAILLM v2.0 | v2.0 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_5` | `baseline-v1.5` | 基准模型 v1.5 | v1.5 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_0` | `baseline-v1.0` | 基准模型 v1.0 | v1.0 |

### 2.12 INVESTMENT_PROFILE_METRICS �?投资画像指标

**来源**: `src/constants/cockpit.constants.ts:119-125`

| 常量引用 | 名称 | 描述 |
|---------|------|------|
| `INVESTMENT_PROFILE_METRICS.ABILITY` | 投资能力 | 综合收益与风险控制能�?|
| `INVESTMENT_PROFILE_METRICS.STYLE` | 投资风格 | 价�?成长/均衡等风格倾向 |
| `INVESTMENT_PROFILE_METRICS.RISK_CONTROL` | 风控能力 | 回撤控制与仓位管理能�?|
| `INVESTMENT_PROFILE_METRICS.HOLDING` | 持仓透视 | 集中度与行业配置分析 |
| `INVESTMENT_PROFILE_METRICS.TIMING` | 择时风格 | 左侧/右侧交易倾向 |

### 2.13 STOCK_POOL_STATUS_COLORS �?股票池状态颜�?
**来源**: `src/constants/cockpit.constants.ts:141-146`

| 常量引用 | 颜色 | 标签 |
|---------|------|------|
| `STOCK_POOL_STATUS_COLORS.ACTIVE` | `#22c55e` | 活跃 |
| `STOCK_POOL_STATUS_COLORS.WARM` | `#3b82f6` | 温热 |
| `STOCK_POOL_STATUS_COLORS.COOL` | `#f59e0b` | 冷清 |
| `STOCK_POOL_STATUS_COLORS.COLD` | `#9ca3af` | 冷淡 |

### 2.14 SECTOR_COLOR_MAPPING �?板块涨跌颜色

**来源**: `src/constants/cockpit.constants.ts:41-49`

| 常量引用 | Tailwind 类名 | 含义 |
|---------|-------------|------|
| `SECTOR_COLOR_MAPPING.STRONG_UP` | `bg-green-500` | 强势上涨 |
| `SECTOR_COLOR_MAPPING.UP` | `bg-green-400` | 上涨 |
| `SECTOR_COLOR_MAPPING.WEAK_UP` | `bg-green-300` | 微涨 |
| `SECTOR_COLOR_MAPPING.FLAT` | `bg-gray-300` | 平盘 |
| `SECTOR_COLOR_MAPPING.WEAK_DOWN` | `bg-red-300` | 微跌 |
| `SECTOR_COLOR_MAPPING.DOWN` | `bg-red-400` | 下跌 |
| `SECTOR_COLOR_MAPPING.STRONG_DOWN` | `bg-red-500` | 强势下跌 |

### 2.15 采集器配置常�?
**来源**: `src/constants/cockpit.constants.ts:176-223`

| 常量引用 | �?| 描述 |
|---------|------|------|
| `COLLECTOR_DEFAULT_CONFIG.TIMEOUT` | `10000` | API 超时时间（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT` | `3` | 重试次数 |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL` | `2000` | 重试间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL` | `5000` | 默认轮询间隔（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MIN_DELAY` | `200` | 模拟延迟最小值（毫秒�?|
| `MOCK_COLLECTOR_CONFIG.MAX_DELAY` | `1000` | 模拟延迟最大值（毫秒�?|
| `WEBSOCKET_COLLECTOR_CONFIG.RECONNECT_INTERVAL` | `3000` | 重连间隔（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.MAX_RECONNECT_COUNT` | `5` | 最大重连次�?|

### 2.16 网格布局常量

**来源**: `src/constants/cockpit.constants.ts:1-5`

| 常量引用 | �?| 描述 |
|---------|------|------|
| `GRID_COLUMNS` | `4` | 网格列数 |
| `GRID_ROW_HEIGHT` | `120` | 行高（像素） |
| `GRID_GAP` | `16` | 网格间距（像素） |

---

## 三、数据流�?
```
┌──────────────────────────────────────────────────────────────────�?�? Widget 数据�?                                                   �?�?                                                                 �?�? DataSourceConfig ──�?TaskScheduler ──�?BaseCollector             �?�? (widgetId=xxx)        (register/start)    �?                    �?�?                                           �?fetch               �?�?                                           �?                    �?�?                                    RawMarketData                 �?�?                                           �?                    �?�?                                           �?                    �?�?                                   MarketDataAdapter              �?�?                                           �?                    �?�?                                           �?                    �?�?                                      MarketData                  �?�?                                           �?                    �?�?                                           �?                    �?�?                             MarketDataProvider (Context)         �?�?                                  �?                             �?�?                     ┌────────────┼────────────�?                �?�?                     �?           �?           �?                �?�?                Widget A     Widget B     Widget C               �?�?                                                                 �?�? WidgetRegistry 管理流程:                                        �?�?   register(template) �?createInstance(widgetId)                 �?�?   �?updateRuntimeState(instanceId, { status })                  �?�?   �?removeInstance(instanceId)                                  �?└──────────────────────────────────────────────────────────────────�?```

**数据来源**：`WidgetRegistry.createInstance()` �?`TaskScheduler.register()` �?`BaseCollector.fetch()`
**数据去向**：`MarketDataProvider` �?�?Widget 组件�?`data` prop
**更新频率**：默�?5 秒轮询（`COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL`），可通过 `DataSourceConfig.interval` 调整

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更�?|
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆�?Widget 框架全部类型定义�?8 个接口）与枚举常量（16 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | MarketData +2 字段（hotSectors/valuePit）；SectorHeatmapData +1 字段（fundFlow）；新增 HotSectorData/ValuePitData 接口；Widget 注册�?12�?1 | Architecture Asset Governor |