---
title: docs/archive/normal/complete-api-doc.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# V9 智能投研复盘系统 - API 文档

> 生成时间: 2026-07-12T08:33:40Z
> 扫描模式: 全部文件
> 总符号数: 2061 | 缺失符号数: 83 | 覆盖率: 95.97%

---

## 文档更新清单

### 更新统计

| 模块 | 符号数量 | 需要补充说明 |
|------|---------|-------------|
| 其他 | 32 | 171 |
| 核心层 (core) | 12 | 122 |
| 服务层 - fetcher | 7 | 30 |
| 服务层 - data-collector | 6 | 83 |
| 智能体层 (agents) | 5 | 67 |
| 服务层 - hybrid-proofread | 5 | 50 |
| 库函数层 (lib) | 4 | 30 |
| 座舱层 (cockpit) | 3 | 29 |
| 服务层 - system | 3 | 36 |
| 服务层 - scoring | 2 | 23 |
| 服务层 - ai-center | 1 | 1 |
| 服务层 - backtest | 1 | 10 |
| 服务层 - contracts.ts | 1 | 2 |
| 服务层 - llm | 1 | 1 |

### 核心层 (core) - 需要补充说明的符号

| 符号名 | 类型 | 文件路径 | 缺失项数 |
|--------|------|---------|---------|
| `AclEngine` | class | `src\core\acl.ts` | 3 |
| `DataBridge` | class | `src\core\databridge.ts` | 28 |
| `HandlerRegistry` | class | `src\core\databridgeHandlers.ts` | 3 |
| `DataFlowEngine` | class | `src\core\dataflow\dataflowEngine.ts` | 33 |
| `DefaultDataBuilder` | class | `src\core\dataflow\defaultDataBuilder.ts` | 3 |
| `EnvelopeFactory` | class | `src\core\envelope.ts` | 2 |
| `FallbackQueue` | class | `src\core\fallbackQueue.ts` | 5 |
| `FeedbackOrchestrator` | class | `src\core\feedbackOrchestrator.ts` | 12 |
| `FreshnessError` | class | `src\core\freshnessGuard.ts` | 1 |
| `MemoryCache` | class | `src\core\memoryCache.ts` | 17 |
| `PipelineScheduler` | class | `src\core\pipelineScheduler.ts` | 11 |
| `DataIntegrityGuard` | class | `src\core\pipelineScheduler.ts` | 4 |

### 服务层 - data-collector - 需要补充说明的符号

| 符号名 | 类型 | 文件路径 | 缺失项数 |
|--------|------|---------|---------|
| `BaseCollector` | class | `src\services\data-collector\collectors\BaseCollector.ts` | 11 |
| `MockCollector` | class | `src\services\data-collector\collectors\MockCollector.ts` | 10 |
| `RestCollector` | class | `src\services\data-collector\collectors\RestCollector.ts` | 4 |
| `WebSocketCollector` | class | `src\services\data-collector\collectors\WebSocketCollector.ts` | 14 |
| `MarketDataAdapter` | class | `src\services\data-collector\MarketDataAdapter.ts` | 27 |
| `TaskScheduler` | class | `src\services\data-collector\TaskScheduler.ts` | 17 |

---

## API 详细文档

### 核心层 (core)

#### AclEngine

**类型**: class

**位置**: `src\core\acl.ts`

**描述**: 访问控制列表引擎，负责权限验证和安全检查

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `check()` | boolean | 检查权限是否允许 |
| `assert()` | void | 断言权限，不允许时抛出异常 |
| `wrap()` | T | 包装函数，执行前检查权限 |

---

#### DataBridge

**类型**: class

**位置**: `src\core\databridge.ts`

