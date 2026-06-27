import type {
  AccountType,
  DataSource,
  OrderDirection,
  OrderStatus,
  ResearchStatus,
} from '@/config/dbConfig'

export interface StockDataQuality {
  basic: boolean
  kline: boolean
  finance: boolean
  lastChecked?: number
}

export interface Stock {
  symbol: string
  name: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  marketCap?: number
  researchStatus: ResearchStatus
  source: DataSource
  dataVersion: number
  dataQuality?: StockDataQuality
  ingestedAt?: number
  updatedAt?: number
  /**
   * 行业代码，用于主题映射与组合集中度控制。
   * 建议采用申万/中信等行业分类编码。
   */
  industryCode?: string
  /**
   * 主题标签，一只股票可同时属于多个主题。
   * 例如：['第四次工业革命稀缺核心资源', 'AI算力']。
   */
  theme?: string[]
  /**
   * 板块/ Sector 名称，用于展示与粗略分组。
   */
  sector?: string
  /**
   * 股票池分组名称，用户自定义的展示/筛选维度。
   * 未指定时由业务层回退为默认分组。
   */
  group?: string
}

/**
 * 股票池分组元数据，用于 UI 展示分组选择器。
 */
export interface PoolGroupMeta {
  name: string
}

export interface V6Score {
  symbol: string
  score: number
  factors: Record<string, number>
  algorithmVersion: string
  calculatedAt: number
  dataVersion: number
  /** 评分质量警告（当数据完整度低于 100% 时填充） */
  qualityWarning?: string
}

export interface DimensionScore {
  name: string
  score: number | null
  rationale: string
  evidence: string[]
  weight: number
}

export interface IntelligentScore {
  id?: number
  symbol: string
  overallScore: number | null
  dimensionScores: DimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
  sourceSnapshot: {
    stock: Stock | undefined
    fileNames: string[]
    reportLength: number
  }
  configSnapshot: {
    model: string
    baseURL: string
  }
  modelResponse: string
  dataVersion: number
  scoredAt: number
}

export interface IndustryDimensionScore {
  name: string
  score: number | null
  rationale: string
  evidence: string[]
  weight: number
}

export interface IndustryScore {
  id?: number
  code: string
  name: string
  overallScore: number | null
  dimensionScores: IndustryDimensionScore[]
  summary: string
  basis: string
  missingFields: string[]
  sectorSnapshot: {
    composite: number
    recommendation: string
    positionPct: string
    subTracks: string[]
  }
  configSnapshot: {
    model: string
    baseURL: string
  }
  modelResponse: string
  scoredAt: number
}

export interface Order {
  id: string
  symbol: string
  direction: OrderDirection
  quantity: number
  price: number
  amount: number
  status: OrderStatus
  accountType: AccountType
  createdAt: number
}

export interface Watchlist {
  id: string
  name: string
  items: string[]
  createdAt: number
  updatedAt: number
}

/**
 * 组合持仓明细（目标 vs 当前）。
 * 用于主题投资组合的构建、展示与再平衡。
 */
export interface PortfolioHolding {
  symbol: string
  name: string
  currentShares: number
  currentWeight: number
  targetWeight: number
  targetShares: number
  price: number
  marketValue: number
  score: number
  rationale: string
}

/**
 * 投资组合快照。
 * 可由 portfolioBuilder 根据股票池、主题、评分实时计算生成。
 */
export interface Portfolio {
  id: string
  name: string
  theme: string
  totalValue: number
  cashReserve: number
  holdings: PortfolioHolding[]
  rebalancePlan: RebalanceAction[]
  createdAt: number
  updatedAt: number
}

/**
 * 再平衡动作：买入/卖出某只标的以接近目标权重。
 */
export interface RebalanceAction {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  shares: number
  reason: string
}

/** 策略分类标签 */
export type StrategyClassification =
  | 'core-scarce'
  | 'value-bargain'
  | 'hot-momentum'
  | 'excluded'

/** 策略候选标的 */
export interface StrategyCandidate {
  symbol: string
  name: string
  composite: number
  valuationScore: number | null
  industryScore: number | null
  momentum: number | null
  sector: string | null
  classification: StrategyClassification
  reasons: string[]
}

/** 策略规则引擎输出结果 */
export interface StrategyResult {
  selected: StrategyCandidate[]
  coreScarce: StrategyCandidate[]
  valueBargain: StrategyCandidate[]
  hotMomentum: StrategyCandidate[]
  rejected: StrategyCandidate[]
  summary: {
    total: number
    selectedCount: number
    coreScarceCount: number
    valueBargainCount: number
    hotMomentumCount: number
  }
}

export interface SignalSnapshot {
  pePercentile?: number
  pbPercentile?: number
  priceToMA20?: number
  priceToMA60?: number
  volumeRatio?: number
  rsi14?: number
  macdDirection?: 'red' | 'green' | 'neutral'
}

