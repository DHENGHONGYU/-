import { ENVELOPE_ACTION, STORE_NAME, type EnvelopeTarget, type ModuleId, type StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import type { Stock } from '@/data/types'
import { CHANGED_SUFFIX, EVENT_NAMES } from '@/constants/store-channels.constants'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { analyze as analyzeHotSector, type HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import { detect as detectRotation, type RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import { analyze as analyzeValuePit, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { aclEngine, inferOperation } from './acl'
import { EnvelopeError, EnvelopeFactory, type StandardEnvelope } from './envelope'
import { fallbackQueue, FallbackQueue } from './fallbackQueue'
import { MemoryCache } from './memoryCache'

/**
 * 信封处理器接口（策略模式）
 * 每个 action 对应一个 Handler，负责具体的数据库操作
 */
interface EnvelopeHandler {
  canHandle(action: string): boolean
  handle(envelope: StandardEnvelope, store: StoreName): Promise<void>
}

/**
 * 通用 PUT 操作处理器
 * 处理所有简单的 db.put() 操作
 */
class PutHandler implements EnvelopeHandler {
  private readonly actions: string[]

  constructor(actions: string[]) {
    this.actions = actions
  }

  canHandle(action: string): boolean {
    return this.actions.includes(action)
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { meta, payload } = envelope
    logger.debug(`[DataBridge] DB put: action="${meta.action}", store="${store}"`)
    await db.put(store, payload)
  }
}

/**
 * 通用 DELETE 操作处理器
 */
class DeleteHandler implements EnvelopeHandler {
  private readonly actions: string[]

  constructor(actions: string[]) {
    this.actions = actions
  }

  canHandle(action: string): boolean {
    return this.actions.includes(action)
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { meta, payload } = envelope
    const { id } = payload as { id: string }
    logger.debug(`[DataBridge] DB delete: action="${meta.action}", store="${store}", id="${id}"`)
    await db.delete(store, id)
  }
}

/**
 * 股票插入处理器（需要特殊处理）
 */
class InsertStockHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.insertStock
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const stock = envelope.payload as Stock
    // 防御性校验：stocks store 的 keyPath 为 'symbol'，缺失会导致 IndexedDB 抛出
    // "Evaluating the object store's key path did not yield a value"
    if (!stock || !stock.symbol) {
      const traceId = envelope.meta.traceId ?? 'N/A'
      throw new EnvelopeError(
        `insertStock rejected: missing or empty "symbol" field (traceId=${traceId})`,
      )
    }
    logger.debug(`[DataBridge] DB insertStock: symbol="${stock.symbol}"`)
    await db.put(store, stock)
  }
}

/**
 * 股票更新处理器（需要合并现有数据）
 */
class UpdateStockHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.updateStock
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const update = envelope.payload as Partial<Stock> & { symbol: string }
    logger.debug(`[DataBridge] DB updateStock: symbol="${update.symbol}"`)
    const existing = await db.get<Stock>(store, update.symbol)
    if (!existing) {
      logger.warn(`[DataBridge] DB updateStock failed: Stock not found "${update.symbol}"`)
      throw new EnvelopeError(`Stock not found: ${update.symbol}`)
    }
    await db.put(store, { ...existing, ...update, updatedAt: Date.now(), dataVersion: (existing.dataVersion ?? 1) + 1 })
  }
}

/**
 * 股票删除处理器（需要级联删除）
 */
class DeleteStockHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.deleteStock
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { symbol } = envelope.payload as { symbol: string }
    logger.info(`[DataBridge] DB deleteStock: symbol="${symbol}" — 开始级联删除`)

    // 1. 删除 Stock 主记录
    await db.delete(store, symbol)

    // 2. 级联删除以 symbol 为主键的关联表
    const symbolKeyStores = [
      STORE_NAME.v6Scores,
      STORE_NAME.dailyQuotes,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
    ]
    for (const s of symbolKeyStores) {
      try {
        await db.delete(s, symbol)
        logger.debug(`[DataBridge] 级联删除: ${s} symbol="${symbol}"`)
      } catch (err) {
        logger.warn(`[DataBridge] 级联删除失败(主键): ${s}`, { error: err instanceof Error ? err.message : String(err) })
      }
    }

    // 3. 级联删除有 by-symbol 索引的关联表（先查后删）
    const indexedStores = [
      STORE_NAME.intelligentScores,
      STORE_NAME.scoreDocs,
      STORE_NAME.localDocs,
      STORE_NAME.newsStockMap,
      STORE_NAME.executionPlans,
      STORE_NAME.executionLogs,
      STORE_NAME.missingReports,
    ]
    for (const s of indexedStores) {
      try {
        const records = await db.getAllByIndex<{ id: string; symbol?: string }>(s, 'by-symbol', symbol)
        for (const rec of records) {
          if (rec.id) {
            await db.delete(s, rec.id)
          }
        }
        if (records.length > 0) {
          logger.debug(`[DataBridge] 级联删除(索引): ${s} count=${records.length}`)
        }
      } catch (err) {
        logger.warn(`[DataBridge] 级联删除失败(索引): ${s}`, { error: err instanceof Error ? err.message : String(err) })
      }
    }

    // 4. 级联删除无 symbol 索引的关联表（全表扫描过滤）
    const scanStores = [STORE_NAME.orders, STORE_NAME.signals, STORE_NAME.watchlists]
    for (const s of scanStores) {
      try {
        const allRecords = await db.getAll<{ id: string; symbol?: string }>(s)
        const toDelete = allRecords.filter((r) => r.symbol === symbol)
        for (const rec of toDelete) {
          if (rec.id) {
            await db.delete(s, rec.id)
          }
        }
        if (toDelete.length > 0) {
          logger.debug(`[DataBridge] 级联删除(扫描): ${s} count=${toDelete.length}`)
        }
      } catch (err) {
        logger.warn(`[DataBridge] 级联删除失败(扫描): ${s}`, { error: err instanceof Error ? err.message : String(err) })
      }
    }

    logger.info(`[DataBridge] DB deleteStock 完成: symbol="${symbol}" — 级联删除结束`)
  }
}

/**
 * 通知类 action 处理器（仅记录日志，不持久化）
 */
class NotificationHandler implements EnvelopeHandler {
  private readonly actions: string[]

  constructor(actions: string[]) {
    this.actions = actions
  }

  canHandle(action: string): boolean {
    return this.actions.includes(action)
  }

  async handle(envelope: StandardEnvelope): Promise<void> {
    const { meta } = envelope
    logger.info(`[DataBridge] Notification-only action, skip DB put: action="${meta.action}"`)
  }
}

/**
 * 持仓数据查询处理器（P0-3 修复）
 * loadHoldingsData 的 payload 是 HoldingsQueryParams（分页/日期/关键词），
 * 不是 Stock 数据，不能写入 stocks store（keyPath='symbol'）。
 * holdingsStore 的 ACL write=[] 也证实它不应执行 DB 写操作。
 * 此处理器仅记录查询日志，不执行 DB 写入。
 */
class LoadHoldingsDataHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.loadHoldingsData
  }

  async handle(envelope: StandardEnvelope): Promise<void> {
    const { meta, payload } = envelope
    logger.info('[DataBridge] loadHoldingsData: query-only action, skip DB put', {
      traceId: meta.traceId,
      source: meta.source,
      payloadKeys: payload ? Object.keys(payload as Record<string, unknown>) : [],
    })
  }
}

/**
 * 信封处理器注册表
 * 按优先级顺序管理所有 Handler
 */
class HandlerRegistry {
  private handlers: EnvelopeHandler[] = []

  register(handler: EnvelopeHandler): void {
    this.handlers.push(handler)
  }

