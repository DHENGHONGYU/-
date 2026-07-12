/**
 * @fileoverview DataBridge - 统一数据桥接层
 *
 * 职责：
 * - 提供 forward() 写操作入口（ACL 校验 + 路由到 DB/Manager/Strategy）
 * - 提供 query() 读操作入口（缓存 + ACL 校验 + 审计日志）
 * - 提供 subscribe() 频道订阅机制（跨模块通信）
 * - 提供 fallbackQueue 重试机制
 *
 * 子模块（从本文件拆分）：
 * - databridgeHandlers.ts: EnvelopeHandler 类族 + HandlerRegistry + createHandlerRegistry
 * - databridgeStrategyRouter.ts: STRATEGY_CHANNEL + routeToStrategy 策略路由逻辑
 */
import { ENVELOPE_ACTION, STORE_NAME, type DbOperation, type ModuleId, type StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import { CHANGED_SUFFIX } from '@/constants/store-channels.constants'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { aclEngine, inferOperation } from './acl'
import { EnvelopeError, EnvelopeFactory, type StandardEnvelope } from './envelope'
import { fallbackQueue, FallbackQueue } from './fallbackQueue'
import { MemoryCache } from './memoryCache'
import { createHandlerRegistry, type HandlerRegistry } from './databridgeHandlers'
import { nanoid } from 'nanoid'
import {
  routeToStrategy,
  type StrategyRouterContext,
} from './databridgeStrategyRouter'

// re-export 子模块的公共 API，保持原导入路径兼容
export { STRATEGY_CHANNEL } from './databridgeStrategyRouter'
export type { StrategyChannel } from './databridgeStrategyRouter'
export type { EnvelopeHandler } from './databridgeHandlers'

const logger = getLogger()

type EnvelopeCallback = (envelope: StandardEnvelope) => void

/**
 * forward() 慢调用阈值（毫秒）。超过则记录 warn 日志。
 */
const FORWARD_SLOW_THRESHOLD_MS = 50

/**
 * broadcast() 慢调用阈值（毫秒）。超过则记录 warn 日志。
 */
const BROADCAST_SLOW_THRESHOLD_MS = 10

/**
 * Action 到 Store 的显式映射表（避免字符串包含判断的歧义）
 */
const ACTION_TO_STORE_MAP: Record<string, StoreName> = {
  [ENVELOPE_ACTION.saveNewsStockMap]: STORE_NAME.newsStockMap,
  [ENVELOPE_ACTION.insertStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.updateStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.deleteStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.saveDailyQuotes]: STORE_NAME.dailyQuotes,
  [ENVELOPE_ACTION.saveFinancialReport]: STORE_NAME.financialReports,
  [ENVELOPE_ACTION.saveIndustryScores]: STORE_NAME.industryScores,
  [ENVELOPE_ACTION.saveIntelligentScores]: STORE_NAME.intelligentScores,
  [ENVELOPE_ACTION.saveRotationScores]: STORE_NAME.rotationScores,
  [ENVELOPE_ACTION.saveHotSectorScores]: STORE_NAME.hotSectorScores,
  [ENVELOPE_ACTION.saveValuePitScores]: STORE_NAME.valuePitScores,
  [ENVELOPE_ACTION.saveSectorScores]: STORE_NAME.sectorScores,
  [ENVELOPE_ACTION.saveScoreDocs]: STORE_NAME.scoreDocs,
  [ENVELOPE_ACTION.saveStrategySnapshots]: STORE_NAME.strategySnapshots,
  [ENVELOPE_ACTION.saveLocalDocs]: STORE_NAME.localDocs,
  [ENVELOPE_ACTION.saveNews]: STORE_NAME.news,
  [ENVELOPE_ACTION.saveSentimentCache]: STORE_NAME.sentimentCache,
  [ENVELOPE_ACTION.saveResearchLog]: STORE_NAME.researchLogs,
  [ENVELOPE_ACTION.saveScores]: STORE_NAME.v6Scores,
  [ENVELOPE_ACTION.insertOrder]: STORE_NAME.orders,
  [ENVELOPE_ACTION.updateOrder]: STORE_NAME.orders,
  [ENVELOPE_ACTION.deleteOrder]: STORE_NAME.orders,
  [ENVELOPE_ACTION.insertSignal]: STORE_NAME.signals,
  [ENVELOPE_ACTION.saveTradeReview]: STORE_NAME.tradeReviews,
  [ENVELOPE_ACTION.saveExecutionPlan]: STORE_NAME.executionPlans,
  [ENVELOPE_ACTION.updateExecutionPlan]: STORE_NAME.executionPlans,
  [ENVELOPE_ACTION.deleteExecutionPlan]: STORE_NAME.executionPlans,
  [ENVELOPE_ACTION.saveExecutionLog]: STORE_NAME.executionLogs,
  [ENVELOPE_ACTION.saveMissingReport]: STORE_NAME.missingReports,
  [ENVELOPE_ACTION.incrementMissingReportRetry]: STORE_NAME.missingReports,
  [ENVELOPE_ACTION.updateExecutionPhase]: STORE_NAME.executionPlans,
  [ENVELOPE_ACTION.loadHoldingsData]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.savePortfolio]: STORE_NAME.portfolios,
  [ENVELOPE_ACTION.newsArticleLoaded]: STORE_NAME.news,
  [ENVELOPE_ACTION.newsArticleBookmarked]: STORE_NAME.news,
  [ENVELOPE_ACTION.holdingsDataLoaded]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.tradeActionExecuted]: STORE_NAME.orders,
  [ENVELOPE_ACTION.resetAll]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.importAll]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.exportAll]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.strategyHotSectorRefresh]: STORE_NAME.hotSectorScores,
  [ENVELOPE_ACTION.strategyValuePitRefresh]: STORE_NAME.valuePitScores,
  [ENVELOPE_ACTION.strategyRotationSignalDetect]: STORE_NAME.rotationScores,
  [ENVELOPE_ACTION.saveWatchlist]: STORE_NAME.watchlists,
  // ── 批量操作通道 ──
  [ENVELOPE_ACTION.bulkInsertStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.bulkSaveDailyQuotes]: STORE_NAME.dailyQuotes,
  [ENVELOPE_ACTION.bulkSaveScores]: STORE_NAME.v6Scores,
  [ENVELOPE_ACTION.bulkSaveFinancialReports]: STORE_NAME.financialReports,
  [ENVELOPE_ACTION.bulkSaveNews]: STORE_NAME.news,
  // ── RBAC 6 表写入通道（v24 新增） ──
  [ENVELOPE_ACTION.saveRbacUser]: STORE_NAME.rbacUsers,
  [ENVELOPE_ACTION.saveRbacRole]: STORE_NAME.rbacRoles,
  [ENVELOPE_ACTION.saveRbacPermission]: STORE_NAME.rbacPermissions,
  [ENVELOPE_ACTION.saveRbacUserRole]: STORE_NAME.rbacUserRoles,
  [ENVELOPE_ACTION.saveRbacRolePermission]: STORE_NAME.rbacRolePermissions,
  [ENVELOPE_ACTION.saveRbacAuditLog]: STORE_NAME.rbacPermissionAuditLogs,
  [ENVELOPE_ACTION.saveCollectConfig]: STORE_NAME.collectConfig,
  [ENVELOPE_ACTION.deleteCollectConfig]: STORE_NAME.collectConfig,
  [ENVELOPE_ACTION.saveCustomAgent]: STORE_NAME.customAgents,
  [ENVELOPE_ACTION.deleteCustomAgent]: STORE_NAME.customAgents,
  [ENVELOPE_ACTION.saveTraceRecord]: STORE_NAME.traceRecords,
}

