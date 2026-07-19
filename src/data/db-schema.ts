/**
 * @fileoverview IndexedDB Schema 定义与创建
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.3），职责：
 * - 集中管理所有 ObjectStore 的创建逻辑（27 个基线 store）
 * - 定义索引（by-status, by-symbol, by-date 等）
 * - stocks store 的 group 字段 backfill 逻辑
 *
 * 设计原则：纯 Schema 定义，不持有数据库连接状态。
 * 由 db.ts 的 openDB() 在 onupgradeneeded 回调中调用。
 *
 * PR-6 阶段 2：提取 ensureStore() 辅助函数，将 26 个重复的
 * "if/else createObjectStore" 模式收敛为单次调用，CC 从 28 降至约 6。
 */
import { STORE_NAME } from '@/config/dbConfig'
import { DEFAULT_POOL_GROUP, POOL_TYPE } from '@/constants/pool.constants'
import type { LogContext } from '@/lib/logger'

/** Schema 创建所需的日志接口（与 db.ts logger 兼容） */
interface SchemaLogger {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  debug(message: string, context?: LogContext): void
}

/** 索引定义（用于 ensureStore 的 indexes 参数） */
interface IndexDefinition {
  readonly name: string
  readonly keyPath: string | readonly string[]
  readonly options?: IDBIndexParameters
}

/** ensureStore 配置选项 */
interface EnsureStoreOptions {
  readonly storeOptions?: IDBObjectStoreParameters
  readonly indexes?: ReadonlyArray<IndexDefinition>
  /**
   * 创建时的日志级别（默认 debug；financialReports 用 info）。
   * 注意：仅影响"创建"日志；"已存在"日志统一使用 debug 级别
   *（与原 db.ts 行为一致，避免审计脚本误判）。
   */
  readonly logLevel?: 'debug' | 'info'
}

/**
 * 幂等创建 ObjectStore 与索引。
 *
 * - store 不存在：创建 store + 全部索引，返回新 store 实例
 * - store 已存在：仅记录 debug 日志，返回 null（不补全索引、不 backfill 数据）
 *
 * 注意：本函数不处理"已存在 store 的索引补全"与"数据 backfill"逻辑。
 * 该类升级期特殊逻辑由调用方自行处理（参见 stocks store 的特殊分支）。
 *
 * @param db 当前数据库实例
 * @param storeName ObjectStore 名称
 * @param logger 结构化日志记录器
 * @param options store 配置、索引列表、创建日志级别
 * @returns 新创建的 store 实例；若已存在则返回 null
 */
function ensureStore(
  db: IDBDatabase,
  storeName: string,
  logger: SchemaLogger,
  options: EnsureStoreOptions = {},
): IDBObjectStore | null {
  const { storeOptions, indexes = [], logLevel = 'debug' } = options

  if (db.objectStoreNames.contains(storeName)) {
    // 已存在时统一用 debug 级别（与原 db.ts 行为一致）
    logger.debug(`[DB] ObjectStore "${storeName}" already exists`)
    return null
  }

  // 创建时使用 logLevel（financialReports 用 info，其他用 debug）
  const autoIncrementSuffix = storeOptions?.autoIncrement === true ? ' with autoIncrement' : ''
  logger[logLevel](`[DB] Creating objectStore: "${storeName}"${autoIncrementSuffix}`)

  const store = db.createObjectStore(storeName, storeOptions ?? {})
  for (const { name, keyPath, options: idxOptions } of indexes) {
    store.createIndex(name, keyPath, idxOptions ?? { unique: false })
  }
  return store
}

