# Cockpit & News 模块文档修正方案（Phase 2-3）

> **Status**: Draft  
> **Version**: v0.9.1-correction-plan  
> **Last Updated**: 2026-06-26  
> **关联差异报告**: `docs/implementation/v9-architecture-data-diff-report.md`  
> **覆盖差异**: DIFF-001, DIFF-004, DIFF-006, DIFF-007, DIFF-008, DIFF-014, DIFF-019, DIFF-022

---

## 一、修正文件清单

| 序号 | 操作 | 文件路径 | 对应差异ID | 优先级 |
|------|------|----------|-----------|--------|
| 1 | 新建 | `docs/cockpit/DATA_DEFINITION.md` | DIFF-007, DIFF-008 | 🔴 P0 |
| 2 | 新建 | `docs/news/DATA_DEFINITION.md` | DIFF-014 | 🔴 P0 |
| 3 | 修改 | `docs/03-architecture-standards.md` | DIFF-001, DIFF-004 | 🔴 P0 |
| 4 | 修改 | `docs/02-functional-specs.md` | DIFF-004 | 🔴 P0 |
| 5 | 修改 | `docs/README.md` | DIFF-006 | 🔴 P0 |
| 6 | 修改 | `docs/10-glossary.md` | DIFF-019, DIFF-022 | 🟡 P1 |

---

## 二、新建文件修正内容

### 2.1 `docs/cockpit/DATA_DEFINITION.md`（新建）

**来源**: DIFF-007（Widget 框架核心类型未定义）、DIFF-008（Cockpit 常量枚举未定义）

**覆盖范围**: 
- 源码文件: `src/types/modules/widget.types.ts`、`src/constants/cockpit.constants.ts`、`src/cockpit/core/widgetRegistry.ts`
- 类型定义: 40+ 个接口
- 枚举常量: 23+ 组

**文档结构**:

