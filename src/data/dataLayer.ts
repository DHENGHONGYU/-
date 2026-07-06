import {
  DATA_SOURCE,
  DEFAULT_POOL_GROUP,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  RESEARCH_STATUS,
  STORE_NAME,
  type StoreName,
  type ResearchStatus,
} from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { db, generateId, now } from './db'
import type {
  DailyQuotes,
  DataLayerResult,
  ExecutionPlan,
  ExecutionLog,
  HotSectorScore,
  IndustryScore,
  IntelligentScore,
  LocalDoc,
  MissingReport,
  NewsArticle,
  NewsStockMap,
  Order,
  Portfolio,
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
} from './types'
import type { TradeReviewRecord } from '@/services/trading/tradeReviewAI'

const logger = getLogger()

function createTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function sendWriteEnvelope<T>(
  action: keyof typeof ENVELOPE_ACTION,
  payload: unknown,
  source: keyof typeof MODULE_ID = 'system',
): Promise<DataLayerResult<T>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID[source],
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION[action],
        traceId: createTraceId('dl'),
      },
      payload,
    )
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('DataBridge.forward failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * 查询单条记录（通过主键）
 */
async function queryGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const result = await dataBridge.query<T>({
    action: ENVELOPE_ACTION.queryGet,
    store,
    key,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryGet failed: store="${store}", key="${key}"`, { error: result.error })
    return undefined
  }
  return result.data
}

/**
 * 查询全部记录
 */
async function queryList<T>(store: StoreName): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryList,
    store,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryList failed: store="${store}"`, { error: result.error })
    return []
  }
  return result.data ?? []
}

/**
 * 按索引查询记录
 */
async function queryByIndex<T>(store: StoreName, indexName: string, indexValue: unknown): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store,
    indexName,
    indexValue,
    source: MODULE_ID.datalayer,
  })
  if (!result.success) {
    logger.error(`[dataLayer] queryByIndex failed: store="${store}", index="${indexName}"`, { error: result.error })
    return []
  }
  return result.data ?? []
}

export const stockStore = {
  async add(stock: Omit<Stock, 'createdAt' | 'updatedAt' | 'dataVersion'>): Promise<DataLayerResult<Stock>> {
    const existing = await queryGet<Stock>(STORE_NAME.stocks, stock.symbol)
    if (existing) {
      return { success: false, error: `${stock.name}(${stock.symbol}) 已存在` }
    }

    const fullStock: Stock = {
      ...stock,
      researchStatus: stock.researchStatus ?? RESEARCH_STATUS.candidate,
      source: stock.source ?? DATA_SOURCE.manual,
      group: stock.group ?? DEFAULT_POOL_GROUP,
      dataVersion: 1,
      ingestedAt: now(),
      updatedAt: now(),
    }

    const result = await sendWriteEnvelope<Stock>('insertStock', fullStock, 'stockpool')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: fullStock }
  },

  async get(symbol: string): Promise<Stock | undefined> {
    return queryGet<Stock>(STORE_NAME.stocks, symbol)
  },

  async list(): Promise<Stock[]> {
    return queryList<Stock>(STORE_NAME.stocks)
  },

  async listByStatus(status: ResearchStatus): Promise<Stock[]> {
    return queryByIndex<Stock>(STORE_NAME.stocks, 'by-status', status)
  },

  async listByGroup(group: string): Promise<Stock[]> {
    return queryByIndex<Stock>(STORE_NAME.stocks, 'by-group', group)
  },

  async listGroups(): Promise<string[]> {
    const all = await queryList<Stock>(STORE_NAME.stocks)
    const groups = new Set<string>()
    for (const stock of all) {
      groups.add(stock.group ?? DEFAULT_POOL_GROUP)
    }
    groups.add(DEFAULT_POOL_GROUP)
    return Array.from(groups).sort()
  },

  async updateStatus(symbol: string, status: ResearchStatus): Promise<DataLayerResult<void>> {
    const existing = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!existing) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    return sendWriteEnvelope(
      'updateStock',
      { symbol, researchStatus: status, updatedAt: now() },
      'stockpool',
    )
  },

  async updateGroup(symbol: string, group: string): Promise<DataLayerResult<Stock>> {
    const normalized = group.trim()
    if (!normalized) {
      return { success: false, error: '分组名称不能为空' }
    }

    const existing = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!existing) {
      return { success: false, error: `Stock not found: ${symbol}` }
    }

    const result = await sendWriteEnvelope<Stock>(
      'updateStock',
      { symbol, group: normalized, updatedAt: now() },
      'stockpool',
    )
    if (!result.success) {
      return { success: false, error: result.error }
    }

    const updated = await queryGet<Stock>(STORE_NAME.stocks, symbol)
    if (!updated) {
      return { success: false, error: `更新分组后未找到股票: ${symbol}` }
    }
    return { success: true, data: updated }
  },

  async remove(symbol: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteStock', { symbol }, 'stockpool')
  },
}

