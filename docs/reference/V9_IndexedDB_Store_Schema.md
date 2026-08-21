---
title: "V9 IndexedDB Store Schema 文档"
domain: data
status: active
last_updated: 2026-08-22
covers_code:
  - src/data/types.ts
  - src/data/db.ts
  - src/services/trading/tradeReviewAI.types.ts
  - src/config/dbConfig.ts
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
# V9 IndexedDB Store Schema 文档

> **版本**：v21  
> **生成日期**：2026-07-05  
> **源文件**：`src/config/dbConfig.ts`、`src/data/db.ts`、`src/data/types.ts`

---

## 1. 总览

### 1.1 基本信息

| 项目 | 值 |
|------|-----|
| 数据库名称 | `V6ProDB` |
| 当前版本号 | **21** |
| Store 总数 | **25** |
| 存储引擎 | IndexedDB（浏览器本地存储） |
| 封装类 | `V6Database`（`src/data/db.ts`） |

### 1.2 版本历史

| 版本区间 | 主要变更 |
|----------|----------|
| v3 → v4 | 新增 `daily_quotes` 存储，用于保存 K线/行情数据。 |
| v4 → v5 | `stocks` 存储新增 `group` 字段与 `by-group` 索引，历史数据回退为默认分组。 |
| v5 → v6 | 新增 `rotation_scores`、`sector_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news`、`news_stock_map`、`sentiment_cache` 存储，支撑 V6 Pro 迁移能力。 |
| v6 → v12 | V9 架构升级，统一数据模型与类型系统，优化索引结构。 |
| v12 → v13 | 新增 `news_bookmarks` 存储，用于持久化资讯收藏状态。 |
| v13 → v14 | 新增 `hot_sector_scores`、`value_pit_scores` 存储，支撑双策略体系。 |
| v14 → v15 | `hot_sector_scores` 维度字段 `composite` 重命名为 `marketEnv`；`value_pit_scores` 移除 `composite` 字段；新增 `execution_logs`、`missing_reports` Store。 |
| v15 → v16 | 数据层补全：新增 `execution_plans`（执行计划）、`portfolios`（投资组合）Store。 |
| v16 → v17 | 智能体调度层：新增 `agent_tasks`、`agent_health_logs` Store。 |
| v17 → v18 | 命令模块：新增 `command_audit_logs` Store。 |
| v18 → v19 | 输出舱与执行模块：新增 `export_tasks`、`execution_strategies` Store。 |
| v19 → v20 | 交易复盘：新增 `trade_reviews` Store。 |
| v20 → v21 | 数据字典补全：完善 ACL 矩阵，新增 `datalayer` 模块的 read/write 权限。 |

### 1.3 Store 一览

| 序号 | Store 名称 | 主键 | 自增 | 索引数 | 主要数据实体 |
|------|-----------|------|------|--------|-------------|
| 1 | `stocks` | `symbol` | 否 | 2 | `Stock` |
| 2 | `v6_scores` | `symbol` | 否 | 0 | `V6Score` |
| 3 | `intelligent_scores` | `id` | 是 | 1 | `IntelligentScore` |
| 4 | `industry_scores` | `id` | 是 | 1 | `IndustryScore` |
| 5 | `orders` | `id` | 否 | 0 | `Order` |
| 6 | `watchlists` | `id` | 否 | 0 | `Watchlist` |
| 7 | `signals` | `id` | 否 | 0 | `Signal` |
| 8 | `research_logs` | `id` | 是 | 0 | `ResearchLog` |
| 9 | `daily_quotes` | `symbol` | 否 | 0 | `DailyQuotes` |
| 10 | `rotation_scores` | `id` | 否 | 4 | `RotationSectorScore` |
| 11 | `sector_scores` | `id` | 否 | 3 | `SectorScoreRecord` |
| 12 | `score_docs` | `docId` | 否 | 3 | `ScoreDocVersion` |
| 13 | `strategy_snapshots` | `id` | 否 | 3 | `StrategySnapshot` |
| 14 | `local_docs` | `id` | 否 | 3 | `LocalDoc` |
| 15 | `news` | `id` | 否 | 4 | `NewsArticle` |
| 16 | `news_stock_map` | `id` | 否 | 2 | `NewsStockMap` |
| 17 | `sentiment_cache` | `id` | 否 | 2 | `SentimentCache` |
| 18 | `news_bookmarks` | `id` | 否 | 1 | 资讯收藏记录 |
| 19 | `hot_sector_scores` | `symbol` | 否 | 1 | `HotSectorScore` |
| 20 | `value_pit_scores` | `symbol` | 否 | 1 | `ValuePitScore` |
| 21 | `execution_logs` | `id` | 是 | 3 | `ExecutionLog`（v15 新增） |
| 22 | `missing_reports` | `id` | 是 | 3 | `MissingReport`（v15 新增） |
| 23 | `execution_plans` | `id` | 否 | 4 | `ExecutionPlan`（v16 新增） |
| 24 | `portfolios` | `id` | 否 | 2 | `Portfolio`（v16 新增） |
| 25 | `trade_reviews` | `id` | 否 | 1 | `TradeReviewRecord`（v20 新增） |

