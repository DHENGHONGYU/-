---
doc_id: V9-DOC-REF-921
title: "Cockpit Widget 框架数据字典"
domain: data
status: active
last_updated: 2026-08-15

covers_code:
  - src/types/modules/widget.types.ts
  - src/constants/cockpit.constants.ts
  - src/cockpit/core/widgetRegistry.ts


code_version: 2.0.0-rc.2
---
> **Version**: v1.2.0  
> **Last Updated**: 2026-07-06  
> **Maintainer**: 架构资产治理官

# Cockpit Widget 框架数据字典

> 生成日期：2026-06-26
> 模块范围：`src/types/modules/widget.types.ts` · `src/constants/cockpit.constants.ts` · `src/cockpit/core/widgetRegistry.ts`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应的 constants 文件引用。

---

## 一、TypeScript 接口定义

### 1.1 MarketData — 标准化市场数据

**来源**: `src/types/modules/widget.types.ts:63-92`
**用途**: 所有 Widget 统一消费的数据接口，由 MarketDataAdapter 转换后提供

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | 是 | 数据生成时间（毫秒时间戳） |
| `indices` | `MarketIndexData[]` | 是 | 大盘指数数据列表 |
| `sectors` | `SectorHeatmapData[]` | 是 | 板块热力图数据列表 |
| `fundFlows` | `FundFlowData[]` | 是 | 资金流向数据列表 |
| `sentiment` | `SentimentData` | 是 | 市场情绪数据 |
| `watchlist` | `WatchlistData[]` | 是 | 自选股列表 |
| `portfolio` | `PortfolioData` | 是 | 持仓概览数据 |
| `tradeReview` | `TradeReviewData` | 是 | AI 交易复盘数据 |
| `analysisScores` | `AnalysisScores` | 是 | 投资画像 / 分析评分数据 |
| `modelComparison` | `ModelComparison` | 是 | AI 大模型对比数据 |
| `stockPool` | `StockPool` | 是 | 股票池管理与监控数据 |
| `chatHistory` | `ChatHistory` | 是 | 个股深度分析 / 市场分析聊天数据 |
| `hotSectors` | `HotSectorData[]` | 是 | 热门板块策略评分数据 |
| `valuePit` | `ValuePitData[]` | 是 | 价值洼地策略评分数据 |

### 1.2 MarketIndexData — 大盘指数数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | 是 | 指数代码，如 `000001`（上证）、`399001`（深证） |
| `name` | `string` | 是 | 指数名称，如 `上证指数` |
| `price` | `number` | 是 | 当前点位 |
| `change` | `number` | 是 | 涨跌额 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `high` | `number` | 否 | 日内最高 |
| `low` | `number` | 否 | 日内最低 |
| `volume` | `string` | 否 | 成交量 |

### 1.3 SectorHeatmapData — 板块热力图数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 板块名称 |
| `code` | `string` | 是 | 板块代码 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `turnover` | `string` | 否 | 成交额 |
| `fundFlow` | `number \| null` | 否 | 资金流向（净流入为正，净流出为负，null 表示无数据） |

### 1.4 FundFlowData — 资金流向数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `string` | 是 | 资金类型 key，见 `FUND_FLOW_TYPES` |
| `name` | `string` | 是 | 资金类型显示名 |
| `value` | `number` | 是 | 净流入金额 |
| `unit` | `string` | 是 | 金额单位，如 `亿` |

### 1.5 SentimentData — 市场情绪数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `fearGreedIndex` | `number` | 是 | 恐惧贪婪指数 0-100 |
| `fearGreedLabel` | `string` | 是 | 恐惧贪婪标签，如 `极度恐惧` |
| `totalStocks` | `number` | 是 | 总股票数 |
| `up` | `number` | 是 | 上涨家数 |
| `down` | `number` | 是 | 下跌家数 |
| `flat` | `number` | 是 | 平盘家数 |
| `limitUp` | `number` | 是 | 涨停家数 |
| `limitDown` | `number` | 是 | 跌停家数 |

