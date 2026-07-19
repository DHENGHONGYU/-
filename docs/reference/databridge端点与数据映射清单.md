---
title: DataBridge 端点与数据映射清�?
type: reference
domain: data
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档版本：v1.2.0 创建日期�?026-06-28 最后更�?*�?026-07-05（v1.2.0：补充执行日�?缺失报告/执行计划 CRUD 端点 5 个，新增..."
tags: [data, databridge, checklist]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DataBridge 端点与数据映射清�?
> **文档版本**：v1.2.0  
> **创建日期**�?026-06-28  
> **最后更�?*�?026-07-05（v1.2.0：补充执行日�?缺失报告/执行计划 CRUD 端点 5 个，新增 Query 路由 3 个，修正 DB 路由计数�?36�? 
> **文档状�?*：�?权威生效  
> **权威等级**：DataBridge 模块设计参�? 
> **维护角色**：数据治理架构师

---

## 文档说明

### 目的

本文档基�?`StandardEnvelope` 通信协议�?P0/P1 级功能数据实体，系统梳理 DataBridge 模块需要暴露的所有数据订阅（subscribe）与转发（forward）端点，作为后续 DataBridge 接口设计、ACL 权限矩阵扩展与模块集成的权威参考�?
### 范围

- **Forward 端点**：DataBridge.forward() 可接收的所�?EnvelopeAction，即所�?写路�?
- **Subscribe 端点**：DataBridge.subscribe() 可订阅的所有频道，即所�?�?监听路径"
- **数据覆盖**：P0 核心数据 + P1 重要功能数据（共 28 + 56 = 84 个数据实体，其中持久化实体映射为端点�?
### 优先级定�?
| 优先�?| 标识 | 定义 |
|:---|:---|:---|
| **P0** | 🔴 核心/基础 | 系统运行基石，核心业务实体与基础通信协议。必须实现�?|
| **P1** | 🟡 重要/功能 | 功能模块骨架数据，支撑具体业务能力。V9 版本内实现�?|
| **P2** | 🟢 辅助/扩展 | 辅助功能、UI状态、未来扩展数据。后续版本规划�?|

### 命名约定

| 层级 | 命名风格 | 示例 |
|:---|:---|:---|
| Forward 动作 | ENVELOPE_ACTION 常量�?| `INSERT_STOCK` |
| 订阅频道（数据类�?| Store 名称（snake_case�?| `stocks`, `v6_scores` |
| 订阅频道（策略流�?| `strategy:{strategyName}` | `strategy:hotSector` |
| 订阅频道（系统类�?| `system:{eventName}` | `system:health` |

---

## 一、Forward 端点总览

Forward 端点�?DataBridge.forward() 方法的输入，即模块通过发�?StandardEnvelope 触发的数据写�?操作请求。按路由类型分为三大类：

| 路由类型 | 数量 | 说明 |
|:---|:---:|:---|
| **DB 路由** | 36 | 数据持久化操作与订单/新闻事件，写�?IndexedDB �?Store |
| **Strategy 路由** | 3 | 策略引擎计算触发，输出到策略频道 |
| **Manager 路由** | 3 | 系统级管理操作（重置/导入/导出�?|
| **合计** | **42** | �?|

> **v1.1.0 变更**：DB 路由新增 6 �?action（saveExecutionLog、saveMissingReport、updateExecutionPlan、deleteExecutionPlan、incrementMissingReportRetry、savePortfolio 已记录但此前未纳入计数），另新增 Query 路由 3 个（queryGet、queryList、queryByIndex）走 `DataBridge.query()` 独立通道，不计入 forward 合计�?
---

## 二、Forward 端点详细清单（DB 路由�?
### 2.1 股票基础数据（P0�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 1 | `insertStock` | `INSERT_STOCK` | Stock | 写（增） | P0 | `stocks` | `stocks` | fetcher, stockpool, user |
| 2 | `updateStock` | `UPDATE_STOCK` | Stock | 写（改） | P0 | `stocks` | `stocks` | stockpool, user, fetcher |
| 3 | `deleteStock` | `DELETE_STOCK` | Stock | 写（删） | P0 | `stocks` | `stocks` | stockpool, user |
| 4 | `saveDailyQuotes` | `SAVE_DAILY_QUOTES` | DailyQuotes | 写（�?改） | P0 | `daily_quotes` | `daily_quotes` | fetcher |

### 2.2 核心评分数据（P0�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 5 | `saveScores` | `SAVE_SCORES` | V6Score | 写（�?改） | P0 | `v6_scores` | `v6_scores` | analyzer |
| 6 | `saveV6Score` | `SAVE_V6_SCORE` | V6Score | 写（�?改） | P0 | `v6_scores` | `v6_scores` | analyzer |
| 7 | `saveHotSectorScores` | `SAVE_HOT_SECTOR_SCORES` | HotSectorScore | 写（�?改） | P0 | `hot_sector_scores` | `hot_sector_scores` | strategy, analyzer |
| 8 | `saveValuePitScores` | `SAVE_VALUE_PIT_SCORES` | ValuePitScore | 写（�?改） | P0 | `value_pit_scores` | `value_pit_scores` | strategy, analyzer |