---

## 2. Store 详细说明

### 2.1 stocks — 股票池基础数据

| 属性 | 值 |
|------|-----|
| Store 名称 | `stocks` |
| 主键 (keyPath) | `symbol` |
| 自增 | 否 |
| 数据实体类型 | `Stock` |
| 数据来源模块 | `fetcher`（写入）、`stockpool`（读写）、`analyzer`（读） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-status` | `researchStatus` | 否 | 按研究状态筛选股票 |
| `by-group` | `group` | 否 | 按用户自定义分组筛选 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | `string` | 是 | 股票代码，主键 |
| `name` | `string` | 是 | 股票名称 |
| `price` | `number` | 否 | 当前价格 |
| `pe` | `number` | 否 | 市盈率 |
| `pb` | `number` | 否 | 市净率 |
| `roe` | `number` | 否 | 净资产收益率 |
| `marketCap` | `number` | 否 | 市值 |
| `researchStatus` | `ResearchStatus` | 是 | 研究状态（candidate/screened/deepDive/watching/archived） |
| `source` | `DataSource` | 是 | 数据来源（manual/import/akshare） |
| `dataVersion` | `number` | 是 | 数据版本号 |
| `dataQuality` | `StockDataQuality` | 否 | 数据质量标记 |
| `industryCode` | `string` | 否 | 行业代码 |
| `theme` | `string[]` | 否 | 主题标签 |
| `sector` | `string` | 否 | 板块名称 |
| `group` | `string` | 否 | 股票池分组名称，默认"默认分组" |
| `ingestedAt` | `number` | 否 | 入库时间戳 |
| `updatedAt` | `number` | 否 | 更新时间戳 |

---

### 2.2 v6_scores — V6 综合评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `v6_scores` |
| 主键 (keyPath) | `symbol` |
| 自增 | 否 |
| 数据实体类型 | `V6Score` |
| 数据来源模块 | `analyzer`（读写）、`stockpool`（读） |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | `string` | 是 | 股票代码，主键 |
| `score` | `number` | 是 | 综合评分 |
| `factors` | `Record<string, number>` | 是 | 各因子得分明细 |
| `algorithmVersion` | `string` | 是 | 算法版本号 |
| `calculatedAt` | `number` | 是 | 计算时间戳 |
| `dataVersion` | `number` | 是 | 数据版本号 |
| `qualityWarning` | `string` | 否 | 评分质量警告（数据完整度低于100%时填充） |

---

### 2.3 intelligent_scores — 智能评分（AI 多维）

| 属性 | 值 |
|------|-----|
| Store 名称 | `intelligent_scores` |
| 主键 (keyPath) | `id` |
| 自增 | **是** |
| 数据实体类型 | `IntelligentScore` |
| 数据来源模块 | `analyzer`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-symbol` | `symbol` | 否 | 按股票代码查询历史评分 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `number` | 否 | 自增主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `overallScore` | `number \| null` | 是 | 总体评分 |
| `dimensionScores` | `DimensionScore[]` | 是 | 各维度评分详情 |
| `summary` | `string` | 是 | 评分总结 |
| `basis` | `string` | 是 | 评分依据 |
| `missingFields` | `string[]` | 是 | 缺失字段列表 |
| `sourceSnapshot` | `object` | 是 | 评分时的源数据快照（股票信息、文件名、报告长度） |
| `configSnapshot` | `object` | 是 | 模型配置快照（model、baseURL） |
| `modelResponse` | `string` | 是 | 模型原始响应 |
| `dataVersion` | `number` | 是 | 数据版本号 |
| `scoredAt` | `number` | 是 | 评分时间戳 |

---