### 1.6 WatchlistData — 自选股数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 股票名称 |
| `code` | `string` | 是 | 股票代码 |
| `price` | `number` | 是 | 最新价 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |

### 1.7 PortfolioData — 持仓概览数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAssets` | `string` | 是 | 总资产 |
| `availableFunds` | `string` | 是 | 可用资金 |
| `todayPnL` | `string` | 是 | 今日盈亏 |
| `todayPnLPercent` | `number` | 是 | 今日盈亏比例（%） |
| `totalPnL` | `string` | 是 | 累计盈亏 |
| `totalPnLPercent` | `number` | 是 | 累计盈亏比例（%） |
| `holdings` | `number` | 是 | 持仓股票数 |

### 1.8 TradeReviewData — AI 交易复盘数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalTrades` | `number` | 是 | 总交易次数 |
| `profitable` | `number` | 是 | 盈利次数 |
| `losing` | `number` | 是 | 亏损次数 |
| `winRate` | `number` | 是 | 胜率 0-1 |
| `profitLossRatio` | `number` | 是 | 盈亏比 |
| `disciplineScore` | `number` | 是 | 纪律评分 0-100 |

### 1.9 AnalysisScores — 投资画像 / 分析评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `profile` | `InvestmentProfile` | 是 | 用户投资画像 |
| `kai` | `KaiScore` | 是 | KAI 选股综合评分 |

### 1.10 InvestmentProfile — 投资画像

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tags` | `string[]` | 是 | 用户标签列表，如 `["老股民", "择时"]` |
| `metrics` | `ProfileMetric[]` | 是 | 核心指标卡片列表 |

### 1.11 ProfileMetric — 投资画像指标

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 指标名称，见 `INVESTMENT_PROFILE_METRICS` |
| `score` | `number` | 是 | 指标评分 0-100 |
| `description` | `string` | 否 | 指标说明 |
| `icon` | `string` | 否 | 图标标识 |

### 1.12 KaiScore — KAI 选股综合评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalScore` | `number` | 是 | 综合评分 0-100 |
| `sentiment` | `number` | 是 | 情绪值 0-100 |
| `trend` | `number` | 是 | 趋势值 0-100 |
| `flow` | `number` | 是 | 流量值 0-100 |
| `dimensions` | `KaiDimension[]` | 是 | 六大类维度评分 |
| `detailDistribution` | `KaiDetailItem[]` | 是 | 维度细项分布表 |

### 1.13 KaiDimension — KAI 评分维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 维度名称，见 `KAI_DIMENSION_NAMES` |
| `score` | `number` | 是 | 维度得分 0-100 |
| `weight` | `number` | 是 | 权重 0-1 |
| `status` | `string` | 是 | 评分状态文本 |
| `color` | `string` | 是 | 颜色标签，来自 `SCORE_LEVELS` |