**描述**: 数据桥接层，负责数据路由、缓存和事件分发

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `subscribers` | Map<string, Set<Callback>> | 订阅者映射 |
| `fallbackQueue` | FallbackQueue | 降级队列 |
| `handlerRegistry` | HandlerRegistry | 处理器注册表 |
| `readCache` | MemoryCache | 读取缓存 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `query()` | Promise<T> | 执行数据查询 |
| `waitForDbReady()` | Promise<void> | 等待数据库就绪 |
| `tryServeFromCache()` | T \| undefined | 尝试从缓存获取数据 |
| `assertQueryAcl()` | void | 断言查询权限 |
| `executeQueryAction()` | Promise<T> | 执行查询操作 |
| `assertQueryGetKey()` | void | 断言查询主键 |
| `assertQueryByIndexKey()` | void | 断言查询索引键 |
| `invalidateCache()` | void | 使缓存失效 |
| `buildCacheKey()` | string | 构建缓存键 |
| `writeQueryAuditLog()` | void | 写入查询审计日志 |
| `forward()` | Promise<T> | 转发请求 |
| `routeToAction()` | Promise<T> | 路由到操作处理器 |
| `subscribe()` | () => void | 订阅数据变化 |
| `getMatchingSubscribers()` | Set<Callback> | 获取匹配的订阅者 |
| `extractSymbolFromPayload()` | string | 从负载中提取符号 |
| `isMarketEnvelope()` | boolean | 判断是否为市场信封 |
| `assertAclWithFallback()` | void | 带降级的权限断言 |
| `routeToQuery()` | Promise<T> | 路由到查询处理器 |
| `routeToEvent()` | void | 路由到事件处理器 |
| `retryFailed()` | Promise<T> | 重试失败操作 |
| `routeToDB()` | Promise<T> | 路由到数据库 |
| `routeToManager()` | Promise<T> | 路由到管理器 |
| `writeAuditLog()` | void | 写入审计日志 |
| `broadcast()` | void | 广播消息 |

---

#### HandlerRegistry

**类型**: class

**位置**: `src\core\databridgeHandlers.ts`

**描述**: 处理器注册表，管理数据桥接层的处理器

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `handlers` | Map<string, Handler> | 处理器映射 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `register()` | void | 注册处理器 |
| `findHandler()` | Handler \| undefined | 查找处理器 |

---

#### DataFlowEngine

**类型**: class

**位置**: `src\core\dataflow\dataflowEngine.ts`

**描述**: 数据流引擎，提供发布-订阅模式的数据流分发，支持缓存、优先级调度和重连

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `subscribers` | Map<string, Set<DataCallback>> | 订阅者映射 |
| `cache` | Map<string, CacheEntry> | 缓存映射 |
| `cacheMaxEntries` | number | 缓存最大条目数 |
| `cacheStats` | CacheStats | 缓存统计信息 |
| `channelMeta` | Map<string, ChannelMeta> | 通道元数据 |
| `eventSource` | EventSource \| null | SSE 事件源 |
| `connected` | boolean | 连接状态 |
| `seqCounter` | number | 序列号计数器 |
| `connectionListeners` | Set<(connected: boolean) => void> | 连接状态监听器 |
| `refreshTimers` | Map<string, ReturnType<typeof setInterval>> | 刷新定时器 |
| `reconnectAttempts` | number | 重连尝试次数 |
| `reconnectTimer` | ReturnType<typeof setTimeout> \| null | 重连定时器 |
| `maxReconnectDelay` | number | 最大重连延迟 |
| `maxReconnectAttempts` | number | 最大重连尝试次数 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `connect()` | void | 建立连接 |
| `_handleSseMessage()` | void | 处理 SSE 消息 |
| `disconnect()` | void | 断开连接 |
| `subscribe()` | () => void | 订阅通道 |
| `getCached()` | T \| undefined | 获取缓存数据 |
| `publish()` | void | 发布数据 |
| `_evictIfNeeded()` | void | 按需淘汰缓存 |
| `setCacheMaxEntries()` | void | 设置缓存最大条目数 |
| `registerRefresh()` | void | 注册刷新任务 |
| `stopRefresh()` | void | 停止刷新任务 |
| `_distribute()` | void | 分发数据 |
| `_scheduleReconnect()` | void | 调度重连 |
| `_tryReconnect()` | void | 尝试重连 |
| `_fallbackToPolling()` | void | 降级到轮询模式 |
| `_notifyConnectionChange()` | void | 通知连接状态变化 |
| `onConnectionChange()` | void | 注册连接状态变化回调 |
| `getStats()` | Stats | 获取统计信息 |
| `getCacheStats()` | CacheStats | 获取缓存统计 |
| `destroy()` | void | 销毁引擎 |

---

#### DefaultDataBuilder

**类型**: class

**位置**: `src\core\dataflow\defaultDataBuilder.ts`