### 2.4 industry_scores — 行业评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `industry_scores` |
| 主键 (keyPath) | `id` |
| 自增 | **是** |
| 数据实体类型 | `IndustryScore` |
| 数据来源模块 | `analyzer`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-code` | `code` | 否 | 按行业代码查询历史评分 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `number` | 否 | 自增主键 |
| `code` | `string` | 是 | 行业代码 |
| `name` | `string` | 是 | 行业名称 |
| `overallScore` | `number \| null` | 是 | 总体评分 |
| `dimensionScores` | `IndustryDimensionScore[]` | 是 | 各维度评分详情 |
| `summary` | `string` | 是 | 评分总结 |
| `basis` | `string` | 是 | 评分依据 |
| `missingFields` | `string[]` | 是 | 缺失字段列表 |
| `sectorSnapshot` | `object` | 是 | 板块快照（composite、recommendation、positionPct、subTracks） |
| `configSnapshot` | `object` | 是 | 模型配置快照 |
| `modelResponse` | `string` | 是 | 模型原始响应 |
| `scoredAt` | `number` | 是 | 评分时间戳 |

---

### 2.5 orders — 交易订单

| 属性 | 值 |
|------|-----|
| Store 名称 | `orders` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `Order` |
| 数据来源模块 | `trading`（读写）、`tradinghub`（写） |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 订单 ID，主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `direction` | `OrderDirection` | 是 | 买卖方向（buy/sell） |
| `quantity` | `number` | 是 | 数量 |
| `price` | `number` | 是 | 价格 |
| `amount` | `number` | 是 | 金额 |
| `status` | `OrderStatus` | 是 | 订单状态（pending/filled/cancelled） |
| `accountType` | `AccountType` | 是 | 账户类型（paper/real） |
| `createdAt` | `number` | 是 | 创建时间戳 |
| `planStopLoss` | `number` | 否 | 计划止损价 |
| `planTakeProfit` | `number` | 否 | 计划止盈价 |
| `planPositionPct` | `number` | 否 | 计划仓位占比（0-1） |
| `planFollowed` | `boolean` | 否 | 是否按计划执行 |
| `maxDrawdown` | `number` | 否 | 最大回撤金额 |
| `maxFloatingProfit` | `number` | 否 | 最大浮动盈利 |
| `profitCaptureRate` | `number` | 否 | 盈利捕获率（0-1） |
| `errors` | `string[]` | 否 | 复盘错误列表 |
| `reviewNoteId` | `string` | 否 | 关联复盘笔记 ID |

---

### 2.6 watchlists — 自选股/观察列表

| 属性 | 值 |
|------|-----|
| Store 名称 | `watchlists` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `Watchlist` |
| 数据来源模块 | `user`（用户管理） |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 列表 ID，主键 |
| `name` | `string` | 是 | 列表名称 |
| `items` | `string[]` | 是 | 股票代码列表 |
| `createdAt` | `number` | 是 | 创建时间戳 |
| `updatedAt` | `number` | 是 | 更新时间戳 |

---

### 2.7 signals — 交易信号

| 属性 | 值 |
|------|-----|
| Store 名称 | `signals` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `Signal` |
| 数据来源模块 | `trading`（读写）、`tradinghub`（写）、`strategy`（读） |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 信号 ID，主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `direction` | `string` | 是 | 信号方向（buy/sell/hold/watch） |
| `type` | `string` | 是 | 信号类型 |
| `confidence` | `number` | 是 | 置信度 |
| `rationale` | `string` | 是 | 信号理由 |
| `snapshot` | `SignalSnapshot` | 是 | 触发时的技术面快照 |
| `createdAt` | `number` | 是 | 创建时间戳 |
| `strategy` | `string` | 否 | 策略来源（hot-sector/value-pit/core-scarce） |

---

### 2.8 research_logs — 研究操作日志

| 属性 | 值 |
|------|-----|
| Store 名称 | `research_logs` |
| 主键 (keyPath) | `id` |
| 自增 | **是** |
| 数据实体类型 | `ResearchLog` |
| 数据来源模块 | 系统审计日志 |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `number` | 否 | 自增主键 |
| `traceId` | `string` | 是 | 追踪 ID |
| `timestamp` | `number` | 是 | 时间戳 |
| `actor` | `string` | 是 | 操作者 |
| `action` | `string` | 是 | 动作类型 |
| `targetType` | `string` | 是 | 目标类型 |
| `targetCode` | `string` | 是 | 目标代码 |
| `payload` | `string` | 否 | 操作载荷（JSON 字符串） |

---

### 2.9 daily_quotes — 日线行情 / K线数据

| 属性 | 值 |
|------|-----|
| Store 名称 | `daily_quotes` |
| 主键 (keyPath) | `symbol` |
| 自增 | 否 |
| 数据实体类型 | `DailyQuotes` |
| 数据来源模块 | `fetcher`（写）、`rotation`（读）、`strategy`（读） |

**索引列表：** 无

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | `string` | 是 | 股票代码，主键 |
| `latest` | `KlineBar` | 是 | 最新一根K线 |
| `history` | `KlineBar[]` | 是 | 历史K线数组 |
| `period` | `string` | 是 | 周期（如 daily） |
| `adjust` | `string` | 是 | 复权方式（如 qfq） |
| `updatedAt` | `number` | 是 | 更新时间戳 |

**KlineBar 结构：**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `date` | `string` | 日期 |
| `open` | `number` | 开盘价 |
| `high` | `number` | 最高价 |
| `low` | `number` | 最低价 |
| `close` | `number` | 收盘价 |
| `volume` | `number` | 成交量 |
| `amount` | `number` | 成交额 |

---

### 2.10 rotation_scores — 板块轮动评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `rotation_scores` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `RotationSectorScore` |
| 数据来源模块 | `rotation`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-sector-date` | `[sectorCode, scoreDate]` | **是** | 按板块+日期唯一查询 |
| `by-sector` | `sectorCode` | 否 | 按板块筛选 |
| `by-total` | `total` | 否 | 按总分排序 |
| `by-resonance` | `resonance` | 否 | 按共振强度排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | ID（格式：sectorCode__date），主键 |
| `sectorCode` | `string` | 是 | 板块代码 |
| `sectorName` | `string` | 是 | 板块名称 |
| `swLevel1/2/3` | `string` | 否 | 申万行业分级 |
| `scoreDate` | `string` | 是 | 评分日期 |
| `f1Jingqi` | `number` | 是 | 景气因子得分 |
| `f2Zijin` | `number` | 是 | 资金因子得分 |
| `f3Guzhi` | `number` | 是 | 估值因子得分 |
| `f4Beta` | `number` | 是 | β+相关系数得分 |
| `f5Nengliang` | `number` | 是 | 量能因子得分 |
| `total` | `number` | 是 | 综合总分（0-100） |
| `resonance` | `number` | 是 | 共振强度（0-10） |
| `signal` | `string` | 是 | 信号标签 |
| `alertLevel` | `string` | 是 | 预警等级 |
| `declineType` | `string` | 是 | 下跌性质 |
| `poolStocks` | `array` | 是 | 相关股票池标的 |
| `analysisReport` | `string` | 否 | 分析报告 |
| `modelUsed` | `string` | 是 | 使用模型 |
| `createdAt` | `string` | 是 | 创建时间 |