// 查询动作集合（目标 store 由 payload 传入，**不**走 ACTION_TO_STORE_MAP）
const QUERY_ACTIONS: ReadonlySet<string> = new Set([
  ENVELOPE_ACTION.queryGet,
  ENVELOPE_ACTION.queryList,
  ENVELOPE_ACTION.queryByIndex,
])

// 事件动作集合（仅广播，不走 DB）
const EVENT_ACTIONS: ReadonlySet<string> = new Set([
  ENVELOPE_ACTION.newsArticleLoaded,
  ENVELOPE_ACTION.holdingsDataLoaded,
  ENVELOPE_ACTION.tradeActionExecuted,
  ENVELOPE_ACTION.loadHoldingsData,
])

// 策略路由动作集合（路由到 routeToStrategy）
const STRATEGY_ACTIONS: ReadonlySet<string> = new Set([
  ENVELOPE_ACTION.strategyHotSectorRefresh,
  ENVELOPE_ACTION.strategyValuePitRefresh,
  ENVELOPE_ACTION.strategyRotationSignalDetect,
])

function inferStore(action: string): StoreName {
  // 查询动作不查 map，由 routeToQuery 从 payload.store 解析
  if (QUERY_ACTIONS.has(action)) {
    throw new EnvelopeError(`Query action "${action}" should not call inferStore; payload.store required`)
  }
  const store = ACTION_TO_STORE_MAP[action]
  if (!store) {
    throw new EnvelopeError(`Unknown action: ${action} (no store mapping found)`)
  }
  return store
}

