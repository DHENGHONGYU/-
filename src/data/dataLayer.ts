import {
  DATA_SOURCE,
  DEFAULT_POOL_GROUP,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  RESEARCH_STATUS,
  type ResearchStatus,
} from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { db, generateId, now } from './db'
import type {
  DailyQuotes,
  DataLayerResult,
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
} from './types'

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

export const stockStore = {
  async add(stock: Omit<Stock, 'createdAt' | 'updatedAt' | 'dataVersion'>): Promise<DataLayerResult<Stock>> {
    const existing = await db.get<Stock>('stocks', stock.symbol)
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
    return db.get<Stock>('stocks', symbol)
  },

  async list(): Promise<Stock[]> {
    return db.getAll<Stock>('stocks')
  },

  async listByStatus(status: ResearchStatus): Promise<Stock[]> {
    return db.getAllByIndex<Stock>('stocks', 'by-status', status)
  },

  async listByGroup(group: string): Promise<Stock[]> {
    return db.getAllByIndex<Stock>('stocks', 'by-group', group)
  },

  async listGroups(): Promise<string[]> {
    const all = await db.getAll<Stock>('stocks')
    const groups = new Set<string>()
    for (const stock of all) {
      groups.add(stock.group ?? DEFAULT_POOL_GROUP)
    }
    groups.add(DEFAULT_POOL_GROUP)
    return Array.from(groups).sort()
  },

  async updateStatus(symbol: string, status: ResearchStatus): Promise<DataLayerResult<void>> {
    const existing = await db.get<Stock>('stocks', symbol)
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

    const existing = await db.get<Stock>('stocks', symbol)
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

    const updated = await db.get<Stock>('stocks', symbol)
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
    return db.get<DailyQuotes>('daily_quotes', symbol)
  },
}

export const v6ScoreStore = {
  async save(score: V6Score): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<V6Score | undefined> {
    return db.get<V6Score>('v6_scores', symbol)
  },

  async list(): Promise<V6Score[]> {
    return db.getAll<V6Score>('v6_scores')
  },
}

export const intelligentScoreStore = {
  async save(score: IntelligentScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIntelligentScores', score, 'analyzer')
  },

  async listBySymbol(symbol: string): Promise<IntelligentScore[]> {
    return db.getAllByIndex<IntelligentScore>('intelligent_scores', 'by-symbol', symbol)
  },

  async getLatestBySymbol(symbol: string): Promise<IntelligentScore | undefined> {
    const list = await this.listBySymbol(symbol)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IntelligentScore[]> {
    return db.getAll<IntelligentScore>('intelligent_scores')
  },
}

export const industryScoreStore = {
  async save(score: IndustryScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveIndustryScores', score, 'analyzer')
  },

  async listByCode(code: string): Promise<IndustryScore[]> {
    return db.getAllByIndex<IndustryScore>('industry_scores', 'by-code', code)
  },

  async getLatestByCode(code: string): Promise<IndustryScore | undefined> {
    const list = await this.listByCode(code)
    return list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
  },

  async list(): Promise<IndustryScore[]> {
    return db.getAll<IndustryScore>('industry_scores')
  },
}

export const researchLogStore = {
  async list(): Promise<ResearchLog[]> {
    return db.getAll<ResearchLog>('research_logs')
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
    return db.getAll<Order>('orders')
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
    return db.getAll<Signal>('signals')
  },

  async listBySymbol(symbol: string): Promise<Signal[]> {
    const all = await db.getAll<Signal>('signals')
    return all.filter((s) => s.symbol === symbol)
  },
}

export const rotationScoreStore = {
  async save(score: RotationSectorScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveRotationScores', score, 'rotation')
  },

  async get(id: string): Promise<RotationSectorScore | undefined> {
    return db.get<RotationSectorScore>('rotation_scores', id)
  },

  async list(): Promise<RotationSectorScore[]> {
    return db.getAll<RotationSectorScore>('rotation_scores')
  },

  async listBySector(sectorCode: string): Promise<RotationSectorScore[]> {
    return db.getAllByIndex<RotationSectorScore>('rotation_scores', 'by-sector', sectorCode)
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
    return db.get<HotSectorScore>('hot_sector_scores', symbol)
  },

  async list(): Promise<HotSectorScore[]> {
    return db.getAll<HotSectorScore>('hot_sector_scores')
  },
}

export const valuePitScoreStore = {
  async save(score: ValuePitScore): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveValuePitScores', score, 'analyzer')
  },

  async get(symbol: string): Promise<ValuePitScore | undefined> {
    return db.get<ValuePitScore>('value_pit_scores', symbol)
  },

  async list(): Promise<ValuePitScore[]> {
    return db.getAll<ValuePitScore>('value_pit_scores')
  },
}