/**
 * 在 onupgradeneeded 回调中创建所有 ObjectStore 与索引。
 *
 * 幂等性：每个 store 都先检查 objectStoreNames.contains，已存在则跳过创建。
 * 对已存在的 stocks store，会补全缺失的 by-group 索引，并 backfill 缺失的 group 字段。
 *
 * 基线 store 清单（27 个，由 createSchema 创建）：
 * stocks / v6Scores / intelligentScores / industryScores / orders / watchlists /
 * signals / researchLogs / dailyQuotes / rotationScores / sectorScores / scoreDocs /
 * strategySnapshots / localDocs / news / newsStockMap / sentimentCache /
 * newsBookmarks / hotSectorScores / valuePitScores / executionLogs / missingReports /
 * executionPlans / portfolios / tradeReviews / financialReports / schemaMigrations
 *
 * 增量 store（由 migration 创建，不在本函数处理）：
 * RBAC 6 表（rbac_*）由 rbacMigrationV24 创建。
 * 参见 AGENTS.md §八 第 3 条职责划分规则。
 *
 * @param db 当前数据库实例
 * @param request 触发 onupgradeneeded 的 IDBOpenDBRequest（用于访问 upgradeTx）
 * @param logger 结构化日志记录器
/**
 * 游标遍历 stocks store，将缺失的 group 字段 backfill 为 DEFAULT_POOL_GROUP。
 * 抽取为独立函数以避免 createSchema 内多层回调嵌套（深度 > 3）。
 */
function backfillGroupField(store: IDBObjectStore, logger: SchemaLogger): void {
  const cursorRequest = store.openCursor()
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    const stock = cursor.value as Record<string, unknown>
    if (stock.group === undefined) {
      logger.debug(`[DB] Backfilling missing "group" field for stock: ${String(stock.symbol)}`)
      stock.group = DEFAULT_POOL_GROUP
      cursor.update(stock)
    }
    cursor.continue()
  }
}

/**
 * 游标遍历 stocks store，将缺失的 pool 字段 backfill 为 research（兼容旧数据）。
 */
function backfillPoolField(store: IDBObjectStore, logger: SchemaLogger): void {
  const cursorRequest = store.openCursor()
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    const stock = cursor.value as Record<string, unknown>
    if (stock.pool === undefined) {
      logger.debug(`[DB] Backfilling missing "pool" field for stock: ${String(stock.symbol)}`)
      stock.pool = POOL_TYPE.research
      cursor.update(stock)
    }
    cursor.continue()
  }
}