### 2.3 交易与信号数据（P0�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 9 | `insertOrder` | `INSERT_ORDER` | Order | 写（增） | P0 | `orders` | `orders` | trading, tradinghub, user, orderstore |
| 10 | `updateOrder` | `UPDATE_ORDER` | Order | 写（改） | P0 | `orders` | `orders` | trading, tradinghub, orderstore |
| 11 | `deleteOrder` | `DELETE_ORDER` | Order | 写（删） | P0 | `orders` | `orders` | tradinghub, user, orderstore |
| 12 | `tradeActionExecuted` | `TRADE_ACTION_EXECUTED` | Order | 事件（交易执行完成） | P0 | `orders` | `orders` | trading, orderstore |
| 13 | `insertSignal` | `INSERT_SIGNAL` | Signal | 写（增） | P0 | `signals` | `signals` | strategy, tradinghub |

### 2.4 执行计划与投资组合（P0，v16 数据层补全）

| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 28 | `createExecutionPlan` | `CREATE_EXECUTION_PLAN` | ExecutionPlan | 写（增） | P0 | `executionPlans` | `executionPlans` | executionStore |
| 29 | `updateExecutionPhase` | `UPDATE_EXECUTION_PHASE` | ExecutionPlan | 写（改） | P0 | `executionPlans` | `executionPlans` | executionStore |
| 32 | `saveExecutionPlan` | `SAVE_EXECUTION_PLAN` | ExecutionPlan | 写（�?改） | P0 | `executionPlans` | `executionPlans` | system |
| 33 | `savePortfolio` | `SAVE_PORTFOLIO` | Portfolio | 写（�?改） | P1 | `portfolios` | `portfolios` | user |
| 34 | `deletePortfolio` | `DELETE_PORTFOLIO` | Portfolio | 写（删） | P1 | `portfolios` | `portfolios` | user |
| 30 | `runBacktest` | `RUN_BACKTEST` | BacktestEngineConfig | 事件（回测触发） | P1 | —（运行时） | �?| backtestStore |
| 31 | `saveBacktestResult` | `SAVE_BACKTEST_RESULT` | BacktestEngineResult | 写（增） | P1 | `backtest_results` | `backtestResults` | backtestStore |

### 2.4 智能评分体系（P1�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 14 | `saveIntelligentScores` | `SAVE_INTELLIGENT_SCORES` | IntelligentScore | 写（�?改） | P1 | `intelligent_scores` | `intelligent_scores` | analyzer |
| 15 | `saveIndustryScores` | `SAVE_INDUSTRY_SCORES` | IndustryScore | 写（�?改） | P1 | `industry_scores` | `industry_scores` | analyzer |

### 2.5 板块与轮动数据（P1�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 16 | `saveRotationScores` | `SAVE_ROTATION_SCORES` | RotationSectorScore | 写（�?改） | P1 | `rotation_scores` | `rotation_scores` | rotation |
| 17 | `saveSectorScores` | `SAVE_SECTOR_SCORES` | SectorScoreRecord | 写（�?改） | P1 | `sector_scores` | `sector_scores` | sector |

### 2.6 策略与文档数据（P1�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 18 | `saveScoreDocs` | `SAVE_SCORE_DOCS` | ScoreDocVersion | 写（�?改） | P1 | `score_docs` | `score_docs` | analyzer |
| 19 | `saveStrategySnapshots` | `SAVE_STRATEGY_SNAPSHOTS` | StrategySnapshot | 写（�?改） | P1 | `strategy_snapshots` | `strategy_snapshots` | tradinghub, strategy |
| 20 | `saveLocalDocs` | `SAVE_LOCAL_DOCS` | LocalDoc | 写（�?改） | P1 | `local_docs` | `local_docs` | user, system |

### 2.7 新闻与舆情数据（P1�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 21 | `saveNews` | `SAVE_NEWS` | NewsArticle | 写（�?改） | P1 | `news` | `news` | news |
| 22 | `saveNewsStockMap` | `SAVE_NEWS_STOCK_MAP` | NewsStockMap | 写（�?改） | P1 | `news_stock_map` | `news_stock_map` | news |
| 23 | `saveSentimentCache` | `SAVE_SENTIMENT_CACHE` | SentimentCache | 写（�?改） | P1 | `sentiment_cache` | `sentiment_cache` | news |
| 24 | `saveNewsBookmark` | `SAVE_NEWS_BOOKMARK` | `{ id, bookmarkedAt }` | 写（增） | P1 | `news_bookmarks` | `news_bookmarks` | news |
| 25 | `deleteNewsBookmark` | `DELETE_NEWS_BOOKMARK` | `{ id }` | 写（删） | P1 | `news_bookmarks` | `news_bookmarks` | news |

### 2.8 研究日志（P0 / 审计�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 26 | `saveResearchLog` | `SAVE_RESEARCH_LOG` | ResearchLog | 写（增） | P0 | `research_logs` | `research_logs` | system（自动写入） |

> **说明**：`saveResearchLog` �?DataBridge 内部�?`writeAuditLog` 自动触发，所�?forward 操作均会写入审计日志，外部模块一般不直接调用�?
### 2.9 持仓查询（P0，v1.1.0 新增 �?P0-3 修复�?
`loadHoldingsData` �?payload �?`HoldingsQueryParams`（分�?日期/关键词查询参数）�?*不是 Stock 数据**，不能写�?`stocks` store（keyPath='symbol'）。v1.1.0 新增 `LoadHoldingsDataHandler` 专用处理器，仅记录查询日志，不执�?DB 写入�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|
| 39 | `loadHoldingsData` | `LOAD_HOLDINGS_DATA` | HoldingsQueryParams | **查询（不�?DB�?* | P0 | —（跳过�?| holdingsStore |