### 1.14 KaiDetailItem — KAI 维度细项

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dimensionName` | `string` | 是 | 所属维度名称 |
| `itemName` | `string` | 是 | 细项名称 |
| `score` | `number` | 是 | 细项得分 0-100 |
| `weight` | `number` | 是 | 细项权重 0-1 |
| `color` | `string` | 是 | 颜色标签 |

### 1.15 ModelComparison — 模型对比数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `leftModel` | `ModelInfo` | 是 | 左侧模型信息 |
| `rightModel` | `ModelInfo` | 是 | 右侧模型信息 |
| `dimensions` | `CompareDimension[]` | 是 | 对比维度列表 |
| `riskHint` | `string` | 是 | 风险提示文本 |

### 1.16 ModelInfo — 模型信息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 模型 ID，见 `LLM_MODEL_VERSIONS` |
| `name` | `string` | 是 | 模型名称 |
| `version` | `string` | 是 | 模型版本号 |
| `score` | `number` | 是 | 模型综合得分 |

### 1.17 CompareDimension — 模型对比维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 维度名称 |
| `leftScore` | `number` | 是 | 左侧模型得分 |
| `rightScore` | `number` | 是 | 右侧模型得分 |
| `weight` | `number` | 是 | 维度权重 0-1 |

### 1.18 StockPool — 股票池数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `stocks` | `StockPoolItem[]` | 是 | 股票列表 |
| `total` | `number` | 是 | 总条数 |
| `page` | `number` | 是 | 当前页码 |
| `pageSize` | `number` | 是 | 每页条数 |

### 1.19 StockPoolItem — 股票池条目

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `price` | `number` | 是 | 最新价 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `turnover` | `string` | 是 | 成交额 |
| `turnoverRate` | `string` | 是 | 换手率 |
| `statusColor` | `string` | 是 | 状态颜色条，来自 `STOCK_POOL_STATUS_COLORS` |
| `statusLabel` | `string` | 是 | 状态标签文本 |

### 1.20 ChatHistory — 聊天历史

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `target` | `string` | 是 | 当前选中的标的代码或 `market` |
| `targetType` | `'stock' \| 'market'` | 是 | 标的类型 |
| `messages` | `ChatMessage[]` | 是 | 消息列表 |

### 1.21 ChatMessage — 聊天消息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 消息唯一标识 |
| `role` | `'user' \| 'assistant'` | 是 | 消息角色 |
| `content` | `string` | 是 | 消息内容（Markdown 格式） |
| `timestamp` | `number` | 是 | 消息时间戳 |

### 1.21A HotSectorData — 热门板块策略评分

**来源**: `src/types/modules/widget.types.ts:337-354`
**用途**: 热门板块策略评分数据，用于驾驶舱 Widget 展示

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `score` | `number` | 是 | 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'ignore'` | 是 | 动作建议 |
| `dimensions` | `{ momentum: number; sentiment: number; technical: number; valuation: number; composite: number }` | 是 | 五维评分 |

### 1.21B ValuePitData — 价值洼地策略评分