export function createSchema(
  db: IDBDatabase,
  request: IDBOpenDBRequest,
  logger: SchemaLogger,
): void {
  // ── stocks：股票基础数据（特殊处理：含 backfill 与索引补全逻辑） ──
  // 不使用 ensureStore，因为需要在 store 已存在时：
  // 1. 补全缺失的 by-group 索引（v6 升级期）
  // 2. 补全缺失的 by-pool 索引（v29 三分拆）
  // 3. backfill 缺失的 group 字段为 DEFAULT_POOL_GROUP
  // 4. backfill 缺失的 pool 字段为 research（兼容旧数据）
  if (!db.objectStoreNames.contains(STORE_NAME.stocks)) {
    logger.debug(`[DB] Creating objectStore: "${STORE_NAME.stocks}"`)
    const store = db.createObjectStore(STORE_NAME.stocks, { keyPath: 'symbol' })
    store.createIndex('by-status', 'researchStatus', { unique: false })
    store.createIndex('by-group', 'group', { unique: false })
    store.createIndex('by-pool', 'pool', { unique: false })
  } else {
    logger.debug(`[DB] ObjectStore "${STORE_NAME.stocks}" already exists, checking indexes...`)
    const store = request.transaction?.objectStore(STORE_NAME.stocks)
    if (store && !store.indexNames.contains('by-group')) {
      logger.debug('[DB] Adding missing index: "by-group" on "stocks"')
      store.createIndex('by-group', 'group', { unique: false })
    }
    if (store && !store.indexNames.contains('by-pool')) {
      logger.debug('[DB] Adding missing index: "by-pool" on "stocks"')
      store.createIndex('by-pool', 'pool', { unique: false })
    }

    if (store) {
      backfillGroupField(store, logger)
      backfillPoolField(store, logger)
    }
  }

  // ── v6Scores：V6 评分结果 ──
  ensureStore(db, STORE_NAME.v6Scores, logger, {
    storeOptions: { keyPath: 'symbol' },
  })

  // ── intelligentScores：智能评分 ──
  ensureStore(db, STORE_NAME.intelligentScores, logger, {
    storeOptions: { keyPath: 'id', autoIncrement: true },
    indexes: [{ name: 'by-symbol', keyPath: 'symbol' }],
  })

  // ── industryScores：行业评分 ──
  ensureStore(db, STORE_NAME.industryScores, logger, {
    storeOptions: { keyPath: 'id', autoIncrement: true },
    indexes: [{ name: 'by-code', keyPath: 'code' }],
  })

  // ── orders：交易订单 ──
  ensureStore(db, STORE_NAME.orders, logger, {
    storeOptions: { keyPath: 'id' },
  })

  // ── watchlists：自选股列表 ──
  ensureStore(db, STORE_NAME.watchlists, logger, {
    storeOptions: { keyPath: 'id' },
  })

  // ── signals：交易信号 ──
  ensureStore(db, STORE_NAME.signals, logger, {
    storeOptions: { keyPath: 'id' },
  })

  // ── researchLogs：研究日志 ──
  ensureStore(db, STORE_NAME.researchLogs, logger, {
    storeOptions: { keyPath: 'id', autoIncrement: true },
  })

  // ── dailyQuotes：日线行情 ──
  ensureStore(db, STORE_NAME.dailyQuotes, logger, {
    storeOptions: { keyPath: 'symbol' },
  })

  // ── rotationScores：板块轮动评分（v6 新增） ──
  ensureStore(db, STORE_NAME.rotationScores, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-sector-date', keyPath: ['sectorCode', 'scoreDate'], options: { unique: true } },
      { name: 'by-sector', keyPath: 'sectorCode' },
      { name: 'by-total', keyPath: 'total' },
      { name: 'by-resonance', keyPath: 'resonance' },
    ],
  })

  // ── sectorScores：十五五板块评分（v6 新增） ──
  ensureStore(db, STORE_NAME.sectorScores, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-sector', keyPath: 'sectorCode' },
      { name: 'by-composite', keyPath: 'composite' },
      { name: 'by-is-core', keyPath: 'isCore' },
    ],
  })

  // ── scoreDocs：评分文档版本库（v6 新增） ──
  ensureStore(db, STORE_NAME.scoreDocs, logger, {
    storeOptions: { keyPath: 'docId' },
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-symbol-version', keyPath: ['symbol', 'version'], options: { unique: true } },
      { name: 'by-composite', keyPath: 'composite' },
    ],
  })

  // ── strategySnapshots：策略快照（v6 新增） ──
  ensureStore(db, STORE_NAME.strategySnapshots, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-version', keyPath: 'version', options: { unique: true } },
      { name: 'by-date', keyPath: 'date' },
      { name: 'by-timestamp', keyPath: 'timestamp' },
    ],
  })

  // ── localDocs：本地知识库（v6 新增） ──
  ensureStore(db, STORE_NAME.localDocs, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-category', keyPath: 'category' },
      { name: 'by-added-at', keyPath: 'addedAt' },
    ],
  })

  // ── news：资讯文章（v6 新增） ──
  ensureStore(db, STORE_NAME.news, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-source', keyPath: 'source' },
      { name: 'by-category', keyPath: 'category' },
      { name: 'by-publish-time', keyPath: 'publishTime' },
      { name: 'by-hash', keyPath: 'hash', options: { unique: true } },
    ],
  })

  // ── newsStockMap：股票-资讯关联（v6 新增） ──
  ensureStore(db, STORE_NAME.newsStockMap, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-news', keyPath: 'newsId' },
    ],
  })

  // ── sentimentCache：情感分析缓存（v6 新增） ──
  ensureStore(db, STORE_NAME.sentimentCache, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-content-hash', keyPath: 'contentHash', options: { unique: true } },
      { name: 'by-analyzed-at', keyPath: 'analyzedAt' },
    ],
  })

  // ── newsBookmarks：资讯收藏（v13 新增） ──
  ensureStore(db, STORE_NAME.newsBookmarks, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [{ name: 'by-bookmarked-at', keyPath: 'bookmarkedAt' }],
  })

  // ── hotSectorScores：双策略评分-热门板块（v14 新增） ──
  ensureStore(db, STORE_NAME.hotSectorScores, logger, {
    storeOptions: { keyPath: 'symbol' },
    indexes: [{ name: 'by-calculated-at', keyPath: 'calculatedAt' }],
  })

  // ── valuePitScores：双策略评分-价值洼地（v14 新增） ──
  ensureStore(db, STORE_NAME.valuePitScores, logger, {
    storeOptions: { keyPath: 'symbol' },
    indexes: [{ name: 'by-calculated-at', keyPath: 'calculatedAt' }],
  })

  // ── executionLogs：执行日志（v15 新增） ──
  ensureStore(db, STORE_NAME.executionLogs, logger, {
    storeOptions: { keyPath: 'id', autoIncrement: true },
    indexes: [
      { name: 'by-plan', keyPath: 'planId' },
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-timestamp', keyPath: 'timestamp' },
    ],
  })

  // ── missingReports：缺失报告登记（v15 新增） ──
  ensureStore(db, STORE_NAME.missingReports, logger, {
    storeOptions: { keyPath: 'id', autoIncrement: true },
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-severity', keyPath: 'severity' },
      { name: 'by-detected-at', keyPath: 'detectedAt' },
    ],
  })

  // ── executionPlans：执行计划（v16 新增） ──
  ensureStore(db, STORE_NAME.executionPlans, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-signal', keyPath: 'signalId' },
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-phase', keyPath: 'phase' },
      { name: 'by-created-at', keyPath: 'createdAt' },
    ],
  })

  // ── portfolios：投资组合（v16 新增） ──
  ensureStore(db, STORE_NAME.portfolios, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-theme', keyPath: 'theme' },
      { name: 'by-updated-at', keyPath: 'updatedAt' },
    ],
  })

  // ── tradeReviews：交易纪律复盘报告（v17 新增） ──
  ensureStore(db, STORE_NAME.tradeReviews, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [{ name: 'by-generated-at', keyPath: 'generatedAt' }],
  })

  // ── financialReports：财务数据报告（v22 新增，使用 info 级别日志） ──
  ensureStore(db, STORE_NAME.financialReports, logger, {
    storeOptions: { keyPath: 'symbol' },
    logLevel: 'info',
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', options: { unique: true } },
      { name: 'by-report-date', keyPath: 'reportDate' },
      { name: 'by-updated-at', keyPath: 'updatedAt' },
    ],
  })

  // ── schemaMigrations：迁移追踪存储（D-01） ──
  ensureStore(db, STORE_NAME.schemaMigrations, logger, {
    storeOptions: { keyPath: 'id' },
  })

  // ── collectConfig：采集策略配置（v25 新增） ──
  ensureStore(db, STORE_NAME.collectConfig, logger, {
    storeOptions: { keyPath: 'id' },
    logLevel: 'info',
    indexes: [{ name: 'by-updated-at', keyPath: 'updatedAt' }],
  })

  // ── customAgents：用户自定义智能体（v26 新增，阶段 B-1） ──
  // keyPath='id'（nanoid 生成）；索引 by-type / by-updated-at 便于按 type 筛选 / 按更新时间排序。
  ensureStore(db, STORE_NAME.customAgents, logger, {
    storeOptions: { keyPath: 'id' },
    logLevel: 'info',
    indexes: [
      { name: 'by-type', keyPath: 'type' },
      { name: 'by-updated-at', keyPath: 'updatedAt' },
    ],
  })

  // ── traceRecords：采集链路追踪记录（v27 新增） ──
  ensureStore(db, STORE_NAME.traceRecords, logger, {
    storeOptions: { keyPath: 'traceId' },
    logLevel: 'info',
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-dimension', keyPath: 'dimensionCode' },
      { name: 'by-started-at', keyPath: 'startedAt' },
      { name: 'by-result', keyPath: 'result' },
    ],
  })

  // ── workflowDefs：工作流定义（v28 新增，write-through 持久化） ──
  ensureStore(db, STORE_NAME.workflowDefs, logger, {
    storeOptions: { keyPath: 'id' },
    logLevel: 'info',
    indexes: [
      { name: 'by-updated-at', keyPath: 'updatedAt' },
      { name: 'by-name', keyPath: 'name' },
    ],
  })

  // ── workflowSchedules：定时调度定义（v28 新增，write-through 持久化） ──
  ensureStore(db, STORE_NAME.workflowSchedules, logger, {
    storeOptions: { keyPath: 'id' },
    logLevel: 'info',
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId' },
      { name: 'by-enabled', keyPath: 'enabled' },
    ],
  })

  // ── workflowTriggers：事件触发器定义（v28 新增，write-through 持久化） ──
  ensureStore(db, STORE_NAME.workflowTriggers, logger, {
    storeOptions: { keyPath: 'id' },
    logLevel: 'info',
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId' },
      { name: 'by-event', keyPath: 'event' },
      { name: 'by-enabled', keyPath: 'enabled' },
    ],
  })

  // ── workflowRuns：运行实例（v28 新增，checkpoint 持久化） ──
  ensureStore(db, STORE_NAME.workflowRuns, logger, {
    storeOptions: { keyPath: 'runId' },
    logLevel: 'info',
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId' },
      { name: 'by-status', keyPath: 'status' },
      { name: 'by-created-at', keyPath: 'createdAt' },
    ],
  })

  // ── analysisResults：分析结果（v30 新增，AnalysisOrchestrator 持久化） ──
  ensureStore(db, STORE_NAME.analysisResults, logger, {
    storeOptions: { keyPath: 'docId' },
    logLevel: 'info',
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-symbol-version', keyPath: ['symbol', 'version'], options: { unique: true } },
      { name: 'by-created-at', keyPath: 'createdAt' },
    ],
  })

  // ── collectionHistory：采集/更新历史（v31 新增，P2-1） ──
  ensureStore(db, STORE_NAME.collectionHistory, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp' },
      { name: 'by-date', keyPath: 'date' },
      { name: 'by-channel', keyPath: 'channel' },
      { name: 'by-status', keyPath: 'status' },
    ],
  })

  // ── conflictLog：冲突日志（v31 新增，P2-1） ──
  ensureStore(db, STORE_NAME.conflictLog, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp' },
      { name: 'by-symbol', keyPath: 'symbol' },
      { name: 'by-resolution', keyPath: 'resolution' },
    ],
  })

  // ── fileImportRecords：文件导入记录（v31 新增，P2-1） ──
  ensureStore(db, STORE_NAME.fileImportRecords, logger, {
    storeOptions: { keyPath: 'id' },
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp' },
      { name: 'by-hash', keyPath: 'fileHash' },
      { name: 'by-fileName', keyPath: 'fileName' },
    ],
  })

  // ── proofreadReports：校对报告（v31 新增，P2-1） ──
  ensureStore(db, STORE_NAME.proofreadReports, logger, {
    storeOptions: { keyPath: 'meta.reportId' },
    indexes: [
      { name: 'by-timestamp', keyPath: 'meta.generatedAt' },
      { name: 'by-fileHash', keyPath: 'meta.fileHash' },
    ],
  })

  // ── scheduleConfigs：调度配置（v31 新增，P2-1） ──
  ensureStore(db, STORE_NAME.scheduleConfigs, logger, {
    storeOptions: { keyPath: 'scheduleId' },
    indexes: [
      { name: 'by-enabled', keyPath: 'enabled' },
      { name: 'by-nextRun', keyPath: 'nextRunAt' },
    ],
  })

}