---

### 2.11 sector_scores — 十五五板块评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `sector_scores` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `SectorScoreRecord` |
| 数据来源模块 | `sector`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-sector` | `sectorCode` | 否 | 按板块筛选 |
| `by-composite` | `composite` | 否 | 按综合分排序 |
| `by-is-core` | `isCore` | 否 | 按核心板块筛选 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | ID（格式：sectorCode__date），主键 |
| `sectorCode` | `string` | 是 | 板块代码 |
| `scoreDate` | `string` | 是 | 评分日期 |
| `dimensions` | `SectorScoreDimensions` | 是 | 三维度评分（planAlignment/policySupport/usChinaParity） |
| `composite` | `number` | 是 | 综合评分 |
| `isCore` | `boolean` | 是 | 是否核心板块 |
| `modelUsed` | `string` | 是 | 使用模型 |
| `createdAt` | `string` | 是 | 创建时间 |

---

### 2.12 score_docs — 评分文档版本库

| 属性 | 值 |
|------|-----|
| Store 名称 | `score_docs` |
| 主键 (keyPath) | `docId` |
| 自增 | 否 |
| 数据实体类型 | `ScoreDocVersion` |
| 数据来源模块 | `analyzer`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-symbol` | `symbol` | 否 | 按股票查询所有版本 |
| `by-symbol-version` | `[symbol, version]` | **是** | 按股票+版本唯一查询 |
| `by-composite` | `composite` | 否 | 按综合分排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `docId` | `string` | 是 | 文档ID（格式：symbol__version__timestamp），主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `stockName` | `string` | 是 | 股票名称 |
| `version` | `number` | 是 | 版本号 |
| `scoreDate` | `string` | 是 | 评分日期 |
| `composite` | `number` | 是 | 综合评分 |
| `l3v` | `number` | 是 | L3V 评分 |
| `layers` | `Record<string, V6LayerScore>` | 是 | 各层级评分 |
| `recommendation` | `object` | 是 | 投资建议（key/label/color） |
| `targetPrice` | `object` | 是 | 目标价（bull/base/bear） |
| `keyRisks` | `string[]` | 是 | 关键风险 |
| `keyCatalysts` | `string[]` | 是 | 关键催化剂 |
| `reportMd` | `string` | 是 | 完整报告 Markdown |
| `modelUsed` | `string` | 是 | 使用模型 |
| `market` | `string` | 是 | 市场 |
| `industry` | `string` | 否 | 行业 |
| `changeFromPrev` | `object` | 否 | 较上一版本变化 |
| `createdAt` | `string` | 是 | 创建时间 |

---

### 2.13 strategy_snapshots — 策略快照