**描述**: 默认数据构建器，构建通道元数据和数据包

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `buildChannelMeta()` | ChannelMeta | 构建通道元数据 |
| `buildEmptyPacket()` | DataPacket | 构建空数据包 |
| `buildFallbackData()` | DataPacket | 构建降级数据 |

---

#### EnvelopeFactory

**类型**: class

**位置**: `src\core\envelope.ts`

**描述**: 信封工厂，创建和验证数据信封

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `create()` | Envelope | 创建信封 |
| `validate()` | boolean | 验证信封 |

---

#### FallbackQueue

**类型**: class

**位置**: `src\core\fallbackQueue.ts`

**描述**: 降级队列，管理失败操作的重试

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `queue` | Queue<FallbackItem> | 队列 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `push()` | void | 入队 |
| `drain()` | void | 排空队列 |
| `peek()` | FallbackItem \| undefined | 查看队首 |
| `clear()` | void | 清空队列 |

---

#### FeedbackOrchestrator

**类型**: class

**位置**: `src\core\feedbackOrchestrator.ts`

**描述**: 反馈编排器，协调数据完整性反馈和修复

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `config` | FeedbackConfig | 配置 |
| `processing` | Set<string> | 正在处理的项 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `checkAndTrigger()` | void | 检查并触发反馈 |
| `detectIssues()` | FeedbackIssue[] | 检测问题 |
| `getCompletenessSeverity()` | Severity | 获取完整性严重程度 |
| `checkEvidenceSufficiency()` | boolean | 检查证据充分性 |
| `checkDataFreshness()` | boolean | 检查数据新鲜度 |
| `executeFeedbackLoop()` | void | 执行反馈循环 |
| `triggerReCollection()` | void | 触发重新采集 |
| `triggerReScore()` | void | 触发重新评分 |
| `broadcastIssues()` | void | 广播问题 |
| `checkAllStocks()` | void | 检查所有股票 |

---

#### FreshnessError

**类型**: class

**位置**: `src\core\freshnessGuard.ts`

**描述**: 新鲜度错误，数据过期时抛出

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `check` | FreshnessRule | 检查规则 |

---

#### MemoryCache

**类型**: class

**位置**: `src\core\memoryCache.ts`

**描述**: 内存缓存，支持TTL过期和LRU淘汰

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `store` | Map<string, CacheItem> | 存储 |
| `options` | CacheOptions | 选项 |
| `stats` | CacheStats | 统计信息 |
| `cleanupTimer` | ReturnType<typeof setInterval> | 清理定时器 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `get()` | T \| undefined | 获取缓存 |
| `set()` | void | 设置缓存 |
| `delete()` | void | 删除缓存 |
| `has()` | boolean | 检查缓存存在 |
| `clear()` | void | 清空缓存 |
| `getStats()` | CacheStats | 获取统计 |
| `resetStats()` | void | 重置统计 |
| `purgeExpired()` | void | 清除过期项 |
| `destroy()` | void | 销毁缓存 |
| `isExpired()` | boolean | 检查是否过期 |
| `evictLRU()` | void | LRU淘汰 |
| `startCleanup()` | void | 启动清理 |
| `stopCleanup()` | void | 停止清理 |

---

#### PipelineScheduler

**类型**: class

**位置**: `src\core\pipelineScheduler.ts`

**描述**: 管道调度器，管理数据处理管道的生命周期

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `cycles` | Map<string, PipelineCycle> | 管道周期 |
| `running` | boolean | 运行状态 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `registerCycle()` | void | 注册管道周期 |
| `start()` | void | 启动调度器 |
| `stop()` | void | 停止调度器 |
| `pauseCycle()` | void | 暂停管道周期 |
| `resumeCycle()` | void | 恢复管道周期 |
| `resetCycle()` | void | 重置管道周期 |
| `getStatus()` | SchedulerStatus | 获取状态 |
| `getCycleStatus()` | CycleStatus | 获取管道周期状态 |
| `isHealthy()` | boolean | 检查健康状态 |

---

#### DataIntegrityGuard

**类型**: class

**位置**: `src\core\pipelineScheduler.ts`

**描述**: 数据完整性守卫，检查和修复数据完整性问题

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `checkStockPool()` | void | 检查股票池 |
| `checkStrategyData()` | void | 检查策略数据 |
| `repairMissingScores()` | void | 修复缺失评分 |
| `repairSymbol()` | void | 修复单个符号 |