/**
 * 查询请求参数
 */
export interface QueryRequest {
  /** 查询动作：queryGet/queryList/queryByIndex */
  action: typeof ENVELOPE_ACTION.queryGet | typeof ENVELOPE_ACTION.queryList | typeof ENVELOPE_ACTION.queryByIndex
  /** 目标存储 */
  store: StoreName
  /** 主键（queryGet 时必填） */
  key?: string
  /** 索引名（queryByIndex 时必填） */
  indexName?: string
  /** 索引值（queryByIndex 时必填） */
  indexValue?: unknown
  /** 调用模块 */
  source?: ModuleId
}

/**
 * 查询结果
 */
export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * DataBridge
 */
export class DataBridge {
  private subscribers = new Map<string, Set<EnvelopeCallback>>()
  private fallbackQueue: FallbackQueue = fallbackQueue
  private handlerRegistry: HandlerRegistry = createHandlerRegistry()
  private readCache = new MemoryCache<unknown>({ namespace: 'databridge:read', defaultTTL: 10_000, maxSize: 200 })

  /**
   * 查询数据（读操作）
   * 支持缓存、ACL 校验、审计日志
   */
  async query<T = unknown>(request: QueryRequest): Promise<QueryResult<T>> {
    const startTs = Date.now()
    const source = request.source ?? 'datalayer'
    logger.info(`[DataBridge] query() called: action="${request.action}", store="${request.store}", source="${source}", key="${request.key ?? 'N/A'}", indexName="${request.indexName ?? 'N/A'}"`)

    try {
      // 0. 等待数据库就绪（store 层不再直接依赖 db.ready）
      await this.waitForDbReady()

      // 1. 生成缓存 key
      const cacheKey = this.buildCacheKey(request)
      logger.debug(`[DataBridge] query() cache key generated: "${cacheKey}"`)

      // 2. 查缓存
      const cachedResult = this.tryServeFromCache<T>(request, cacheKey, startTs)
      if (cachedResult) return cachedResult
      logger.info(`[DataBridge] query() cache MISS: key="${cacheKey}", proceeding to database query`)

      // 3. ACL 校验
      this.assertQueryAcl(source, request.store)

      // 4. 执行数据库操作
      logger.debug(`[DataBridge] query() executing database operation: action="${request.action}", store="${request.store}"`)
      const result = await this.executeQueryAction<T>(request)

      // 5. 缓存结果
      this.readCache.set(cacheKey, result)
      const cacheStatsAfterSet = this.readCache.getStats()
      logger.info(`[DataBridge] query() result cached: key="${cacheKey}", cacheSize=${cacheStatsAfterSet.size}, maxSize=${cacheStatsAfterSet.maxSize}`)

      // 6. 审计日志
      this.writeQueryAuditLog(request, source).catch((err) => {
        logger.error(`[DataBridge] query() audit log failed: action="${request.action}", store="${request.store}", traceId="query-${Date.now()}"`, { error: err })
      })

      const duration = Date.now() - startTs
      logger.info(`[DataBridge] query() completed (from db): action="${request.action}", store="${request.store}", duration=${duration}ms`)

      return { success: true, data: result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const errorName = err instanceof Error ? err.name : 'UnknownError'
      logger.error(`[DataBridge] query() FAILED: action="${request.action}", store="${request.store}", errorName="${errorName}", errorMessage="${message}"`)
      return { success: false, error: message }
    }
  }

  /**
   * 等待数据库就绪（query 内部抽出，降低主函数嵌套深度）
   */
  private async waitForDbReady(): Promise<void> {
    if (db.isReady()) return
    logger.info('[DataBridge] query() waiting for database ready...')
    await db.ready()
    logger.info('[DataBridge] query() database ready confirmed')
  }

  /**
   * 命中缓存时直接返回；未命中返回 null（query 内部抽出，降低主函数嵌套深度）
   */
  private tryServeFromCache<T>(request: QueryRequest, cacheKey: string, startTs: number): { success: true; data: T } | null {
    const cached = this.readCache.get(cacheKey) as T | undefined
    if (cached === undefined) return null
    const cacheStats = this.readCache.getStats()
    logger.info(`[DataBridge] query() cache HIT: key="${cacheKey}", cacheSize=${cacheStats.size}, hitRate=${(cacheStats.hitRate * 100).toFixed(1)}%`)
    const duration = Date.now() - startTs
    logger.info(`[DataBridge] query() completed (from cache): action="${request.action}", store="${request.store}", duration=${duration}ms`)
    return { success: true, data: cached }
  }

  /**
   * 执行 query 的 ACL 校验，校验失败抛出原错误（query 内部抽出，降低主函数嵌套深度）
   */
  private assertQueryAcl(source: ModuleId, store: StoreName): void {
    try {
      logger.debug(`[DataBridge] query() ACL check starting: module="${source}", store="${store}", operation="SELECT"`)
      aclEngine.assert({ module: source, store, operation: 'SELECT' })
      logger.info(`[DataBridge] query() ACL check PASSED: module="${source}", store="${store}", operation="SELECT"`)
    } catch (aclErr) {
      const aclErrorMessage = aclErr instanceof Error ? aclErr.message : String(aclErr)
      logger.error(`[DataBridge] query() ACL check FAILED: module="${source}", store="${store}", operation="SELECT", reason="${aclErrorMessage}"`)
      throw aclErr
    }
  }

  /**
   * 根据 action 执行具体数据库读取操作（query 内部抽出，降低主函数嵌套深度）
   */
  private async executeQueryAction<T>(request: QueryRequest): Promise<T> {
    switch (request.action) {
      case ENVELOPE_ACTION.queryGet: {
        this.assertQueryGetKey(request)
        logger.debug(`[DataBridge] query() executing db.get: store="${request.store}", key="${request.key}"`)
        const getResult = await db.get(request.store, request.key!) as T
        logger.debug(`[DataBridge] query() db.get completed: found=${getResult != null}`)
        return getResult
      }
      case ENVELOPE_ACTION.queryList: {
        logger.debug(`[DataBridge] query() executing db.getAll: store="${request.store}"`)
        const listResult = await db.getAll(request.store) as T
        const listLength = Array.isArray(listResult) ? listResult.length : 'N/A'
        logger.debug(`[DataBridge] query() db.getAll completed: resultCount=${listLength}`)
        return listResult
      }
      case ENVELOPE_ACTION.queryByIndex: {
        this.assertQueryByIndexKey(request)
        const indexValueStr = typeof request.indexValue === 'string' ? request.indexValue : JSON.stringify(request.indexValue)
        logger.debug(`[DataBridge] query() executing db.getAllByIndex: store="${request.store}", indexName="${request.indexName}", indexValue="${indexValueStr}"`)
        const indexResult = await db.getAllByIndex(request.store, request.indexName!, request.indexValue as string) as T
        const indexListLength = Array.isArray(indexResult) ? indexResult.length : 'N/A'
        logger.debug(`[DataBridge] query() db.getAllByIndex completed: resultCount=${indexListLength}`)
        return indexResult
      }
      default: {
        const unknownAction = request.action as string
        logger.error(`[DataBridge] query() unknown action: "${unknownAction}"`)
        throw new EnvelopeError(`Unknown query action: ${unknownAction}`)
      }
    }
  }

  private assertQueryGetKey(request: QueryRequest): void {
    if (request.key != null) return
    logger.error(`[DataBridge] query() parameter validation failed: queryGet requires key parameter`)
    throw new EnvelopeError('queryGet requires key parameter')
  }

  private assertQueryByIndexKey(request: QueryRequest): void {
    if (request.indexName != null && request.indexValue !== undefined) return
    logger.error(`[DataBridge] query() parameter validation failed: queryByIndex requires indexName and indexValue parameters`)
    throw new EnvelopeError('queryByIndex requires indexName and indexValue parameters')
  }

  /**
   * 清除指定 store 的缓存
   * 在写操作后调用，保证数据一致性
   */
  invalidateCache(store: StoreName): void {
    const statsBefore = this.readCache.getStats()
    logger.info(`[DataBridge] invalidateCache() called: store="${store}", cacheSizeBefore=${statsBefore.size}, hitCount=${statsBefore.hitCount}, missCount=${statsBefore.missCount}`)
    // MemoryCache 不支持批量删除，只能 clear 全部
    // 后续可优化为按 pattern 删除
    this.readCache.clear()
    const statsAfter = this.readCache.getStats()
    logger.info(`[DataBridge] invalidateCache() completed: store="${store}", cacheSizeAfter=${statsAfter.size}, clearedEntries=${statsBefore.size - statsAfter.size}`)
  }

  private buildCacheKey(request: QueryRequest): string {
    const parts: string[] = [request.action, request.store]
    if (request.key != null) parts.push(`key=${request.key}`)
    if (request.indexName != null) parts.push(`idx=${request.indexName}`)
    if (request.indexValue !== undefined) {
      const valStr = typeof request.indexValue === 'string' ? request.indexValue : JSON.stringify(request.indexValue)
      parts.push(`val=${valStr}`)
    }
    return parts.join(':')
  }

  private async writeQueryAuditLog(request: QueryRequest, source: ModuleId): Promise<void> {
    const targetCode = request.key ?? request.indexValue?.toString() ?? request.action
    await db.put(STORE_NAME.researchLogs, {
      traceId: `query-${nanoid(8)}`,
      timestamp: Date.now(),
      actor: source,
      action: request.action,
      targetType: request.store,
      targetCode,
      payload: JSON.stringify({ indexName: request.indexName }),
    })
  }

  async forward(envelope: StandardEnvelope): Promise<void> {
    const startTs = Date.now()
    logger.info(`[DataBridge] forward() called: action="${envelope.meta.action}", source="${envelope.meta.source}", traceId="${envelope.meta.traceId}"`)

    const validation = EnvelopeFactory.validate(envelope)
    if (!validation.valid) {
      logger.error(`[DataBridge] Invalid envelope: ${validation.error}, action="${envelope.meta.action}"`)
      throw new EnvelopeError(`Invalid envelope: ${validation.error}`)
    }
    logger.debug(`[DataBridge] Envelope validated: action="${envelope.meta.action}", target="${envelope.meta.target}"`)

    const { meta } = envelope
    const operation = inferOperation(meta.action)

    // 1. Query 路径：从 payload 解析真实目标 store（不查 ACTION_TO_STORE_MAP）
    let targetStore: StoreName
    if (QUERY_ACTIONS.has(meta.action)) {
      const payloadStore = envelope.payload != null && typeof envelope.payload === 'object'
        && 'store' in envelope.payload
        ? (envelope.payload as Record<string, unknown>).store
        : undefined
      if (typeof payloadStore !== 'string' || payloadStore === '') {
        throw new EnvelopeError(`Query action "${meta.action}" requires payload.store`)
      }
      targetStore = payloadStore as StoreName
    } else {
      targetStore = inferStore(meta.action)
    }

    logger.debug(`[DataBridge] Route determined: action="${meta.action}", targetStore="${targetStore}", operation="${operation}"`)

    const shouldContinue = await this.assertAclWithFallback(envelope, targetStore, operation)
    if (!shouldContinue) return

    this.writeAuditLog(envelope, targetStore).catch((err) => {
      logger.error(`[DataBridge] Audit log failed: action="${meta.action}", traceId="${meta.traceId}"`, { error: err })
    })

    try {
      await this.routeToAction(envelope, targetStore)
    } catch (err) {
      logger.error(`[DataBridge] forward() failed: action="${meta.action}", traceId="${meta.traceId}"`, { error: err })
      throw err
    } finally {
      const duration = Date.now() - startTs
      if (duration > FORWARD_SLOW_THRESHOLD_MS) {
        logger.warn(`[DataBridge] forward() took ${duration}ms for action "${meta.action}"`)
      }
      logger.info(`[DataBridge] forward() completed: action="${meta.action}", duration=${duration}ms`)
    }
  }

  /**
   * 按 action 类型路由到对应处理器（策略/查询/事件/管理/DB）。
   * 将主 forward 的路由分支提取到独立方法，避免同一函数内重复判断 QUERY_ACTIONS。
   */
  private async routeToAction(envelope: StandardEnvelope, targetStore: StoreName): Promise<void> {
    const { meta } = envelope

    if (STRATEGY_ACTIONS.has(meta.action)) {
      logger.info(`[DataBridge] Routing to strategy engine: action="${meta.action}"`)
      const ctx: StrategyRouterContext = {
        subscribers: this.subscribers,
        broadcast: (channel, env) => this.broadcast(channel, env),
      }
      routeToStrategy(envelope, ctx)
      return
    }

    if (QUERY_ACTIONS.has(meta.action)) {
      logger.info(`[DataBridge] Routing to query: action="${meta.action}", store="${targetStore}"`)
      await this.routeToQuery(envelope, targetStore)
      return
    }

    if (EVENT_ACTIONS.has(meta.action)) {
      logger.info(`[DataBridge] Routing to event channel: action="${meta.action}"`)
      await this.routeToEvent(envelope)
      return
    }

    if (
      meta.action === ENVELOPE_ACTION.resetAll ||
      meta.action === ENVELOPE_ACTION.importAll ||
      meta.action === ENVELOPE_ACTION.exportAll
    ) {
      logger.info(`[DataBridge] Routing to manager: action="${meta.action}"`)
      await this.routeToManager(envelope)
    } else {
      logger.info(`[DataBridge] Routing to DB: action="${meta.action}", store="${targetStore}"`)
      await this.routeToDB(envelope, targetStore)
    }

    // 写操作成功后清除相关缓存，保证读一致性
    this.invalidateCache(targetStore)

    logger.debug(`[DataBridge] Broadcasting to channel: "${targetStore}"`)
    this.broadcast(targetStore, envelope)
  }

  subscribe(channel: string, callback: EnvelopeCallback): () => void {
    logger.debug(`[DataBridge] subscribe() called: channel="${channel}"`)

    if (channel === 'db') {
      logger.error(`[DataBridge] subscribe() rejected: cannot subscribe to "db" channel`)
      throw new EnvelopeError('Cannot subscribe to "db" channel')
    }

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
      logger.debug(`[DataBridge] Created subscriber set for channel: "${channel}"`)
    }

    const prevCount = this.subscribers.get(channel)!.size
    this.subscribers.get(channel)!.add(callback)
    const newCount = this.subscribers.get(channel)!.size

    logger.info(`[DataBridge] Subscribe: channel="${channel}", count=${prevCount}→${newCount}`)

    return () => {
      const wasPresent = this.subscribers.get(channel)?.has(callback) === true
      this.subscribers.get(channel)?.delete(callback)
      const remaining = this.subscribers.get(channel)?.size ?? 0

      if (wasPresent) {
        logger.info(`[DataBridge] Unsubscribe: channel="${channel}", remaining=${remaining}`)
      }
    }
  }

