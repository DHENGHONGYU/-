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
 */
import { ENVELOPE_ACTION, STORE_NAME, type StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import type { Stock } from '@/data/types'
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
    } else {
      logger.debug(`[DataBridge] DB put: action="${meta.action}", store="${store}"`)
    }

    await db.put(store, payload)

    if (meta.action === ENVELOPE_ACTION.saveFinancialReport) {
      const duration = Date.now() - startTime
      logger.info(`[DataBridge] PutHandler 财务数据保存完成`, {
        action: meta.action,
        store,
        traceId: meta.traceId,
        duration: `${duration}ms`,
      })
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
 * @see src/config/cascadeConfig.ts
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

  async handle(envelope: StandardEnvelope, _store: StoreName): Promise<void> {
    const { meta } = envelope
    logger.info(`[DataBridge] Notification-only action, skip DB put: action="${meta.action}"`)
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
      await db.withTransaction([store], 'readwrite', async (tx) => {
        const objectStore = tx.objectStore(store)
        for (const item of items) {
          await objectStore.put(item)
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

  async handle(envelope: StandardEnvelope, _store: StoreName): Promise<void> {
    const { meta, payload } = envelope
    logger.info('[DataBridge] loadHoldingsData: query-only action, skip DB put', {
      traceId: meta.traceId,
      source: meta.source,
      payloadKeys: payload != null ? Object.keys(payload) : [],
    })
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

  // 2.6 批量操作处理器
  registry.register(
    new BulkHandler([
      ENVELOPE_ACTION.bulkInsertStock,
      ENVELOPE_ACTION.bulkSaveDailyQuotes,
      ENVELOPE_ACTION.bulkSaveScores,
      ENVELOPE_ACTION.bulkSaveFinancialReports,
      ENVELOPE_ACTION.bulkSaveNews,
    ])
  )

  // 3. DELETE 操作处理器
  registry.register(new DeleteHandler([ENVELOPE_ACTION.deleteExecutionPlan]))

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
    ])
  )

  return registry
}