| 属性 | 值 |
|------|-----|
| Store 名称 | `strategy_snapshots` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `StrategySnapshot` |
| 数据来源模块 | `tradinghub`（写）、`trading`（读） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-version` | `version` | **是** | 按版本号唯一查询 |
| `by-date` | `date` | 否 | 按日期筛选 |
| `by-timestamp` | `timestamp` | 否 | 按时间戳排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 快照 ID，主键 |
| `version` | `number` | 是 | 版本号 |
| `timestamp` | `number` | 是 | 时间戳 |
| `date` | `string` | 是 | 日期 |
| `time` | `string` | 是 | 时间 |
| `stockCount` | `number` | 是 | 股票总数 |
| `scoreCount` | `number` | 是 | 已评分数量 |
| `rotationCount` | `number` | 是 | 轮动信号数量 |
| `core` | `StrategyGroupSnapshot` | 是 | 核心稀缺组快照 |
| `hot` | `StrategyGroupSnapshot` | 是 | 热门追涨组快照 |
| `value` | `StrategyGroupSnapshot` | 是 | 价值洼地组快照 |
| `changeFromPrev` | `object` | 否 | 较上一版本变化 |
| `trigger` | `string` | 是 | 触发原因 |

---

### 2.14 local_docs — 本地知识库文档

| 属性 | 值 |
|------|-----|
| Store 名称 | `local_docs` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `LocalDoc` |
| 数据来源模块 | `analyzer`（关联）、用户上传 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-symbol` | `symbol` | 否 | 按股票代码筛选 |
| `by-category` | `category` | 否 | 按分类筛选 |
| `by-added-at` | `addedAt` | 否 | 按添加时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 文档 ID，主键 |
| `symbol` | `string` | 是 | 关联股票代码 |
| `name` | `string` | 是 | 文档名称 |
| `content` | `string` | 是 | 文档内容 |
| `category` | `string` | 是 | 分类（研报/财报/行业分析/新闻/策略笔记/其他） |
| `tags` | `string[]` | 是 | 标签列表 |
| `sourcePath` | `string` | 是 | 源文件路径 |
| `size` | `number` | 是 | 文件大小 |
| `addedAt` | `number` | 是 | 添加时间戳 |

---

### 2.15 news — 资讯文章

| 属性 | 值 |
|------|-----|
| Store 名称 | `news` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `NewsArticle` |
| 数据来源模块 | `news`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-source` | `source` | 否 | 按来源筛选 |
| `by-category` | `category` | 否 | 按分类筛选 |
| `by-publish-time` | `publishTime` | 否 | 按发布时间排序 |
| `by-hash` | `hash` | **是** | 按内容哈希去重 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 文章 ID，主键 |
| `title` | `string` | 是 | 标题 |
| `content` | `string` | 是 | 内容正文 |
| `url` | `string` | 是 | 原文链接 |
| `source` | `string` | 是 | 来源 |
| `category` | `string` | 是 | 分类 |
| `publishTime` | `string` | 是 | 发布时间 |
| `fetchTime` | `string` | 是 | 抓取时间 |
| `sentiment` | `string` | 是 | 情感倾向（positive/negative/neutral） |
| `sentimentConfidence` | `number` | 是 | 情感置信度 |
| `relatedStocks` | `string[]` | 是 | 关联股票代码列表 |
| `keywords` | `string[]` | 是 | 关键词列表 |
| `hash` | `string` | 是 | 内容哈希（用于去重） |

---

### 2.16 news_stock_map — 股票-资讯关联映射

| 属性 | 值 |
|------|-----|
| Store 名称 | `news_stock_map` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `NewsStockMap` |
| 数据来源模块 | `news`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-symbol` | `symbol` | 否 | 按股票查询关联资讯 |
| `by-news` | `newsId` | 否 | 按资讯查询关联股票 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 关联ID（格式：{symbol}_{newsId}），主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `newsId` | `string` | 是 | 资讯 ID |
| `relevanceScore` | `number` | 是 | 相关性评分 |
| `isTitleMatch` | `boolean` | 是 | 是否标题匹配 |
| `isContentMatch` | `boolean` | 是 | 是否正文匹配 |
| `industryMatch` | `boolean` | 是 | 是否行业匹配 |

---

### 2.17 sentiment_cache — 情感分析缓存

| 属性 | 值 |
|------|-----|
| Store 名称 | `sentiment_cache` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `SentimentCache` |
| 数据来源模块 | `news`（读写） |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-content-hash` | `contentHash` | **是** | 按内容哈希快速查询缓存 |
| `by-analyzed-at` | `analyzedAt` | 否 | 按分析时间排序/清理 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 缓存ID（格式：sent_{contentHash}），主键 |
| `contentHash` | `string` | 是 | 内容哈希 |
| `sentiment` | `string` | 是 | 情感倾向（positive/negative/neutral） |
| `confidence` | `number` | 是 | 置信度 |
| `method` | `string` | 是 | 分析方法（rule/llm/hybrid） |
| `analyzedAt` | `number` | 是 | 分析时间戳 |
| `llmModel` | `string` | 否 | 使用的 LLM 模型名称 |

---

### 2.18 news_bookmarks — 资讯收藏

| 属性 | 值 |
|------|-----|
| Store 名称 | `news_bookmarks` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | 资讯收藏记录（与 `NewsArticle` 结构一致） |
| 数据来源模块 | `news`（读写） |
| 引入版本 | v13 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-bookmarked-at` | `bookmarkedAt` | 否 | 按收藏时间排序 |

**主要字段说明：**

该 Store 存储用户收藏的资讯文章，结构与 `NewsArticle` 类似，额外包含收藏时间戳 `bookmarkedAt`。用于持久化用户的资讯收藏状态，支持离线查看。

---