  private getMatchingSubscribers(channel: string): Set<EnvelopeCallback> {
    // 严格匹配：只匹配订阅了完全相同 channel 的回调
    // 历史曾支持通配（'event:*'）与前缀匹配（'test' 匹配 'test:foo'），均无调用方依赖
    // 且与 symbol 级精确广播（bypass 模糊匹配）冲突，移除以保持单一行为
    const callbacks = this.subscribers.get(channel)
    return new Set(callbacks ?? [])
  }

  private extractSymbolFromPayload(payload: unknown): string | undefined {
    if (payload == null || typeof payload !== 'object') return undefined
    if ('symbol' in payload) {
      return String((payload as Record<string, unknown>).symbol)
    }
    if (!Array.isArray(payload) || payload.length === 0) return undefined
    const firstItem = payload[0]
    if (typeof firstItem === 'object' && firstItem != null && 'symbol' in firstItem) {
      const symbol = (firstItem as Record<string, unknown>).symbol
      return typeof symbol === 'string' ? symbol : undefined
    }
    return undefined
  }

  private isMarketEnvelope(action: string): boolean {
    return action === ENVELOPE_ACTION.saveDailyQuotes
  }

  /**
   * ACL 校验；若市场类 envelope 被拒绝则入队重试并返回 false，
   * 否则返回 true 表示继续处理。
   */
  private async assertAclWithFallback(
    envelope: StandardEnvelope,
    targetStore: StoreName,
    operation: DbOperation,
  ): Promise<boolean> {
    const { meta } = envelope
    try {
      aclEngine.assert({
        module: meta.source,
        store: targetStore,
        operation,
      })
      logger.debug(`[DataBridge] ACL check passed: module="${meta.source}", store="${targetStore}", operation="${operation}"`)
      return true
    } catch (aclErr) {
      logger.error(`[DataBridge] ACL check failed: module="${meta.source}", store="${targetStore}", operation="${operation}"`, { error: aclErr })
      if (this.isMarketEnvelope(meta.action)) {
        logger.warn(`[DataBridge] ACL rejected market envelope, enqueueing for retry: action="${meta.action}", traceId="${meta.traceId}"`)
        this.fallbackQueue.push(envelope)
        return false
      }
      throw aclErr
    }
  }