---

### 服务层 - data-collector

#### BaseCollector

**类型**: class

**位置**: `src\services\data-collector\collectors\BaseCollector.ts`

**描述**: 基础采集器，提供通用的采集逻辑和重试机制

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `config` | CollectorConfig | 配置 |
| `abortController` | AbortController | 中止控制器 |
| `isRunning` | boolean | 运行状态 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `collect()` | Promise<RawMarketData> | 执行采集 |
| `collectWithRetry()` | Promise<RawMarketData> | 带重试的采集 |
| `tryCollectOnce()` | Promise<RawMarketData> | 尝试采集一次 |
| `executeWithTimeout()` | Promise<RawMarketData> | 带超时的执行 |
| `cancel()` | void | 取消采集 |
| `getIsRunning()` | boolean | 获取运行状态 |
| `delay()` | Promise<void> | 延迟 |
| `wrapData()` | RawMarketData | 包装数据 |

---

#### MockCollector

**类型**: class

**位置**: `src\services\data-collector\collectors\MockCollector.ts`

**描述**: 模拟采集器，生成模拟数据用于测试

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `collect()` | Promise<RawMarketData> | 执行采集 |
| `getRandomDelay()` | number | 获取随机延迟 |
| `generateIndicesData()` | MarketIndexData[] | 生成指数数据 |
| `generateSectorsData()` | SectorHeatmapData[] | 生成板块数据 |
| `generateFundFlowData()` | FundFlowData | 生成资金流向数据 |
| `generateSentimentData()` | SentimentData | 生成情绪数据 |
| `generateWatchlistData()` | WatchlistData[] | 生成自选股数据 |
| `generatePortfolioData()` | PortfolioData | 生成持仓数据 |
| `generateTradeReviewData()` | TradeReviewData | 生成交易复盘数据 |
| `fluctuate()` | number | 波动计算 |

---

#### RestCollector

**类型**: class

**位置**: `src\services\data-collector\collectors\RestCollector.ts`

**描述**: REST采集器，通过HTTP REST API采集数据

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `baseUrl` | string | 基础URL |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `collect()` | Promise<RawMarketData> | 执行采集 |
| `collectPost()` | Promise<RawMarketData> | POST方式采集 |
| `inferDataType()` | string | 推断数据类型 |

---

#### WebSocketCollector

**类型**: class

**位置**: `src\services\data-collector\collectors\WebSocketCollector.ts`

**描述**: WebSocket采集器，通过WebSocket实时采集数据

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `ws` | WebSocket \| null | WebSocket连接 |
| `reconnectCount` | number | 重连次数 |
| `reconnectTimer` | ReturnType<typeof setTimeout> | 重连定时器 |
| `messageQueue` | Queue<Message> | 消息队列 |
| `onMessageCallback` | (data: RawMarketData) => void | 消息回调 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `collect()` | Promise<RawMarketData> | 执行采集 |
| `connect()` | void | 建立连接 |
| `disconnect()` | void | 断开连接 |
| `send()` | void | 发送消息 |
| `onMessage()` | void | 处理消息 |
| `handleReconnect()` | void | 处理重连 |
| `flushMessageQueue()` | void | 清空消息队列 |
| `inferDataType()` | string | 推断数据类型 |
| `cancel()` | void | 取消采集 |

---

#### MarketDataAdapter

**类型**: class

**位置**: `src\services\data-collector\MarketDataAdapter.ts`

**描述**: 市场数据适配器，将不同来源的原始数据统一映射为标准化的MarketData接口

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `adapt()` | Partial<MarketData> | 适配单条原始数据 |
| `merge()` | MarketData | 合并多个数据片段 |
| `adaptIndices()` | MarketIndexData[] | 适配指数数据 |
| `adaptSectors()` | SectorHeatmapData[] | 适配板块数据 |
| `adaptFundFlows()` | FundFlowData | 适配资金流向数据 |
| `adaptSentiment()` | SentimentData | 适配情绪数据 |
| `adaptWatchlist()` | WatchlistData[] | 适配自选股数据 |
| `adaptPortfolio()` | PortfolioData | 适配持仓数据 |
| `adaptTradeReview()` | TradeReviewData | 适配交易复盘数据 |
| `adaptAnalysisScores()` | AnalysisScores | 适配分析评分数据 |
| `adaptModelComparison()` | ModelComparison | 适配模型对比数据 |
| `adaptStockPool()` | StockPool | 适配股票池数据 |
| `adaptChatHistory()` | ChatHistory | 适配聊天历史数据 |
| `adaptHotSectors()` | HotSectorData[] | 适配热门板块数据 |
| `adaptValuePit()` | ValuePitData | 适配价值洼地数据 |
| `adaptStockItem()` | StockPoolItem | 适配股票项数据 |
| `adaptMessage()` | ChatMessage | 适配消息数据 |

