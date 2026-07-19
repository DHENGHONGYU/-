/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { generateId } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import { DATA_SOURCE, ORDER_DIRECTION, ORDER_STATUS, ACCOUNT_TYPE, type DataSource, type OrderDirection } from '@/config/dbConfig'
import { DEFAULT_POOL_GROUP, DEFAULT_POOL_TYPE, RESEARCH_STATUS, type ResearchStatus } from '@/constants/pool.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type {
  DailyQuotes,
  KlineBar,
  LocalDoc,
  NewsArticle,
  NewsStockMap,
  Order,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Stock,
  StrategyGroupSnapshot,
  StrategySnapshot,
  V6LayerScore,
  V6Score,
} from '@/data/types'
import type {
  V6Stock,
  V6DailyQuote,
  V6ScoreRecord,
  V6Order,
  V6SectorScore,
  V6RotationScore,
  V6ScoreDoc,
  V6StrategyGroupItem,
  V6StrategyGroupSnapshot,
  V6StrategySnapshot,
  V6LocalDoc,
  V6NewsArticle,
  V6NewsStockMap,
  V6SentimentCache,
  V6ExportShape,
  V9ImportShape,
} from './migrationTypes'

const logger = getLogger()

/**
 * sentimentNumberToLabel
 * @param score
 */
export function sentimentNumberToLabel(score: number): 'positive' | 'negative' | 'neutral' {
  if (score > 0.2) return 'positive'
  if (score < -0.2) return 'negative'
  return 'neutral'
}

/**
 * parseTimestamp
 * @param value
 * @returns number | undefined
 */