export interface Signal {
  id: string
  symbol: string
  direction: 'buy' | 'sell' | 'hold' | 'watch'
  type: string
  confidence: number
  rationale: string
  snapshot: SignalSnapshot
  createdAt: number
}

export interface ResearchLog {
  id?: number
  traceId: string
  timestamp: number
  actor: string
  action: string
  targetType: string
  targetCode: string
  payload?: string
}

export interface KlineBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export interface DailyQuotes {
  symbol: string
  latest: KlineBar
  history: KlineBar[]
  period: string
  adjust: string
  updatedAt: number
}

export interface DataLayerResult<T> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================
// V6 Pro 迁移：板块评分体系 — 十五五规划 20 大新兴行业
// ============================================================

/** 板块评分三维度 */
export interface SectorScoreDimensions {
  /** 十五五规划契合度 0-5 */
  planAlignment: number
  /** 政策支持力度 0-5 */
  policySupport: number
  /** 中美同等热度 0-5 */
  usChinaParity: number
}

/** 中美对比数据 */
export interface SectorUsChinaData {
  chinaShare?: string
  usStatus?: string
  gap?: string
}

/** 板块定义（十五五规划新兴行业） */
export interface SectorDefinition {
  code: string
  name: string
  category: '新兴产业' | '未来产业' | '战略基础'
  description: string
  keywords: string[]
  dimensions: SectorScoreDimensions
  weight: { plan: number; policy: number; parity: number }
  composite: number
  isCore: boolean
  usChina: SectorUsChinaData
  keyStocks: Array<{ symbol: string; name: string }>
  relatedConcepts: string[]
}

/** 板块-股票映射 */
export interface SectorStockMapping {
  sectorCode: string
  sectorName: string
  stockSymbols: string[]
  matchType: 'primary' | 'secondary'
}

/** 板块评分记录（存入 IndexedDB） */
export interface SectorScoreRecord {
  id: string // sectorCode__date
  sectorCode: string
  scoreDate: string
  dimensions: SectorScoreDimensions
  composite: number
  isCore: boolean
  modelUsed: string
  createdAt: string
}

// ============================================================
// V6 Pro 迁移：板块轮动量化策略
// ============================================================

/** 市场风格周期 */
export type MarketStyle = 'growth' | 'value' | 'balanced'

/** 轮动因子子指标 */
export interface RotationSubFactor {
  code: string
  name: string
  score: number
  calcMethod: string
  dataSource: string
  freq: string
  fullRule: string
  midRule: string
  zeroRule: string
  redLine?: string
}

/** 轮动因子 */
export interface RotationFactor {
  code: string
  name: string
  weight: number
  maxScore: number
  subCount: number
  role: string
  color: string
  subs: RotationSubFactor[]
}

/** 轮动信号分级 */
export interface RotationSignalGrade {
  minResonance: number
  maxResonance: number
  label: string
  signalType: string
  position: string
  action: string
  color: string
  bg: string
}

/** 综合得分分档 */
export interface RotationScoreBucket {
  min: number
  label: string
  pos: string
  desc: string
  color: string
}

/** 高景气抛售预警 */
export interface RotationAlertLevel {
  code: string
  name: string
  color: string
  condition: string
  action: string
}

/** 下跌性质判定结果 */
export interface DeclineNature {
  type: '杀逻辑' | '杀业绩' | '杀估值'
  severity: '严重' | '中等' | '轻微'
  action: string
  color: string
}

/** 板块轮动评分记录（存入 IndexedDB） */
export interface RotationSectorScore {
  id: string // sectorCode__date
  sectorCode: string
  sectorName: string
  swLevel1?: string
  swLevel2?: string
  swLevel3?: string
  scoreDate: string
  /** 景气因子得分 */
  f1Jingqi: number
  /** 资金因子得分 */
  f2Zijin: number
  /** 估值因子得分 */
  f3Guzhi: number
  /** β+相关系数得分 */
  f4Beta: number
  /** 量能因子得分 */
  f5Nengliang: number
  /** 综合总分 0-100 */
  total: number
  /** 共振强度 0-10 */
  resonance: number
  /** 信号标签 */
  signal: string
  /** 预警等级 */
  alertLevel: string
  /** 下跌性质 */
  declineType: string
  /** 相关股票池标的 */
  poolStocks: Array<{ symbol: string; name: string; v6Composite?: number }>
  /** 分析报告 */
  analysisReport?: string
  modelUsed: string
  createdAt: string
}

// ============================================================
// V6 Pro 迁移：评分文档版本库
// ============================================================

/** V6 评分单维度 */
export interface V6LayerScore {
  score: number
  reason: string
  weight: number
}

/** 单只股票的一次评分文档版本 */
export interface ScoreDocVersion {
  docId: string // symbol__version__timestamp
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
  createdAt: string
}

/** 内部文件库统计 */
export interface FileLibraryStats {
  totalDocs: number
  totalStocks: number
  totalVersions: number
  avgComposite: number
  coreStocks: number
  lastUpdate: string
}