  private async routeToQuery(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { meta, payload } = envelope
    
    logger.info(`[DataBridge] routeToQuery() called: action="${meta.action}", store="${store}"`)

    const queryRequest: QueryRequest = {
      action: meta.action as QueryRequest['action'],
      store,
      key: payload != null && typeof payload === 'object' && 'key' in payload
        ? String((payload as Record<string, unknown>).key)
        : undefined,
      indexName: payload != null && typeof payload === 'object' && 'indexName' in payload
        ? String((payload as Record<string, unknown>).indexName)
        : undefined,
      indexValue: payload != null && typeof payload === 'object' && 'indexValue' in payload
        ? (payload as Record<string, unknown>).indexValue
        : undefined,
      source: meta.source,
    }

    const result = await this.query(queryRequest)
    
    const newPayload = payload != null && typeof payload === 'object'
      ? { ...(payload as Record<string, unknown>), queryResult: result }
      : { queryResult: result }
    
    this.broadcast(`query:${store}`, {
      meta: envelope.meta,
      payload: newPayload,
    })

    logger.info(`[DataBridge] routeToQuery() completed: action="${meta.action}", success=${result.success}`)
  }

  private async routeToEvent(envelope: StandardEnvelope): Promise<void> {
    const { meta } = envelope
    const eventChannel = `event:${meta.action.toLowerCase()}`
    
    logger.info(`[DataBridge] routeToEvent() called: action="${meta.action}", eventChannel="${eventChannel}"`)

    this.broadcast(eventChannel, envelope)
    this.broadcast('event:*', envelope)

    logger.info(`[DataBridge] routeToEvent() completed: action="${meta.action}"`)
  }