**来源**: `src/types/modules/widget.types.ts:357-377`
**用途**: 价值洼地候选、五维评分与轮动信号状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `score` | `number` | 是 | 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'wait' \| 'ignore'` | 是 | 动作建议 |
| `rotationSignal` | `boolean` | 是 | 轮动信号是否触发 |
| `dimensions` | `{ catalyst: number; valuation: number; chip: number; rotation: number; liquidity: number; composite: number }` | 是 | 六维评分 |

### 1.22 DataSourceConfig — Widget 数据源配置

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `DataSourceType` | 是 | 数据源类型，见 §2.1 |
| `mode` | `CollectionMode` | 是 | 采集模式，见 §2.2 |
| `interval` | `number` | 是 | 轮询间隔（毫秒） |
| `endpoint` | `string` | 否 | API 端点 |
| `params` | `Record<string, unknown>` | 否 | 额外请求参数 |
| `enabled` | `boolean` | 是 | 是否启用 |

### 1.23 WidgetConfig — Widget 实例配置

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | 是 | 实例唯一标识 |
| `widgetId` | `string` | 是 | Widget 模板 ID |
| `size` | `{ cols: number; rows: number }` | 是 | 网格尺寸 |
| `position` | `{ x: number; y: number }` | 否 | 网格位置 |
| `title` | `string` | 是 | 显示标题 |
| `settings` | `Record<string, unknown>` | 是 | 自定义设置 |
| `visible` | `boolean` | 是 | 是否可见 |
| `collapsed` | `boolean` | 是 | 是否折叠 |
| `dataSource` | `DataSourceConfig` | 否 | 数据源配置 |

### 1.24 WidgetMeta — Widget 模板元数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | Widget 模板 ID |
| `name` | `string` | 是 | 显示名称 |
| `category` | `string` | 是 | 分类 |
| `description` | `string` | 是 | 功能描述 |
| `defaultSize` | `{ cols: number; rows: number }` | 是 | 默认网格尺寸 |
| `defaultConfig` | `Record<string, unknown>` | 否 | 默认配置 |
| `defaultDataSource` | `DataSourceConfig` | 否 | 默认数据源配置 |

### 1.25 WidgetRuntimeState — Widget 运行时状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | 是 | 实例 ID |
| `widgetId` | `string` | 是 | Widget 模板 ID |
| `status` | `'idle' \| 'loading' \| 'ready' \| 'error'` | 是 | 当前状态 |
| `error` | `string` | 否 | 错误信息 |
| `lastRefresh` | `number` | 否 | 上次刷新时间 |

### 1.26 CollectionTask — 采集任务定义

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务唯一标识 |
| `widgetId` | `string` | 是 | 关联 Widget ID |
| `instanceId` | `string` | 是 | 关联实例 ID |
| `dataSource` | `DataSourceConfig` | 是 | 数据源配置 |
| `status` | `CollectionTaskStatus` | 是 | 当前状态，见 §2.3 |
| `error` | `string` | 否 | 错误信息 |
| `lastRun` | `number` | 否 | 上次执行时间 |
| `nextRun` | `number` | 否 | 下次执行时间 |
| `runCount` | `number` | 是 | 执行次数 |
| `successCount` | `number` | 是 | 成功次数 |
| `failCount` | `number` | 是 | 失败次数 |

### 1.27 WidgetTemplate — Widget 注册模板（widgetRegistry）

**来源**: `src/cockpit/core/widgetRegistry.ts:9-14`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `meta` | `WidgetMeta` | 是 | Widget 元数据 |
| `component` | `() => Promise<{ default: React.ComponentType }>` | 是 | 懒加载组件工厂函数 |
| `configPanel` | `() => Promise<{ default: React.ComponentType }>` | 否 | 配置面板懒加载工厂函数 |

### 1.28 WidgetRegistry 已注册 Widget 清单

| widgetId | 名称 | 分类 | 组件文件 |
|----------|------|------|---------|
| `marketIndices` | 市场指数 | market | `MarketIndicesWidget.tsx` |
| `sectorHeatmap` | 板块热力图 | market | `SectorHeatmapWidget.tsx` |
| `fundFlow` | 资金流向 | market | `FundFlowWidget.tsx` |
| `marketSentiment` | 市场情绪 | market | `MarketSentimentWidget.tsx` |
| `watchlist` | 自选股 | market | `WatchlistWidget.tsx` |
| `portfolioOverview` | 持仓概览 | portfolio | `PortfolioOverviewWidget.tsx` |
| `aiTradeReview` | AI 交易复盘 | strategy | `AITradeReviewWidget.tsx` |
| `investmentProfile` | 投资画像 | analysis | `InvestmentProfileWidget.tsx` |
| `stockPool` | 股票池监控 | analysis | `StockPoolWidget.tsx` |
| `kaiScore` | KAI 综合评分 | analysis | `KaiScoreWidget.tsx` |
| `modelCompare` | 大模型对比 | analysis | `ModelCompareWidget.tsx` |
| `stockChat` | 深度分析助手 | analysis | `StockChatWidget.tsx` |
| `hotSector` | 热门板块策略 | strategy | `HotSectorWidget.tsx` |
| `valuePit` | 价值洼地策略 | strategy | `ValuePitWidget.tsx` |
| `agentPerformance` | 智能体性能追踪 | 系统监控 | `AgentPerformanceWidget.tsx` |
| `engineStatus` | 引擎状态监控 | 系统监控 | `EngineStatusWidget.tsx` |
| `systemArchitecture` | 系统架构视图 | 系统监控 | `SystemArchitectureWidget.tsx` |
| `pnlAnalysis` | 盈亏分析 | 交易分析 | `PnLAnalysisWidget.tsx` |
| `positionControl` | 仓位控制 | 投资组合 | `PositionControlWidget.tsx` |
| `riskMonitor` | 风险监控 | 系统监控 | `RiskMonitorWidget.tsx` |
| `signalMonitor` | 信号监控 | 交易分析 | `SignalMonitorWidget.tsx` |

---

## 二、枚举常量定义

### 2.1 DataSourceType — 数据源类型

**来源**: `src/types/modules/widget.types.ts:12` + `src/constants/cockpit.constants.ts:163-167`

| 枚举值 | 常量引用 | 描述 |
|--------|---------|------|
| `'mock'` | `DATA_SOURCE_TYPE.MOCK` | 模拟数据源 |
| `'rest'` | `DATA_SOURCE_TYPE.REST` | REST API 数据源 |
| `'websocket'` | `DATA_SOURCE_TYPE.WEBSOCKET` | WebSocket 实时推送 |

### 2.2 CollectionMode — 采集模式

**来源**: `src/constants/cockpit.constants.ts:170-174`

| 枚举值 | 常量引用 | 描述 |
|--------|---------|------|
| `'polling'` | `COLLECTION_MODE.POLLING` | 定时轮询 |
| `'once'` | `COLLECTION_MODE.ONCE` | 单次采集 |
| `'streaming'` | `COLLECTION_MODE.STREAMING` | 流式推送 |

### 2.3 CollectionTaskStatus — 采集任务状态

**来源**: `src/types/modules/widget.types.ts:329`

| 枚举值 | 描述 |
|--------|------|
| `'pending'` | 等待执行 |
| `'running'` | 执行中 |
| `'paused'` | 已暂停 |
| `'error'` | 错误 |
| `'completed'` | 已完成 |

### 2.4 WIDGET_SIZE — Widget 网格尺寸

**来源**: `src/constants/cockpit.constants.ts:7-13`

| 常量引用 | cols | rows | 用途 |
|---------|------|------|------|
| `WIDGET_SIZE.FULL_WIDTH` | 4 | 2 | 全宽 Widget |
| `WIDGET_SIZE.HALF_WIDTH` | 2 | 2 | 半宽 Widget |
| `WIDGET_SIZE.THIRD_WIDTH` | 1 | 2 | 1/3 宽 Widget |
| `WIDGET_SIZE.LARGE_HEIGHT` | 4 | 3 | 大高度 Widget |
| `WIDGET_SIZE.CHAT_HEIGHT` | 4 | 4 | 聊天 Widget |

### 2.5 MARKET_INDEX_CODES — 大盘指数代码

**来源**: `src/constants/cockpit.constants.ts:15-20`

| 常量引用 | 代码 | 名称 |
|---------|------|------|
| `MARKET_INDEX_CODES.SHANGHAI` | `000001` | 上证指数 |
| `MARKET_INDEX_CODES.SHENZHEN` | `399001` | 深证成指 |
| `MARKET_INDEX_CODES.CHINEXT` | `399006` | 创业板指 |
| `MARKET_INDEX_CODES.STAR` | `000688` | 科创50 |

### 2.6 FUND_FLOW_TYPES — 资金流向类型

**来源**: `src/constants/cockpit.constants.ts:29-33`

| 常量引用 | 值 | 显示名 |
|---------|------|------|
| `FUND_FLOW_TYPES.MAIN` | `main` | 主力净流入 |
| `FUND_FLOW_TYPES.RETAIL` | `retail` | 散户净流入 |
| `FUND_FLOW_TYPES.NORTH` | `north` | 北向净流入 |

### 2.7 SENTIMENT_LEVELS — 市场情绪分级

**来源**: `src/constants/cockpit.constants.ts:51-57`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SENTIMENT_LEVELS.EXTREME_FEAR` | 0-20 | 极度恐惧 | `bg-red-600` |
| `SENTIMENT_LEVELS.FEAR` | 20-40 | 恐惧 | `bg-red-400` |
| `SENTIMENT_LEVELS.NEUTRAL` | 40-60 | 中性 | `bg-yellow-400` |
| `SENTIMENT_LEVELS.GREEDY` | 60-80 | 贪婪 | `bg-green-400` |
| `SENTIMENT_LEVELS.EXTREME_GREEDY` | 80-100 | 极度贪婪 | `bg-green-600` |

