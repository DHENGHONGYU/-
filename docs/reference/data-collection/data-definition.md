---
title: 数据采集模块数据字典
type: reference
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "生成日期�?026-06-26 模块范围：`src/services/data-collector/` ·..."
tags: [data, data-definition, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 数据采集模块数据字典

> 生成日期�?026-06-26
> 模块范围：`src/services/data-collector/` · `src/types/modules/widget.types.ts`（采集相关类型）· `src/constants/cockpit.constants.ts`（采集配置常量）
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码采集配置、超时时间、重试次数，必须从此字典对应�?constants 引用�?
---

## 一、TypeScript 接口定义

### 1.1 DataSourceConfig �?数据源配�?
**来源**: `src/types/modules/widget.types.ts`
**用�?*: 每个 Widget 声明自身数据需求的核心配置，由 TaskScheduler 解析后创建采集器

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `DataSourceType` | �?| 数据源类型（mock/rest/websocket），�?§2.1 |
| `mode` | `CollectionMode` | �?| 采集模式（polling/once/streaming），�?§2.2 |
| `interval` | `number` | �?| 轮询间隔（毫秒），默�?5000 |
| `endpoint` | `string` | �?| API 端点路径 |
| `params` | `Record<string, unknown>` | �?| 额外请求参数 |
| `enabled` | `boolean` | �?| 是否启用采集 |

### 1.2 CollectionTask �?采集任务定义

**来源**: `src/types/modules/widget.types.ts`
**用�?*: TaskScheduler 管理的单个采集任务，包含状态、重试、执行统�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | �?| 任务唯一标识，格�?`task_{widgetId}_{instanceId}_{counter}` |
| `widgetId` | `string` | �?| 关联 Widget 模板 ID |
| `instanceId` | `string` | �?| 关联 Widget 实例 ID |
| `dataSource` | `DataSourceConfig` | �?| 数据源配�?|
| `status` | `CollectionTaskStatus` | �?| 当前状态，�?§2.3 |
| `error` | `string` | �?| 错误信息 |
| `lastRun` | `number` | �?| 上次执行时间（毫秒时间戳�?|
| `nextRun` | `number` | �?| 下次执行时间（毫秒时间戳�?|
| `runCount` | `number` | �?| 执行次数 |
| `successCount` | `number` | �?| 成功次数 |
| `failCount` | `number` | �?| 失败次数 |

### 1.3 RawMarketData �?原始市场数据

**来源**: `src/types/modules/widget.types.ts`
**用�?*: 采集器从外部获取的原始数据结构，未经适配

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dataType` | `string` | �?| 数据类型：indices/sectors/fundFlow/sentiment/watchlist/portfolio/tradeReview/analysisScores/modelComparison/stockPool/chatHistory/hotSectors/valuePit |
| `source` | `string` | �?| 数据来源标识 |
| `payload` | `unknown` | �?| 原始数据载荷 |
| `timestamp` | `number` | �?| 采集时间（毫秒时间戳�?|

### 1.4 CollectorConfig �?采集器配�?
**来源**: `src/types/modules/widget.types.ts`
**用�?*: 各采集器的通用配置�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timeout` | `number` | �?| 超时时间（毫秒），默�?10000 |
| `retryCount` | `number` | �?| 重试次数，默�?3 |
| `retryInterval` | `number` | �?| 重试间隔（毫秒），默�?2000 |
| `headers` | `Record<string, string>` | �?| 请求�?|

### 1.5 BaseCollector �?基础采集器（抽象类）

**来源**: `src/services/data-collector/collectors/BaseCollector.ts`
**用�?*: 所有采集器的基类，提供超时控制、错误捕获、重试机�?
**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `fetch` | `(task: CollectionTask) => Promise<RawMarketData>` | 执行采集并返回原始数�?|
| `fetchWithRetry` | `(task: CollectionTask) => Promise<RawMarketData>` | 带重试的采集执行 |

**配置**: 超时 10s（`COLLECTOR_DEFAULT_CONFIG.TIMEOUT`），重试 3 次（`COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT`），重试间隔 2s（`COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL`�?
### 1.6 TaskScheduler �?任务调度�?
**来源**: `src/services/data-collector/TaskScheduler.ts`
**用�?*: 管理 Widget 数据采集任务的注册、启动、停止、错误恢�?
**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `registerTask` | `(widgetId, instanceId, dataSource) => string` | 注册采集任务，返�?taskId |
| `startTask` | `(taskId: string) => Promise<void>` | 启动采集任务（自动创建对�?Collector�?|
| `stopTask` | `(taskId: string) => void` | 停止采集任务，清除定时器 |
| `stopAll` | `() => void` | 停止所有任务（页面销毁时调用�?|
| `getTask` | `(taskId: string) => CollectionTask \| undefined` | 获取任务状�?|
| `getAllTasks` | `() => CollectionTask[]` | 获取所有任务列�?|
| `subscribe` | `(callback: CollectionResultCallback) => () => void` | 订阅采集结果回调（返回取消订阅函数） |

**生命周期管理**:
- 自动轮询：根�?`DataSourceConfig.interval` 创建 `setInterval`
- 错误恢复：采集失败后自动记录错误，下一次轮询继续尝�?- 内存防泄漏：`stopAll()` 清除所�?`setInterval` �?Collector 实例

### 1.7 MarketDataAdapter �?市场数据适配�?
**来源**: `src/services/data-collector/MarketDataAdapter.ts`
**用�?*: 将不同来源（Mock/REST/WebSocket）的原始数据统一映射�?`MarketData`

**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `adapt` | `(rawData: RawMarketData) => Partial<MarketData>` | �?dataType 分派适配 |
| `merge` | `(...partials: Partial<MarketData>[]) => MarketData` | 合并多个数据片段为完�?MarketData |

**支持的数据类型适配**:
| dataType | 适配方法 | 输出字段 |
|----------|---------|---------|
| `indices` | `adaptIndices` | `MarketData.indices` |
| `sectors` | `adaptSectors` | `MarketData.sectors` |
| `fundFlow` | `adaptFundFlows` | `MarketData.fundFlows` |
| `sentiment` | `adaptSentiment` | `MarketData.sentiment` |
| `watchlist` | `adaptWatchlist` | `MarketData.watchlist` |
| `portfolio` | `adaptPortfolio` | `MarketData.portfolio` |
| `tradeReview` | `adaptTradeReview` | `MarketData.tradeReview` |
| `analysisScores` | `adaptAnalysisScores` | `MarketData.analysisScores` |
| `modelComparison` | `adaptModelComparison` | `MarketData.modelComparison` |
| `stockPool` | `adaptStockPool` | `MarketData.stockPool` |
| `chatHistory` | `adaptChatHistory` | `MarketData.chatHistory` |
| `hotSectors` | `adaptHotSectors` | `MarketData.hotSectors` |
| `valuePit` | `adaptValuePit` | `MarketData.valuePit` |

### 1.8 采集器实现清�?
| 采集�?| 文件 | 描述 | 配置来源 |
|--------|------|------|---------|
| `MockCollector` | `collectors/MockCollector.ts` | 模拟数据采集器，生成随机波动行情 | `MOCK_COLLECTOR_CONFIG` |
| `RestCollector` | `collectors/RestCollector.ts` | REST API 采集器，通过 HTTP 请求获取数据 | `REST_COLLECTOR_CONFIG` |
| `WebSocketCollector` | `collectors/WebSocketCollector.ts` | WebSocket 实时推送采集器（预留） | `WEBSOCKET_COLLECTOR_CONFIG` |

---

## 二、枚举常量定�?
### 2.1 DataSourceType �?数据源类�?
**来源**: `src/types/modules/widget.types.ts` + `src/constants/cockpit.constants.ts:163-167`

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
**来源**: `src/types/modules/widget.types.ts`

| 枚举�?| 描述 |
|--------|------|
| `'pending'` | 等待执行 |
| `'running'` | 执行�?|
| `'paused'` | 已暂�?|
| `'error'` | 错误 |
| `'completed'` | 已完�?|

### 2.4 采集器配置常�?
**来源**: `src/constants/cockpit.constants.ts:176-223`

| 常量引用 | �?| 描述 |
|---------|------|------|
| `COLLECTOR_DEFAULT_CONFIG.TIMEOUT` | `10000` | API 超时时间（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT` | `3` | 重试次数 |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL` | `2000` | 重试间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL` | `5000` | 默认轮询间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.MIN_POLLING_INTERVAL` | `1000` | 最小轮询间隔（毫秒�?|
| `COLLECTOR_DEFAULT_CONFIG.MAX_POLLING_INTERVAL` | `60000` | 最大轮询间隔（毫秒�?|
| `MOCK_COLLECTOR_CONFIG.MIN_DELAY` | `200` | 模拟延迟最小值（毫秒�?|
| `MOCK_COLLECTOR_CONFIG.MAX_DELAY` | `1000` | 模拟延迟最大值（毫秒�?|
| `MOCK_COLLECTOR_CONFIG.PRICE_FLUCTUATION` | `0.02` | 随机数据波动范围 |
| `MOCK_COLLECTOR_CONFIG.DEFAULT_SEED` | `'v9-market-data'` | 默认随机种子 |
| `REST_COLLECTOR_CONFIG.BASE_URL` | `import.meta.env.VITE_API_BASE_URL \|\| '/api'` | 基础 API URL |
| `WEBSOCKET_COLLECTOR_CONFIG.RECONNECT_INTERVAL` | `3000` | 重连间隔（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.MAX_RECONNECT_COUNT` | `5` | 最大重连次�?|

### 2.5 环境变量驱动

**来源**: `src/constants/cockpit.constants.ts:228`

| 常量引用 | 表达�?| 描述 |
|---------|--------|------|
| `ACTIVE_DATA_SOURCE` | `VITE_DATA_SOURCE_TYPE \|\| 'mock'` | 当前生效的数据源类型，开发环境默�?mock |

---

## 三、数据流�?
```
┌──────────────────────────────────────────────────────────────────�?�? 数据采集三层架构                                                  �?�?                                                                 �?�? WidgetDataSourceConfig ──�?TaskScheduler                         �?�? (type/mode/interval)        �?                                  �?�?                             �?registerTask() �?startTask()      �?�?                             �?                                  �?�?                    ┌─────────────────�?                         �?�?                    �? BaseCollector   �?                         �?�?                    �? ├─ MockCollector�?                         �?�?                    �? ├─ RestCollector�?                         �?�?                    �? └─ WSCollector  �?                         �?�?                    └────────┬────────�?                         �?�?                             �?fetch() / fetchWithRetry()        �?�?                             �?                                  �?�?                        RawMarketData                             �?�?                             �?                                  �?�?                             �?                                  �?�?                    ┌─────────────────�?                         �?�?                    �?MarketDataAdapter�?                         �?�?                    �? adapt() + merge()�?                        �?�?                    └────────┬────────�?                         �?�?                             �?                                  �?�?                             �?                                  �?�?                         MarketData                               �?�?                             �?                                  �?�?                             �?                                  �?�?                  MarketDataProvider (React Context)             �?�?                             �?                                  �?�?                  ┌──────────┼──────────�?                       �?�?                  �?         �?         �?                       �?�?             Widget A   Widget B   Widget C                      �?�?                                                                 �?�? 生命周期:                                                       �?�?   registerTask �?startTask �?fetch �?adapt �?dispatch           �?�?   �?(repeat per interval) �?stopTask �?cleanup                  �?└──────────────────────────────────────────────────────────────────�?```

**数据来源**：`WidgetRegistry.createInstance()` �?`TaskScheduler.registerTask()` �?`BaseCollector.fetch()`
**数据去向**：`MarketDataAdapter.adapt()` �?`MarketDataProvider` �?�?Widget 组件�?`data` prop
**更新频率**：默�?5 秒轮询，可通过 `DataSourceConfig.interval` 调整
**数据源切�?*：通过 `VITE_DATA_SOURCE_TYPE` 环境变量控制，无需修改代码

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更�?|
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖数据采集三层架构全部类型定义（8 个接口）与枚举常量（5 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | CollectorConfig +1 字段（headers）；RawMarketData.dataType +2 值（hotSectors/valuePit）；MarketDataAdapter +2 适配规则 | Architecture Asset Governor |