export const dailyQuoteStore = {
  async save(quotes: DailyQuotes): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveDailyQuotes', quotes, 'fetcher')
  },

  async get(symbol: string): Promise<DailyQuotes | undefined> {
    return queryGet<DailyQuotes>(STORE_NAME.dailyQuotes, symbol)
  },
}

export const v6ScoreStore = {
  async save(score: V6Score): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<V6Score | undefined> {
    return queryGet<V6Score>(STORE_NAME.v6Scores, symbol)
  },

  async list(): Promise<V6Score[]> {
    return queryList<V6Score>(STORE_NAME.v6Scores)
  },
}

export const intelligentScoreStore = {
  async save(score: IntelligentScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIntelligentScores', score, 'analyzer')
  },

  async listBySymbol(symbol: string): Promise<IntelligentScore[]> {
    return queryByIndex<IntelligentScore>(STORE_NAME.intelligentScores, 'by-symbol', symbol)
  },

  async getLatestBySymbol(symbol: string): Promise<IntelligentScore | undefined> {
    const list = await this.listBySymbol(symbol)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IntelligentScore[]> {
    return queryList<IntelligentScore>(STORE_NAME.intelligentScores)
  },
}

export const industryScoreStore = {
  async save(score: IndustryScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIndustryScores', score, 'analyzer')
  },

  async listByCode(code: string): Promise<IndustryScore[]> {
    return queryByIndex<IndustryScore>(STORE_NAME.industryScores, 'by-code', code)
  },

  async getLatestByCode(code: string): Promise<IndustryScore | undefined> {
    const list = await this.listByCode(code)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IndustryScore[]> {
    return queryList<IndustryScore>(STORE_NAME.industryScores)
  },
}

export const researchLogStore = {
  async list(): Promise<ResearchLog[]> {
    return queryList<ResearchLog>(STORE_NAME.researchLogs)
  },
}

export const orderStore = {
  async add(order: Omit<Order, 'id' | 'createdAt'>): Promise<DataLayerResult<Order>> {
    const fullOrder: Order = {
      ...order,
      id: generateId(),
      createdAt: now(),
    }
    const result = await sendWriteEnvelope<Order>('insertOrder', fullOrder, 'tradinghub')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: fullOrder }
  },

  async list(): Promise<Order[]> {
    return queryList<Order>(STORE_NAME.orders)
  },
}

export const signalStore = {
  async save(signal: Signal): Promise<DataLayerResult<Signal>> {
    const result = await sendWriteEnvelope<Signal>('insertSignal', signal, 'tradinghub')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: signal }
  },

  async list(): Promise<Signal[]> {
    return queryList<Signal>(STORE_NAME.signals)
  },

  async listBySymbol(symbol: string): Promise<Signal[]> {
    const all = await queryList<Signal>(STORE_NAME.signals)
    return all.filter((s) => s.symbol === symbol)
  },
}