  get failedEnvelopes(): readonly StandardEnvelope[] {
    return this.fallbackQueue.peek()
  }

  async retryFailed(): Promise<{ success: number; failed: number }> {
    const pending = this.fallbackQueue.drain()
    let success = 0
    let failed = 0

    for (const envelope of pending) {
      try {
        await this.forward(envelope)
        success++
        logger.info(`[DataBridge] Retry succeeded: action="${envelope.meta.action}", traceId="${envelope.meta.traceId}"`)
      } catch (err) {
        failed++
        logger.warn(`[DataBridge] Retry failed, re-enqueueing: action="${envelope.meta.action}", traceId="${envelope.meta.traceId}"`, { error: err })
        this.fallbackQueue.push(envelope)
      }
    }

    return { success, failed }
  }

  private async routeToDB(
    envelope: StandardEnvelope,
    store: StoreName,
  ): Promise<void> {
    const startTs = Date.now()
    const { meta } = envelope
    logger.debug(`[DataBridge] routeToDB() called: action="${meta.action}", store="${store}"`)

    try {
      // 使用策略模式：查找对应的 Handler
      const handler = this.handlerRegistry.findHandler(meta.action)
      if (!handler) {
        logger.warn(`[DataBridge] No handler found for action: "${meta.action}", falling back to default put`)
        await db.put(store, envelope.payload)
      } else {
        await handler.handle(envelope, store)
      }

      const duration = Date.now() - startTs
      logger.info(`[DataBridge] routeToDB() completed: action="${meta.action}", store="${store}", duration=${duration}ms`)
    } catch (err) {
      logger.error(`[DataBridge] routeToDB() failed: action="${meta.action}", store="${store}"`, { error: err })
      throw new EnvelopeError(
        `DB route failed for ${store}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private async routeToManager(envelope: StandardEnvelope): Promise<void> {
    const startTs = Date.now()
    const { meta } = envelope
    logger.debug(`[DataBridge] routeToManager() called: action="${meta.action}"`)

    try {
      switch (meta.action) {
        case ENVELOPE_ACTION.resetAll: {
          logger.info(`[DataBridge] Manager resetAll: clearing entire database`)
          await db.reset()
          break
        }
        case ENVELOPE_ACTION.importAll: {
          const data = envelope.payload as Record<string, unknown[]>
          const tableCount = Object.keys(data).length
          const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
          logger.info(`[DataBridge] Manager importAll: ${tableCount} tables, ${totalRecords} records`)
          await db.import(data)
          break
        }
        case ENVELOPE_ACTION.exportAll: {
          logger.info(`[DataBridge] Manager exportAll: exporting all data`)
          await db.export()
          break
        }
        default: {
          logger.error(`[DataBridge] routeToManager() failed: Unknown action "${meta.action}"`)
          throw new EnvelopeError(`Unknown manager action: ${envelope.meta.action}`)
        }
      }

      const duration = Date.now() - startTs
      logger.info(`[DataBridge] routeToManager() completed: action="${meta.action}", duration=${duration}ms`)
    } catch (err) {
      logger.error(`[DataBridge] routeToManager() failed: action="${meta.action}"`, { error: err })
      throw err
    }
  }

  private async writeAuditLog(
    envelope: StandardEnvelope,
    store: StoreName,
  ): Promise<void> {
    const { meta, payload } = envelope
    const targetCode =
      payload != null && typeof payload === 'object' && 'symbol' in payload
        ? String((payload as Record<string, unknown>).symbol)
        : String(meta.action)

    logger.debug(`[DataBridge] writeAuditLog(): action="${meta.action}", targetType="${store}", targetCode="${targetCode}"`)

    const now = Date.now()
    await db.put(STORE_NAME.researchLogs, {
      traceId: meta.traceId,
      timestamp: now,
      actor: meta.source,
      action: meta.action,
      targetType: store,
      targetCode,
      payload: JSON.stringify(payload),
      // D-04：审计字段随写入链路自动填充（结构对齐 data/audit#AuditMeta）
      audit: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        operator: meta.source,
      },
    })
  }

  public broadcast(channel: string, envelope: StandardEnvelope): void {
    const startTs = Date.now()
    logger.debug(`[DataBridge] broadcast() called: channel="${channel}", action="${envelope.meta.action}"`)

    const symbol = this.extractSymbolFromPayload(envelope.payload)
    const channelsToBroadcast: string[] = [channel]

    if (symbol) {
      channelsToBroadcast.push(`${channel}:${symbol}`)
      logger.debug(`[DataBridge] Adding symbol-level channel: "${channel}:${symbol}"`)
    }

    let totalCallbackCount = 0
    let totalSuccessCount = 0
    let totalErrorCount = 0

    for (const targetChannel of channelsToBroadcast) {
      const callbacks = this.getMatchingSubscribers(targetChannel)
      if (callbacks.size === 0) {
        logger.debug(`[DataBridge] broadcast() skipped: no matching subscribers for channel "${targetChannel}"`)
        continue
      }

      const callbackCount = callbacks.size
      let successCount = 0
      let errorCount = 0
      let subscriberIndex = 0

      callbacks.forEach((cb) => {
        subscriberIndex++
        try {
          cb(envelope)
          successCount++
        } catch (err) {
          errorCount++
          logger.error(`[DataBridge] Subscriber #${subscriberIndex} error for channel "${targetChannel}"`, { error: err })
        }
      })

      totalCallbackCount += callbackCount
      totalSuccessCount += successCount
      totalErrorCount += errorCount

      logger.info(`[DataBridge] broadcast() to subscribers: channel="${targetChannel}", listeners=${callbackCount}, success=${successCount}, errors=${errorCount}`)
    }

    const eventName = `${channel}${CHANGED_SUFFIX}`
    logger.debug(`[DataBridge] Emitting eventBus: "${eventName}"`)
    try {
      eventBus.emit(eventName, envelope)
    } catch (err) {
      logger.warn(`[DataBridge] eventBus.emit failed for channel "${channel}", action="${envelope.meta.action}", traceId="${envelope.meta.traceId}"`, { error: err })
    }

    const duration = Date.now() - startTs
    if (duration > BROADCAST_SLOW_THRESHOLD_MS) {
      logger.warn(`[DataBridge] broadcast() took ${duration}ms for channel "${channel}"`)
    }

    if (totalCallbackCount > 0) {
      logger.info(`[DataBridge] broadcast() completed: channel="${channel}", totalListeners=${totalCallbackCount}, totalSuccess=${totalSuccessCount}, totalErrors=${totalErrorCount}`)
    }
  }
}

/**
 * dataBridge
 */
export const dataBridge = new DataBridge()