### 2.19 hot_sector_scores — 热门板块策略评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `hot_sector_scores` |
| 主键 (keyPath) | `symbol` |
| 自增 | 否 |
| 数据实体类型 | `HotSectorScore` |
| 数据来源模块 | `analyzer`（读写）、`tradinghub`（读写）、`strategy`（读写） |
| 引入版本 | v14 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-calculated-at` | `calculatedAt` | 否 | 按计算时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | `string` | 是 | 股票/板块代码，主键 |
| `name` | `string` | 是 | 板块/标的名称 |
| `score` | `number` | 是 | 总评分 |
| `dimensions` | `HotSectorDimensionScores` | 是 | 五维度评分（momentum/sentiment/technical/valuation/marketEnv） |
| `action` | `string` | 是 | 操作建议（immediate/probe/ignore） |
| `calculatedAt` | `number` | 是 | 计算时间戳 |
| `dataVersion` | `number` | 是 | 数据版本号 |
| `qualityWarning` | `string` | 否 | 质量警告 |

> **v15 变更**：维度字段 `composite` 重命名为 `marketEnv`（大盘环境维度）。

---

### 2.20 value_pit_scores — 价值洼地策略评分

| 属性 | 值 |
|------|-----|
| Store 名称 | `value_pit_scores` |
| 主键 (keyPath) | `symbol` |
| 自增 | 否 |
| 数据实体类型 | `ValuePitScore` |
| 数据来源模块 | `analyzer`（读写）、`tradinghub`（读写）、`strategy`（读写） |
| 引入版本 | v14 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-calculated-at` | `calculatedAt` | 否 | 按计算时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | `string` | 是 | 股票/板块代码，主键 |
| `name` | `string` | 是 | 板块/标的名称 |
| `score` | `number` | 是 | 总评分 |
| `dimensions` | `ValuePitDimensionScores` | 是 | 五维度评分（catalyst/valuation/chip/rotation/liquidity） |
| `rotationSignal` | `boolean` | 是 | 是否触发轮动信号 |
| `action` | `string` | 是 | 操作建议（immediate/probe/wait/ignore） |
| `calculatedAt` | `number` | 是 | 计算时间戳 |
| `dataVersion` | `number` | 是 | 数据版本号 |
| `qualityWarning` | `string` | 否 | 质量警告 |

> **v15 变更**：移除 `dimensions.composite` 字段。

---

### 2.21 execution_logs — 执行日志

| 属性 | 值 |
|------|-----|
| Store 名称 | `execution_logs` |
| 主键 (keyPath) | `id` |
| 自增 | **是** |
| 数据实体类型 | `ExecutionLog` |
| 数据来源模块 | `execution`（读写）、`trading`（读） |
| 引入版本 | v15 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-plan` | `planId` | 否 | 按执行计划查询日志 |
| `by-symbol` | `symbol` | 否 | 按股票代码筛选 |
| `by-timestamp` | `timestamp` | 否 | 按时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `number` | 否 | 自增主键 |
| `planId` | `string` | 是 | 关联的执行计划 ID |
| `symbol` | `string` | 是 | 股票代码 |
| `action` | `string` | 是 | 执行动作（如 buy/sell/cancel） |
| `actor` | `string` | 否 | 执行者（user/agent/system） |
| `phase` | `ExecutionPhase` | 是 | 执行阶段（plan/confirmed/pending/executed/cancelled/reviewed） |
| `timestamp` | `number` | 是 | 执行时间戳 |
| `detail` | `string` | 否 | 执行详情描述 |
| `success` | `boolean` | 否 | 是否执行成功 |
| `errorMessage` | `string` | 否 | 错误信息（失败时填充） |
| `createdAt` | `number` | 是 | 记录创建时间戳 |

---

### 2.22 missing_reports — 缺失报告登记

| 属性 | 值 |
|------|-----|
| Store 名称 | `missing_reports` |
| 主键 (keyPath) | `id` |
| 自增 | **是** |
| 数据实体类型 | `MissingReport` |
| 数据来源模块 | `execution`（读写）、`trading`（读） |
| 引入版本 | v15 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-symbol` | `symbol` | 否 | 按股票代码查询缺失报告 |
| `by-severity` | `severity` | 否 | 按严重程度筛选 |
| `by-detected-at` | `detectedAt` | 否 | 按检测时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `number` | 否 | 自增主键 |
| `symbol` | `string` | 是 | 股票代码 |
| `reportType` | `string` | 是 | 报告类型 |
| `severity` | `string` | 是 | 严重程度（low/medium/high/critical） |
| `reason` | `string` | 是 | 缺失原因 |
| `detectedAt` | `number` | 是 | 检测时间戳 |
| `retryCount` | `number` | 是 | 重试次数 |
| `resolvedAt` | `number` | 否 | 解决时间戳（未解决时为 undefined） |
| `createdAt` | `number` | 是 | 记录创建时间戳 |

---

### 2.23 execution_plans — 执行计划