export const rotationScoreStore = {
  async save(score: RotationSectorScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveRotationScores', score, 'rotation')
  },

  async get(id: string): Promise<RotationSectorScore | undefined> {
    return queryGet<RotationSectorScore>(STORE_NAME.rotationScores, id)
  },

  async list(): Promise<RotationSectorScore[]> {
    return queryList<RotationSectorScore>(STORE_NAME.rotationScores)
  },

  async listBySector(sectorCode: string): Promise<RotationSectorScore[]> {
    return queryByIndex<RotationSectorScore>(STORE_NAME.rotationScores, 'by-sector', sectorCode)
  },

  async getLatestBySector(sectorCode: string): Promise<RotationSectorScore | undefined> {
    const list = await this.listBySector(sectorCode)
    return list.sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
  },
}

export const hotSectorScoreStore = {
  async save(score: HotSectorScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveHotSectorScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<HotSectorScore | undefined> {
    return queryGet<HotSectorScore>(STORE_NAME.hotSectorScores, symbol)
  },

  async list(): Promise<HotSectorScore[]> {
    return queryList<HotSectorScore>(STORE_NAME.hotSectorScores)
  },
}

export const valuePitScoreStore = {
  async save(score: ValuePitScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveValuePitScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<ValuePitScore | undefined> {
    return queryGet<ValuePitScore>(STORE_NAME.valuePitScores, symbol)
  },

  async list(): Promise<ValuePitScore[]> {
    return queryList<ValuePitScore>(STORE_NAME.valuePitScores)
  },
}

export const sectorScoreStore = {
  async save(score: SectorScoreRecord): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSectorScores', score, 'sector')
  },

  async get(id: string): Promise<SectorScoreRecord | undefined> {
    return queryGet<SectorScoreRecord>(STORE_NAME.sectorScores, id)
  },

  async list(): Promise<SectorScoreRecord[]> {
    return queryList<SectorScoreRecord>(STORE_NAME.sectorScores)
  },

  async listBySector(sectorCode: string): Promise<SectorScoreRecord[]> {
    return queryByIndex<SectorScoreRecord>(STORE_NAME.sectorScores, 'by-sector', sectorCode)
  },

  async getLatestBySector(sectorCode: string): Promise<SectorScoreRecord | undefined> {
    const list = await this.listBySector(sectorCode)
    return list.sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
  },
}

export const scoreDocStore = {
  async save(doc: ScoreDocVersion): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScoreDocs', doc, 'analyzer')
  },

  async get(docId: string): Promise<ScoreDocVersion | undefined> {
    return queryGet<ScoreDocVersion>(STORE_NAME.scoreDocs, docId)
  },

  async list(): Promise<ScoreDocVersion[]> {
    return queryList<ScoreDocVersion>(STORE_NAME.scoreDocs)
  },

  async listBySymbol(symbol: string): Promise<ScoreDocVersion[]> {
    return queryByIndex<ScoreDocVersion>(STORE_NAME.scoreDocs, 'by-symbol', symbol)
  },

  async getLatestBySymbol(symbol: string): Promise<ScoreDocVersion | undefined> {
    const list = await this.listBySymbol(symbol)
    return list.sort((a, b) => b.version - a.version)[0]
  },
}

export const strategySnapshotStore = {
  async save(snapshot: StrategySnapshot): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveStrategySnapshots', snapshot, 'tradinghub')
  },

  async get(id: string): Promise<StrategySnapshot | undefined> {
    return queryGet<StrategySnapshot>(STORE_NAME.strategySnapshots, id)
  },

  async list(): Promise<StrategySnapshot[]> {
    return queryList<StrategySnapshot>(STORE_NAME.strategySnapshots)
  },

  async getLatest(): Promise<StrategySnapshot | undefined> {
    const list = await this.list()
    return list.sort((a, b) => b.timestamp - a.timestamp)[0]
  },
}