export const sectorScoreStore = {
  async save(score: SectorScoreRecord): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSectorScores', score, 'sector')
  },

  async get(id: string): Promise<SectorScoreRecord | undefined> {
    return db.get<SectorScoreRecord>('sector_scores', id)
  },

  async list(): Promise<SectorScoreRecord[]> {
    return db.getAll<SectorScoreRecord>('sector_scores')
  },

  async listBySector(sectorCode: string): Promise<SectorScoreRecord[]> {
    return db.getAllByIndex<SectorScoreRecord>('sector_scores', 'by-sector', sectorCode)
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
    return db.get<ScoreDocVersion>('score_docs', docId)
  },

  async list(): Promise<ScoreDocVersion[]> {
    return db.getAll<ScoreDocVersion>('score_docs')
  },

  async listBySymbol(symbol: string): Promise<ScoreDocVersion[]> {
    return db.getAllByIndex<ScoreDocVersion>('score_docs', 'by-symbol', symbol)
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
    return db.get<StrategySnapshot>('strategy_snapshots', id)
  },

  async list(): Promise<StrategySnapshot[]> {
    return db.getAll<StrategySnapshot>('strategy_snapshots')
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
    return db.get<LocalDoc>('local_docs', id)
  },

  async list(): Promise<LocalDoc[]> {
    return db.getAll<LocalDoc>('local_docs')
  },

  async listBySymbol(symbol: string): Promise<LocalDoc[]> {
    return db.getAllByIndex<LocalDoc>('local_docs', 'by-symbol', symbol)
  },
}

export const newsStore = {
  async save(article: NewsArticle): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNews', article, 'news')
  },

  async get(id: string): Promise<NewsArticle | undefined> {
    return db.get<NewsArticle>('news', id)
  },

  async getByHash(hash: string): Promise<NewsArticle | undefined> {
    return db.getAllByIndex<NewsArticle>('news', 'by-hash', hash).then((list) => list[0])
  },

  async list(): Promise<NewsArticle[]> {
    return db.getAll<NewsArticle>('news')
  },
}

export const newsStockMapStore = {
  async save(mapping: NewsStockMap): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveNewsStockMap', mapping, 'news')
  },

  async listBySymbol(symbol: string): Promise<NewsStockMap[]> {
    return db.getAllByIndex<NewsStockMap>('news_stock_map', 'by-symbol', symbol)
  },

  async listByNews(newsId: string): Promise<NewsStockMap[]> {
    return db.getAllByIndex<NewsStockMap>('news_stock_map', 'by-news', newsId)
  },
}

export const sentimentCacheStore = {
  async save(cache: SentimentCache): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveSentimentCache', cache, 'news')
  },

  async get(id: string): Promise<SentimentCache | undefined> {
    return db.get<SentimentCache>('sentiment_cache', id)
  },

  async getByContentHash(contentHash: string): Promise<SentimentCache | undefined> {
    const list = await db.getAllByIndex<SentimentCache>('sentiment_cache', 'by-content-hash', contentHash)
    return list[0]
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
  manager: dataManager,
}