> **Handler 注册优先�?*：`LoadHoldingsDataHandler` 注册在通知类处理器之后、DELETE 处理器之前（注释标记 "2.5"），优先于通用 `PutHandler`�?
### 2.10 交易复盘数据（P1�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---|:---|:---|
| 27 | `saveTradeReview` | `SAVE_TRADE_REVIEW` | TradeReviewRecord | 写（�?改） | P1 | `trade_reviews` | `trade_reviews` | disciplineStore, trading |

### 2.11 执行日志与缺失报告（P0，v1.1.0 补充�?
以下 action �?`ENVELOPE_ACTION` 中定义且已在 `DataBridge.createHandlerRegistry()` 中注册处理器，但此前文档未收录�?
| 序号 | EnvelopeAction | 常量�?| 数据实体 | 操作类型 | 优先�?| IndexedDB Store | 订阅频道�?| 主要来源模块 |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| 40 | `saveExecutionLog` | `SAVE_EXECUTION_LOG` | ExecutionLog | 写（增） | P0 | `execution_logs` | `execution_logs` | executionStore |
| 41 | `saveMissingReport` | `SAVE_MISSING_REPORT` | MissingReport | 写（增） | P0 | `missing_reports` | `missing_reports` | executionStore |
| 42 | `incrementMissingReportRetry` | `INCREMENT_MISSING_REPORT_RETRY` | MissingReport | 写（改） | P0 | `missing_reports` | `missing_reports` | executionStore |
| 43 | `updateExecutionPlan` | `UPDATE_EXECUTION_PLAN` | ExecutionPlan | 写（改） | P0 | `execution_plans` | `executionPlans` | executionStore |
| 44 | `deleteExecutionPlan` | `DELETE_EXECUTION_PLAN` | ExecutionPlan | 写（删） | P0 | `execution_plans` | `executionPlans` | executionStore |

> **Handler 说明**：`deleteExecutionPlan` �?`DeleteHandler` 处理；`saveExecutionLog`、`saveMissingReport`、`incrementMissingReportRetry`、`updateExecutionPlan` 由通用 `PutHandler` 处理�?
### 2.12 Query 路由（读操作，v1.1.0 补充�?
`DataBridge.query()` 提供独立的读操作通道，不�?`forward()` 路径，不触发广播。支�?ACL 校验与读缓存�?
| 序号 | EnvelopeAction | 常量�?| 操作类型 | 说明 |
|:---:|:---|:---|:---:|:---|
| 45 | `queryGet` | `QUERY_GET` | 读（单条�?| 按主键查询单条记录，`db.get(store, key)` |
| 46 | `queryList` | `QUERY_LIST` | 读（全部�?| 查询 Store 全部记录，`db.getAll(store)` |
| 47 | `queryByIndex` | `QUERY_BY_INDEX` | 读（索引�?| 按索引查询，`db.getAllByIndex(store, indexName, indexValue)` |

> **Query 路由参数**：通过 `QueryRequest` 接口传入（含 `action`、`store`、`key?`、`indexName?`、`indexValue?`、`source?`），返回 `QueryResult<T>`（含 `success`、`data?`、`error?`）�?
---

## 三、Forward 端点详细清单（Strategy 路由�?
Strategy 路由不直接写�?DB，而是触发策略引擎计算，计算结果通过策略频道广播�?
| 序号 | EnvelopeAction | 常量�?| 触发动作 | 输出频道 | 优先�?| 输出数据实体 | 主要来源模块 |
|:---:|:---|:---|:---|:---|:---:|:---|:---|
| S1 | `strategyHotSectorRefresh` | `STRATEGY_HOT_SECTOR_REFRESH` | 热门板块策略重计�?| `strategy:hotSector` | P0 | HotSectorScore[] | strategy, user |
| S2 | `strategyValuePitRefresh` | `STRATEGY_VALUE_PIT_REFRESH` | 价值洼地策略重计算 | `strategy:valuePit` | P0 | ValuePitScore[] | strategy, user |
| S3 | `strategyRotationSignalDetect` | `STRATEGY_ROTATION_SIGNAL_DETECT` | 轮动信号检�?| `strategy:rotationSignal` | P0 | RotationSignal[] | strategy, rotation |

### Strategy 路由工作�?
```
发送方 �?DataBridge.forward(envelope)
        �?ACL 校验
        �?routeToStrategy()
          ├── 输入校验（payload 必须为数组）
          ├── 逐标的计算评�?信号
          ├── 汇总统�?          ├── broadcast(strategy:xxx, resultEnvelope)
          └── eventBus.emit(strategy:xxxChanged, result)
```

---

## 四、Forward 端点详细清单（Manager 路由�?
Manager 路由处理系统级全局操作，影响所�?Store�?
| 序号 | EnvelopeAction | 常量�?| 操作类型 | 影响范围 | 优先�?| 主要来源模块 |
|:---:|:---|:---|:---:|:---|:---:|:---|
| M1 | `resetAll` | `RESET_ALL` | 写（全删�?| 所�?Store 清空 | P0 | system, user |
| M2 | `importAll` | `IMPORT_ALL` | 写（批量增） | 所�?Store 批量导入 | P0 | system, user |
| M3 | `exportAll` | `EXPORT_ALL` | �?| 所�?Store 导出 | P0 | system, user |

