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
 *
 * @todo P1-4: 拆分计划（当前 843 行 CC=86，audit:split-quality 建议拆分）
 *   Phase 1 (done): 提取 ACL 方法到 databridgeAcl.ts（assertQueryAcl 等，CC 100→86）
 *   Phase 2: 提取 broadcast/subscribe/auditLog 到独立类（~150 行）
 *   Phase 3: 提取 cache 逻辑到独立类（~100 行）
 *   目标：主文件 < 400 行，CC < 30
  * @doc [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012, V9-DOC-PROJ-002]
*/

import { ENVELOPE_ACTION, ENVELOPE_TARGET, STORE_NAME, type ModuleId, type StoreName } from '@/config/dbConfig'
import { gateway } from '@/data/gateway'
import { CHANGED_SUFFIX } from '@/constants/store-channels.constants'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { inferOperation } from './acl'
import { EnvelopeError, EnvelopeFactory, type StandardEnvelope } from './envelope'
import { fallbackQueue, FallbackQueue } from './fallbackQueue'
import { MemoryCache } from './memoryCache'
import { createHandlerRegistry, type HandlerRegistry } from './databridgeHandlers'
import { nanoid } from 'nanoid'
import {
  assertQueryAcl,
  assertQueryGetKey,
  assertQueryByIndexKey,
  assertAclWithFallback,
} from './databridgeAcl'
import {
  routeToStrategy,
  type StrategyRouterContext,
} from './databridgeStrategyRouter'
import { routeToQuery as routeToQueryFn, routeToEvent as routeToEventFn, routeToManager as routeToManagerFn } from './databridgeRouter'
import type { QueryRequest, QueryResult } from './databridge.types'

// re-export 共享类型，保持原导入路径兼容
export type { QueryRequest, QueryResult } from './databridge.types'