// ============================================================
// V6 Pro 迁移：策略快照与版本管理
// ============================================================

/** 策略分组快照 */
export interface StrategyGroupSnapshot {
  count: number
  avgComposite: number
  maxComposite: number
  symbols: string[]
  items: Array<{
    symbol: string
    name: string
    composite: number
    classification: string
  }>
}

/** 策略快照 */
export interface StrategySnapshot {
  id: string
  version: number
  timestamp: number
  date: string
  time: string
  stockCount: number
  scoreCount: number
  rotationCount: number
  core: StrategyGroupSnapshot
  hot: StrategyGroupSnapshot
  value: StrategyGroupSnapshot
  changeFromPrev?: {
    totalChange: number
    coreChange: { added: string[]; removed: string[] }
    hotChange: { added: string[]; removed: string[] }
    valueChange: { added: string[]; removed: string[] }
    scoreChanges?: Array<{
      symbol: string
      name: string
      oldComposite: number
      newComposite: number
      delta: number
    }>
  }
  trigger: string
}

// ============================================================
// V6 Pro 迁移：本地知识库
// ============================================================

/** 本地知识库文档 */
export interface LocalDoc {
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

// ============================================================
// V6 Pro 迁移：资讯与情感
// ============================================================

/** 外部财经源抓取资讯 */
export interface NewsArticle {
  id: string
  title: string
  content: string
  url: string
  source: string
  category: string
  publishTime: string
  fetchTime: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentConfidence: number
  relatedStocks: string[]
  keywords: string[]
  hash: string
}

/** 股票-资讯多对多关联 */
export interface NewsStockMap {
  id: string // {symbol}_{newsId}
  symbol: string
  newsId: string
  relevanceScore: number
  isTitleMatch: boolean
  isContentMatch: boolean
  industryMatch: boolean
}

/** 情感分析缓存 */
export interface SentimentCache {
  id: string // sent_{contentHash}
  contentHash: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  method: 'rule' | 'llm' | 'hybrid'
  analyzedAt: number
  llmModel?: string
}

// ============================================================
// V6 Pro 迁移：七维数据架构
// ============================================================

/** 七维数据类型 */
export type DataDimensionType =
  | '01_basic'
  | '02_kline'
  | '03_chip'
  | '04_events'
  | '05_news'
  | '06_industry'
  | '07_index'

/** 七维数据元数据 */
export interface DataDimensionMeta {
  code: DataDimensionType
  name: string
  description: string
  storageStrategy: 'full' | 'lightweight'
  filePattern: string
}

/** 单维度采集状态 */
export interface DimensionStatus {
  status: 'pending' | 'collecting' | 'completed' | 'failed'
  records: number
  updatedAt: string
  hash?: string
}

/** 单股票元数据 */
export interface StockMeta {
  code: string
  name: string
  market: 'SH' | 'SZ' | 'BJ'
  industry: string
  addedAt: string
  lastCollectTime: string | null
  dimensions: Record<string, DimensionStatus>
}

/** 全局 meta.json 结构 */
export interface GlobalMeta {
  version: string
  schemaVersion: string
  createdAt: string
  lastUpdated: string
  stocks: StockMeta[]
  statistics: {
    totalStocks: number
    totalRecords: number
    totalNews: number
    totalEvents: number
    storageSizeMB: number
  }
}

// ============================================================
// V6 Pro 迁移：统一股票数据视图
// ============================================================

export interface UnifiedStockData {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  amount: number
  open: number
  high: number
  low: number
  prevClose: number
  turnover: number | null
  marketCap: number | null
  pe: number | null
  pb: number | null
  roe: number | null
  grossMargin: number | null
  netMargin: number | null
  revenueGrowth: number | null
  profitGrowth: number | null
  debtRatio: number | null
  eps: number | null
  ma5: number | null
  ma10: number | null
  ma20: number | null
  macd: number | null
  rsi6: number | null
  rsi12: number | null
  rsi24: number | null
  k: number | null
  d: number | null
  j: number | null
  bollUpper: number | null
  bollMid: number | null
  bollLower: number | null
  atr: number | null
  maSignal: 'golden_cross' | 'death_cross' | 'neutral' | null
  rsiSignal: 'overbought' | 'oversold' | 'neutral' | null
  macdSignal: 'bullish' | 'bearish' | 'neutral' | null
  sentimentScore: number | null
  sentimentConfidence: number | null
  sectorName: string | null
  sectorRank: number | null
  sectorStrength: number | null
  trendScore: number | null
  valueScore: number | null
  fundScore: number | null
  sentimentFactorScore: number | null
  totalScore: number | null
  signalType: 'strong_buy' | 'buy' | 'hold' | 'watch' | null
  signalReason: string | null
  var95: number | null
  maxDrawdown: number | null
  timestamp: string
  dataSource: string
}