### 2.8 STOCK_COLOR_MAPPING — 股票涨跌颜色映射（A 股标准：红涨绿跌）

**来源**: `src/constants/cockpit.constants.ts:62-81`

| 常量引用 | 含义 | HEX 值 | Tailwind 类名 |
|---------|------|--------|-------------|
| `STOCK_COLOR_MAPPING.UP` | 上涨 | `#ef4444` | `text-red-500` |
| `STOCK_COLOR_MAPPING.DOWN` | 下跌 | `#22c55e` | `text-green-500` |
| `STOCK_COLOR_MAPPING.NEUTRAL` | 平盘 | `#9ca3af` | `text-gray-400` |

### 2.9 SCORE_LEVELS — 评分等级映射

**来源**: `src/constants/cockpit.constants.ts:86-92`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SCORE_LEVELS.EXCELLENT` | 80-100 | 优秀 | `#22c55e` |
| `SCORE_LEVELS.GOOD` | 60-80 | 良好 | `#3b82f6` |
| `SCORE_LEVELS.AVERAGE` | 40-60 | 一般 | `#f59e0b` |
| `SCORE_LEVELS.POOR` | 20-40 | 较弱 | `#f97316` |
| `SCORE_LEVELS.BAD` | 0-20 | 差 | `#ef4444` |

