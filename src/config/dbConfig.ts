const testDbName = typeof process !== 'undefined' ? process.env.TEST_DB_NAME : undefined
export const DB_NAME = testDbName ? testDbName : ('V6ProDB' as const)
export const DB_VERSION = 6 as const

/**
 * 股票池默认分组名称。
 * 当股票未指定分组或历史数据缺失分组字段时使用。
 */
export const DEFAULT_POOL_GROUP = '默认分组' as const

export const RESEARCH_STATUS = {
  candidate: 'candidate',
  screened: 'screened',
  deepDive: 'deepDive',
  watching: 'watching',
  archived: 'archived',
} as const

export type ResearchStatus =
  (typeof RESEARCH_STATUS)[keyof typeof RESEARCH_STATUS]

export const DATA_SOURCE = {
  manual: 'manual',
  import: 'import',
  akshare: 'akshare',
} as const

export type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE]

export const ORDER_DIRECTION = {
  buy: 'buy',
  sell: 'sell',
} as const

export type OrderDirection =
  (typeof ORDER_DIRECTION)[keyof typeof ORDER_DIRECTION]

export const ORDER_STATUS = {
  pending: 'pending',
  filled: 'filled',
  cancelled: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const ACCOUNT_TYPE = {
  paper: 'paper',
  real: 'real',
} as const

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE]

export const ENVELOPE_TARGET = {
  db: 'db',
  analyzer: 'analyzer',
  ui: 'ui',
  tradinghub: 'tradinghub',
  system: 'system',
} as const

export type EnvelopeTarget =
  (typeof ENVELOPE_TARGET)[keyof typeof ENVELOPE_TARGET]

export const ENVELOPE_ACTION = {
  insertStock: 'INSERT_STOCK',
  updateStock: 'UPDATE_STOCK',
  deleteStock: 'DELETE_STOCK',
  saveScores: 'SAVE_SCORES',
  saveDailyQuotes: 'SAVE_DAILY_QUOTES',
  saveIntelligentScores: 'SAVE_INTELLIGENT_SCORES',
  saveIndustryScores: 'SAVE_INDUSTRY_SCORES',
  saveRotationScores: 'SAVE_ROTATION_SCORES',
  saveSectorScores: 'SAVE_SECTOR_SCORES',
  saveScoreDocs: 'SAVE_SCORE_DOCS',
  saveStrategySnapshots: 'SAVE_STRATEGY_SNAPSHOTS',
  saveLocalDocs: 'SAVE_LOCAL_DOCS',
  saveNews: 'SAVE_NEWS',
  saveNewsStockMap: 'SAVE_NEWS_STOCK_MAP',
  saveSentimentCache: 'SAVE_SENTIMENT_CACHE',
  saveResearchLog: 'SAVE_RESEARCH_LOG',
  insertSignal: 'INSERT_SIGNAL',
  insertOrder: 'INSERT_ORDER',
  updateOrder: 'UPDATE_ORDER',
  deleteOrder: 'DELETE_ORDER',
  resetAll: 'RESET_ALL',
  importAll: 'IMPORT_ALL',
  exportAll: 'EXPORT_ALL',
} as const

export type EnvelopeAction =
  (typeof ENVELOPE_ACTION)[keyof typeof ENVELOPE_ACTION]

export const MODULE_ID = {
  fetcher: 'fetcher',
  stockpool: 'stockpool',
  analyzer: 'analyzer',
  tradinghub: 'tradinghub',
  system: 'system',
  user: 'user',
  rotation: 'rotation',
  sector: 'sector',
  news: 'news',
} as const

export type ModuleId = (typeof MODULE_ID)[keyof typeof MODULE_ID]

/**
 * 用户自定义股票池分组名称最大长度。
 */
export const MAX_POOL_GROUP_NAME_LENGTH = 20 as const

export const STORE_NAME = {
  stocks: 'stocks',
  v6Scores: 'v6_scores',
  intelligentScores: 'intelligent_scores',
  industryScores: 'industry_scores',
  orders: 'orders',
  watchlists: 'watchlists',
  signals: 'signals',
  researchLogs: 'research_logs',
  dailyQuotes: 'daily_quotes',
  rotationScores: 'rotation_scores',
  sectorScores: 'sector_scores',
  scoreDocs: 'score_docs',
  strategySnapshots: 'strategy_snapshots',
  localDocs: 'local_docs',
  news: 'news',
  newsStockMap: 'news_stock_map',
  sentimentCache: 'sentiment_cache',
} as const

export type StoreName = (typeof STORE_NAME)[keyof typeof STORE_NAME]

export const DB_OPERATION = {
  select: 'SELECT',
  insert: 'INSERT',
  update: 'UPDATE',
  delete: 'DELETE',
} as const

export type DbOperation = (typeof DB_OPERATION)[keyof typeof DB_OPERATION]

export interface AclPermission {
  readonly read: readonly StoreName[]
  readonly write: readonly StoreName[]
  readonly actions: readonly DbOperation[]
}

export const ACL_MATRIX: Readonly<Record<ModuleId, AclPermission>> = {
  [MODULE_ID.fetcher]: {
    read: [],
    write: [STORE_NAME.stocks, STORE_NAME.dailyQuotes],
    actions: [DB_OPERATION.insert, DB_OPERATION.update],
  },
  [MODULE_ID.stockpool]: {
    read: [STORE_NAME.stocks, STORE_NAME.v6Scores],
    write: [STORE_NAME.stocks],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.analyzer]: {
    read: [
      STORE_NAME.stocks,
      STORE_NAME.v6Scores,
      STORE_NAME.intelligentScores,
      STORE_NAME.industryScores,
      STORE_NAME.scoreDocs,
    ],
    write: [STORE_NAME.v6Scores, STORE_NAME.intelligentScores, STORE_NAME.industryScores, STORE_NAME.scoreDocs],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update],
  },
  [MODULE_ID.rotation]: {
    read: [STORE_NAME.stocks, STORE_NAME.rotationScores, STORE_NAME.dailyQuotes],
    write: [STORE_NAME.rotationScores],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.sector]: {
    read: [STORE_NAME.stocks, STORE_NAME.sectorScores],
    write: [STORE_NAME.sectorScores],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.news]: {
    read: [STORE_NAME.stocks, STORE_NAME.news, STORE_NAME.newsStockMap, STORE_NAME.sentimentCache],
    write: [STORE_NAME.news, STORE_NAME.newsStockMap, STORE_NAME.sentimentCache],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.tradinghub]: {
    read: [STORE_NAME.stocks, STORE_NAME.v6Scores, STORE_NAME.orders, STORE_NAME.signals, STORE_NAME.strategySnapshots],
    write: [STORE_NAME.orders, STORE_NAME.signals, STORE_NAME.strategySnapshots],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.system]: {
    read: Object.values(STORE_NAME),
    write: Object.values(STORE_NAME),
    actions: Object.values(DB_OPERATION),
  },
  [MODULE_ID.user]: {
    read: [STORE_NAME.stocks, STORE_NAME.v6Scores, STORE_NAME.orders],
    write: [STORE_NAME.stocks, STORE_NAME.orders],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
}

export interface EnvelopeMeta {
  source: ModuleId
  target: EnvelopeTarget
  action: EnvelopeAction
  traceId: string
  timestamp: number
}
