import { ENVELOPE_ACTION, STORE_NAME, type EnvelopeTarget, type ModuleId, type StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import type {
  DailyQuotes,
  HotSectorScore,
  IndustryScore,
  IntelligentScore,
  LocalDoc,
  NewsArticle,
  NewsStockMap,
  Order,
  ResearchLog,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Signal,
  Stock,
  StrategySnapshot,
  ValuePitScore,
  V6Score,
} from '@/data/types'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { analyze as analyzeHotSector, type HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import { detect as detectRotation, type RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import { analyze as analyzeValuePit, type ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { aclEngine, inferOperation } from './acl'
import { EnvelopeError, EnvelopeFactory, type StandardEnvelope } from './envelope'
import { fallbackQueue, FallbackQueue } from './fallbackQueue'

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

function inferStore(action: string): StoreName {
  if (action.includes('NEWS_STOCK_MAP')) return STORE_NAME.newsStockMap
  if (action.includes('STOCK')) return STORE_NAME.stocks
  if (action.includes('DAILY_QUOTES')) return STORE_NAME.dailyQuotes
  if (action.includes('INDUSTRY')) return STORE_NAME.industryScores
  if (action.includes('INTELLIGENT')) return STORE_NAME.intelligentScores
  if (action.includes('ROTATION')) return STORE_NAME.rotationScores
  if (action.includes('HOT_SECTOR_SCORE')) return STORE_NAME.hotSectorScores
  if (action.includes('VALUE_PIT_SCORE')) return STORE_NAME.valuePitScores
  if (action.includes('SECTOR_SCORE')) return STORE_NAME.sectorScores
  if (action.includes('SCORE_DOCS')) return STORE_NAME.scoreDocs
  if (action.includes('STRATEGY_SNAPSHOTS')) return STORE_NAME.strategySnapshots
  if (action.includes('LOCAL_DOCS')) return STORE_NAME.localDocs
  if (action.includes('NEWS')) return STORE_NAME.news
  if (action.includes('SENTIMENT_CACHE')) return STORE_NAME.sentimentCache
  if (action.includes('RESEARCH_LOG')) return STORE_NAME.researchLogs
  if (action.includes('SCORE')) return STORE_NAME.v6Scores
  if (action.includes('ORDER')) return STORE_NAME.orders
  if (action.includes('WATCHLIST')) return STORE_NAME.watchlists
  if (action.includes('SIGNAL')) return STORE_NAME.signals
  return STORE_NAME.stocks
}

export class DataBridge {
  private subscribers = new Map<string, Set<EnvelopeCallback>>()
  private fallbackQueue: FallbackQueue = fallbackQueue

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
    const { meta, payload } = envelope
    logger.debug(`[DataBridge] routeToDB() called: action="${meta.action}", store="${store}"`)

    try {
      switch (meta.action) {
        case ENVELOPE_ACTION.insertStock: {
          const stock = payload as Stock
          logger.debug(`[DataBridge] DB insertStock: symbol="${stock.symbol}"`)
          await db.put(store, stock)
          break
        }
        case ENVELOPE_ACTION.updateStock: {
          const update = payload as Partial<Stock> & { symbol: string }
          logger.debug(`[DataBridge] DB updateStock: symbol="${update.symbol}"`)
          const existing = await db.get<Stock>(store, update.symbol)
          if (!existing) {
            logger.warn(`[DataBridge] DB updateStock failed: Stock not found "${update.symbol}"`)
            throw new EnvelopeError(`Stock not found: ${update.symbol}`)
          }
          await db.put(store, { ...existing, ...update, updatedAt: Date.now(), dataVersion: (existing.dataVersion ?? 1) + 1 })
          break
        }
        case ENVELOPE_ACTION.deleteStock: {
          const { symbol } = payload as { symbol: string }
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
          break
        }
        case ENVELOPE_ACTION.saveScores: {
          const score = payload as V6Score
          logger.debug(`[DataBridge] DB saveScores: symbol="${score.symbol}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveDailyQuotes: {
          const quotes = payload as DailyQuotes
          logger.debug(`[DataBridge] DB saveDailyQuotes: symbol="${quotes.symbol}"`)
          await db.put(store, quotes)
          break
        }
        case ENVELOPE_ACTION.saveIntelligentScores: {
          const score = payload as IntelligentScore
          logger.debug(`[DataBridge] DB saveIntelligentScores: symbol="${score.symbol}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveIndustryScores: {
          const score = payload as IndustryScore
          logger.debug(`[DataBridge] DB saveIndustryScores: code="${score.code}", name="${score.name}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveRotationScores: {
          const score = payload as RotationSectorScore
          logger.debug(`[DataBridge] DB saveRotationScores: sectorCode="${score.sectorCode}", sectorName="${score.sectorName}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveSectorScores: {
          const score = payload as SectorScoreRecord
          logger.debug(`[DataBridge] DB saveSectorScores: sectorCode="${score.sectorCode}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveScoreDocs: {
          const doc = payload as ScoreDocVersion
          logger.debug(`[DataBridge] DB saveScoreDocs: docId="${doc.docId}"`)
          await db.put(store, doc)
          break
        }
        case ENVELOPE_ACTION.saveStrategySnapshots: {
          const snapshot = payload as StrategySnapshot
          logger.debug(`[DataBridge] DB saveStrategySnapshots: id="${snapshot.id}", version=${snapshot.version}`)
          await db.put(store, snapshot)
          break
        }
        case ENVELOPE_ACTION.saveHotSectorScores: {
          const score = payload as HotSectorScore
          logger.debug(`[DataBridge] DB saveHotSectorScores: symbol="${score.symbol}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveValuePitScores: {
          const score = payload as ValuePitScore
          logger.debug(`[DataBridge] DB saveValuePitScores: symbol="${score.symbol}"`)
          await db.put(store, score)
          break
        }
        case ENVELOPE_ACTION.saveLocalDocs: {
          const doc = payload as LocalDoc
          logger.debug(`[DataBridge] DB saveLocalDocs: docId="${doc.id}"`)
          await db.put(store, doc)
          break
        }
        case ENVELOPE_ACTION.saveNews: {
          const article = payload as NewsArticle
          logger.debug(`[DataBridge] DB saveNews: articleId="${article.id}"`)
          await db.put(store, article)
          break
        }
        case ENVELOPE_ACTION.saveNewsStockMap: {
          const mapping = payload as NewsStockMap
          logger.debug(`[DataBridge] DB saveNewsStockMap: newsId="${mapping.newsId}", symbol="${mapping.symbol}"`)
          await db.put(store, mapping)
          break
        }
        case ENVELOPE_ACTION.saveSentimentCache: {
          const cache = payload as SentimentCache
          logger.debug(`[DataBridge] DB saveSentimentCache: contentHash="${cache.contentHash}"`)
          await db.put(store, cache)
          break
        }
        case ENVELOPE_ACTION.saveResearchLog: {
          const log = payload as ResearchLog
          logger.debug(`[DataBridge] DB saveResearchLog: action="${log.action}"`)
          await db.put(store, log)
          break
        }
        case ENVELOPE_ACTION.insertOrder: {
          const order = payload as Order
          logger.debug(`[DataBridge] DB insertOrder: id="${order.id}", symbol="${order.symbol}"`)
          await db.put(store, order)
          break
        }
        case ENVELOPE_ACTION.insertSignal: {
          const signal = payload as Signal
          logger.debug(`[DataBridge] DB insertSignal: id="${signal.id}", symbol="${signal.symbol}"`)
          await db.put(store, signal)
          break
        }
        // 通知类 action：仅用于可观测性，payload 是统计信息而非业务实体，不应持久化
        case ENVELOPE_ACTION.newsArticleLoaded:
        case ENVELOPE_ACTION.holdingsDataLoaded:
        case ENVELOPE_ACTION.tradeActionExecuted: {
          logger.info(`[DataBridge] Notification-only action, skip DB put: action="${meta.action}"`)
          break
        }
        case ENVELOPE_ACTION.saveTradeReview: {
          logger.info(`[DataBridge] Saving trade review report`)
          await db.put(store, payload)
          break
        }
        default: {
          logger.warn(`[DataBridge] Unknown action routed to DB default put: action="${meta.action}", store="${store}"`)
          await db.put(store, payload)
        }
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
                `marketEnv=${score.dimensions.marketEnv.toFixed(2)} ` +
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
            eventBus.emit('strategy:hotSectorChanged', scores)
            logger.info(`[DataBridge] HotSector: EventBus emit "strategy:hotSectorChanged" 完成, payload.length=${scores.length}`)
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
            eventBus.emit('strategy:valuePitChanged', scores)
            logger.info(`[DataBridge] ValuePit: EventBus emit "strategy:valuePitChanged" 完成, payload.length=${scores.length}`)
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
            eventBus.emit('strategy:rotationSignalTriggered', signals)
            logger.info(`[DataBridge] RotationSignal: EventBus emit "strategy:rotationSignalTriggered" 完成, payload.length=${signals.length}`)
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

    logger.debug(`[DataBridge] Emitting eventBus: "${channel}:changed"`)
    try {
      eventBus.emit(`${channel}:changed`, envelope)
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