  findHandler(action: string): EnvelopeHandler | undefined {
    return this.handlers.find((h) => h.canHandle(action))
  }
}

/**
 * 初始化处理器注册表
 */
function createHandlerRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry()

  // 1. 特殊处理器（优先级高）
  registry.register(new InsertStockHandler())
  registry.register(new UpdateStockHandler())
  registry.register(new DeleteStockHandler())

  // 2. 通知类处理器
  registry.register(
    new NotificationHandler([
      ENVELOPE_ACTION.newsArticleLoaded,
      ENVELOPE_ACTION.holdingsDataLoaded,
      ENVELOPE_ACTION.tradeActionExecuted,
    ])
  )

  // 2.5 持仓查询处理器（P0-3 修复：loadHoldingsData 的 payload 是 HoldingsQueryParams，
  // 不是 Stock 数据，不应写入 stocks store。holdingsStore 的 ACL write=[] 也证实了这一点）
  registry.register(new LoadHoldingsDataHandler())

  // 3. DELETE 操作处理器
  registry.register(new DeleteHandler([ENVELOPE_ACTION.deleteExecutionPlan]))

  // 4. 通用 PUT 操作处理器（处理所有简单的 db.put() 操作）
  registry.register(
    new PutHandler([
      ENVELOPE_ACTION.saveScores,
      ENVELOPE_ACTION.saveDailyQuotes,
      ENVELOPE_ACTION.saveIntelligentScores,
      ENVELOPE_ACTION.saveIndustryScores,
      ENVELOPE_ACTION.saveRotationScores,
      ENVELOPE_ACTION.saveSectorScores,
      ENVELOPE_ACTION.saveScoreDocs,
      ENVELOPE_ACTION.saveStrategySnapshots,
      ENVELOPE_ACTION.saveHotSectorScores,
      ENVELOPE_ACTION.saveValuePitScores,
      ENVELOPE_ACTION.saveLocalDocs,
      ENVELOPE_ACTION.saveNews,
      ENVELOPE_ACTION.saveNewsStockMap,
      ENVELOPE_ACTION.saveSentimentCache,
      ENVELOPE_ACTION.saveResearchLog,
      ENVELOPE_ACTION.insertOrder,
      ENVELOPE_ACTION.updateOrder,
      ENVELOPE_ACTION.insertSignal,
      ENVELOPE_ACTION.saveTradeReview,
      ENVELOPE_ACTION.updateExecutionPlan,
      ENVELOPE_ACTION.incrementMissingReportRetry,
      ENVELOPE_ACTION.saveExecutionPlan,
      ENVELOPE_ACTION.saveExecutionLog,
      ENVELOPE_ACTION.saveMissingReport,
      ENVELOPE_ACTION.updateExecutionPhase,
      ENVELOPE_ACTION.savePortfolio,
      ENVELOPE_ACTION.newsArticleBookmarked,
    ])
  )

  return registry
}

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
 * 策略数据流订阅频道名称常量。
 * 外部组件通过 `dataBridge.subscribe(STRATEGY_CHANNEL.hotSector, cb)` 订阅。
 */
export const STRATEGY_CHANNEL = {
  hotSector: 'strategy:hotSector',
  valuePit: 'strategy:valuePit',
  rotationSignal: 'strategy:rotationSignal',
} as const

export type StrategyChannel = (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL]

/**
 * Action 到 Store 的显式映射表（避免字符串包含判断的歧义）
 */
const ACTION_TO_STORE_MAP: Record<string, StoreName> = {
  [ENVELOPE_ACTION.saveNewsStockMap]: STORE_NAME.newsStockMap,
  [ENVELOPE_ACTION.insertStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.updateStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.deleteStock]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.saveDailyQuotes]: STORE_NAME.dailyQuotes,
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
}

