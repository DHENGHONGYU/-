/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066, V9-DOC-BACK-023]
 */
import type {
  DailyQuotes,
  LocalDoc,
  NewsArticle,
  NewsStockMap,
  Order,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Stock,
  StrategySnapshot,
  V6LayerScore,
  V6Score,
} from '@/data/types'

export interface V6Stock {
  symbol: string
  name: string
  market?: string
  industryL1?: string
  industryL2?: string
  industryL3?: string
  csL1?: string
  csL2?: string
  csL3?: string
  trackAnalysis?: {
    level1?: string
    level2?: string
    level3?: string
    source?: string
    updatedAt?: string
  }
  hotTrack?: string
  conceptTags?: string[]
  isFavorite?: boolean
  shares?: number
  avgCost?: number
  status?: string
  lastScore?: number
  lastRating?: string
  lastScoredAt?: string
  targetPrice?: number
  stopLoss?: number
  source?: string
  tags?: string[]
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface V6DailyQuote {
  id?: string
  symbol: string
  tradeDate: string
  price?: number
  open?: number
  high?: number
  low?: number
  preClose?: number
  change?: number
  changePercent?: number
  volume?: number
  amount?: number
  peTtm?: number | null
  pb?: number | null
  ps?: number | null
  marketCap?: number | null
  turnoverRate?: number | null
  ma5?: number | null
  ma10?: number | null
  ma20?: number | null
  ma60?: number | null
  updatedAt?: string
}

export interface V6ScoreRecord {
  symbol: string
  scoreDate: string
  composite: number
  l3v?: number
  layers?: Record<string, V6LayerScore>
  recommendation?: { key: string; label: string; color: string }
  targetPrice?: { bull: number; base: number; bear: number }
  keyRisks?: string[]
  keyCatalysts?: string[]
  modelUsed?: string
  promptVersion?: string
  rawResponse?: string
  durationMs?: number
  createdAt?: string
  id?: string
}

export interface V6Order {
  id?: string
  symbol: string
  type?: string
  date?: string
  time?: string
  price?: number
  shares?: number
  amount?: number
  fee?: number
  strategy?: string
  batch?: string
  note?: string
  createdAt?: string
}

export interface V6SectorScore {
  id?: string
  sectorCode: string
  scoreDate: string
  dimensions: {
    planAlignment: number
    policySupport: number
    usChinaParity: number
  }
  composite: number
  isCore: boolean
  modelUsed: string
  notes?: string
  createdAt?: string
}

export interface V6RotationScore {
  id?: string
  sectorCode: string
  sectorName: string
  swLevel1?: string
  swLevel2?: string
  swLevel3?: string
  scoreDate: string
  f1Jingqi: number
  f2Zijin: number
  f2a?: number
  f2b?: number
  f2c?: number
  f2d?: number
  f3Guzhi: number
  f4Beta: number
  f5Nengliang: number
  total: number
  resonance: number
  signal: string
  signalColor?: string
  alertLevel: string
  declineType: string
  poolStocks?: string[]
  poolStockNames?: string[]
  analysisReport?: string
  modelUsed: string
  createdAt?: string
}

export interface V6ScoreDoc {
  docId: string
  symbol: string
  stockName: string
  version: number
  scoreDate: string
  composite: number
  l3v: number
  layers: Record<string, V6LayerScore>
  recommendation: { key: string; label: string; color: string }
  targetPrice: { bull: number; base: number; bear: number }
  keyRisks: string[]
  keyCatalysts: string[]
  reportMd: string
  modelUsed: string
  market: string
  industry?: string
  changeFromPrev?: {
    compositeDelta: number
    l3vDelta: number
    layerChanges: Record<string, number>
  }
  createdAt?: string
}

export interface V6StrategyGroupItem {
  symbol: string
  name: string
  composite: number
  l1Score?: number
  l3fScore?: number
  l7Score?: number
  l8Score?: number
  resonance?: number
  industryL1?: string
  industryL2?: string
  industryL3?: string
  recommendationKey?: string
  recommendationLabel?: string
  classification: string
}

export interface V6StrategyGroupSnapshot {
  count: number
  avgComposite: number
  maxComposite: number
  symbols: string[]
  items: V6StrategyGroupItem[]
}

export interface V6StrategySnapshot {
  id: string
  version: number
  timestamp: string
  date: string
  time: string
  stockCount?: number
  scoreCount?: number
  rotationCount?: number
  core: V6StrategyGroupSnapshot
  hot: V6StrategyGroupSnapshot
  value: V6StrategyGroupSnapshot
  changeFromPrev?: StrategySnapshot['changeFromPrev']
  trigger?: string
}

export interface V6LocalDoc {
  id: string
  symbol: string
  name: string
  content: string
  category: '研报' | '财报' | '行业分析' | '新闻' | '策略笔记' | '其他'
  tags: string[]
  sourcePath: string
  size: number
  addedAt: number
}

export interface V6NewsArticle {
  id: string
  title: string
  content: string
  url: string
  source: string
  category: string
  publishTime: string
  fetchTime: string
  sentiment: number
  sentimentConfidence: number
  relatedStocks: string[]
  keywords: string[]
  hash: string
}

export interface V6NewsStockMap {
  id: string
  symbol: string
  newsId: string
  relevanceScore: number
  isTitleMatch: boolean
  isContentMatch: boolean
  industryMatch: boolean
}

export interface V6SentimentCache {
  id: string
  contentHash: string
  sentiment: number
  confidence: number
  method: 'rule' | 'llm' | 'hybrid'
  analyzedAt: string
  llmModel?: string
}

export interface V6ExportShape {
  stocks?: V6Stock[]
  daily_quotes?: V6DailyQuote[]
  v6_scores?: V6ScoreRecord[]
  orders?: V6Order[]
  sector_scores?: V6SectorScore[]
  rotation_scores?: V6RotationScore[]
  score_docs?: V6ScoreDoc[]
  strategy_snapshots?: V6StrategySnapshot[]
  local_docs?: V6LocalDoc[]
  news?: V6NewsArticle[]
  news_stock_map?: V6NewsStockMap[]
  sentiment_cache?: V6SentimentCache[]
  v6_reports?: unknown[]
  score_history?: unknown[]
  concepts?: unknown[]
  strategies?: unknown[]
}

export interface V9ImportShape {
  stocks: Stock[]
  dailyQuotes: DailyQuotes[]
  v6Scores: V6Score[]
  scoreDocsFromScores: ScoreDocVersion[]
  orders: Order[]
  sectorScores: SectorScoreRecord[]
  rotationScores: RotationSectorScore[]
  scoreDocs: ScoreDocVersion[]
  strategySnapshots: StrategySnapshot[]
  localDocs: LocalDoc[]
  news: NewsArticle[]
  newsStockMaps: NewsStockMap[]
  sentimentCache: SentimentCache[]
}

export interface MigrationReport {
  success: boolean
  durationMs: number
  summary: {
    totalStores: number
    importedRecords: number
    skippedRecords: number
    failedRecords: number
  }
  details: Array<{
    store: string
    total: number
    success: number
    skipped: number
    failed: number
    errors?: Array<{ index: number; id?: string; error: string }>
  }>
}

export interface MigrationOptions {
  overwriteExisting?: boolean
  dryRun?: boolean
}

export interface StoreImportContext<T> {
  storeName: string
  items: T[]
  keyPath: (item: T) => string
  get: (key: string) => Promise<T | undefined>
  save: (item: T) => Promise<unknown>
  overwrite?: boolean
}