### 2.10 KAI_DIMENSION_NAMES — KAI 评分维度

**来源**: `src/constants/cockpit.constants.ts:97-104`

| 常量引用 | 中文名 |
|---------|--------|
| `KAI_DIMENSION_NAMES.COMPETITIVENESS` | 竞争力 |
| `KAI_DIMENSION_NAMES.TECHNICAL` | 技术面 |
| `KAI_DIMENSION_NAMES.FUNDAMENTAL` | 基本面 |
| `KAI_DIMENSION_NAMES.SENTIMENT` | 情绪面 |
| `KAI_DIMENSION_NAMES.FUND_FLOW` | 资金面 |
| `KAI_DIMENSION_NAMES.INDUSTRY` | 行业面 |

### 2.11 LLM_MODEL_VERSIONS — AI 大模型版本

**来源**: `src/constants/cockpit.constants.ts:109-114`

| 常量引用 | ID | 名称 | 版本 |
|---------|------|------|------|
| `LLM_MODEL_VERSIONS.KAILLM_V2_1` | `kaillm-v2.1` | KAILLM v2.1 | v2.1 |
| `LLM_MODEL_VERSIONS.KAILLM_V2_0` | `kaillm-v2.0` | KAILLM v2.0 | v2.0 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_5` | `baseline-v1.5` | 基准模型 v1.5 | v1.5 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_0` | `baseline-v1.0` | 基准模型 v1.0 | v1.0 |

### 2.12 INVESTMENT_PROFILE_METRICS — 投资画像指标

**来源**: `src/constants/cockpit.constants.ts:119-125`

| 常量引用 | 名称 | 描述 |
|---------|------|------|
| `INVESTMENT_PROFILE_METRICS.ABILITY` | 投资能力 | 综合收益与风险控制能力 |
| `INVESTMENT_PROFILE_METRICS.STYLE` | 投资风格 | 价值/成长/均衡等风格倾向 |
| `INVESTMENT_PROFILE_METRICS.RISK_CONTROL` | 风控能力 | 回撤控制与仓位管理能力 |
| `INVESTMENT_PROFILE_METRICS.HOLDING` | 持仓透视 | 集中度与行业配置分析 |
| `INVESTMENT_PROFILE_METRICS.TIMING` | 择时风格 | 左侧/右侧交易倾向 |

