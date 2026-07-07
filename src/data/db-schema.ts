/**
 * @fileoverview IndexedDB Schema 定义与创建
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.3），职责：
 * - 集中管理所有 ObjectStore 的创建逻辑（28 个 store）
 * - 定义索引（by-status, by-symbol, by-date 等）
 * - stocks store 的 group 字段 backfill 逻辑
 *
 * 设计原则：纯 Schema 定义，不持有数据库连接状态。
 * 由 db.ts 的 openDB() 在 onupgradeneeded 回调中调用。
 */
import { DEFAULT_POOL_GROUP, STORE_NAME } from '@/config/dbConfig'
import type { LogContext } from '@/lib/logger'

/** Schema 创建所需的日志接口（与 db.ts logger 兼容） */
interface SchemaLogger {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  debug(message: string, context?: LogContext): void
}

/**
 * 在 onupgradeneeded 回调中创建所有 ObjectStore 与索引。
 *
 * 幂等性：每个 store 都先检查 objectStoreNames.contains，已存在则跳过创建。
 * 对已存在的 stocks store，会补全缺失的 by-group 索引，并 backfill 缺失的 group 字段。
 *
 * @param db 当前数据库实例
 * @param request 触发 onupgradeneeded 的 IDBOpenDBRequest（用于访问 upgradeTx）
 * @param logger 结构化日志记录器
 */