// re-export 子模块的公共 API，保持原导入路径兼容
export { STRATEGY_CHANNEL } from './databridgeStrategyRouter'
export type { StrategyChannel } from './databridgeStrategyRouter'
export type { EnvelopeHandler } from './databridgeHandlers'
export { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'
export type { EnvelopeAction, StoreName, ModuleId } from '@/config/dbConfig'

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
  [ENVELOPE_ACTION.updateStockStatus]: STORE_NAME.stocks,
  [ENVELOPE_ACTION.updateStockGroup]: STORE_NAME.stocks,
  // ── Workflow 存储写入通道（v28 新增）──
  [ENVELOPE_ACTION.saveWorkflowDef]: STORE_NAME.workflowDefs,
  [ENVELOPE_ACTION.deleteWorkflowDef]: STORE_NAME.workflowDefs,
  [ENVELOPE_ACTION.saveWorkflowSchedule]: STORE_NAME.workflowSchedules,
  [ENVELOPE_ACTION.deleteWorkflowSchedule]: STORE_NAME.workflowSchedules,
  [ENVELOPE_ACTION.saveWorkflowTrigger]: STORE_NAME.workflowTriggers,
  [ENVELOPE_ACTION.deleteWorkflowTrigger]: STORE_NAME.workflowTriggers,
  [ENVELOPE_ACTION.saveWorkflowRun]: STORE_NAME.workflowRuns,
  // ── RBAC 审计日志归档删除通道（v24 新增）──
  [ENVELOPE_ACTION.deleteRbacAuditLog]: STORE_NAME.rbacPermissionAuditLogs,
  // ── 数据网关补全映射（v31 整改：原未映射导致 inferStore 抛 "Unknown action"，Store 写入静默失败）──
  [ENVELOPE_ACTION.saveCollectionHistory]: STORE_NAME.collectionHistory,
  [ENVELOPE_ACTION.deleteCollectionHistory]: STORE_NAME.collectionHistory,
  [ENVELOPE_ACTION.saveConflictLog]: STORE_NAME.conflictLog,
  [ENVELOPE_ACTION.saveFileImportRecord]: STORE_NAME.fileImportRecords,
  [ENVELOPE_ACTION.saveScheduleConfig]: STORE_NAME.scheduleConfigs,
  [ENVELOPE_ACTION.deleteScheduleConfig]: STORE_NAME.scheduleConfigs,
  [ENVELOPE_ACTION.saveProofreadReport]: STORE_NAME.proofreadReports,
  [ENVELOPE_ACTION.saveAnalysisResult]: STORE_NAME.analysisResults,
  // ── 八域资料体系（v32 新增，ADR-010） ──
  [ENVELOPE_ACTION.saveProfileItem]: STORE_NAME.profileItems,
  [ENVELOPE_ACTION.bulkSaveProfileItems]: STORE_NAME.profileItems,
  [ENVELOPE_ACTION.deleteProfileItem]: STORE_NAME.profileItems,
  [ENVELOPE_ACTION.saveScoreEvidence]: STORE_NAME.scoreEvidence,
  [ENVELOPE_ACTION.bulkSaveScoreEvidence]: STORE_NAME.scoreEvidence,
  [ENVELOPE_ACTION.deleteScoreEvidence]: STORE_NAME.scoreEvidence,
  [ENVELOPE_ACTION.saveStockProfile]: STORE_NAME.stockProfiles,
  [ENVELOPE_ACTION.saveProfileTag]: STORE_NAME.profileTags,
  [ENVELOPE_ACTION.deleteProfileTag]: STORE_NAME.profileTags,
  // ── 报告资产化（v33 新增，P1 报告资产化）──
  [ENVELOPE_ACTION.saveGeneratedReport]: STORE_NAME.generatedReports,
  [ENVELOPE_ACTION.saveReportTemplate]: STORE_NAME.reportTemplates,
  [ENVELOPE_ACTION.deleteGeneratedReport]: STORE_NAME.generatedReports,
  // ── 筛选结果集持久化（v34 新增，P0 筛选结果集持久化）──
  [ENVELOPE_ACTION.saveScreeningResult]: STORE_NAME.screeningResults,
  [ENVELOPE_ACTION.deleteScreeningResult]: STORE_NAME.screeningResults,
  // ── 观察池复盘持久化（v35 新增，spec 缺口② 闭环）──
  [ENVELOPE_ACTION.saveObservationReview]: STORE_NAME.observationReviews,
  [ENVELOPE_ACTION.deleteObservationReview]: STORE_NAME.observationReviews,
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
  ENVELOPE_ACTION.feedbackIssuesDetected,
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
 * DataBridge
 */
export class DataBridge {
  private subscribers = new Map<string, Set<EnvelopeCallback>>()
  private fallbackQueue: FallbackQueue = fallbackQueue
  private handlerRegistry: HandlerRegistry = createHandlerRegistry()
  private readCache = new MemoryCache<unknown>({ namespace: 'databridge:read', defaultTTL: 10_000, maxSize: 200 })

  /**
   * 初始化数据库连接。
   * 应用启动时调用，幂等：已初始化则直接返回。
   */
  async init(): Promise<void> {
    if (gateway.isReady()) {
      logger.debug('[DataBridge] init() called but already initialized, skipping')
      return
    }
    logger.info('[DataBridge] init() called, initializing database...')
    await gateway.init()
    logger.info('[DataBridge] init() completed, database ready')
  }

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
      assertQueryAcl(source, request.store)

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
    if (gateway.isReady()) return
    logger.info('[DataBridge] query() waiting for database ready...')
    await gateway.ready()
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
   * 根据 action 执行具体数据库读取操作（query 内部抽出，降低主函数嵌套深度）
   */
  private async executeQueryAction<T>(request: QueryRequest): Promise<T> {
    switch (request.action) {
      case ENVELOPE_ACTION.queryGet: {
        assertQueryGetKey(request)
        logger.debug(`[DataBridge] query() executing gateway.get: store="${request.store}", key="${request.key}"`)
        const getResult = await gateway.get(request.store, request.key!) as T
        logger.debug(`[DataBridge] query() gateway.get completed: found=${getResult != null}`)
        return getResult
      }
      case ENVELOPE_ACTION.queryList: {
        logger.debug(`[DataBridge] query() executing gateway.getAll: store="${request.store}"`)
        const listResult = await gateway.getAll(request.store) as T
        const listLength = Array.isArray(listResult) ? listResult.length : 'N/A'
        logger.debug(`[DataBridge] query() gateway.getAll completed: resultCount=${listLength}`)
        return listResult
      }
      case ENVELOPE_ACTION.queryByIndex: {
        assertQueryByIndexKey(request)
        const indexValueStr = typeof request.indexValue === 'string' ? request.indexValue : JSON.stringify(request.indexValue)
        logger.debug(`[DataBridge] query() executing gateway.queryByIndex: store="${request.store}", indexName="${request.indexName}", indexValue="${indexValueStr}"`)
        const indexResult = await gateway.queryByIndex(request.store, request.indexName!, request.indexValue as string) as T
        const indexListLength = Array.isArray(indexResult) ? indexResult.length : 'N/A'
        logger.debug(`[DataBridge] query() gateway.queryByIndex completed: resultCount=${indexListLength}`)
        return indexResult
      }
      default: {
        const unknownAction = request.action as string
        logger.error(`[DataBridge] query() unknown action: "${unknownAction}"`)
        throw new EnvelopeError(`Unknown query action: ${unknownAction}`)
      }
    }
  }



  /**
   * 清除指定 store 的缓存（按 store 名精确匹配，不再全量清空）。
   * 在写操作后调用，保证数据一致性。
   *
   * 缓存 Key 格式: `{action}:{store}[:key=...][:idx=...][:val=...]`
   * 匹配规则: 包含 `:{store}:`（store 作为中间段）或以 `:{store}` 结尾
   */
  invalidateCache(store: StoreName): void {
    const statsBefore = this.readCache.getStats()
    logger.info(`[DataBridge] invalidateCache() called: store="${store}", cacheSizeBefore=${statsBefore.size}, hitCount=${statsBefore.hitCount}, missCount=${statsBefore.missCount}`)
    const cleared = this.readCache.deleteByPrefix(`:${store}`)
    const statsAfter = this.readCache.getStats()
    logger.info(`[DataBridge] invalidateCache() completed: store="${store}", clearedEntries=${cleared}, cacheSizeAfter=${statsAfter.size}`)
  }

  /**
   * 清空全部读缓存（不区分 store）。
   * 用于测试隔离与手动全局重置；invalidateCache 已等价于全清，
   * 本方法提供语义化显式入口。
   */
  invalidateAll(): void {
    this.readCache.clear()
  }

  async exportAllData(source: ModuleId = 'system'): Promise<Record<string, unknown[]>> {
    const startTs = Date.now()
    logger.info(`[DataBridge] exportAllData() called: source="${source}"`)
    await this.waitForDbReady()

    const envelope = EnvelopeFactory.create(
      {
        source,
        target: ENVELOPE_TARGET.system,
        action: ENVELOPE_ACTION.exportAll,
        traceId: `export-${nanoid(8)}`,
      },
      {},
    )

    const operation = inferOperation(ENVELOPE_ACTION.exportAll)
    const targetStore = STORE_NAME.stocks
    const shouldContinue = await assertAclWithFallback(envelope, targetStore, operation)
    if (!shouldContinue) {
      throw new EnvelopeError('Export rejected by ACL')
    }

    this.writeAuditLog(envelope, targetStore).catch((err) => {
      logger.error(`[DataBridge] exportAll audit log failed`, { error: err })
    })

    const data = await gateway.exportData()
    const duration = Date.now() - startTs
    logger.info(`[DataBridge] exportAllData() completed: tables=${Object.keys(data).length}, duration=${duration}ms`)
    return data
  }

  async importAllData(data: Record<string, unknown[]>, source: ModuleId = 'system'): Promise<void> {
    const startTs = Date.now()
    const tableCount = Object.keys(data).length
    logger.info(`[DataBridge] importAllData() called: source="${source}", tables=${tableCount}`)
    await this.waitForDbReady()

    const envelope = EnvelopeFactory.create(
      {
        source,
        target: ENVELOPE_TARGET.system,
        action: ENVELOPE_ACTION.importAll,
        traceId: `import-${nanoid(8)}`,
      },
      data,
    )

    const operation = inferOperation(ENVELOPE_ACTION.importAll)
    const targetStore = STORE_NAME.stocks
    const shouldContinue = await assertAclWithFallback(envelope, targetStore, operation)
    if (!shouldContinue) {
      throw new EnvelopeError('Import rejected by ACL')
    }

    this.writeAuditLog(envelope, targetStore).catch((err) => {
      logger.error(`[DataBridge] importAll audit log failed`, { error: err })
    })

    await gateway.importData(data)
    this.invalidateAll()

    const duration = Date.now() - startTs
    logger.info(`[DataBridge] importAllData() completed: tables=${tableCount}, duration=${duration}ms`)
  }

  async resetAllData(source: ModuleId = 'system'): Promise<void> {
    const startTs = Date.now()
    logger.info(`[DataBridge] resetAllData() called: source="${source}"`)
    await this.waitForDbReady()

    const envelope = EnvelopeFactory.create(
      {
        source,
        target: ENVELOPE_TARGET.system,
        action: ENVELOPE_ACTION.resetAll,
        traceId: `reset-${nanoid(8)}`,
      },
      {},
    )

    const operation = inferOperation(ENVELOPE_ACTION.resetAll)
    const targetStore = STORE_NAME.stocks
    const shouldContinue = await assertAclWithFallback(envelope, targetStore, operation)
    if (!shouldContinue) {
      throw new EnvelopeError('Reset rejected by ACL')
    }

    this.writeAuditLog(envelope, targetStore).catch((err) => {
      logger.error(`[DataBridge] resetAll audit log failed`, { error: err })
    })

    await gateway.resetAll()
    this.invalidateAll()

    const duration = Date.now() - startTs
    logger.info(`[DataBridge] resetAllData() completed: duration=${duration}ms`)
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
    const now = Date.now()
    await gateway.put(STORE_NAME.researchLogs, {
      traceId: `query-${nanoid(8)}`,
      timestamp: now,
      actor: source,
      action: request.action,
      targetType: request.store,
      targetCode,
      payload: JSON.stringify({ indexName: request.indexName }),
      // P0-5: 补充 audit 审计元数据，对齐 writeAuditLog 结构
      audit: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        operator: source,
      },
    })
  }

  async forward(envelope: StandardEnvelope): Promise<void> {
    const startTs = Date.now()
    
    const payloadInfo = envelope.payload !== null && typeof envelope.payload === 'object'
      ? { keys: Object.keys(envelope.payload), type: Array.isArray(envelope.payload) ? 'array' : 'object' }
      : { keys: [], type: typeof envelope.payload }
    
    logger.info(
      `[DataBridge] forward() called: action="${envelope.meta.action}", source="${envelope.meta.source}", traceId="${envelope.meta.traceId}"\n` +
      `  目标: ${envelope.meta.target || 'N/A'}\n` +
      `  Payload 类型: ${payloadInfo.type}\n` +
      `  Payload 字段: ${payloadInfo.keys.length > 0 ? payloadInfo.keys.join(', ') : '(空)'}`
    )

    const validation = EnvelopeFactory.validate(envelope)
    if (!validation.valid) {
      logger.error(
        `[DataBridge] ❌ Envelope 验证失败: action="${envelope.meta.action}", traceId="${envelope.meta.traceId}"\n` +
        `  错误: ${validation.error}\n` +
        `  Meta: ${JSON.stringify(envelope.meta)}\n` +
        `  Payload: ${JSON.stringify(envelope.payload).slice(0, 300)}`
      )
      throw new EnvelopeError(`Invalid envelope: ${validation.error}`)
    }
    logger.debug(`[DataBridge] ✅ Envelope 验证通过: action="${envelope.meta.action}", target="${envelope.meta.target}"`)

    const { meta } = envelope
    const operation = inferOperation(meta.action)

    let targetStore: StoreName
    if (QUERY_ACTIONS.has(meta.action)) {
      const payloadStore = envelope.payload != null && typeof envelope.payload === 'object'
        && 'store' in envelope.payload
        ? (envelope.payload as Record<string, unknown>).store
        : undefined
      if (typeof payloadStore !== 'string' || payloadStore === '') {
        logger.error(
          `[DataBridge] ❌ Query 动作缺少 payload.store: action="${meta.action}", traceId="${meta.traceId}"\n` +
          `  Payload: ${JSON.stringify(envelope.payload)}`
        )
        throw new EnvelopeError(`Query action "${meta.action}" requires payload.store`)
      }
      targetStore = payloadStore as StoreName
    } else {
      targetStore = inferStore(meta.action)
    }

    logger.info(
      `[DataBridge] 路由确定: action="${meta.action}", targetStore="${targetStore}", operation="${operation}"\n` +
      `  Action 类型: ${STRATEGY_ACTIONS.has(meta.action) ? '策略' : QUERY_ACTIONS.has(meta.action) ? '查询' : EVENT_ACTIONS.has(meta.action) ? '事件' : 'DB操作'}`
    )

    const shouldContinue = await assertAclWithFallback(envelope, targetStore, operation)
    if (!shouldContinue) {
      logger.info(`[DataBridge] ACL 校验未通过，已降级处理: action="${meta.action}", traceId="${meta.traceId}"`)
      return
    }

    this.writeAuditLog(envelope, targetStore).catch((err) => {
      logger.error(`[DataBridge] 审计日志写入失败: action="${meta.action}", traceId="${meta.traceId}"`, { error: err })
    })

    try {
      await this.routeToAction(envelope, targetStore)
    } catch (err) {
      logger.error(
        `[DataBridge] ❌ forward() 失败: action="${meta.action}", traceId="${meta.traceId}", targetStore="${targetStore}"\n` +
        `  错误类型: ${err instanceof Error ? err.constructor.name : typeof err}\n` +
        `  错误信息: ${err instanceof Error ? err.message : String(err)}`,
        { error: err }
      )
      throw err
    } finally {
      const duration = Date.now() - startTs
      if (duration > FORWARD_SLOW_THRESHOLD_MS) {
        logger.warn(`[DataBridge] ⚠️ forward() 执行缓慢: action="${meta.action}", duration=${duration}ms`)
      }
      logger.info(`[DataBridge] ✅ forward() 完成: action="${meta.action}", duration=${duration}ms`)
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
    const callbacks = this.subscribers.get(channel)
    return callbacks ?? new Set<EnvelopeCallback>()
  }

  private extractSymbolFromPayload(payload: unknown): string | undefined {
    if (payload == null || typeof payload !== 'object') return undefined
    if ('symbol' in payload) {
      return String((payload as Record<string, unknown>).symbol)
    }
    if (!Array.isArray(payload) || payload.length === 0) return undefined
    const firstItem: unknown = payload[0]
    if (typeof firstItem === 'object' && firstItem != null && 'symbol' in firstItem) {
      const symbol = (firstItem as Record<string, unknown>).symbol
      return typeof symbol === 'string' ? symbol : undefined
    }
    return undefined
  }

  private async routeToQuery(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    // P1-16 Phase 1: 委托到 databridgeRouter.ts
    await routeToQueryFn(envelope, store, this, this.broadcast.bind(this))
  }

  private async routeToEvent(envelope: StandardEnvelope): Promise<void> {
    // P1-16 Phase 1: 委托到 databridgeRouter.ts
    routeToEventFn(envelope, this.broadcast.bind(this))
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
        await gateway.put(store, envelope.payload)
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
    // P1-16 Phase 1: 委托到 databridgeRouter.ts
    await routeToManagerFn(envelope)
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
    await gateway.put(STORE_NAME.researchLogs, {
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

      // 同步派发：方法签名为 void，调用方（含单测 V9-TEST-UT-011）期望同步按序送达。
      // 每个 subscriber 独立 try/catch 隔离，任一抛错不影响其余订阅者与后续 eventBus.emit。
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