---

## 五、Subscribe 订阅频道总览

Subscribe 频道�?DataBridge.subscribe() 方法支持的所有可订阅频道。所�?DB 写入操作完成后，会向对应 Store 名称的频道广播变更通知；策略路由则向专用策略频道广播�?
| 频道分类 | 数量 | 说明 |
|:---|:---:|:---|
| **数据 Store 频道** | 21 | �?IndexedDB Store 一一对应，写入后自动广播 |
| **策略数据流频�?* | 3 | 策略引擎计算结果实时推�?|
| **事件型频道（规划中）** | 5 | 业务事件通知，非数据变更驱动 |
| **合计（当前已实现�?* | **24** | �?|

---

## 六、Subscribe 频道详细清单（数�?Store 频道�?
所�?DB 路由操作完成后，DataBridge 会调�?`broadcast(targetStore, envelope)` 向对�?Store 频道推送变更。订阅者收到完整的 StandardEnvelope（含 payload �?meta）�?
### 6.1 P0 核心数据频道

| 序号 | 频道�?| 对应 Store | 数据实体 | 触发 Action | 优先�?| 典型订阅�?|
|:---:|:---|:---|:---|:---|:---:|:---|
| 1 | `stocks` | `stocks` | Stock | insertStock, updateStock, deleteStock | P0 | stockpool, tradinghub, analyzer, UI |
| 2 | `daily_quotes` | `daily_quotes` | DailyQuotes | saveDailyQuotes | P0 | analyzer, rotation, strategy, UI |
| 3 | `v6_scores` | `v6_scores` | V6Score | saveScores, saveV6Score | P0 | analyzer, tradinghub, strategy, UI |
| 4 | `hot_sector_scores` | `hot_sector_scores` | HotSectorScore | saveHotSectorScores | P0 | strategy, tradinghub, UI |
| 5 | `value_pit_scores` | `value_pit_scores` | ValuePitScore | saveValuePitScores | P0 | strategy, tradinghub, UI |
| 6 | `orders` | `orders` | Order | insertOrder, updateOrder, deleteOrder, tradeActionExecuted | P0 | orderstore, tradinghub, trading, UI |
| 7 | `signals` | `signals` | Signal | insertSignal | P0 | tradinghub, trading, UI |
| 8 | `research_logs` | `research_logs` | ResearchLog | saveResearchLog | P0 | system, audit UI |

### 6.2 P1 重要功能数据频道

| 序号 | 频道�?| 对应 Store | 数据实体 | 触发 Action | 优先�?| 典型订阅�?|
|:---:|:---|:---|:---|:---|:---:|:---|
| 9 | `intelligent_scores` | `intelligent_scores` | IntelligentScore | saveIntelligentScores | P1 | analyzer, UI |
| 10 | `industry_scores` | `industry_scores` | IndustryScore | saveIndustryScores | P1 | analyzer, sector, UI |
| 11 | `rotation_scores` | `rotation_scores` | RotationSectorScore | saveRotationScores | P1 | rotation, strategy, UI |
| 12 | `sector_scores` | `sector_scores` | SectorScoreRecord | saveSectorScores | P1 | sector, UI |
| 13 | `score_docs` | `score_docs` | ScoreDocVersion | saveScoreDocs | P1 | analyzer, UI |
| 14 | `strategy_snapshots` | `strategy_snapshots` | StrategySnapshot | saveStrategySnapshots | P1 | tradinghub, strategy, UI |
| 15 | `local_docs` | `local_docs` | LocalDoc | saveLocalDocs | P1 | analyzer, UI |
| 16 | `news` | `news` | NewsArticle | saveNews, updateNews, deleteNews, newsArticleLoaded, newsArticleBookmarked | P1 | news, newsStore, UI |
| 17 | `news_stock_map` | `news_stock_map` | NewsStockMap | saveNewsStockMap | P1 | news, analyzer, UI |
| 18 | `sentiment_cache` | `sentiment_cache` | SentimentCache | saveSentimentCache | P1 | news, analyzer |
| 19 | `watchlists` | `watchlists` | Watchlist | （待实现�?| P1 | stockpool, UI |
| 20 | `news_bookmarks` | `news_bookmarks` | `{ id, bookmarkedAt }` | saveNewsBookmark, deleteNewsBookmark, newsArticleBookmarked | P1 | news, newsStore, UI |
| 21 | `trade_reviews` | `trade_reviews` | TradeReviewRecord | saveTradeReview | P1 | disciplineStore, trading, UI |

> **注意**：`watchlists` Store 已在 STORE_NAME 中定义，但当�?DataBridge 中尚无对应的 EnvelopeAction �?forward 处理逻辑，属�?P1 待实现端点�?
---