```markdown
# Cockpit / Widget 框架 — 数据字典

> 生成日期：2026-06-26
> 模块范围：`src/types/modules/widget.types.ts` · `src/constants/cockpit.constants.ts` · `src/cockpit/core/`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码，必须从此字典对应的 constants 文件引用。

---

## 一、TypeScript 接口定义

### 1.1 DataSourceConfig — Widget 数据源配置

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `type` | `DataSourceType` | 是 | `"mock"` / `"rest"` / `"websocket"` | 数据源类型 |
| `mode` | `CollectionMode` | 是 | `"polling"` / `"once"` / `"streaming"` | 采集模式 |
| `interval` | `number` | 是 | ≥ 1000 | 轮询间隔（毫秒） |
| `endpoint` | `string` | 否 | - | API 端点（REST 数据源时使用） |
| `params` | `Record<string, unknown>` | 否 | - | 额外请求参数 |
| `enabled` | `boolean` | 是 | `true` / `false` | 是否启用 |

### 1.2 RawMarketData — 原始市场数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `timestamp` | `number` | 是 | 毫秒时间戳 | 数据生成时间 |
| `dataType` | `string` | 是 | `"indices"` / `"sectors"` / `"fundFlow"` / `"sentiment"` / `"watchlist"` / `"portfolio"` / `"tradeReview"` / `"analysisScores"` / `"modelComparison"` / `"stockPool"` / `"chatHistory"` | 数据类型标识 |
| `payload` | `unknown` | 是 | - | 原始 payload |
| `source` | `string` | 是 | - | 数据来源标识 |

### 1.3 MarketData — 标准化市场数据（Widget 统一消费接口）

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `timestamp` | `number` | 是 | 毫秒时间戳 | 数据生成时间 |
| `indices` | `MarketIndexData[]` | 是 | - | 大盘指数数据 |
| `sectors` | `SectorHeatmapData[]` | 是 | - | 板块热力图数据 |
| `fundFlows` | `FundFlowData[]` | 是 | - | 资金流向数据 |
| `sentiment` | `SentimentData` | 是 | - | 市场情绪数据 |
| `watchlist` | `WatchlistData[]` | 是 | - | 自选股数据 |
| `portfolio` | `PortfolioData` | 是 | - | 持仓概览数据 |
| `tradeReview` | `TradeReviewData` | 是 | - | AI 交易复盘数据 |
| `analysisScores` | `AnalysisScores` | 是 | - | 投资画像 / 分析评分数据 |
| `modelComparison` | `ModelComparison` | 是 | - | AI 大模型对比数据 |
| `stockPool` | `StockPool` | 是 | - | 股票池管理与监控数据 |
| `chatHistory` | `ChatHistory` | 是 | - | 个股深度分析 / 市场分析聊天数据 |

### 1.4 MarketIndexData — 大盘指数数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | 是 | `"000001"` / `"399001"` / `"399006"` / `"000688"` | 指数代码 |
| `name` | `string` | 是 | `"上证指数"` / `"深证成指"` / `"创业板指"` / `"科创50"` | 指数名称 |
| `price` | `number` | 是 | - | 当前点位 |
| `change` | `number` | 是 | - | 涨跌点数 |
| `changePercent` | `number` | 是 | - | 涨跌幅（%） |
| `high` | `number` | 否 | - | 最高 |
| `low` | `number` | 否 | - | 最低 |
| `volume` | `string` | 否 | - | 成交量 |

### 1.5 SectorHeatmapData — 板块热力图数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `name` | `string` | 是 | - | 板块名称 |
| `code` | `string` | 是 | - | 板块代码 |
| `changePercent` | `number` | 是 | - | 涨跌幅（%） |
| `turnover` | `string` | 否 | - | 成交额 |

### 1.6 FundFlowData — 资金流向数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `type` | `string` | 是 | `"main"` / `"retail"` / `"north"` | 资金类型 |
| `name` | `string` | 是 | `"主力净流入"` / `"散户净流入"` / `"北向净流入"` | 资金名称 |
| `value` | `number` | 是 | - | 金额（亿元） |
| `unit` | `string` | 是 | `"亿"` | 单位 |

### 1.7 SentimentData — 市场情绪数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `fearGreedIndex` | `number` | 是 | 0-100 | 恐惧贪婪指数 |
| `fearGreedLabel` | `string` | 是 | 见 §2.5 SENTIMENT_LEVELS | 情绪标签 |
| `totalStocks` | `number` | 是 | ≥ 0 | 总股票数 |
| `up` | `number` | 是 | ≥ 0 | 上涨数 |
| `down` | `number` | 是 | ≥ 0 | 下跌数 |
| `flat` | `number` | 是 | ≥ 0 | 平盘数 |
| `limitUp` | `number` | 是 | ≥ 0 | 涨停数 |
| `limitDown` | `number` | 是 | ≥ 0 | 跌停数 |

### 1.8 WatchlistData — 自选股数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `name` | `string` | 是 | - | 股票名称 |
| `code` | `string` | 是 | - | 股票代码 |
| `price` | `number` | 是 | - | 当前价格 |
| `changePercent` | `number` | 是 | - | 涨跌幅（%） |

### 1.9 PortfolioData — 持仓概览数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `totalAssets` | `string` | 是 | - | 总资产 |
| `availableFunds` | `string` | 是 | - | 可用资金 |
| `todayPnL` | `string` | 是 | - | 当日盈亏 |
| `todayPnLPercent` | `number` | 是 | - | 当日盈亏率 |
| `totalPnL` | `string` | 是 | - | 累计盈亏 |
| `totalPnLPercent` | `number` | 是 | - | 累计盈亏率 |
| `holdings` | `number` | 是 | ≥ 0 | 持仓品种数 |

### 1.10 TradeReviewData — AI 交易复盘数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `totalTrades` | `number` | 是 | ≥ 0 | 总交易数 |
| `profitable` | `number` | 是 | ≥ 0 | 盈利数 |
| `losing` | `number` | 是 | ≥ 0 | 亏损数 |
| `winRate` | `number` | 是 | 0-100 | 胜率（%） |
| `profitLossRatio` | `number` | 是 | ≥ 0 | 盈亏比 |
| `disciplineScore` | `number` | 是 | 0-100 | 纪律评分 |

### 1.11 AnalysisScores — 投资画像 / 分析评分数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `profile` | `InvestmentProfile` | 是 | - | 用户投资画像 |
| `kai` | `KaiScore` | 是 | - | KAI 选股综合评分 |

### 1.12 InvestmentProfile — 投资画像

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `tags` | `string[]` | 是 | - | 用户标签列表 |
| `metrics` | `ProfileMetric[]` | 是 | - | 核心指标卡片 |

### 1.13 ProfileMetric — 投资画像指标卡片

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `name` | `string` | 是 | 见 §2.10 INVESTMENT_PROFILE_METRICS | 指标名称 |
| `score` | `number` | 是 | 0-100 | 指标评分 |
| `description` | `string` | 否 | - | 指标说明 |
| `icon` | `string` | 否 | - | 图标标识 |

### 1.14 KaiScore — KAI 选股综合评分

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `totalScore` | `number` | 是 | 0-100 | 综合评分 |
| `sentiment` | `number` | 是 | 0-100 | 情绪值 |
| `trend` | `number` | 是 | 0-100 | 趋势值 |
| `flow` | `number` | 是 | 0-100 | 流量值 |
| `dimensions` | `KaiDimension[]` | 是 | 见 §2.9 KAI_DIMENSION_NAMES | 六大类维度评分 |
| `detailDistribution` | `KaiDetailItem[]` | 是 | - | 维度细项分布表 |

### 1.15 KaiDimension — KAI 评分维度

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `name` | `string` | 是 | 见 §2.9 | 维度名称 |
| `score` | `number` | 是 | 0-100 | 维度得分 |
| `weight` | `number` | 是 | 0-1 | 权重 |
| `status` | `string` | 是 | - | 评分状态文本 |
| `color` | `string` | 是 | Tailwind CSS 类名 | 颜色标签 |

### 1.16 KaiDetailItem — KAI 维度细项

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `dimensionName` | `string` | 是 | - | 所属维度名称 |
| `itemName` | `string` | 是 | - | 细项名称 |
| `score` | `number` | 是 | 0-100 | 细项得分 |
| `weight` | `number` | 是 | 0-1 | 细项权重 |
| `color` | `string` | 是 | Tailwind CSS 类名 | 颜色标签 |

### 1.17 ModelComparison — 模型对比数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `leftModel` | `ModelInfo` | 是 | - | 左侧模型信息 |
| `rightModel` | `ModelInfo` | 是 | - | 右侧模型信息 |
| `dimensions` | `CompareDimension[]` | 是 | - | 对比维度列表 |
| `riskHint` | `string` | 是 | - | 风险提示文本 |

### 1.18 ModelInfo — 模型信息

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | 见 §2.11 LLM_MODEL_VERSIONS | 模型 ID |
| `name` | `string` | 是 | - | 模型名称 |
| `version` | `string` | 是 | - | 模型版本号 |
| `score` | `number` | 是 | 0-100 | 模型综合得分 |

### 1.19 CompareDimension — 模型对比维度

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `name` | `string` | 是 | - | 维度名称 |
| `leftScore` | `number` | 是 | 0-100 | 左侧模型得分 |
| `rightScore` | `number` | 是 | 0-100 | 右侧模型得分 |
| `weight` | `number` | 是 | 0-1 | 维度权重 |

### 1.20 StockPool — 股票池数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `stocks` | `StockPoolItem[]` | 是 | - | 股票列表 |
| `total` | `number` | 是 | ≥ 0 | 总条数 |
| `page` | `number` | 是 | ≥ 1 | 当前页码 |
| `pageSize` | `number` | 是 | ≥ 1 | 每页条数 |

### 1.21 StockPoolItem — 股票池条目

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | 是 | - | 股票代码 |
| `name` | `string` | 是 | - | 股票名称 |
| `price` | `number` | 是 | - | 最新价 |
| `changePercent` | `number` | 是 | - | 涨跌幅（%） |
| `turnover` | `string` | 是 | - | 成交额 |
| `turnoverRate` | `string` | 是 | - | 换手率 |
| `statusColor` | `string` | 是 | 见 §2.8 STOCK_POOL_STATUS_COLORS | 状态颜色 |
| `statusLabel` | `string` | 是 | `"活跃"` / `"温热"` / `"冷清"` / `"冷淡"` | 状态标签 |

### 1.22 ChatHistory — 聊天历史数据

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `target` | `string` | 是 | - | 当前选中的标的代码或市场标识 |
| `targetType` | `"stock"` / `"market"` | 是 | - | 标的类型 |
| `messages` | `ChatMessage[]` | 是 | - | 消息列表 |

### 1.23 ChatMessage — 聊天消息

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 消息唯一标识 |
| `role` | `"user"` / `"assistant"` | 是 | - | 消息角色 |
| `content` | `string` | 是 | Markdown 格式 | 消息内容 |
| `timestamp` | `number` | 是 | 毫秒时间戳 | 消息时间戳 |

### 1.24 CollectionTask — 采集任务定义

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `taskId` | `string` | 是 | - | 任务唯一标识 |
| `widgetId` | `string` | 是 | - | 关联的 Widget ID |
| `instanceId` | `string` | 是 | - | 关联的实例 ID |
| `dataSource` | `DataSourceConfig` | 是 | - | 数据源配置 |
| `status` | `CollectionTaskStatus` | 是 | `"pending"`