export function createSchema(
  db: IDBDatabase,
  request: IDBOpenDBRequest,
  logger: SchemaLogger,
): void {
  // ── stocks：股票基础数据 ──
  if (!db.objectStoreNames.contains(STORE_NAME.stocks)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.stocks}"`)
    const store = db.createObjectStore(STORE_NAME.stocks, { keyPath: 'symbol' })
    store.createIndex('by-status', 'researchStatus', { unique: false })
    store.createIndex('by-group', 'group', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.stocks}" already exists, checking indexes...`)
    const store = request.transaction?.objectStore(STORE_NAME.stocks)
    if (store && !store.indexNames.contains('by-group')) {
      logger.debug('[DB] Adding missing index: "by-group" on "stocks"')
      store.createIndex('by-group', 'group', { unique: false })
    }

    if (store) {
      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (cursor) {
          const stock = cursor.value as Record<string, unknown>
          if (stock.group === undefined) {
            logger.debug(`[DB] Backfilling missing "group" field for stock: ${String(stock.symbol)}`)
            stock.group = DEFAULT_POOL_GROUP
            cursor.update(stock)
          }
          cursor.continue()
        }
      }
    }
  }

  // ── v6Scores：V6 评分结果 ──
  if (!db.objectStoreNames.contains(STORE_NAME.v6Scores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.v6Scores}"`)
    db.createObjectStore(STORE_NAME.v6Scores, { keyPath: 'symbol' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.v6Scores}" already exists`)
  }

  // ── intelligentScores：智能评分 ──
  if (!db.objectStoreNames.contains(STORE_NAME.intelligentScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.intelligentScores}" with autoIncrement`)
    const scoreStore = db.createObjectStore(STORE_NAME.intelligentScores, {
      keyPath: 'id',
      autoIncrement: true,
    })
    scoreStore.createIndex('by-symbol', 'symbol', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.intelligentScores}" already exists`)
  }

  // ── industryScores：行业评分 ──
  if (!db.objectStoreNames.contains(STORE_NAME.industryScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.industryScores}" with autoIncrement`)
    const industryStore = db.createObjectStore(STORE_NAME.industryScores, {
      keyPath: 'id',
      autoIncrement: true,
    })
    industryStore.createIndex('by-code', 'code', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.industryScores}" already exists`)
  }

  // ── orders：交易订单 ──
  if (!db.objectStoreNames.contains(STORE_NAME.orders)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.orders}"`)
    db.createObjectStore(STORE_NAME.orders, { keyPath: 'id' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.orders}" already exists`)
  }

  // ── watchlists：自选股列表 ──
  if (!db.objectStoreNames.contains(STORE_NAME.watchlists)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.watchlists}"`)
    db.createObjectStore(STORE_NAME.watchlists, { keyPath: 'id' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.watchlists}" already exists`)
  }

  // ── signals：交易信号 ──
  if (!db.objectStoreNames.contains(STORE_NAME.signals)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.signals}"`)
    db.createObjectStore(STORE_NAME.signals, { keyPath: 'id' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.signals}" already exists`)
  }

  // ── researchLogs：研究日志 ──
  if (!db.objectStoreNames.contains(STORE_NAME.researchLogs)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.researchLogs}" with autoIncrement`)
    db.createObjectStore(STORE_NAME.researchLogs, {
      keyPath: 'id',
      autoIncrement: true,
    })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.researchLogs}" already exists`)
  }

  // ── dailyQuotes：日线行情 ──
  if (!db.objectStoreNames.contains(STORE_NAME.dailyQuotes)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.dailyQuotes}"`)
    db.createObjectStore(STORE_NAME.dailyQuotes, { keyPath: 'symbol' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.dailyQuotes}" already exists`)
  }

  // ── rotationScores：板块轮动评分（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.rotationScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.rotationScores}"`)
    const rotationStore = db.createObjectStore(STORE_NAME.rotationScores, { keyPath: 'id' })
    rotationStore.createIndex('by-sector-date', ['sectorCode', 'scoreDate'], { unique: true })
    rotationStore.createIndex('by-sector', 'sectorCode', { unique: false })
    rotationStore.createIndex('by-total', 'total', { unique: false })
    rotationStore.createIndex('by-resonance', 'resonance', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.rotationScores}" already exists`)
  }

  // ── sectorScores：十五五板块评分（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.sectorScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.sectorScores}"`)
    const sectorScoreStore = db.createObjectStore(STORE_NAME.sectorScores, { keyPath: 'id' })
    sectorScoreStore.createIndex('by-sector', 'sectorCode', { unique: false })
    sectorScoreStore.createIndex('by-composite', 'composite', { unique: false })
    sectorScoreStore.createIndex('by-is-core', 'isCore', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.sectorScores}" already exists`)
  }

  // ── scoreDocs：评分文档版本库（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.scoreDocs)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.scoreDocs}"`)
    const scoreDocStore = db.createObjectStore(STORE_NAME.scoreDocs, { keyPath: 'docId' })
    scoreDocStore.createIndex('by-symbol', 'symbol', { unique: false })
    scoreDocStore.createIndex('by-symbol-version', ['symbol', 'version'], { unique: true })
    scoreDocStore.createIndex('by-composite', 'composite', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.scoreDocs}" already exists`)
  }

  // ── strategySnapshots：策略快照（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.strategySnapshots)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.strategySnapshots}"`)
    const snapshotStore = db.createObjectStore(STORE_NAME.strategySnapshots, { keyPath: 'id' })
    snapshotStore.createIndex('by-version', 'version', { unique: true })
    snapshotStore.createIndex('by-date', 'date', { unique: false })
    snapshotStore.createIndex('by-timestamp', 'timestamp', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.strategySnapshots}" already exists`)
  }

  // ── localDocs：本地知识库（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.localDocs)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.localDocs}"`)
    const localDocStore = db.createObjectStore(STORE_NAME.localDocs, { keyPath: 'id' })
    localDocStore.createIndex('by-symbol', 'symbol', { unique: false })
    localDocStore.createIndex('by-category', 'category', { unique: false })
    localDocStore.createIndex('by-added-at', 'addedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.localDocs}" already exists`)
  }

  // ── news：资讯文章（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.news)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.news}"`)
    const newsStore = db.createObjectStore(STORE_NAME.news, { keyPath: 'id' })
    newsStore.createIndex('by-source', 'source', { unique: false })
    newsStore.createIndex('by-category', 'category', { unique: false })
    newsStore.createIndex('by-publish-time', 'publishTime', { unique: false })
    newsStore.createIndex('by-hash', 'hash', { unique: true })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.news}" already exists`)
  }

  // ── newsStockMap：股票-资讯关联（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.newsStockMap)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.newsStockMap}"`)
    const newsStockMapStore = db.createObjectStore(STORE_NAME.newsStockMap, { keyPath: 'id' })
    newsStockMapStore.createIndex('by-symbol', 'symbol', { unique: false })
    newsStockMapStore.createIndex('by-news', 'newsId', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.newsStockMap}" already exists`)
  }

  // ── sentimentCache：情感分析缓存（v6 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.sentimentCache)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.sentimentCache}"`)
    const sentimentStore = db.createObjectStore(STORE_NAME.sentimentCache, { keyPath: 'id' })
    sentimentStore.createIndex('by-content-hash', 'contentHash', { unique: true })
    sentimentStore.createIndex('by-analyzed-at', 'analyzedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.sentimentCache}" already exists`)
  }

  // ── newsBookmarks：资讯收藏（v13 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.newsBookmarks)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.newsBookmarks}"`)
    const bookmarkStore = db.createObjectStore(STORE_NAME.newsBookmarks, { keyPath: 'id' })
    bookmarkStore.createIndex('by-bookmarked-at', 'bookmarkedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.newsBookmarks}" already exists`)
  }

  // ── hotSectorScores：双策略评分-热门板块（v14 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.hotSectorScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.hotSectorScores}"`)
    const hotSectorStore = db.createObjectStore(STORE_NAME.hotSectorScores, { keyPath: 'symbol' })
    hotSectorStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.hotSectorScores}" already exists`)
  }

  // ── valuePitScores：双策略评分-价值洼地（v14 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.valuePitScores)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.valuePitScores}"`)
    const valuePitStore = db.createObjectStore(STORE_NAME.valuePitScores, { keyPath: 'symbol' })
    valuePitStore.createIndex('by-calculated-at', 'calculatedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.valuePitScores}" already exists`)
  }

  // ── executionLogs：执行日志（v15 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.executionLogs)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.executionLogs}" with autoIncrement`)
    const executionLogStore = db.createObjectStore(STORE_NAME.executionLogs, {
      keyPath: 'id',
      autoIncrement: true,
    })
    executionLogStore.createIndex('by-plan', 'planId', { unique: false })
    executionLogStore.createIndex('by-symbol', 'symbol', { unique: false })
    executionLogStore.createIndex('by-timestamp', 'timestamp', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.executionLogs}" already exists`)
  }

  // ── missingReports：缺失报告登记（v15 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.missingReports)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.missingReports}" with autoIncrement`)
    const missingReportStore = db.createObjectStore(STORE_NAME.missingReports, {
      keyPath: 'id',
      autoIncrement: true,
    })
    missingReportStore.createIndex('by-symbol', 'symbol', { unique: false })
    missingReportStore.createIndex('by-severity', 'severity', { unique: false })
    missingReportStore.createIndex('by-detected-at', 'detectedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.missingReports}" already exists`)
  }

  // ── executionPlans：执行计划（v16 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.executionPlans)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.executionPlans}"`)
    const executionPlanStore = db.createObjectStore(STORE_NAME.executionPlans, { keyPath: 'id' })
    executionPlanStore.createIndex('by-signal', 'signalId', { unique: false })
    executionPlanStore.createIndex('by-symbol', 'symbol', { unique: false })
    executionPlanStore.createIndex('by-phase', 'phase', { unique: false })
    executionPlanStore.createIndex('by-created-at', 'createdAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.executionPlans}" already exists`)
  }

  // ── portfolios：投资组合（v16 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.portfolios)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.portfolios}"`)
    const portfolioStore = db.createObjectStore(STORE_NAME.portfolios, { keyPath: 'id' })
    portfolioStore.createIndex('by-theme', 'theme', { unique: false })
    portfolioStore.createIndex('by-updated-at', 'updatedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.portfolios}" already exists`)
  }

  // ── tradeReviews：交易纪律复盘报告（v17 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.tradeReviews)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.tradeReviews}" with keyPath: "id"`)
    const tradeReviewStore = db.createObjectStore(STORE_NAME.tradeReviews, { keyPath: 'id' })
    tradeReviewStore.createIndex('by-generated-at', 'generatedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.tradeReviews}" already exists`)
  }

  // ── financialReports：财务数据报告（v22 新增） ──
  if (!db.objectStoreNames.contains(STORE_NAME.financialReports)) {
    logger.info(`[DB] Creating objectStore: "${STORE_NAME.financialReports}" with keyPath: "symbol"`)
    const financialReportStore = db.createObjectStore(STORE_NAME.financialReports, { keyPath: 'symbol' })
    financialReportStore.createIndex('by-symbol', 'symbol', { unique: true })
    financialReportStore.createIndex('by-report-date', 'reportDate', { unique: false })
    financialReportStore.createIndex('by-updated-at', 'updatedAt', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.financialReports}" already exists`)
  }

  // ── schemaMigrations：迁移追踪存储（D-01） ──
  if (!db.objectStoreNames.contains(STORE_NAME.schemaMigrations)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.schemaMigrations}"`)
    db.createObjectStore(STORE_NAME.schemaMigrations, { keyPath: 'id' })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.schemaMigrations}" already exists`)
  }
}
