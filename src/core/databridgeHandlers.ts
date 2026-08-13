/**
 * @fileoverview DataBridge 信封处理器（策略模式实现）
 *
 * 从 databridge.ts 拆分而来，职责：
 * - 定义 EnvelopeHandler 接口
 * - 实现各 action 对应的 Handler 类（Put/Delete/InsertStock/UpdateStock/DeleteStock/Notification/LoadHoldingsData）
 * - 提供 HandlerRegistry 注册表与 createHandlerRegistry 工厂
 *
 * 设计原则：每个 Handler 仅依赖 db / logger / envelope，不依赖 DataBridge 主类内部状态，
 * 因此可独立测试与扩展。
  * @doc [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012, V9-DOC-PROJ-002]
*/
import { ENVELOPE_ACTION, STORE_NAME, type StoreName } from '@/config/dbConfig'
import { db, now } from '@/data/db'
import type { CustomAgent, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { EnvelopeError, type StandardEnvelope } from './envelope'
import { cascadeExecutor } from './cascadeExecutor'
import { CascadeError } from '@/types/modules/cascade.types'

const logger = getLogger()

/**
 * 信封处理器接口（策略模式）
 * 每个 action 对应一个 Handler，负责具体的数据库操作
 */
export interface EnvelopeHandler {
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
    const startTime = Date.now()

    // 对财务数据保存操作使用 info 级别日志，便于排查问题
    if (meta.action === ENVELOPE_ACTION.saveFinancialReport) {
      const report = payload as { symbol?: string; reportDate?: string; revenue?: number; netProfit?: number }
      logger.info(`[DataBridge] PutHandler 开始保存财务数据`, {
        action: meta.action,
        store,
        traceId: meta.traceId,
        symbol: report.symbol,
        reportDate: report.reportDate,
        revenue: report.revenue,
        netProfit: report.netProfit,
        fieldCount: Object.keys(payload as Record<string, unknown>).length,
      })
      await db.put(store, payload)
      const duration = Date.now() - startTime
      logger.info(`[DataBridge] PutHandler 财务数据保存完成`, {
        action: meta.action,
        store,
        traceId: meta.traceId,
        duration: `${duration}ms`,
      })
    } else {
      logger.debug(`[DataBridge] DB put: action="${meta.action}", store="${store}"`)
      await db.put(store, payload)
    }
  }
}

/**
 * 通用 DELETE 操作处理器
 *
 * 集成级联策略执行器（cascadeExecutor）：
 * - 删除前先执行级联策略（CASCADE/RESTRICT/SET_NULL/SOFT_DELETE）
 * - RESTRICT 策略阻止删除时，抛出 CascadeError，不执行 db.delete()
 * - CASCADE 策略先删除关联数据，再删除主实体
 *
 * @see src/core/cascadeExecutor.ts
 * @see src/core/cascadeExecutor.ts
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

    // 执行级联策略（RESTRICT 可能阻止删除）
    try {
      const result = await cascadeExecutor.execute(store, id)
      if (result.targets.length > 0) {
        logger.info('[DataBridge] DeleteHandler 级联策略执行完成', {
          action: meta.action,
          store,
          id,
          traceId: meta.traceId,
          cascadeTargets: result.targets.length,
          affectedTotal: result.targets.reduce((sum, t) => sum + t.affectedCount, 0),
        })
      }
    } catch (err) {
      if (err instanceof CascadeError) {
        logger.warn('[DataBridge] DeleteHandler 删除被级联策略阻止', {
          action: meta.action,
          store,
          id,
          traceId: meta.traceId,
          error: err.message,
        })
        throw new EnvelopeError(`删除被阻止: ${err.message} (traceId=${meta.traceId})`)
      }
      // 非 CascadeError 的其他错误，记录日志但不阻止删除（容错策略）
      logger.error('[DataBridge] DeleteHandler 级联执行异常（继续删除）', {
        action: meta.action,
        store,
        id,
        traceId: meta.traceId,
        error: err instanceof Error ? err.message : String(err),
      })
    }

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
    if (!stock.symbol || stock.symbol === '') {
      const traceId = envelope.meta.traceId
      throw new EnvelopeError(
        `insertStock Rejected: missing or empty "symbol" field (traceId=${traceId})`,
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
    const newDataVersion = existing.dataVersion + 1
    await db.put(store, { ...existing, ...update, updatedAt: Date.now(), dataVersion: newDataVersion })
  }
}

/**
 * 股票研究状态更新处理器
 * 更新 stocks 表的 researchStatus 字段
 */
class UpdateStockStatusHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.updateStockStatus
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { symbol, status } = envelope.payload as { symbol: string; status: string }
    logger.debug(`[DataBridge] DB updateStockStatus: symbol="${symbol}", status="${status}"`)
    const existing = await db.get<Stock>(store, symbol)
    if (!existing) {
      logger.warn(`[DataBridge] DB updateStockStatus failed: Stock not found "${symbol}"`)
      throw new EnvelopeError(`Stock not found: ${symbol}`)
    }
    const newDataVersion = (existing.dataVersion ?? 0) + 1
    await db.put(store, {
      ...existing,
      researchStatus: status,
      updatedAt: Date.now(),
      dataVersion: newDataVersion,
    })
  }
}

/**
 * 股票分组更新处理器
 * 更新 stocks 表的 group 字段
 */
class UpdateStockGroupHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.updateStockGroup
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { symbol, group } = envelope.payload as { symbol: string; group: string }
    logger.debug(`[DataBridge] DB updateStockGroup: symbol="${symbol}", group="${group}"`)
    const existing = await db.get<Stock>(store, symbol)
    if (!existing) {
      logger.warn(`[DataBridge] DB updateStockGroup failed: Stock not found "${symbol}"`)
      throw new EnvelopeError(`Stock not found: ${symbol}`)
    }
    const newDataVersion = (existing.dataVersion ?? 0) + 1
    await db.put(store, {
      ...existing,
      group,
      updatedAt: Date.now(),
      dataVersion: newDataVersion,
    })
  }
}

/**
 * 自定义智能体保存处理器
 * 在写入前自动补齐 createdAt / updatedAt 时间戳（兼容新增与更新）。
 */
class CustomAgentSaveHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.saveCustomAgent
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const agent = envelope.payload as Omit<CustomAgent, 'createdAt' | 'updatedAt'> & { createdAt?: number }
    const existing = await db.get<CustomAgent>(store, agent.id)
    const full: CustomAgent = {
      ...agent,
      createdAt: existing?.createdAt ?? agent.createdAt ?? now(),
      updatedAt: now(),
    }
    logger.debug(`[DataBridge] DB saveCustomAgent: id="${agent.id}"`)
    await db.put(store, full)
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

    // 2-4. 级联删除关联表
    await this.deleteSymbolKeyRecords(symbol)
    await this.deleteIndexedRecords(symbol)
    await this.deleteScannedRecords(symbol)

    logger.info(`[DataBridge] DB deleteStock 完成: symbol="${symbol}" — 级联删除结束`)
  }

  private async deleteSymbolKeyRecords(symbol: string): Promise<void> {
    const stores = [
      STORE_NAME.v6Scores,
      STORE_NAME.dailyQuotes,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
      STORE_NAME.financialReports,
    ]
    for (const s of stores) {
      try {
        await db.delete(s, symbol)
        logger.debug(`[DataBridge] 级联删除: ${s} symbol="${symbol}"`)
      } catch (err) {
        logger.warn(`[DataBridge] 级联删除失败(主键): ${s}`, { error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  private async deleteIndexedRecords(symbol: string): Promise<void> {
    const stores = [
      STORE_NAME.intelligentScores,
      STORE_NAME.scoreDocs,
      STORE_NAME.localDocs,
      STORE_NAME.newsStockMap,
      STORE_NAME.executionPlans,
      STORE_NAME.executionLogs,
      STORE_NAME.missingReports,
      STORE_NAME.profileItems,
      STORE_NAME.scoreEvidence,
      STORE_NAME.traceRecords,
      STORE_NAME.analysisResults,
      STORE_NAME.conflictLog,
    ]
    for (const s of stores) {
      await this.deleteBySymbolIndex(s, symbol)
    }
  }

  /** 按 by-symbol 索引级联删除某标的记录，单 store 失败不影响其他 store */
  private async deleteBySymbolIndex(store: StoreName, symbol: string): Promise<void> {
    try {
      const records = await db.getAllByIndex<{ id: string; symbol?: string }>(store, 'by-symbol', symbol)
      const ids = records.map((r) => r.id).filter((id): id is string => Boolean(id))
      for (const id of ids) {
        await db.delete(store, id)
      }
      if (ids.length > 0) {
        logger.debug(`[DataBridge] 级联删除(索引): ${store} count=${ids.length}`)
      }
    } catch (err) {
      logger.warn(`[DataBridge] 级联删除失败(索引): ${store}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private async deleteScannedRecords(symbol: string): Promise<void> {
    const stores = [STORE_NAME.orders, STORE_NAME.signals, STORE_NAME.watchlists, STORE_NAME.researchLogs, STORE_NAME.tradeReviews]
    for (const s of stores) {
      await this.deleteBySymbolScan(s, symbol)
    }
  }

  /** 全表扫描按 symbol 匹配后级联删除，单 store 失败不影响其他 store */
  private async deleteBySymbolScan(store: StoreName, symbol: string): Promise<void> {
    try {
      const allRecords = await db.getAll<{ id: string; symbol?: string }>(store)
      const toDelete = allRecords.filter((r) => r.symbol === symbol && Boolean(r.id))
      for (const rec of toDelete) {
        await db.delete(store, rec.id)
      }
      if (toDelete.length > 0) {
        logger.debug(`[DataBridge] 级联删除(扫描): ${store} count=${toDelete.length}`)
      }
    } catch (err) {
      logger.warn(`[DataBridge] 级联删除失败(扫描): ${store}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * 执行计划删除处理器（级联删除关联的执行日志）
 */
class DeleteExecutionPlanHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.deleteExecutionPlan
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { id } = envelope.payload as { id: string }
    logger.info(`[DataBridge] DB deleteExecutionPlan: id="${id}" — 开始级联删除`)

    await db.delete(store, id)

    try {
      const logs = await db.getAllByIndex<{ id: string }>(STORE_NAME.executionLogs, 'by-plan', id)
      for (const log of logs) {
        await db.delete(STORE_NAME.executionLogs, log.id)
      }
      if (logs.length > 0) {
        logger.debug(`[DataBridge] 级联删除: executionLogs by-plan="${id}" count=${logs.length}`)
      }
    } catch (err) {
      logger.warn(`[DataBridge] 级联删除失败: executionLogs by-plan="${id}"`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    logger.info(`[DataBridge] DB deleteExecutionPlan 完成: id="${id}" — 级联删除结束`)
  }
}

/**
 * 工作流定义删除处理器（级联删除调度、触发器、运行实例）
 */
class DeleteWorkflowDefHandler implements EnvelopeHandler {
  canHandle(action: string): boolean {
    return action === ENVELOPE_ACTION.deleteWorkflowDef
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { id } = envelope.payload as { id: string }
    logger.info(`[DataBridge] DB deleteWorkflowDef: id="${id}" — 开始级联删除`)

    await db.delete(store, id)

    const childStores = [
      { store: STORE_NAME.workflowSchedules, index: 'by-workflow-id', keyField: 'id' },
      { store: STORE_NAME.workflowTriggers, index: 'by-workflow-id', keyField: 'id' },
      { store: STORE_NAME.workflowRuns, index: 'by-workflow-id', keyField: 'runId' },
    ]

    for (const child of childStores) {
      try {
        const records = await db.getAllByIndex<Record<string, unknown>>(child.store, child.index, id)
        for (const rec of records) {
          const key = rec[child.keyField]
          if (typeof key === 'string') {
            await db.delete(child.store, key)
          }
        }
        if (records.length > 0) {
          logger.debug(`[DataBridge] 级联删除: ${child.store} by-workflow-id="${id}" count=${records.length}`)
        }
      } catch (err) {
        logger.warn(`[DataBridge] 级联删除失败: ${child.store} by-workflow-id="${id}"`, {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info(`[DataBridge] DB deleteWorkflowDef 完成: id="${id}" — 级联删除结束`)
  }
}

/**
 * 批量操作处理器
 * 使用 IndexedDB 事务进行批量写入，提升性能
 */
class BulkHandler implements EnvelopeHandler {
  private readonly actions: string[]

  constructor(actions: string[]) {
    this.actions = actions
  }

  canHandle(action: string): boolean {
    return this.actions.includes(action)
  }

  async handle(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { meta, payload } = envelope
    const items = payload as unknown[]

    if (!Array.isArray(items)) {
      throw new EnvelopeError(`Bulk operation requires array payload: ${meta.action}`)
    }

    if (items.length === 0) {
      logger.debug(`[DataBridge] BulkHandler: empty array, skipping: action="${meta.action}", store="${store}"`)
      return
    }

    logger.info(`[DataBridge] BulkHandler 开始批量写入`, {
      action: meta.action,
      store,
      traceId: meta.traceId,
      count: items.length,
    })

    const startTime = Date.now()

    try {
      await db.withTransaction([store], 'readwrite', (tx) => {
        const objectStore = tx.objectStore(store)
        for (const item of items) {
          objectStore.put(item)
        }
      })

      const duration = Date.now() - startTime
      logger.info(`[DataBridge] BulkHandler 批量写入完成`, {
        action: meta.action,
        store,
        traceId: meta.traceId,
        count: items.length,
        duration: `${duration}ms`,
        avgPerItem: `${(duration / items.length).toFixed(2)}ms`,
      })
    } catch (err) {
      logger.error(`[DataBridge] BulkHandler 批量写入失败`, {
        action: meta.action,
        store,
        traceId: meta.traceId,
        count: items.length,
        error: err instanceof Error ? err.message : String(err),
      })
      throw new EnvelopeError(`Bulk operation failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

/**
 * 信封处理器注册表
 * 按优先级顺序管理所有 Handler
 */
export class HandlerRegistry {
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
export function createHandlerRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry()

  // 1. 特殊处理器（优先级高）
  registry.register(new InsertStockHandler())
  registry.register(new UpdateStockHandler())
  registry.register(new DeleteStockHandler())

  // 1.5 股票状态/分组更新处理器
  registry.register(new UpdateStockStatusHandler())
  registry.register(new UpdateStockGroupHandler())

  // 2.6 批量操作处理器
  registry.register(
    new BulkHandler([
      ENVELOPE_ACTION.bulkInsertStock,
      ENVELOPE_ACTION.bulkSaveDailyQuotes,
      ENVELOPE_ACTION.bulkSaveScores,
      ENVELOPE_ACTION.bulkSaveFinancialReports,
      ENVELOPE_ACTION.bulkSaveNews,
      // 八域资料体系（v32 新增，ADR-010）
      ENVELOPE_ACTION.bulkSaveProfileItems,
      ENVELOPE_ACTION.bulkSaveScoreEvidence,
    ])
  )

  // 3. DELETE 操作处理器
  registry.register(
    new DeleteHandler([
      ENVELOPE_ACTION.deleteCustomAgent,
      // v32: 补全未注册的 DELETE action（原 fallback 裸 put，无级联校验）
      ENVELOPE_ACTION.deleteOrder,
      ENVELOPE_ACTION.deleteCollectConfig,
      ENVELOPE_ACTION.deleteRbacAuditLog,
      ENVELOPE_ACTION.deleteWorkflowSchedule,
      ENVELOPE_ACTION.deleteWorkflowTrigger,
      ENVELOPE_ACTION.deleteCollectionHistory,
      ENVELOPE_ACTION.deleteScheduleConfig,
      // 八域资料体系（v32 新增，ADR-010）
      ENVELOPE_ACTION.deleteProfileItem,
      ENVELOPE_ACTION.deleteScoreEvidence,
      ENVELOPE_ACTION.deleteProfileTag,
    ])
  )

  // 3.1 级联删除处理器（P1-M3 新增）
  registry.register(new DeleteExecutionPlanHandler())
  registry.register(new DeleteWorkflowDefHandler())

  // 3.5 自定义智能体保存处理器（补齐时间戳）
  registry.register(new CustomAgentSaveHandler())

  // 4. 通用 PUT 操作处理器（处理所有简单的 db.put() 操作）
  registry.register(
    new PutHandler([
      ENVELOPE_ACTION.saveScores,
      ENVELOPE_ACTION.saveDailyQuotes,
      ENVELOPE_ACTION.saveFinancialReport,
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
      ENVELOPE_ACTION.saveWatchlist,
      ENVELOPE_ACTION.saveCollectConfig,
      ENVELOPE_ACTION.saveTraceRecord,
      // v32: 补全未注册的 PUT action（原 fallback 裸 put，无 handler 校验）
      // RBAC 6 表写入
      ENVELOPE_ACTION.saveRbacUser,
      ENVELOPE_ACTION.saveRbacRole,
      ENVELOPE_ACTION.saveRbacPermission,
      ENVELOPE_ACTION.saveRbacUserRole,
      ENVELOPE_ACTION.saveRbacRolePermission,
      ENVELOPE_ACTION.saveRbacAuditLog,
      // Workflow 存储写入
      ENVELOPE_ACTION.saveWorkflowDef,
      ENVELOPE_ACTION.saveWorkflowSchedule,
      ENVELOPE_ACTION.saveWorkflowTrigger,
      ENVELOPE_ACTION.saveWorkflowRun,
      // 数据网关补全映射
      ENVELOPE_ACTION.saveCollectionHistory,
      ENVELOPE_ACTION.saveConflictLog,
      ENVELOPE_ACTION.saveFileImportRecord,
      ENVELOPE_ACTION.saveScheduleConfig,
      ENVELOPE_ACTION.saveProofreadReport,
      ENVELOPE_ACTION.saveAnalysisResult,
      // 八域资料体系（v32 新增，ADR-010）
      ENVELOPE_ACTION.saveProfileItem,
      ENVELOPE_ACTION.saveScoreEvidence,
      ENVELOPE_ACTION.saveStockProfile,
      ENVELOPE_ACTION.saveProfileTag,
      // Notification 类 action：数据加载/事件触发时缓存到对应 store
      ENVELOPE_ACTION.newsArticleLoaded,
      ENVELOPE_ACTION.holdingsDataLoaded,
      ENVELOPE_ACTION.tradeActionExecuted,
      ENVELOPE_ACTION.loadHoldingsData,
    ])
  )

  return registry
}