export const localDocStore = {
  async save(doc: LocalDoc): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveLocalDocs', doc, 'system')
  },

  async get(id: string): Promise<LocalDoc | undefined> {
    return queryGet<LocalDoc>(STORE_NAME.localDocs, id)
  },

  async list(): Promise<LocalDoc[]> {
    return queryList<LocalDoc>(STORE_NAME.localDocs)
  },

  async listBySymbol(symbol: string): Promise<LocalDoc[]> {
    return queryByIndex<LocalDoc>(STORE_NAME.localDocs, 'by-symbol', symbol)
  },
}

export const newsStore = {
  async save(article: NewsArticle): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNews', article, 'news')
  },

  async get(id: string): Promise<NewsArticle | undefined> {
    return queryGet<NewsArticle>(STORE_NAME.news, id)
  },

  async getByHash(hash: string): Promise<NewsArticle | undefined> {
    const list = await queryByIndex<NewsArticle>(STORE_NAME.news, 'by-hash', hash)
    return list[0]
  },

  async list(): Promise<NewsArticle[]> {
    return queryList<NewsArticle>(STORE_NAME.news)
  },
}

export const newsStockMapStore = {
  async save(mapping: NewsStockMap): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNewsStockMap', mapping, 'news')
  },

  async listBySymbol(symbol: string): Promise<NewsStockMap[]> {
    return queryByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-symbol', symbol)
  },

  async listByNews(newsId: string): Promise<NewsStockMap[]> {
    return queryByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-news', newsId)
  },
}

export const sentimentCacheStore = {
  async save(cache: SentimentCache): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSentimentCache', cache, 'news')
  },

  async get(id: string): Promise<SentimentCache | undefined> {
    return queryGet<SentimentCache>(STORE_NAME.sentimentCache, id)
  },

  async getByContentHash(contentHash: string): Promise<SentimentCache | undefined> {
    const list = await queryByIndex<SentimentCache>(STORE_NAME.sentimentCache, 'by-content-hash', contentHash)
    return list[0]
  },
}

export const executionPlanStore = {
  async save(plan: ExecutionPlan): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveExecutionPlan', plan, 'executionPlans')
  },

  async get(id: string): Promise<ExecutionPlan | undefined> {
    return queryGet<ExecutionPlan>(STORE_NAME.executionPlans, id)
  },

  async getAll(): Promise<ExecutionPlan[]> {
    return queryList<ExecutionPlan>(STORE_NAME.executionPlans)
  },

  async getBySymbol(symbol: string): Promise<ExecutionPlan[]> {
    return queryByIndex<ExecutionPlan>(STORE_NAME.executionPlans, 'by-symbol', symbol)
  },

  async list(): Promise<ExecutionPlan[]> {
    return queryList<ExecutionPlan>(STORE_NAME.executionPlans)
  },

  async update(id: string, updates: Partial<ExecutionPlan>): Promise<DataLayerResult<ExecutionPlan>> {
    const existing = await queryGet<ExecutionPlan>(STORE_NAME.executionPlans, id)
    if (!existing) return { success: false, error: 'ExecutionPlan not found' }
    const updated = { ...existing, ...updates, updatedAt: Date.now() }
    const result = await sendWriteEnvelope<ExecutionPlan>('updateExecutionPlan', updated, 'executionPlans')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: updated }
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteExecutionPlan', { id }, 'executionPlans')
  },
}

export const executionLogStore = {
  async save(log: ExecutionLog): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveExecutionLog', log, 'executionLogs')
  },

  async getByPlanId(planId: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-plan-id', planId)
  },

  async listByPlan(planId: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-plan-id', planId)
  },

  async getBySymbol(symbol: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-symbol', symbol)
  },

  async listBySymbol(symbol: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-symbol', symbol)
  },

  async list(): Promise<ExecutionLog[]> {
    return queryList<ExecutionLog>(STORE_NAME.executionLogs)
  },

  async getAll(): Promise<ExecutionLog[]> {
    return queryList<ExecutionLog>(STORE_NAME.executionLogs)
  },
}