| 属性 | 值 |
|------|-----|
| Store 名称 | `execution_plans` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `ExecutionPlan` |
| 数据来源模块 | `execution`（读写）、`trading`（读写） |
| 引入版本 | v16 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-signal` | `signalId` | 否 | 按关联信号查询 |
| `by-symbol` | `symbol` | 否 | 按股票代码筛选 |
| `by-phase` | `phase` | 否 | 按执行阶段筛选 |
| `by-created-at` | `createdAt` | 否 | 按创建时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 执行计划 ID，主键 |
| `signalId` | `string` | 否 | 关联的交易信号 ID |
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 计划名称 |
| `phase` | `ExecutionPhase` | 是 | 当前执行阶段 |
| `direction` | `'buy' \| 'sell'` | 是 | 买卖方向 |
| `quantity` | `number` | 是 | 计划数量 |
| `targetPrice` | `number` | 是 | 目标价格 |
| `currentPrice` | `number` | 否 | 当前市场价格 |
| `rationale` | `string` | 是 | 执行理由 |
| `confidence` | `number` | 是 | 置信度（0-1） |
| `riskChecks` | `RiskCheckItem[]` | 是 | 风控检查项列表 |
| `risk` | `object` | 否 | 风控结果（passed/preCheck/postCheck/issueCount/checks/warnings） |
| `sizing` | `object` | 否 | 仓位计算（quantity/positionPct/reason） |
| `result` | `'success' \| 'failed' \| 'partial'` | 否 | 执行结果 |
| `orderId` | `string` | 否 | 关联订单 ID |
| `errorMessage` | `string` | 否 | 错误信息 |
| `accountType` | `AccountType` | 否 | 账户类型（paper/real） |
| `confirmedAt` | `number` | 否 | 确认时间戳 |
| `executedAt` | `number` | 否 | 执行时间戳 |
| `reviewedAt` | `number` | 否 | 复盘时间戳 |
| `createdAt` | `number` | 是 | 创建时间戳 |
| `updatedAt` | `number` | 否 | 更新时间戳 |

---

### 2.24 portfolios — 投资组合

| 属性 | 值 |
|------|-----|
| Store 名称 | `portfolios` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `Portfolio` |
| 数据来源模块 | `strategy`（读写）、`tradinghub`（读） |
| 引入版本 | v16 |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-theme` | `theme` | 否 | 按投资主题筛选 |
| `by-updated-at` | `updatedAt` | 否 | 按更新时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 组合 ID，主键 |
| `name` | `string` | 是 | 组合名称 |
| `theme` | `string` | 是 | 投资主题 |
| `totalValue` | `number` | 是 | 组合总价值 |
| `cashReserve` | `number` | 是 | 现金储备 |
| `holdings` | `PortfolioHolding[]` | 是 | 持仓列表（symbol/name/currentShares/currentWeight/targetWeight/targetShares/price/marketValue/score/rationale） |
| `rebalancePlan` | `RebalanceAction[]` | 是 | 再平衡计划（symbol/action/shares/reason） |
| `createdAt` | `number` | 是 | 创建时间戳 |
| `updatedAt` | `number` | 是 | 更新时间戳 |

---

### 2.25 trade_reviews — 交易纪律复盘

| 属性 | 值 |
|------|-----|
| Store 名称 | `trade_reviews` |
| 主键 (keyPath) | `id` |
| 自增 | 否 |
| 数据实体类型 | `TradeReviewRecord` |
| 数据来源模块 | `trading`（读写）、`output`（读） |
| 引入版本 | v20 |
| 类型定义位置 | `src/services/trading/tradeReviewAI.types.ts` |

**索引列表：**

| 索引名 | 字段 | 唯一 | 用途 |
|--------|------|------|------|
| `by-generated-at` | `generatedAt` | 否 | 按生成时间排序 |

**主要字段说明：**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 复盘记录 ID，主键 |
| `generatedAt` | `number` | 是 | 生成时间戳 |
| `report` | `TradeReviewReport` | 是 | 六维复盘报告主体（summary/errorAnalysis/disciplineAnalysis/skillDevelopment/actionPlan/aiInsight） |
| `tradeErrors` | `DetectedError[]` | 是 | 检测到的交易错误列表 |
| `disciplineScore` | `number` | 是 | 纪律评分（0-100） |
| `skillRoadmap` | `string[]` | 是 | 技能发展路线图 |
| `psychologicalProfile` | `PsychologicalProfile \| null` | 是 | 心理画像（可为 null） |

> **注意**：`TradeReviewRecord` 是 25 个 Store 中唯一不在 `src/data/types.ts` 中定义的类型，其类型定义位于 `src/services/trading/tradeReviewAI.types.ts`。

---

## 3. 附录

### 3.1 Store 与数据实体映射关系表