export function parseTimestamp(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    return value
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  return Number.isFinite(value) ? value : undefined
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeSource(v6Source?: string): DataSource {
  if (v6Source === 'AI推荐' || v6Source === '策略信号' || v6Source === '手动添加') {
    return DATA_SOURCE.manual
  }
  if (!v6Source) return DATA_SOURCE.manual
  const validSources = Object.values(DATA_SOURCE) as string[]
  return validSources.includes(v6Source) ? (v6Source as DataSource) : DATA_SOURCE.manual
}

function normalizeResearchStatus(isFavorite?: boolean): ResearchStatus {
  return isFavorite ? RESEARCH_STATUS.watching : RESEARCH_STATUS.candidate
}

/**
 * normalizeStockThemes
 * @param v6
 */
export function normalizeStockThemes(v6: V6Stock): {
  industryCode?: string
  sector?: string
  theme?: string[]
  group?: string
} {
  const themes = new Set<string>()
  const track = v6.trackAnalysis
  if (track?.level1) themes.add(track.level1)
  if (track?.level2) themes.add(track.level2)
  if (track?.level3) themes.add(track.level3)
  if (v6.hotTrack) themes.add(v6.hotTrack)
  for (const tag of safeArray<string>(v6.conceptTags)) {
    themes.add(tag)
  }

  let group: string | undefined
  const tags = safeArray<string>(v6.tags)
  if (tags.length > 0) {
    const groupCandidate = tags[0]
    if (groupCandidate && groupCandidate.length <= 20) {
      group = groupCandidate
    }
    for (const tag of tags) {
      if (!group || tag === group) continue
      themes.add(tag)
    }
  }

  return {
    industryCode: safeString(v6.industryL1),
    sector: safeString(v6.industryL2),
    theme: Array.from(themes).filter(Boolean),
    group: group ?? DEFAULT_POOL_GROUP,
  }
}

/**
 * transformV6Stock
 * @param v6
 * @returns Stock
 */
export function transformV6Stock(v6: V6Stock): Stock {
  const { industryCode, sector, theme, group } = normalizeStockThemes(v6)
  return {
    symbol: v6.symbol,
    name: v6.name,
    pool: DEFAULT_POOL_TYPE,
    researchStatus: normalizeResearchStatus(v6.isFavorite),
    source: normalizeSource(v6.source),
    dataVersion: 1,
    ingestedAt: parseTimestamp(v6.createdAt),
    updatedAt: parseTimestamp(v6.updatedAt),
    industryCode,
    sector,
    theme,
    group,
  }
}

/**
 * transformV6Order
 * @param v6
 * @returns Order
 */
export function transformV6Order(v6: V6Order): Order {
  const direction: OrderDirection =
    v6.type === 'sell' || v6.type === 'reduce' ? ORDER_DIRECTION.sell : ORDER_DIRECTION.buy

  let createdAt: number | undefined
  if (v6.date) {
    const timePart = v6.time ? `T${v6.time}:00.000Z` : 'T00:00:00.000Z'
    const parsed = Date.parse(`${v6.date}${timePart}`)
    createdAt = Number.isFinite(parsed) ? parsed : undefined
  }
  createdAt ??= parseTimestamp(v6.createdAt) ?? Date.now()

  return {
    id: generateId(),
    symbol: v6.symbol,
    direction,
    quantity: safeNumber(v6.shares) ?? 0,
    price: safeNumber(v6.price) ?? 0,
    amount: safeNumber(v6.amount) ?? 0,
    status: ORDER_STATUS.filled,
    accountType: ACCOUNT_TYPE.paper,
    createdAt,
  }
}

/**
 * transformV6DailyQuotes
 * @param v6Quotes
 * @returns DailyQuotes[]
 */
export function transformV6DailyQuotes(v6Quotes: V6DailyQuote[]): DailyQuotes[] {
  const bySymbol = new Map<string, V6DailyQuote[]>()
  for (const quote of v6Quotes) {
    if (!quote.symbol || !quote.tradeDate) continue
    const list = bySymbol.get(quote.symbol) ?? []
    list.push(quote)
    bySymbol.set(quote.symbol, list)
  }

  const result: DailyQuotes[] = []
  for (const [symbol, quotes] of bySymbol.entries()) {
    const sorted = quotes.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    const history: KlineBar[] = sorted
      .map((q) => ({
        date: q.tradeDate,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        open: safeNumber(q.open) || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        high: safeNumber(q.high) || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        low: safeNumber(q.low) || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        close: safeNumber(q.price) || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        volume: safeNumber(q.volume) || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        amount: safeNumber(q.amount) || 0,
      }))
      .filter((bar) => bar.date)

    const latest = history[history.length - 1]
    if (!latest) continue

    const updatedAt = Math.max(
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      ...sorted.map((q) => parseTimestamp(q.updatedAt) || 0),
      (() => {
        const ts = parseTimestamp(sorted[sorted.length - 1]?.tradeDate)
        if (ts == null) {
          logger.warn('[migrationTransformers] 字段缺失，使用默认值', { field: 'tradeDate', context: `symbol=${symbol}` })
          return 0
        }
        return ts
      })(),
    )

    result.push({
      symbol,
      latest,
      history,
      period: 'daily',
      adjust: 'qfq',
      updatedAt,
    })
  }
  return result
}

/**
 * transformV6Score
 * @param v6
 * @returns V6Score
 */
export function transformV6Score(v6: V6ScoreRecord): V6Score {
  const factors: Record<string, number> = {}
  if (v6.layers) {
    for (const [key, layer] of Object.entries(v6.layers)) {
      if (layer && typeof layer.score === 'number' && Number.isFinite(layer.score)) factors[key] = layer.score
    }
  }

  const calculatedAt = v6.scoreDate ? Date.parse(`${v6.scoreDate}T00:00:00.000Z`) : Date.now()

  return {
    symbol: v6.symbol,
    score: safeNumber(v6.composite) ?? 0,
    factors,
    algorithmVersion: `${v6.modelUsed ?? 'unknown'}__${v6.promptVersion ?? 'v6'}`,
    calculatedAt: Number.isFinite(calculatedAt) ? calculatedAt : Date.now(),
    dataVersion: 1,
  }
}

/**
 * transformV6ScoreToDoc
 * @param v6
 * @returns ScoreDocVersion
 */
export function transformV6ScoreToDoc(v6: V6ScoreRecord): ScoreDocVersion {
  const layers: Record<string, V6LayerScore> = {}
  if (v6.layers) {
    for (const [key, layer] of Object.entries(v6.layers)) {
      if (layer && typeof layer.score === 'number') layers[key] = {
        score: layer.score,
        reason: typeof layer.reason === 'string' ? layer.reason : '',
        weight: typeof layer.weight === 'number' && Number.isFinite(layer.weight) ? layer.weight : 0,
      }
    }
  }

  const nowMs = Date.now()
  const version = 1
  return {
    docId: `${v6.symbol}__V${version}__${nowMs}`,
    symbol: v6.symbol,
    stockName: v6.symbol,
    version,
    scoreDate: v6.scoreDate,
    composite: safeNumber(v6.composite) ?? 0,
    l3v: safeNumber(v6.l3v) ?? 0,
    layers,
    recommendation: v6.recommendation ?? { key: 'hold', label: '持有', color: COLOR_TOKENS.neutral.hex },
    targetPrice: v6.targetPrice ?? { bull: 0, base: 0, bear: 0 },
    keyRisks: safeArray<string>(v6.keyRisks),
    keyCatalysts: safeArray<string>(v6.keyCatalysts),
    reportMd: v6.rawResponse ?? '',
    modelUsed: v6.modelUsed ?? 'unknown',
    market: 'A股',
    industry: undefined,
    createdAt: new Date(nowMs).toISOString(),
  }
}

/**
 * transformV6SectorScore
 * @param v6
 * @returns SectorScoreRecord
 */
export function transformV6SectorScore(v6: V6SectorScore): SectorScoreRecord {
  return {
    id: v6.id ?? `${v6.sectorCode}__${v6.scoreDate}`,
    sectorCode: v6.sectorCode,
    scoreDate: v6.scoreDate,
    dimensions: {
      planAlignment: safeNumber(v6.dimensions?.planAlignment) ?? 0,
      policySupport: safeNumber(v6.dimensions?.policySupport) ?? 0,
      usChinaParity: safeNumber(v6.dimensions?.usChinaParity) ?? 0,
    },
    composite: safeNumber(v6.composite) ?? 0,
    isCore: Boolean(v6.isCore),
    modelUsed: v6.modelUsed ?? 'unknown',
    createdAt: v6.createdAt ?? new Date().toISOString(),
  }
}

/**
 * transformV6RotationScore
 * @param v6
 * @returns RotationSectorScore
 */
export function transformV6RotationScore(v6: V6RotationScore): RotationSectorScore {
  const poolStocks: RotationSectorScore['poolStocks'] = []
  const v6PoolStocks = safeArray<string>(v6.poolStocks)
  const v6PoolNames = safeArray<string>(v6.poolStockNames)
  for (let i = 0; i < v6PoolStocks.length; i++) {
    const symbol = v6PoolStocks[i]
    if (!symbol) continue
    poolStocks.push({
      symbol,
      name: v6PoolNames[i] ?? symbol,
    })
  }

  return {
    id: v6.id ?? `${v6.sectorCode}__${v6.scoreDate}`,
    sectorCode: v6.sectorCode,
    sectorName: v6.sectorName,
    swLevel1: safeString(v6.swLevel1),
    swLevel2: safeString(v6.swLevel2),
    swLevel3: safeString(v6.swLevel3),
    scoreDate: v6.scoreDate,
    f1Jingqi: safeNumber(v6.f1Jingqi) ?? 0,
    f2Zijin: safeNumber(v6.f2Zijin) ?? 0,
    f3Guzhi: safeNumber(v6.f3Guzhi) ?? 0,
    f4Beta: safeNumber(v6.f4Beta) ?? 0,
    f5Nengliang: safeNumber(v6.f5Nengliang) ?? 0,
    total: safeNumber(v6.total) ?? 0,
    resonance: safeNumber(v6.resonance) ?? 0,
    signal: v6.signal ?? '',
    alertLevel: v6.alertLevel ?? '',
    declineType: v6.declineType ?? '',
    poolStocks,
    analysisReport: v6.analysisReport,
    modelUsed: v6.modelUsed ?? 'unknown',
    createdAt: v6.createdAt ?? new Date().toISOString(),
  }
}

/**
 * transformV6ScoreDoc
 * @param v6
 * @returns ScoreDocVersion
 */
export function transformV6ScoreDoc(v6: V6ScoreDoc): ScoreDocVersion {
  return {
    docId: v6.docId,
    symbol: v6.symbol,
    stockName: v6.stockName,
    version: safeNumber(v6.version) ?? 1,
    scoreDate: v6.scoreDate,
    composite: safeNumber(v6.composite) ?? 0,
    l3v: safeNumber(v6.l3v) ?? 0,
    layers: v6.layers ?? {},
    recommendation: v6.recommendation ?? { key: 'hold', label: '持有', color: COLOR_TOKENS.neutral.hex },
    targetPrice: v6.targetPrice ?? { bull: 0, base: 0, bear: 0 },
    keyRisks: safeArray<string>(v6.keyRisks),
    keyCatalysts: safeArray<string>(v6.keyCatalysts),
    reportMd: v6.reportMd ?? '',
    modelUsed: v6.modelUsed ?? 'unknown',
    market: v6.market ?? 'A股',
    industry: safeString(v6.industry),
    changeFromPrev: v6.changeFromPrev,
    createdAt: v6.createdAt ?? new Date().toISOString(),
  }
}

function buildV9StrategyGroupSnapshot(v6: V6StrategyGroupSnapshot): StrategyGroupSnapshot {
  return {
    count: safeNumber(v6.count) ?? 0,
    avgComposite: safeNumber(v6.avgComposite) ?? 0,
    maxComposite: safeNumber(v6.maxComposite) ?? 0,
    symbols: safeArray<string>(v6.symbols),
    items: safeArray<V6StrategyGroupItem>(v6.items).map((item) => ({
      symbol: item.symbol,
      name: item.name,
      composite: safeNumber(item.composite) ?? 0,
      classification: item.classification ?? 'excluded',
    })),
  }
}

/**
 * transformV6StrategySnapshot
 * @param v6
 * @returns StrategySnapshot
 */
export function transformV6StrategySnapshot(v6: V6StrategySnapshot): StrategySnapshot {
  return {
    id: v6.id,
    version: safeNumber(v6.version) ?? 1,
    timestamp: parseTimestamp(v6.timestamp) ?? Date.now(),
    date: v6.date,
    time: v6.time,
    stockCount: safeNumber(v6.stockCount) ?? 0,
    scoreCount: safeNumber(v6.scoreCount) ?? 0,
    rotationCount: safeNumber(v6.rotationCount) ?? 0,
    core: buildV9StrategyGroupSnapshot(v6.core),
    hot: buildV9StrategyGroupSnapshot(v6.hot),
    value: buildV9StrategyGroupSnapshot(v6.value),
    changeFromPrev: v6.changeFromPrev,
    trigger: v6.trigger ?? 'manual',
  }
}

/**
 * transformV6LocalDoc
 * @param v6
 * @returns LocalDoc
 */
export function transformV6LocalDoc(v6: V6LocalDoc): LocalDoc {
  return {
    id: v6.id,
    symbol: v6.symbol,
    name: v6.name,
    content: v6.content ?? '',
    category: v6.category ?? '其他',
    tags: safeArray<string>(v6.tags),
    sourcePath: v6.sourcePath ?? '',
    size: safeNumber(v6.size) ?? 0,
    addedAt: safeNumber(v6.addedAt) ?? Date.now(),
  }
}

/**
 * transformV6NewsArticle
 * @param v6
 * @returns NewsArticle
 */
export function transformV6NewsArticle(v6: V6NewsArticle): NewsArticle {
  return {
    id: v6.id,
    title: v6.title ?? '',
    content: v6.content ?? '',
    url: v6.url ?? '',
    source: v6.source ?? 'unknown',
    category: v6.category ?? '其他',
    publishTime: v6.publishTime ?? new Date().toISOString(),
    fetchTime: v6.fetchTime ?? new Date().toISOString(),
    sentiment: sentimentNumberToLabel(safeNumber(v6.sentiment) ?? 0),
    sentimentConfidence: safeNumber(v6.sentimentConfidence) ?? 0,
    relatedStocks: safeArray<string>(v6.relatedStocks),
    keywords: safeArray<string>(v6.keywords),
    hash: v6.hash ?? generateNewsHash(v6.title + v6.content),
  }
}

/**
 * transformV6NewsStockMap
 * @param v6
 * @returns NewsStockMap
 */
export function transformV6NewsStockMap(v6: V6NewsStockMap): NewsStockMap {
  return {
    id: v6.id,
    symbol: v6.symbol,
    newsId: v6.newsId,
    relevanceScore: safeNumber(v6.relevanceScore) ?? 0,
    isTitleMatch: Boolean(v6.isTitleMatch),
    isContentMatch: Boolean(v6.isContentMatch),
    industryMatch: Boolean(v6.industryMatch),
  }
}

/**
 * transformV6SentimentCache
 * @param v6
 * @returns SentimentCache
 */
export function transformV6SentimentCache(v6: V6SentimentCache): SentimentCache {
  return {
    id: v6.id,
    contentHash: v6.contentHash,
    sentiment: sentimentNumberToLabel(safeNumber(v6.sentiment) ?? 0),
    confidence: safeNumber(v6.confidence) ?? 0,
    method: v6.method ?? 'rule',
    analyzedAt: parseTimestamp(v6.analyzedAt) ?? Date.now(),
    llmModel: safeString(v6.llmModel),
  }
}

/** DJB2 哈希算法种子值 */
const DJB2_HASH_SEED = 5381

function generateNewsHash(input: string): string {
  let hash = DJB2_HASH_SEED
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * parseV6Export
 * @param json
 * @returns V6ExportShape
 */
export function parseV6Export(json: unknown): V6ExportShape {
  if (json === null || typeof json !== 'object') {
    throw new Error('V6 导出 JSON 必须是对象')
  }
  const raw = json as Record<string, unknown>

  const asArray = (key: string): unknown[] => {
    const value = raw[key]
    if (value === undefined) return []
    if (!Array.isArray(value)) {
      throw new Error(`V6 导出中的 ${key} 必须是数组`)
    }
    return value
  }

  return {
    stocks: asArray('stocks') as V6Stock[],
    daily_quotes: asArray('daily_quotes') as V6DailyQuote[],
    v6_scores: asArray('v6_scores') as V6ScoreRecord[],
    orders: asArray('orders') as V6Order[],
    sector_scores: asArray('sector_scores') as V6SectorScore[],
    rotation_scores: asArray('rotation_scores') as V6RotationScore[],
    score_docs: asArray('score_docs') as V6ScoreDoc[],
    strategy_snapshots: asArray('strategy_snapshots') as V6StrategySnapshot[],
    local_docs: asArray('local_docs') as V6LocalDoc[],
    news: asArray('news') as V6NewsArticle[],
    news_stock_map: asArray('news_stock_map') as V6NewsStockMap[],
    sentiment_cache: asArray('sentiment_cache') as V6SentimentCache[],
    v6_reports: asArray('v6_reports'),
    score_history: asArray('score_history'),
    concepts: asArray('concepts'),
    strategies: asArray('strategies'),
  }
}

/**
 * transformV6ToV9
 * @param v6
 * @returns V9ImportShape
 */
export function transformV6ToV9(v6: V6ExportShape): V9ImportShape {
  const stocks = safeArray<V6Stock>(v6.stocks).map(transformV6Stock)
  const dailyQuotes = transformV6DailyQuotes(safeArray<V6DailyQuote>(v6.daily_quotes))
  const v6ScoreRecords = safeArray<V6ScoreRecord>(v6.v6_scores)
  const v6Scores = v6ScoreRecords.map(transformV6Score)
  const scoreDocsFromScores = v6ScoreRecords.map(transformV6ScoreToDoc)
  const orders = safeArray<V6Order>(v6.orders).map(transformV6Order)
  const sectorScores = safeArray<V6SectorScore>(v6.sector_scores).map(transformV6SectorScore)
  const rotationScores = safeArray<V6RotationScore>(v6.rotation_scores).map(transformV6RotationScore)
  const scoreDocs = safeArray<V6ScoreDoc>(v6.score_docs).map(transformV6ScoreDoc)
  const strategySnapshots = safeArray<V6StrategySnapshot>(v6.strategy_snapshots).map(transformV6StrategySnapshot)
  const localDocs = safeArray<V6LocalDoc>(v6.local_docs).map(transformV6LocalDoc)
  const news = safeArray<V6NewsArticle>(v6.news).map(transformV6NewsArticle)
  const newsStockMaps = safeArray<V6NewsStockMap>(v6.news_stock_map).map(transformV6NewsStockMap)
  const sentimentCache = safeArray<V6SentimentCache>(v6.sentiment_cache).map(transformV6SentimentCache)

  return {
    stocks,
    dailyQuotes,
    v6Scores,
    scoreDocsFromScores,
    orders,
    sectorScores,
    rotationScores,
    scoreDocs,
    strategySnapshots,
    localDocs,
    news,
    newsStockMaps,
    sentimentCache,
  }
}