function inferStore(action: string): StoreName {
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
    const source = request.source ?? ('datalayer' as ModuleId)
    logger.info(`[DataBridge] query() called: action="${request.action}", store="${request.store}", source="${source}", key="${request.key ?? 'N/A'}", indexName="${request.indexName ?? 'N/A'}"`)

    try {
      // 1. 生成缓存 key
      const cacheKey = this.buildCacheKey(request)
      logger.debug(`[DataBridge] query() cache key generated: "${cacheKey}"`)

      // 2. 查缓存
      const cached = this.readCache.get(cacheKey) as T | undefined
      if (cached !== undefined) {
        const cacheStats = this.readCache.getStats()
        logger.info(`[DataBridge] query() cache HIT: key="${cacheKey}", cacheSize=${cacheStats.size}, hitRate=${(cacheStats.hitRate * 100).toFixed(1)}%`)
        const duration = Date.now() - startTs
        logger.info(`[DataBridge] query() completed (from cache): action="${request.action}", store="${request.store}", duration=${duration}ms`)
        return { success: true, data: cached }
      }
      logger.info(`[DataBridge] query() cache MISS: key="${cacheKey}", proceeding to database query`)

      // 3. ACL 校验
      try {
        logger.debug(`[DataBridge] query() ACL check starting: module="${source}", store="${request.store}", operation="SELECT"`)
        aclEngine.assert({
          module: source,
          store: request.store,
          operation: 'SELECT',
        })
        logger.info(`[DataBridge] query() ACL check PASSED: module="${source}", store="${request.store}", operation="SELECT"`)
      } catch (aclErr) {
        const aclErrorMessage = aclErr instanceof Error ? aclErr.message : String(aclErr)
        logger.error(`[DataBridge] query() ACL check FAILED: module="${source}", store="${request.store}", operation="SELECT", reason="${aclErrorMessage}"`)
        throw aclErr
      }

      // 4. 执行数据库操作
      logger.debug(`[DataBridge] query() executing database operation: action="${request.action}", store="${request.store}"`)
      let result: T
      switch (request.action) {
        case ENVELOPE_ACTION.queryGet: {
          if (!request.key) {
            logger.error(`[DataBridge] query() parameter validation failed: queryGet requires key parameter`)
            throw new EnvelopeError('queryGet requires key parameter')
          }
          logger.debug(`[DataBridge] query() executing db.get: store="${request.store}", key="${request.key}"`)
          result = await db.get(request.store, request.key) as T
          logger.debug(`[DataBridge] query() db.get completed: found=${result !== undefined && result !== null}`)
          break
        }
        case ENVELOPE_ACTION.queryList: {
          logger.debug(`[DataBridge] query() executing db.getAll: store="${request.store}"`)
          result = await db.getAll(request.store) as T
          const listLength = Array.isArray(result) ? result.length : 'N/A'
          logger.debug(`[DataBridge] query() db.getAll completed: resultCount=${listLength}`)
          break
        }
        case ENVELOPE_ACTION.queryByIndex: {
          if (!request.indexName || request.indexValue === undefined) {
            logger.error(`[DataBridge] query() parameter validation failed: queryByIndex requires indexName and indexValue parameters`)
            throw new EnvelopeError('queryByIndex requires indexName and indexValue parameters')
          }
          const indexValueStr = typeof request.indexValue === 'string' ? request.indexValue : JSON.stringify(request.indexValue)
          logger.debug(`[DataBridge] query() executing db.getAllByIndex: store="${request.store}", indexName="${request.indexName}", indexValue="${indexValueStr}"`)
          result = await db.getAllByIndex(request.store, request.indexName, request.indexValue as string) as T
          const indexListLength = Array.isArray(result) ? result.length : 'N/A'
          logger.debug(`[DataBridge] query() db.getAllByIndex completed: resultCount=${indexListLength}`)
          break
        }
        default: {
          const unknownAction: string = request.action as string
          logger.error(`[DataBridge] query() unknown action: "${unknownAction}"`)
          throw new EnvelopeError(`Unknown query action: ${unknownAction}`)
        }
      }

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
    if (request.key) parts.push(`key=${request.key}`)
    if (request.indexName) parts.push(`idx=${request.indexName}`)
    if (request.indexValue !== undefined) {
      const valStr = typeof request.indexValue === 'string' ? request.indexValue : JSON.stringify(request.indexValue)
      parts.push(`val=${valStr}`)
    }
    return parts.join(':')
  }

  private async writeQueryAuditLog(request: QueryRequest, source: ModuleId): Promise<void> {
    const targetCode = request.key ?? request.indexValue?.toString() ?? request.action
    await db.put(STORE_NAME.researchLogs, {
      traceId: `query-${Date.now()}`,
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
    const targetStore = inferStore(meta.action)
    const operation = inferOperation(meta.action)

    logger.debug(`[DataBridge] Route determined: action="${meta.action}", targetStore="${targetStore}", operation="${operation}"`)

    try {
      try {
        aclEngine.assert({
          module: meta.source as ModuleId,
          store: targetStore,
          operation,
        })
        logger.debug(`[DataBridge] ACL check passed: module="${meta.source}", store="${targetStore}", operation="${operation}"`)
      } catch (aclErr) {
        logger.error(`[DataBridge] ACL check failed: module="${meta.source}", store="${targetStore}", operation="${operation}"`, { error: aclErr })
        if (this.isMarketEnvelope(meta.action)) {
          logger.warn(`[DataBridge] ACL rejected market envelope, enqueueing for retry: action="${meta.action}", traceId="${meta.traceId}"`)
          this.fallbackQueue.push(envelope)
          return
        }
        throw aclErr
      }

      this.writeAuditLog(envelope, targetStore).catch((err) => {
        logger.error(`[DataBridge] Audit log failed: action="${meta.action}", traceId="${meta.traceId}"`, { error: err })
      })

      if (
        meta.action === ENVELOPE_ACTION.strategyHotSectorRefresh ||
        meta.action === ENVELOPE_ACTION.strategyValuePitRefresh ||
        meta.action === ENVELOPE_ACTION.strategyRotationSignalDetect
      ) {
        logger.info(`[DataBridge] Routing to strategy engine: action="${meta.action}"`)
        await this.routeToStrategy(envelope)
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
      const wasPresent = this.subscribers.get(channel)?.has(callback)
      this.subscribers.get(channel)?.delete(callback)
      const remaining = this.subscribers.get(channel)?.size ?? 0

      if (wasPresent) {
        logger.info(`[DataBridge] Unsubscribe: channel="${channel}", remaining=${remaining}`)
      }
    }
  }

  private isMarketEnvelope(action: string): boolean {
    return action === ENVELOPE_ACTION.saveDailyQuotes
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

  private async routeToStrategy(envelope: StandardEnvelope): Promise<void> {
    const startTs = Date.now()
    const { meta, payload } = envelope
    logger.info(`[DataBridge] routeToStrategy() called: action="${meta.action}"`)

    try {
      switch (meta.action) {
        case ENVELOPE_ACTION.strategyHotSectorRefresh: {
          try {
            // ===== 1. 输入校验 =====
            const inputs = payload as HotSectorAnalyzerInput[]
            if (!Array.isArray(inputs)) {
              const err = new EnvelopeError('HotSector: payload 必须是数组')
              logger.error(`[DataBridge] HotSector refresh: payload 校验失败`, { error: err })
              throw err
            }
            logger.info(`[DataBridge] HotSector refresh: 输入数量=${inputs.length}, 板块列表=[${inputs.map((i) => i.symbol).join(', ')}]`)

            // ===== 2. 逐板块评分 =====
            const scores = inputs.map((input) => {
              const score = analyzeHotSector(input)
              logger.info(
                `[DataBridge] HotSector: ${input.symbol} ` +
                `momentum=${score.dimensions.momentum.toFixed(2)} ` +
                `sentiment=${score.dimensions.sentiment.toFixed(2)} ` +
                `technical=${score.dimensions.technical.toFixed(2)} ` +
                `valuation=${score.dimensions.valuation.toFixed(2)} ` +
                `marketEnv=${(score.dimensions.marketEnv ?? 0).toFixed(2)} ` +
                `→ score=${score.score.toFixed(2)} action=${score.action}`,
              )
              return score
            })

            // ===== 3. 评分汇总 =====
            const avgScore = scores.reduce((s, c) => s + c.score, 0) / scores.length
            const maxScore = Math.max(...scores.map((s) => s.score))
            const minScore = Math.min(...scores.map((s) => s.score))
            const immediateCount = scores.filter((s) => s.action === 'immediate').length
            const probeCount = scores.filter((s) => s.action === 'probe').length
            const ignoreCount = scores.filter((s) => s.action === 'ignore').length
            logger.info(
              `[DataBridge] HotSector 评分汇总: ` +
              `avg=${avgScore.toFixed(2)} max=${maxScore.toFixed(2)} min=${minScore.toFixed(2)} ` +
              `immediate=${immediateCount} probe=${probeCount} ignore=${ignoreCount}`,
            )

            // ===== 4. 广播到策略频道 =====
            const subscriberCount = this.subscribers.get(STRATEGY_CHANNEL.hotSector)?.size ?? 0
            logger.info(`[DataBridge] HotSector: 准备广播到 channel="${STRATEGY_CHANNEL.hotSector}", 订阅者数=${subscriberCount}`)

            const channelEnvelope: StandardEnvelope = {
              ...envelope,
              payload: scores,
              meta: { ...meta, target: STRATEGY_CHANNEL.hotSector as EnvelopeTarget },
            }
            this.broadcast(STRATEGY_CHANNEL.hotSector, channelEnvelope)
            logger.info(`[DataBridge] HotSector: channel="${STRATEGY_CHANNEL.hotSector}" 广播完成`)

            // ===== 5. EventBus 事件 =====
            eventBus.emit(EVENT_NAMES.HOT_SECTOR_CHANGED, scores)
            logger.info(`[DataBridge] HotSector: EventBus emit "${EVENT_NAMES.HOT_SECTOR_CHANGED}" 完成, payload.length=${scores.length}`)
          } catch (err) {
            logger.error(`[DataBridge] HotSector refresh 失败`, { error: err })
            throw err
          }
          break
        }

        case ENVELOPE_ACTION.strategyValuePitRefresh: {
          try {
            // ===== 1. 输入校验 =====
            const inputs = payload as ValuePitAnalyzerInput[]
            if (!Array.isArray(inputs)) {
              const err = new EnvelopeError('ValuePit: payload 必须是数组')
              logger.error(`[DataBridge] ValuePit refresh: payload 校验失败`, { error: err })
              throw err
            }
            logger.info(`[DataBridge] ValuePit refresh: 输入数量=${inputs.length}, 板块列表=[${inputs.map((i) => i.symbol).join(', ')}]`)

            // ===== 2. 逐板块评分 =====
            const scores = inputs.map((input) => {
              const score = analyzeValuePit(input)
              logger.info(
                `[DataBridge] ValuePit: ${input.symbol} ` +
                `catalyst=${score.dimensions.catalyst.toFixed(2)} ` +
                `valuation=${score.dimensions.valuation.toFixed(2)} ` +
                `chip=${score.dimensions.chip.toFixed(2)} ` +
                `rotation=${score.dimensions.rotation.toFixed(2)} ` +
                `liquidity=${score.dimensions.liquidity.toFixed(2)} ` +
                `→ score=${score.score.toFixed(2)} action=${score.action}`,
              )
              return score
            })

            // ===== 3. 评分汇总 =====
            const avgScore = scores.reduce((s, c) => s + c.score, 0) / scores.length
            const maxScore = Math.max(...scores.map((s) => s.score))
            const minScore = Math.min(...scores.map((s) => s.score))
            const immediateCount = scores.filter((s) => s.action === 'immediate').length
            const probeCount = scores.filter((s) => s.action === 'probe').length
            const waitCount = scores.filter((s) => s.action === 'wait').length
            const ignoreCount = scores.filter((s) => s.action === 'ignore').length
            logger.info(
              `[DataBridge] ValuePit 评分汇总: ` +
              `avg=${avgScore.toFixed(2)} max=${maxScore.toFixed(2)} min=${minScore.toFixed(2)} ` +
              `immediate=${immediateCount} probe=${probeCount} wait=${waitCount} ignore=${ignoreCount}`,
            )

            // ===== 4. 广播到策略频道 =====
            const subscriberCount = this.subscribers.get(STRATEGY_CHANNEL.valuePit)?.size ?? 0
            logger.info(`[DataBridge] ValuePit: 准备广播到 channel="${STRATEGY_CHANNEL.valuePit}", 订阅者数=${subscriberCount}`)

            const channelEnvelope: StandardEnvelope = {
              ...envelope,
              payload: scores,
              meta: { ...meta, target: STRATEGY_CHANNEL.valuePit as EnvelopeTarget },
            }
            this.broadcast(STRATEGY_CHANNEL.valuePit, channelEnvelope)
            logger.info(`[DataBridge] ValuePit: channel="${STRATEGY_CHANNEL.valuePit}" 广播完成`)

            // ===== 5. EventBus 事件 =====
            eventBus.emit(EVENT_NAMES.VALUE_PIT_CHANGED, scores)
            logger.info(`[DataBridge] ValuePit: EventBus emit "${EVENT_NAMES.VALUE_PIT_CHANGED}" 完成, payload.length=${scores.length}`)
          } catch (err) {
            logger.error(`[DataBridge] ValuePit refresh 失败`, { error: err })
            throw err
          }
          break
        }

        case ENVELOPE_ACTION.strategyRotationSignalDetect: {
          try {
            // ===== 1. 输入校验 =====
            const inputs = payload as RotationSignalInput[]
            if (!Array.isArray(inputs)) {
              const err = new EnvelopeError('RotationSignal: payload 必须是数组')
              logger.error(`[DataBridge] RotationSignal detect: payload 校验失败`, { error: err })
              throw err
            }
            logger.info(
              `[DataBridge] RotationSignal detect: 输入数量=${inputs.length}, ` +
              `板块列表=[${inputs.map((i) => i.sectorId).join(', ')}], ` +
              `成交量数据量=[${inputs.map((i) => i.volume.history.length).join(', ')}], ` +
              `资金流数据量=[${inputs.map((i) => i.capitalFlow.dailyNetFlow.length).join(', ')}], ` +
              `收盘价数据量=[${inputs.map((i) => i.goldenCross.closes.length).join(', ')}]`,
            )

            // ===== 2. 逐板块检测 =====
            const signals = inputs.map((input) => {
              const signal = detectRotation(input)
              logger.info(
                `[DataBridge] RotationSignal: ${input.sectorId} ` +
                `volumeBreakthrough=${signal.conditions.volumeBreakthrough} ` +
                `capitalInflow=${signal.conditions.capitalInflow} ` +
                `goldenCross=${signal.conditions.goldenCross} ` +
                `→ triggered=${signal.triggered} strength=${signal.strength}`,
              )
              return signal
            })

            // ===== 3. 检测汇总 =====
            const triggeredCount = signals.filter((s) => s.triggered).length
            const notTriggeredCount = signals.length - triggeredCount
            const strongCount = signals.filter((s) => s.strength === 'strong').length
            const mediumCount = signals.filter((s) => s.strength === 'medium').length
            const weakCount = signals.filter((s) => s.strength === 'weak').length
            const triggeredList = signals.filter((s) => s.triggered).map((s) => s.sectorId)
            logger.info(
              `[DataBridge] RotationSignal 检测汇总: ` +
              `总=${signals.length} 触发=${triggeredCount} 未触发=${notTriggeredCount} ` +
              `strong=${strongCount} medium=${mediumCount} weak=${weakCount} ` +
              `触发板块=[${triggeredList.join(', ') || '无'}]`,
            )

            // ===== 4. 广播到策略频道 =====
            const subscriberCount = this.subscribers.get(STRATEGY_CHANNEL.rotationSignal)?.size ?? 0
            logger.info(`[DataBridge] RotationSignal: 准备广播到 channel="${STRATEGY_CHANNEL.rotationSignal}", 订阅者数=${subscriberCount}`)

            const channelEnvelope: StandardEnvelope = {
              ...envelope,
              payload: signals,
              meta: { ...meta, target: STRATEGY_CHANNEL.rotationSignal as EnvelopeTarget },
            }
            this.broadcast(STRATEGY_CHANNEL.rotationSignal, channelEnvelope)
            logger.info(`[DataBridge] RotationSignal: channel="${STRATEGY_CHANNEL.rotationSignal}" 广播完成`)

            // ===== 5. EventBus 事件 =====
            eventBus.emit(EVENT_NAMES.ROTATION_SIGNAL_TRIGGERED, signals)
            logger.info(`[DataBridge] RotationSignal: EventBus emit "${EVENT_NAMES.ROTATION_SIGNAL_TRIGGERED}" 完成, payload.length=${signals.length}`)
          } catch (err) {
            logger.error(`[DataBridge] RotationSignal detect 失败`, { error: err })
            throw err
          }
          break
        }

        default: {
          logger.error(`[DataBridge] routeToStrategy() failed: Unknown action "${meta.action}"`)
          throw new EnvelopeError(`Unknown strategy action: ${meta.action}`)
        }
      }

      const duration = Date.now() - startTs
      logger.info(`[DataBridge] routeToStrategy() completed: action="${meta.action}", duration=${duration}ms`)
    } catch (err) {
      logger.error(`[DataBridge] routeToStrategy() failed: action="${meta.action}"`, { error: err })
      throw err
    }
  }

  private async writeAuditLog(
    envelope: StandardEnvelope,
    store: StoreName,
  ): Promise<void> {
    const { meta, payload } = envelope
    const targetCode =
      payload && typeof payload === 'object' && 'symbol' in payload
        ? String((payload as Record<string, unknown>).symbol)
        : String(meta.action)

    logger.debug(`[DataBridge] writeAuditLog(): action="${meta.action}", targetType="${store}", targetCode="${targetCode}"`)

    await db.put(STORE_NAME.researchLogs, {
      traceId: meta.traceId,
      timestamp: Date.now(),
      actor: meta.source,
      action: meta.action,
      targetType: store,
      targetCode,
      payload: JSON.stringify(payload),
    })
  }

  private broadcast(channel: string, envelope: StandardEnvelope): void {
    const startTs = Date.now()
    logger.debug(`[DataBridge] broadcast() called: channel="${channel}", action="${envelope.meta.action}"`)

    const callbacks = this.subscribers.get(channel)
    if (!callbacks) {
      logger.debug(`[DataBridge] broadcast() skipped: no subscribers for channel "${channel}"`)
      return
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
        logger.error(`[DataBridge] Subscriber #${subscriberIndex} error for channel "${channel}"`, { error: err })
      }
    })

    logger.info(`[DataBridge] broadcast() to subscribers: channel="${channel}", listeners=${callbackCount}, success=${successCount}, errors=${errorCount}`)

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
  }
}

export const dataBridge = new DataBridge()