| Store 名称 | TypeScript 类型 | 类型定义文件 | 主键字段 |
|-----------|----------------|-------------|----------|
| `stocks` | `Stock` | `src/data/types.ts` | `symbol` |
| `v6_scores` | `V6Score` | `src/data/types.ts` | `symbol` |
| `intelligent_scores` | `IntelligentScore` | `src/data/types.ts` | `id`（自增） |
| `industry_scores` | `IndustryScore` | `src/data/types.ts` | `id`（自增） |
| `orders` | `Order` | `src/data/types.ts` | `id` |
| `watchlists` | `Watchlist` | `src/data/types.ts` | `id` |
| `signals` | `Signal` | `src/data/types.ts` | `id` |
| `research_logs` | `ResearchLog` | `src/data/types.ts` | `id`（自增） |
| `daily_quotes` | `DailyQuotes` | `src/data/types.ts` | `symbol` |
| `rotation_scores` | `RotationSectorScore` | `src/data/types.ts` | `id` |
| `sector_scores` | `SectorScoreRecord` | `src/data/types.ts` | `id` |
| `score_docs` | `ScoreDocVersion` | `src/data/types.ts` | `docId` |
| `strategy_snapshots` | `StrategySnapshot` | `src/data/types.ts` | `id` |
| `local_docs` | `LocalDoc` | `src/data/types.ts` | `id` |
| `news` | `NewsArticle` | `src/data/types.ts` | `id` |
| `news_stock_map` | `NewsStockMap` | `src/data/types.ts` | `id` |
| `sentiment_cache` | `SentimentCache` | `src/data/types.ts` | `id` |
| `news_bookmarks` | 资讯收藏记录（NewsArticle 扩展） | — | `id` |
| `hot_sector_scores` | `HotSectorScore` | `src/data/types.ts` | `symbol` |
| `value_pit_scores` | `ValuePitScore` | `src/data/types.ts` | `symbol` |
| `execution_logs` | `ExecutionLog` | `src/data/types.ts` | `id`（自增） |
| `missing_reports` | `MissingReport` | `src/data/types.ts` | `id`（自增） |
| `execution_plans` | `ExecutionPlan` | `src/data/types.ts` | `id` |
| `portfolios` | `Portfolio` | `src/data/types.ts` | `id` |
| `trade_reviews` | `TradeReviewRecord` | `src/services/trading/tradeReviewAI.types.ts` | `id` |

### 3.2 模块与 Store 权限矩阵（ACL）

| 模块 | 可读 Store | 可写 Store |
|------|-----------|-----------|
| `fetcher` | — | `stocks`、`daily_quotes` |
| `stockpool` | `stocks`、`v6_scores` | `stocks` |
| `analyzer` | `stocks`、`v6_scores`、`intelligent_scores`、`industry_scores`、`score_docs`、`hot_sector_scores`、`value_pit_scores` | `v6_scores`、`intelligent_scores`、`industry_scores`、`score_docs`、`hot_sector_scores`、`value_pit_scores` |
| `rotation` | `stocks`、`rotation_scores`、`daily_quotes` | `rotation_scores` |
| `sector` | `stocks`、`sector_scores` | `sector_scores` |
| `news` | `stocks`、`news`、`news_stock_map`、`sentiment_cache`、`news_bookmarks` | `news`、`news_stock_map`、`sentiment_cache`、`news_bookmarks` |
| `tradinghub` | `stocks`、`v6_scores`、`orders`、`signals`、`strategy_snapshots`、`hot_sector_scores`、`value_pit_scores` | `orders`、`signals`、`strategy_snapshots`、`hot_sector_scores`、`value_pit_scores` |
| `trading` | `stocks`、`orders`、`signals`、`strategy_snapshots` | `orders`、`signals` |
| `strategy` | `stocks`、`v6_scores`、`daily_quotes`、`hot_sector_scores`、`value_pit_scores`、`rotation_scores`、`signals` | `hot_sector_scores`、`value_pit_scores` |
| `user` | `stocks`、`v6_scores`、`orders` | `stocks`、`orders` |
| `system` | 全部 | 全部 |

### 3.3 唯一索引汇总

| Store | 唯一索引 | 字段 |
|-------|---------|------|
| `rotation_scores` | `by-sector-date` | `[sectorCode, scoreDate]` |
| `score_docs` | `by-symbol-version` | `[symbol, version]` |
| `strategy_snapshots` | `by-version` | `version` |
| `news` | `by-hash` | `hash` |
| `sentiment_cache` | `by-content-hash` | `contentHash` |

### 3.4 自增主键 Store 汇总

| Store | 主键字段 | 说明 |
|-------|---------|------|
| `intelligent_scores` | `id` | AI 智能评分历史，每条记录独立自增 |
| `industry_scores` | `id` | 行业评分历史，每条记录独立自增 |
| `research_logs` | `id` | 操作审计日志，按顺序自增 |
| `execution_logs` | `id` | 执行日志，按顺序自增（v15 新增） |
| `missing_reports` | `id` | 缺失报告登记，按顺序自增（v15 新增） |

---

> **文档说明**：本文档基于 `DB_VERSION = 21` 的代码实现自动整理，所有 Schema 定义来源于 `src/data/db.ts` 的 `onupgradeneeded` 回调，类型定义来源于 `src/data/types.ts`。当数据库版本升级时，请同步更新本文档。