### 2.13 STOCK_POOL_STATUS_COLORS — 股票池状态颜色

**来源**: `src/constants/cockpit.constants.ts:141-146`

| 常量引用 | 颜色 | 标签 |
|---------|------|------|
| `STOCK_POOL_STATUS_COLORS.ACTIVE` | `#22c55e` | 活跃 |
| `STOCK_POOL_STATUS_COLORS.WARM` | `#3b82f6` | 温热 |
| `STOCK_POOL_STATUS_COLORS.COOL` | `#f59e0b` | 冷清 |
| `STOCK_POOL_STATUS_COLORS.COLD` | `#9ca3af` | 冷淡 |

### 2.14 SECTOR_COLOR_MAPPING — 板块涨跌颜色

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

### 2.15 采集器配置常量

**来源**: `src/constants/cockpit.constants.ts:176-223`

| 常量引用 | 值 | 描述 |
|---------|------|------|
| `COLLECTOR_DEFAULT_CONFIG.TIMEOUT` | `10000` | API 超时时间（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT` | `3` | 重试次数 |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL` | `2000` | 重试间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL` | `5000` | 默认轮询间隔（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MIN_DELAY` | `200` | 模拟延迟最小值（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MAX_DELAY` | `1000` | 模拟延迟最大值（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.RECONNECT_INTERVAL` | `3000` | 重连间隔（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.MAX_RECONNECT_COUNT` | `5` | 最大重连次数 |

### 2.16 网格布局常量

**来源**: `src/constants/cockpit.constants.ts:1-5`

| 常量引用 | 值 | 描述 |
|---------|------|------|
| `GRID_COLUMNS` | `4` | 网格列数 |
| `GRID_ROW_HEIGHT` | `120` | 行高（像素） |
| `GRID_GAP` | `16` | 网格间距（像素） |

---

## 三、数据流向

```
┌──────────────────────────────────────────────────────────────────┐
│  Widget 数据流                                                    │
│                                                                  │
│  DataSourceConfig ──→ TaskScheduler ──→ BaseCollector             │
│  (widgetId=xxx)        (register/start)    │                     │
│                                            │ fetch               │
│                                            ▼                     │
│                                     RawMarketData                 │
│                                            │                     │
│                                            ▼                     │
│                                    MarketDataAdapter              │
│                                            │                     │
│                                            ▼                     │
│                                       MarketData                  │
│                                            │                     │
│                                            ▼                     │
│                              MarketDataProvider (Context)         │
│                                   │                              │
│                      ┌────────────┼────────────┐                 │
│                      ▼            ▼            ▼                 │
│                 Widget A     Widget B     Widget C               │
│                                                                  │
│  WidgetRegistry 管理流程:                                        │
│    register(template) → createInstance(widgetId)                 │
│    → updateRuntimeState(instanceId, { status })                  │
│    → removeInstance(instanceId)                                  │
└──────────────────────────────────────────────────────────────────┘
```

**数据来源**：`WidgetRegistry.createInstance()` → `TaskScheduler.register()` → `BaseCollector.fetch()`
**数据去向**：`MarketDataProvider` → 各 Widget 组件的 `data` prop
**更新频率**：默认 5 秒轮询（`COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL`），可通过 `DataSourceConfig.interval` 调整

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖 Widget 框架全部类型定义（28 个接口）与枚举常量（16 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | MarketData +2 字段（hotSectors/valuePit）；SectorHeatmapData +1 字段（fundFlow）；新增 HotSectorData/ValuePitData 接口；Widget 注册表 12→21 | Architecture Asset Governor |