## 七、Subscribe 频道详细清单（策略数据流频道�?
策略数据流频道由 Strategy 路由主动广播，不与任�?Store 直接对应，承载实时计算结果�?
| 序号 | 频道�?| 常量标识 | 输出数据实体 | 触发 Action | 优先�?| 典型订阅�?|
|:---:|:---|:---|:---|:---|:---:|:---|
| SC1 | `strategy:hotSector` | `STRATEGY_CHANNEL.hotSector` | HotScoreScore[] | strategyHotSectorRefresh | P0 | tradinghub, UI, signal generator |
| SC2 | `strategy:valuePit` | `STRATEGY_CHANNEL.valuePit` | ValuePitScore[] | strategyValuePitRefresh | P0 | tradinghub, UI, signal generator |
| SC3 | `strategy:rotationSignal` | `STRATEGY_CHANNEL.rotationSignal` | RotationSignal[] | strategyRotationSignalDetect | P0 | strategy, tradinghub, UI |

### 策略频道 vs Store 频道的区�?
| 维度 | Store 频道 | 策略数据流频�?|
|:---|:---|:---|
| 触发时机 | DB 写入完成�?| 策略计算完成�?|
| 数据来源 | IndexedDB 持久化数�?| 运行时计算结�?|
| payload 内容 | 单条记录（写入的实体�?| 批量结果数组 |
| 广播方式 | DataBridge.broadcast(storeName) | routeToStrategy �?broadcast(channel) |
| 对应 EnvelopeTarget | `db` | `strategy:hotSector` �?|

---

## 八、事件型频道规划（P1 / P2�?
当前 EnvelopeAction 中定义了若干事件型动作（�?CRUD 操作），这些动作目前未独立频道，可在后续版本规划为专用事件频道�?
| 序号 | 事件动作 | 常量�?| 规划频道�?| 数据实体 | 优先�?| 说明 |
|:---:|:---|:---|:---|:---|:---:|:---|
| E1 | `newsArticleLoaded` | `NEWS_ARTICLE_LOADED` | `event:newsLoaded` | NewsArticle | P1 | 新闻文章加载完成事件 |
| E2 | `newsArticleBookmarked` | `NEWS_ARTICLE_BOOKMARKED` | `event:newsBookmarked` | `{ id, bookmarked }` | P2 | 新闻收藏/取消收藏事件（已�?`news` / `news_bookmarks` Store 频道处理�?|
| E3 | `holdingsDataLoaded` | `HOLDINGS_DATA_LOADED` | `event:holdingsLoaded` | PortfolioHolding[] | P1 | 持仓数据加载完成事件 |
| E4 | `tradeActionExecuted` | `TRADE_ACTION_EXECUTED` | `event:tradeExecuted` | Order | P1 | 交易动作执行完成事件（已�?`orders` Store 频道处理�?|

> **说明**�?> - `tradeActionExecuted` 已作�?`orders` Store 频道的触�?Action �?OrderStore 订阅，用于交易完成后自动刷新持仓与盈亏�?> - `newsArticleBookmarked` 以及新增�?`saveNewsBookmark` / `deleteNewsBookmark` 已在 `news` �?`news_bookmarks` Store 频道处理，NewsStore 据此同步本地 `bookmarkedIds`�?> - 其余事件型动作当前在 DataBridge 中走默认 DB 路由（default put），未做专门处理。建议后续版本为事件型动作增加独立路由与事件频道�?
---

## 九、数据实�?- 端点映射总表

下表按数据实体维度，汇总每个实体对应的 forward 动作与订阅频道�?
### 9.1 P0 核心数据实体

| 数据实体 | 编号 | Forward 动作（写�?| Subscribe 频道（读监听�?| Store | 优先�?|
|:---|:---:|:---|:---|:---|:---:|
| Stock | #6 | insertStock, updateStock, deleteStock | `stocks` | `stocks` | P0 |
| DailyQuotes | #20 | saveDailyQuotes | `daily_quotes` | `daily_quotes` | P0 |
| V6Score | #12 | saveScores, saveV6Score | `v6_scores` | `v6_scores` | P0 |
| HotSectorScore | #13 | saveHotSectorScores | `hot_sector_scores`, `strategy:hotSector` | `hot_sector_scores` | P0 |
| ValuePitScore | #15 | saveValuePitScores | `value_pit_scores`, `strategy:valuePit` | `value_pit_scores` | P0 |
| RotationSignal | #18 | —（运行时计算，不持久化�?| `strategy:rotationSignal` | �?| P0 |
| Order | #7 | insertOrder, updateOrder, deleteOrder, tradeActionExecuted | `orders` | `orders` | P0 |
| Signal | #8 | insertSignal | `signals` | `signals` | P0 |
| Watchlist | #9 | （待实现�?| `watchlists` | `watchlists` | P0 |
| ResearchLog | �?| saveResearchLog | `research_logs` | `research_logs` | P0 |

### 9.2 P1 重要功能数据实体