export const missingReportStore = {
  async report(report: Omit<MissingReport, 'id'>): Promise<DataLayerResult<MissingReport>> {
    const id = Date.now()
    const fullReport: MissingReport = { ...report, id, createdAt: now() }
    await sendWriteEnvelope('saveMissingReport', fullReport, 'missingReports')
    return { success: true, data: fullReport }
  },

  async list(): Promise<MissingReport[]> {
    return queryList<MissingReport>(STORE_NAME.missingReports)
  },

  async listBySymbol(symbol: string): Promise<MissingReport[]> {
    return queryByIndex<MissingReport>(STORE_NAME.missingReports, 'by-symbol', symbol)
  },

  async listBySeverity(severity: string): Promise<MissingReport[]> {
    const all = await queryList<MissingReport>(STORE_NAME.missingReports)
    return all.filter((r) => r.severity === severity)
  },

  async incrementRetry(id: number): Promise<DataLayerResult<MissingReport>> {
    const report = await queryGet<MissingReport>(STORE_NAME.missingReports, String(id))
    if (!report) return { success: false, error: 'Report not found' }
    const updated = { ...report, retryCount: report.retryCount + 1 }
    const result = await sendWriteEnvelope<MissingReport>('incrementMissingReportRetry', updated, 'missingReports')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: updated }
  },
}

export const portfolioStore = {
  async save(portfolio: Portfolio): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('savePortfolio', portfolio, 'tradinghub')
  },

  async saveWithTx(portfolio: Portfolio, tx: IDBTransaction): Promise<void> {
    const store = tx.objectStore(STORE_NAME.portfolios)
    await new Promise<void>((resolve, reject) => {
      const request = store.put(portfolio)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
    })
  },

  async get(id: string): Promise<Portfolio | undefined> {
    return queryGet<Portfolio>(STORE_NAME.portfolios, id)
  },

  async getWithTx(id: string, tx: IDBTransaction): Promise<Portfolio | undefined> {
    const store = tx.objectStore(STORE_NAME.portfolios)
    return new Promise<Portfolio | undefined>((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result as Portfolio | undefined)
      request.onerror = () => reject(request.error instanceof Error ? request.error : new Error(String(request.error)))
    })
  },

  async list(): Promise<Portfolio[]> {
    return queryList<Portfolio>(STORE_NAME.portfolios)
  },
}

export const tradeReviewStore = {
  async save(record: TradeReviewRecord): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveTradeReview', record, 'tradeReviews')
  },

  async getLatest(): Promise<TradeReviewRecord | null> {
    const all = await queryList<TradeReviewRecord>(STORE_NAME.tradeReviews)
    if (all.length === 0) return null
    return all.reduce((latest, r) => (r.generatedAt > latest.generatedAt ? r : latest))
  },
}

export const dataManager = {
  async reset(): Promise<void> {
    await db.reset()
  },

  async export(): Promise<Record<string, unknown[]>> {
    return db.export()
  },

  async import(data: Record<string, unknown[]>): Promise<void> {
    await db.import(data)
  },
}

export const dataLayer = {
  stocks: stockStore,
  v6Scores: v6ScoreStore,
  dailyQuotes: dailyQuoteStore,
  intelligentScores: intelligentScoreStore,
  industryScores: industryScoreStore,
  researchLogs: researchLogStore,
  orders: orderStore,
  signals: signalStore,
  rotationScores: rotationScoreStore,
  sectorScores: sectorScoreStore,
  scoreDocs: scoreDocStore,
  strategySnapshots: strategySnapshotStore,
  localDocs: localDocStore,
  news: newsStore,
  newsStockMap: newsStockMapStore,
  sentimentCache: sentimentCacheStore,
  hotSectorScores: hotSectorScoreStore,
  valuePitScores: valuePitScoreStore,
  executionPlans: executionPlanStore,
  executionLogs: executionLogStore,
  missingReports: missingReportStore,
  portfolios: portfolioStore,
  tradeReviews: tradeReviewStore,
  manager: dataManager,
}