---

#### TaskScheduler

**类型**: class

**位置**: `src\services\data-collector\TaskScheduler.ts`

**描述**: 任务调度器，管理数据采集任务的调度和执行

**属性说明**:

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `tasks` | Map<string, ScheduledTask> | 任务映射 |
| `running` | boolean | 运行状态 |
| `metrics` | TaskMetrics | 任务指标 |

**方法说明**:

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
| `schedule()` | void | 调度任务 |
| `unschedule()` | void | 取消调度 |
| `start()` | void | 启动调度器 |
| `stop()` | void | 停止调度器 |
| `pause()` | void | 暂停调度器 |
| `resume()` | void | 恢复调度器 |
| `runOnce()` | Promise<void> | 运行一次 |
| `getTaskStatus()` | TaskStatus | 获取任务状态 |
| `getMetrics()` | TaskMetrics | 获取指标 |
| `resetMetrics()` | void | 重置指标 |
| `retryFailed()` | void | 重试失败任务 |
| `shutdown()` | void | 关闭调度器 |

---

## data-collector 模块分析

### 高缺失符号数量原因

经过分析，`data-collector` 模块（6个符号，83个缺失项）缺失符号数量较高的原因如下：

#### 1. 代码规范问题

**问题**: 该模块的代码虽然有类级别的 JSDoc 注释，但缺少方法级别的注释。

**证据**: `MarketDataAdapter.ts` 中有类级别的 `@description` 和 `@remarks` 注释，但方法的 JSDoc 不完整。

**影响**: 语义扫描工具只能识别文档中出现的方法名，由于文档中缺少方法名，导致大量方法被标记为缺失。

#### 2. 方法数量多

**问题**: `MarketDataAdapter` 类包含 27 个方法（各种 `adapt*` 方法），但文档中只记录了通用说明，没有列出每个方法的名称。

**证据**: `adapt()` 方法内部通过 switch-case 调用了多个 `adapt*` 方法，但这些方法名没有出现在文档中。

#### 3. MockCollector 的生成方法

**问题**: `MockCollector` 包含 10 个数据生成方法（`generate*`），这些方法在文档中没有被提及。

#### 4. 建议的改进措施

| 改进项 | 优先级 | 说明 |
|--------|--------|------|
| 为 `MarketDataAdapter` 的所有 `adapt*` 方法添加 JSDoc | P0 | 每个方法需要 `@param` 和 `@returns` 注释 |
| 为 `MockCollector` 的所有 `generate*` 方法添加 JSDoc | P0 | 每个方法需要 `@returns` 注释 |
| 为 `WebSocketCollector` 的属性和方法添加 JSDoc | P1 | 5个属性和9个方法需要注释 |
| 为 `TaskScheduler` 的属性和方法添加 JSDoc | P1 | 3个属性和12个方法需要注释 |
| 为 `BaseCollector` 的属性和方法添加 JSDoc | P2 | 3个属性和8个方法需要注释 |

### 改进示例

```typescript
/**
 * 适配指数数据
 * @param payload 原始指数数据
 * @returns 标准化的指数数据数组
 */
adaptIndices(payload: unknown): MarketIndexData[] {
  // 实现逻辑
}
```

---

## 使用说明

1. **查看更新清单**: 文档顶部的更新清单列出了所有需要补充说明的符号
2. **补充文档**: 根据清单中的 TODO 项，为每个符号添加详细说明
3. **验证覆盖率**: 更新文档后运行 `npm run audit:docs` 验证覆盖率提升
4. **持续维护**: 新增代码时同步更新文档，保持高覆盖率