| 数据实体 | 编号 | Forward 动作（写�?| Subscribe 频道（读监听�?| Store | 优先�?|
|:---|:---:|:---|:---|:---|:---:|
| IntelligentScore | #45 | saveIntelligentScores | `intelligent_scores` | `intelligent_scores` | P1 |
| IndustryScore | #47 | saveIndustryScores | `industry_scores` | `industry_scores` | P1 |
| RotationSectorScore | #51 | saveRotationScores | `rotation_scores` | `rotation_scores` | P1 |
| SectorScoreRecord | #49 | saveSectorScores | `sector_scores` | `sector_scores` | P1 |
| ScoreDocVersion | #148 | saveScoreDocs | `score_docs` | `score_docs` | P1 |
| StrategySnapshot | #162 | saveStrategySnapshots | `strategy_snapshots` | `strategy_snapshots` | P1 |
| LocalDoc | #149 | saveLocalDocs | `local_docs` | `local_docs` | P1 |
| NewsArticle | #74 | saveNews | `news` | `news` | P1 |
| NewsStockMap | #75 | saveNewsStockMap | `news_stock_map` | `news_stock_map` | P1 |
| SentimentCache | #76 | saveSentimentCache | `sentiment_cache` | `sentiment_cache` | P1 |
| NewsBookmark | #�?| saveNewsBookmark, deleteNewsBookmark | `news_bookmarks` | `news_bookmarks` | P1 |
| TradeReviewRecord | #59 | saveTradeReview | `trade_reviews` | `trade_reviews` | P1 |

### 9.3 运行�?/ 不持久化实体（P0/P1�?
以下实体参与数据流但不独立持久化，不作为独立端点暴露�?
| 数据实体 | 编号 | 所属层�?| 存在形式 | 优先�?|
|:---|:---:|:---|:---|:---:|
| StandardEnvelope | #1 | P0 | 通信协议，所有端点的载体 | P0 |
| EnvelopeMeta | #2 | P0 | StandardEnvelope 的嵌套结�?| P0 |
| KlineBar | #19 | P0 | DailyQuotes.history 嵌套元素 | P0 |
| HotSectorDimensionScores | #14 | P0 | HotSectorScore.dimensions 嵌套 | P0 |
| ValuePitDimensionScores | #16 | P0 | ValuePitScore.dimensions 嵌套 | P0 |
| SignalSnapshot | #23 | P0 | Signal.snapshot 嵌套 | P0 |
| DualStrategyResult | #17 | P0 | 运行时计算，存入 StrategySnapshot | P0 |
| Portfolio | #10 | P0 | 运行时计�?+ StrategySnapshot 嵌入 | P0 |
| PortfolioHolding | #11 | P0 | Portfolio 嵌套结构 | P0 |
| RebalanceAction | #28 | P0 | Portfolio 嵌套结构 | P0 |
| DimensionScore | #46 | P1 | IntelligentScore.dimensionScores 嵌套 | P1 |
| IndustryDimensionScore | #48 | P1 | IndustryScore.dimensionScores 嵌套 | P1 |
| SectorScoreDimensions | #50 | P1 | SectorScoreRecord.dimensions 嵌套 | P1 |
| StrategyCandidate | #42 | P1 | StrategyResult 嵌套 / 运行�?| P1 |
| StrategyResult | #43 | P1 | 运行时计算，存入 StrategySnapshot | P1 |

---

## 十、当前实现缺口与待办�?
基于 P0/P1 数据实体的完整映射，当前 DataBridge 实现存在以下待补充项�?
### 10.1 P0 级缺�?
| 缺口�?| 说明 | 建议动作 |
|:---|:---|:---|
| Watchlist 相关 Action | STORE_NAME 已定�?`watchlists`，但无对�?EnvelopeAction �?forward 处理 | 新增 `insertWatchlist`, `updateWatchlist`, `deleteWatchlist` |
| Signal 更新/删除 Action | 仅有 `insertSignal`，缺�?`updateSignal`, `deleteSignal` | 视业务需求补�?|

### 10.2 P1 级缺�?
| 缺口�?| 说明 | 建议动作 |
|:---|:---|:---|
| 事件型动作路�?| `tradeActionExecuted` 已纳�?`orders` Store 频道；`newsArticleBookmarked` / `saveNewsBookmark` / `deleteNewsBookmark` 已纳�?`news` / `news_bookmarks` Store 频道。`newsArticleLoaded`、`holdingsDataLoaded` 仍走默认 DB 路由 | 规划剩余事件型动作的专用路由与频�?|
| 板块定义数据 | SectorDefinition 为配置加载，无动态写入端�?| 如需运行时修改，新增 saveSectorDefinition �?|
| 交易复盘数据 | ReviewReport, DisciplineScore, ActionPlan �?~~Store 未在 DataBridge 中映射~~ **已通过 `saveTradeReview` / `trade_reviews` Store 实现（Phase 1�?* | ~~后续版本补充~~ 已完�?|
| AI Agent 数据 | AgentDefinition, AgentInstance �?Store 未接�?DataBridge | 后续版本补充 |
| ~~执行日志/缺失报告~~ | ~~`execution_logs`、`missing_reports` 无对�?EnvelopeAction~~ **已通过 `saveExecutionLog`、`saveMissingReport`、`incrementMissingReportRetry` 实现（v1.2.0�?* | ~~后续版本补充~~ 已完�?|
| ~~执行计划完整 CRUD~~ | ~~仅有 `createExecutionPlan`/`updateExecutionPhase`，缺少更新和删除~~ **已补�?`updateExecutionPlan`、`deleteExecutionPlan`（v1.2.0�?* | ~~后续版本补充~~ 已完�?|

### 10.3 架构优化建议

| 优化�?| 现状 | 建议 |
|:---|:---|:---|
| 批量操作支持 | 当前所�?forward 均为单条写入 | 增加 BULK_* 系列 Action 支持批量导入 |
| 查询�?forward | forward 仅支持写操作，查询走 DB 层直�?| 评估是否需�?QUERY_* 系列 Action 统一�?DataBridge |
| 细粒度订�?| 当前�?Store 全量广播，无法按标的过滤 | 增加 `stocks:{symbol}` 级别的细粒度订阅能力 |
| 事件型频道独�?| 事件型动作混�?DB 路由�?| 分离事件路由，建�?`event:*` 频道体系 |

---

## 附录 A：EnvelopeAction 完整对照�?
| 序号 | 键名 | 常量�?| 路由类型 | 目标 Store | 数据实体 | 优先�?|
|:---:|:---|:---|:---|:---|:---|:---:|
| 1 | insertStock | INSERT_STOCK | DB | stocks | Stock | P0 |
| 2 | updateStock | UPDATE_STOCK | DB | stocks | Stock | P0 |
| 3 | deleteStock | DELETE_STOCK | DB | stocks | Stock | P0 |
| 4 | saveScores | SAVE_SCORES | DB | v6_scores | V6Score | P0 |
| 5 | saveV6Score | SAVE_V6_SCORE | DB | v6_scores | V6Score | P0 |
| 6 | saveDailyQuotes | SAVE_DAILY_QUOTES | DB | daily_quotes | DailyQuotes | P0 |
| 7 | saveIntelligentScores | SAVE_INTELLIGENT_SCORES | DB | intelligent_scores | IntelligentScore | P1 |
| 8 | saveIndustryScores | SAVE_INDUSTRY_SCORES | DB | industry_scores | IndustryScore | P1 |
| 9 | saveRotationScores | SAVE_ROTATION_SCORES | DB | rotation_scores | RotationSectorScore | P1 |
| 10 | saveSectorScores | SAVE_SECTOR_SCORES | DB | sector_scores | SectorScoreRecord | P1 |
| 11 | saveScoreDocs | SAVE_SCORE_DOCS | DB | score_docs | ScoreDocVersion | P1 |
| 12 | saveStrategySnapshots | SAVE_STRATEGY_SNAPSHOTS | DB | strategy_snapshots | StrategySnapshot | P1 |
| 13 | saveHotSectorScores | SAVE_HOT_SECTOR_SCORES | DB | hot_sector_scores | HotSectorScore | P0 |
| 14 | saveValuePitScores | SAVE_VALUE_PIT_SCORES | DB | value_pit_scores | ValuePitScore | P0 |
| 15 | saveLocalDocs | SAVE_LOCAL_DOCS | DB | local_docs | LocalDoc | P1 |
| 16 | saveNews | SAVE_NEWS | DB | news | NewsArticle | P1 |
| 17 | saveNewsStockMap | SAVE_NEWS_STOCK_MAP | DB | news_stock_map | NewsStockMap | P1 |
| 18 | saveSentimentCache | SAVE_SENTIMENT_CACHE | DB | sentiment_cache | SentimentCache | P1 |
| 19 | saveResearchLog | SAVE_RESEARCH_LOG | DB | research_logs | ResearchLog | P0 |
| 20 | insertSignal | INSERT_SIGNAL | DB | signals | Signal | P0 |
| 21 | insertOrder | INSERT_ORDER | DB | orders | Order | P0 |
| 22 | updateOrder | UPDATE_ORDER | DB | orders | Order | P0 |
| 23 | deleteOrder | DELETE_ORDER | DB | orders | Order | P0 |
| 24 | tradeActionExecuted | TRADE_ACTION_EXECUTED | DB | orders | Order | P0 |
| 25 | strategyHotSectorRefresh | STRATEGY_HOT_SECTOR_REFRESH | Strategy | —（�?strategy:hotSector�?| HotSectorScore[] | P0 |
| 26 | strategyValuePitRefresh | STRATEGY_VALUE_PIT_REFRESH | Strategy | —（�?strategy:valuePit�?| ValuePitScore[] | P0 |
| 27 | strategyRotationSignalDetect | STRATEGY_ROTATION_SIGNAL_DETECT | Strategy | —（�?strategy:rotationSignal�?| RotationSignal[] | P0 |
| 28 | resetAll | RESET_ALL | Manager | 全部 Store | �?| P0 |
| 29 | importAll | IMPORT_ALL | Manager | 全部 Store | �?| P0 |
| 30 | exportAll | EXPORT_ALL | Manager | 全部 Store | �?| P0 |
| 31 | newsArticleLoaded | NEWS_ARTICLE_LOADED | DB（默认） | news | NewsArticle | P1 |
| 32 | newsArticleBookmarked | NEWS_ARTICLE_BOOKMARKED | DB（默认） | news_bookmarks | `{ id, bookmarked }` | P2 |
| 33 | saveNewsBookmark | SAVE_NEWS_BOOKMARK | DB | news_bookmarks | `{ id, bookmarkedAt }` | P1 |
| 34 | deleteNewsBookmark | DELETE_NEWS_BOOKMARK | DB | news_bookmarks | `{ id }` | P1 |
| 35 | holdingsDataLoaded | HOLDINGS_DATA_LOADED | DB（默认） | stocks | PortfolioHolding | P1 |
| 36 | saveTradeReview | SAVE_TRADE_REVIEW | DB | trade_reviews | TradeReviewRecord | P1 |
| 37 | createExecutionPlan | CREATE_EXECUTION_PLAN | DB | execution_plans | ExecutionPlan | P0 |
| 38 | updateExecutionPhase | UPDATE_EXECUTION_PHASE | DB | execution_plans | ExecutionPlan | P0 |
| 39 | loadHoldingsData | LOAD_HOLDINGS_DATA | **查询（不�?DB�?* | —（跳过�?| HoldingsQueryParams | P0 |
| 40 | saveExecutionLog | SAVE_EXECUTION_LOG | DB | execution_logs | ExecutionLog | P0 |
| 41 | saveMissingReport | SAVE_MISSING_REPORT | DB | missing_reports | MissingReport | P0 |
| 42 | incrementMissingReportRetry | INCREMENT_MISSING_REPORT_RETRY | DB | missing_reports | MissingReport | P0 |
| 43 | updateExecutionPlan | UPDATE_EXECUTION_PLAN | DB | execution_plans | ExecutionPlan | P0 |
| 44 | deleteExecutionPlan | DELETE_EXECUTION_PLAN | DB | execution_plans | ExecutionPlan | P0 |
| 45 | queryGet | QUERY_GET | Query（读�?| 按请求指�?| 泛型 T | P0 |
| 46 | queryList | QUERY_LIST | Query（读�?| 按请求指�?| 泛型 T[] | P0 |
| 47 | queryByIndex | QUERY_BY_INDEX | Query（读�?| 按请求指�?| 泛型 T[] | P0 |

> **v1.1.0 变更**�?> - #39 `loadHoldingsData` �?`LoadHoldingsDataHandler` 专用处理器处理，不执�?DB 写入。此前该 action 被错误路由至 `PutHandler` �?`stocks` store，导�?IndexedDB key path 报错（P0-3）�?> - #40�?44 为新�?DB 路由 action，已�?`createHandlerRegistry()` 中注册对应处理器�?> - #45�?47 �?Query 路由 action，走 `DataBridge.query()` 独立通道，不�?`forward()`�?
---

## 附录 B：订阅频道完整清�?
| 序号 | 频道�?| 类型 | 对应数据实体 | 优先�?| 触发方式 |
|:---:|:---|:---|:---|:---:|:---|
| 1 | `stocks` | Store 频道 | Stock | P0 | DB 写入后广�?|
| 2 | `daily_quotes` | Store 频道 | DailyQuotes | P0 | DB 写入后广�?|
| 3 | `v6_scores` | Store 频道 | V6Score | P0 | DB 写入后广�?|
| 4 | `hot_sector_scores` | Store 频道 | HotSectorScore | P0 | DB 写入后广�?|
| 5 | `value_pit_scores` | Store 频道 | ValuePitScore | P0 | DB 写入后广�?|
| 6 | `orders` | Store 频道 | Order | P0 | DB 写入后广�?|
| 7 | `signals` | Store 频道 | Signal | P0 | DB 写入后广�?|
| 8 | `research_logs` | Store 频道 | ResearchLog | P0 | 审计自动写入后广�?|
| 9 | `watchlists` | Store 频道 | Watchlist | P0 | 待实�?|
| 10 | `intelligent_scores` | Store 频道 | IntelligentScore | P1 | DB 写入后广�?|
| 11 | `industry_scores` | Store 频道 | IndustryScore | P1 | DB 写入后广�?|
| 12 | `rotation_scores` | Store 频道 | RotationSectorScore | P1 | DB 写入后广�?|
| 13 | `sector_scores` | Store 频道 | SectorScoreRecord | P1 | DB 写入后广�?|
| 14 | `score_docs` | Store 频道 | ScoreDocVersion | P1 | DB 写入后广�?|
| 15 | `strategy_snapshots` | Store 频道 | StrategySnapshot | P1 | DB 写入后广�?|
| 16 | `local_docs` | Store 频道 | LocalDoc | P1 | DB 写入后广�?|
| 17 | `news` | Store 频道 | NewsArticle | P1 | DB 写入 / 事件触发后广�?|
| 18 | `news_stock_map` | Store 频道 | NewsStockMap | P1 | DB 写入后广�?|
| 19 | `sentiment_cache` | Store 频道 | SentimentCache | P1 | DB 写入后广�?|
| 20 | `news_bookmarks` | Store 频道 | `{ id, bookmarkedAt }` | P1 | DB 写入 / 事件触发后广�?|
| 21 | `trade_reviews` | Store 频道 | TradeReviewRecord | P1 | DB 写入后广�?|
| 22 | `market_data:orders` | Store 频道（MarketDataStore 订阅�?| Order（事件触发刷新） | P0 | MarketDataStore 订阅 orders 频道，订单变更时自动触发 portfolioOverview 数据源刷�?|
| 23 | `strategy:hotSector` | 策略流频�?| HotSectorScore[] | P0 | 策略计算后广�?|
| 24 | `strategy:valuePit` | 策略流频�?| ValuePitScore[] | P0 | 策略计算后广�?|
| 25 | `strategy:rotationSignal` | 策略流频�?| RotationSignal[] | P0 | 策略计算后广�?|
| 26 | `executionPlans` | Store 频道 | ExecutionPlan | P0 | DB 写入后广播（createExecutionPlan / updateExecutionPhase�?|

---

> **文档结束**
>
> 本文档基�?`src/core/databridge.ts`、`src/core/envelope.ts`、`src/config/dbConfig.ts` �?`./v9核心数据字典与类型定�?整合�?.md` (v1.2) 综合梳理生成�?