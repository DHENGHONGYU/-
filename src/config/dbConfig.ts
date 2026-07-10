const testDbName = typeof process !== 'undefined' ? process.env.TEST_DB_NAME : undefined
export const DB_NAME = testDbName ? testDbName : ('V6ProDB' as const)
export const DB_VERSION = 27 as const

// DB_VERSION 升级历史：
// v3 → v4: 新增 daily_quotes 存储，用于保存 K线/行情数据。
// v4 → v5: stocks 存储新增 group 字段与 by-group 索引，历史数据回退为默认分组。
// v5 → v6: 新增 rotation_scores、sector_scores、score_docs、strategy_snapshots、
//          local_docs、news、news_stock_map、sentiment_cache 存储，支撑 V6 Pro 迁移能力。
// v6 → v12: V9 架构升级，统一数据模型与类型系统，优化索引结构。
// v12 → v13: 新增 news_bookmarks 存储，用于持久化资讯收藏状态。
// v13 → v14: 新增 hot_sector_scores、value_pit_scores 存储，支撑双策略体系。
// v14 → v15: 新增 execution_logs、missing_reports 存储；hot_sector_scores 维度字段 composite 重命名为 marketEnv；value_pit_scores 移除 composite 字段。
// v15 → v16: 新增 execution_plans（执行计划）、portfolios（投资组合）存储。
// v16 → v17: 新增 agent_tasks、agent_health_logs 存储（智能体调度层）。
// v17 → v18: 新增 command_audit_logs 存储（命令审计日志）。
// v18 → v19: 新增 export_tasks、execution_strategies 存储（输出舱与执行模块）。
// v19 → v20: 新增 trade_reviews 存储（交易纪律复盘）。
// v20 → v21: 数据字典补全：完善 ACL 矩阵，新增 datalayer 模块的 read/write 权限。
// v21 → v22: 新增 financial_reports 存储，支撑评分引擎财务数据管道。
// v22 → v23: 新增 schema_migrations 存储（迁移追踪），落地 D-01 Schema 迁移框架。
// v23 → v24: 新增 RBAC 5 表模式（rbac_users/rbac_roles/rbac_permissions/rbac_user_roles/
//            rbac_role_permissions/rbac_permission_audit_logs），支撑权限自动回收与僵尸账号检测。
// v24 → v25: 新增 collect_config 存储，用于持久化采集策略配置。
// v25 → v26: 新增 custom_agents 存储（阶段 B-1），用于持久化用户在「自定义智能体」页创建的 Agent。
// v26 → v27: 新增 trace_records 存储，用于持久化采集链路追踪数据。
// @compliance AGENTS.md §八：DB_VERSION 必须与浏览器现有版本匹配或更高

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
  event: 'event',
  /** 策略数据流：热门板块 */
  'strategy:hotSector': 'strategy:hotSector',
  /** 策略数据流：价值洼地 */
  'strategy:valuePit': 'strategy:valuePit',
  /** 策略数据流：轮动信号 */
  'strategy:rotationSignal': 'strategy:rotationSignal',
  /** 执行计划模块 */
  executionPlans: 'executionPlans',
  /** 执行日志模块 */
  executionLogs: 'executionLogs',
  /** 缺失报告模块 */
  missingReports: 'missingReports',
  /** 组合管理模块 */
  portfolios: 'portfolios',
  /** 交易复盘模块 */
  tradeReviews: 'tradeReviews',
} as const

export type EnvelopeTarget =
  (typeof ENVELOPE_TARGET)[keyof typeof ENVELOPE_TARGET]

export const ENVELOPE_ACTION = {
  insertStock: 'INSERT_STOCK',
  updateStock: 'UPDATE_STOCK',
  deleteStock: 'DELETE_STOCK',
  saveScores: 'SAVE_SCORES',
  saveDailyQuotes: 'SAVE_DAILY_QUOTES',
  saveFinancialReport: 'SAVE_FINANCIAL_REPORT',
  saveIntelligentScores: 'SAVE_INTELLIGENT_SCORES',
  saveIndustryScores: 'SAVE_INDUSTRY_SCORES',
  saveRotationScores: 'SAVE_ROTATION_SCORES',
  saveSectorScores: 'SAVE_SECTOR_SCORES',
  saveScoreDocs: 'SAVE_SCORE_DOCS',
  saveStrategySnapshots: 'SAVE_STRATEGY_SNAPSHOTS',
  saveHotSectorScores: 'SAVE_HOT_SECTOR_SCORES',
  saveValuePitScores: 'SAVE_VALUE_PIT_SCORES',
  saveLocalDocs: 'SAVE_LOCAL_DOCS',
  saveNews: 'SAVE_NEWS',
  saveNewsStockMap: 'SAVE_NEWS_STOCK_MAP',
  saveSentimentCache: 'SAVE_SENTIMENT_CACHE',
  newsArticleLoaded: 'NEWS_ARTICLE_LOADED',
  newsArticleBookmarked: 'NEWS_ARTICLE_BOOKMARKED',
  holdingsDataLoaded: 'HOLDINGS_DATA_LOADED',
  tradeActionExecuted: 'TRADE_ACTION_EXECUTED',
  saveResearchLog: 'SAVE_RESEARCH_LOG',
  insertSignal: 'INSERT_SIGNAL',
  insertOrder: 'INSERT_ORDER',
  updateOrder: 'UPDATE_ORDER',
  deleteOrder: 'DELETE_ORDER',
  resetAll: 'RESET_ALL',
  importAll: 'IMPORT_ALL',
  exportAll: 'EXPORT_ALL',
  /** 策略：触发热门板块重新计算 */
  strategyHotSectorRefresh: 'STRATEGY_HOT_SECTOR_REFRESH',
  /** 策略：触发价值洼地重新计算 */
  strategyValuePitRefresh: 'STRATEGY_VALUE_PIT_REFRESH',
  /** 策略：触发轮动信号检测 */
  strategyRotationSignalDetect: 'STRATEGY_ROTATION_SIGNAL_DETECT',
  /** 反馈：检测到数据问题 */
  feedbackIssuesDetected: 'FEEDBACK_ISSUES_DETECTED',
  /** 交易复盘保存 */
  saveTradeReview: 'SAVE_TRADE_REVIEW',
  /** 执行计划保存 */
  saveExecutionPlan: 'SAVE_EXECUTION_PLAN',
  /** 执行日志保存 */
  saveExecutionLog: 'SAVE_EXECUTION_LOG',
  /** 缺失报告保存 */
  saveMissingReport: 'SAVE_MISSING_REPORT',
  /** 更新执行阶段 */
  updateExecutionPhase: 'UPDATE_EXECUTION_PHASE',
  /** 加载持仓数据 */
  loadHoldingsData: 'LOAD_HOLDINGS_DATA',
  /** 保存投资组合 */
  savePortfolio: 'SAVE_PORTFOLIO',
  /** 更新执行计划 */
  updateExecutionPlan: 'UPDATE_EXECUTION_PLAN',
  /** 删除执行计划 */
  deleteExecutionPlan: 'DELETE_EXECUTION_PLAN',
  /** 增加缺失报告重试次数 */
  incrementMissingReportRetry: 'INCREMENT_MISSING_REPORT_RETRY',
  /** 保存观察列表快照（修复 C4：孤立的 watchlists 物理表写入通道） */
  saveWatchlist: 'SAVE_WATCHLIST',
  // ── RBAC 6 表写入通道（v24 新增；STORE_NAME 已含 rbac* 表，无需 as StoreName 断言） ──
  /** 保存 RBAC 用户 */
  saveRbacUser: 'SAVE_RBAC_USER',
  /** 保存 RBAC 角色 */
  saveRbacRole: 'SAVE_RBAC_ROLE',
  /** 保存 RBAC 权限 */
  saveRbacPermission: 'SAVE_RBAC_PERMISSION',
  /** 保存用户-角色映射 */
  saveRbacUserRole: 'SAVE_RBAC_USER_ROLE',
  /** 保存角色-权限映射 */
  saveRbacRolePermission: 'SAVE_RBAC_ROLE_PERMISSION',
  /** 保存权限审计日志（append-only） */
  saveRbacAuditLog: 'SAVE_RBAC_AUDIT_LOG',
  /** 删除权限审计日志（仅归档服务 RBAC-S3 使用，普通调用禁止） */
  deleteRbacAuditLog: 'DELETE_RBAC_AUDIT_LOG',
  /** 保存采集配置（v25 新增） */
  saveCollectConfig: 'SAVE_COLLECT_CONFIG',
  /** 删除采集配置（v25 新增） */
  deleteCollectConfig: 'DELETE_COLLECT_CONFIG',
  // ── 自定义智能体通道（v26 新增，阶段 B-1） ──
  /** 保存/更新自定义智能体 */
  saveCustomAgent: 'SAVE_CUSTOM_AGENT',
  /** 删除自定义智能体 */
  deleteCustomAgent: 'DELETE_CUSTOM_AGENT',
  /** 保存采集链路追踪记录（v27 新增） */
  saveTraceRecord: 'SAVE_TRACE_RECORD',
  // ── 批量操作（BulkEnvelope） ──
  /** 批量插入股票 */
  bulkInsertStock: 'BULK_INSERT_STOCK',
  /** 批量保存行情数据 */
  bulkSaveDailyQuotes: 'BULK_SAVE_DAILY_QUOTES',
  /** 批量保存评分数据 */
  bulkSaveScores: 'BULK_SAVE_SCORES',
  /** 批量保存财务报告 */
  bulkSaveFinancialReports: 'BULK_SAVE_FINANCIAL_REPORTS',
  /** 批量保存新闻数据 */
  bulkSaveNews: 'BULK_SAVE_NEWS',
  // 查询操作（QueryEnvelope）
  /** 查询单条记录 */
  queryGet: 'QUERY_GET',
  /** 查询全部记录 */
  queryList: 'QUERY_LIST',
  /** 按索引查询记录 */
  queryByIndex: 'QUERY_BY_INDEX',
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
  trading: 'trading',
  strategy: 'strategy',
  orderstore: 'orderstore',
  holdingsStore: 'holdingsStore',
  executionPlans: 'executionPlans',
  executionLogs: 'executionLogs',
  missingReports: 'missingReports',
  portfolios: 'portfolios',
  tradeReviews: 'tradeReviews',
  datalayer: 'datalayer',
  /** RBAC 权限管理模块（v24 新增） */
  rbac: 'rbac',
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
  financialReports: 'financial_reports',
  rotationScores: 'rotation_scores',
  sectorScores: 'sector_scores',
  scoreDocs: 'score_docs',
  strategySnapshots: 'strategy_snapshots',
  localDocs: 'local_docs',
  news: 'news',
  newsStockMap: 'news_stock_map',
  sentimentCache: 'sentiment_cache',
  newsBookmarks: 'news_bookmarks',
  hotSectorScores: 'hot_sector_scores',
  valuePitScores: 'value_pit_scores',
  executionPlans: 'execution_plans',
  executionLogs: 'execution_logs',
  missingReports: 'missing_reports',
  portfolios: 'portfolios',
  tradeReviews: 'trade_reviews',
  schemaMigrations: 'schema_migrations',
  // ── 采集配置存储（v25 新增） ──
  collectConfig: 'collect_config',
  // ── RBAC 5 表模式（v24 新增） ──
  rbacUsers: 'rbac_users',
  rbacRoles: 'rbac_roles',
  rbacPermissions: 'rbac_permissions',
  rbacUserRoles: 'rbac_user_roles',
  rbacRolePermissions: 'rbac_role_permissions',
  rbacPermissionAuditLogs: 'rbac_permission_audit_logs',
  // ── 自定义智能体存储（v26 新增，阶段 B-1） ──
  customAgents: 'custom_agents',
  // ── 采集链路追踪存储（v27 新增） ──
  traceRecords: 'trace_records',
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
    read: [STORE_NAME.traceRecords, STORE_NAME.collectConfig],
    write: [STORE_NAME.stocks, STORE_NAME.dailyQuotes, STORE_NAME.financialReports, STORE_NAME.collectConfig, STORE_NAME.traceRecords],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete, DB_OPERATION.select],
  },
  [MODULE_ID.stockpool]: {
    read: [STORE_NAME.stocks, STORE_NAME.v6Scores],
    write: [STORE_NAME.stocks],
    // 修复 2026-07-08: 添加 DB_OPERATION.select，允许 poolStore 通过 DataBridge 查询 stocks/v6Scores
    // 原配置仅允许 insert/update/delete，导致 poolStore.refresh() 触发 ACL_PERMISSION_DENIED
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.analyzer]: {
    read: [
      STORE_NAME.stocks,
      STORE_NAME.v6Scores,
      STORE_NAME.intelligentScores,
      STORE_NAME.industryScores,
      STORE_NAME.scoreDocs,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
      STORE_NAME.signals,
    ],
    write: [
      STORE_NAME.v6Scores,
      STORE_NAME.intelligentScores,
      STORE_NAME.industryScores,
      STORE_NAME.scoreDocs,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
    ],
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
    read: [STORE_NAME.stocks, STORE_NAME.news, STORE_NAME.newsStockMap, STORE_NAME.sentimentCache, STORE_NAME.newsBookmarks],
    write: [STORE_NAME.news, STORE_NAME.newsStockMap, STORE_NAME.sentimentCache, STORE_NAME.newsBookmarks],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.tradinghub]: {
    read: [
      STORE_NAME.stocks,
      STORE_NAME.v6Scores,
      STORE_NAME.orders,
      STORE_NAME.signals,
      STORE_NAME.strategySnapshots,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
    ],
    write: [
      STORE_NAME.orders,
      STORE_NAME.signals,
      STORE_NAME.strategySnapshots,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
    ],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.trading]: {
    read: [STORE_NAME.stocks, STORE_NAME.orders, STORE_NAME.signals, STORE_NAME.strategySnapshots],
    write: [STORE_NAME.orders, STORE_NAME.signals],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update],
  },
  [MODULE_ID.system]: {
    read: Object.values(STORE_NAME),
    write: Object.values(STORE_NAME),
    actions: Object.values(DB_OPERATION),
  },
  [MODULE_ID.user]: {
    read: [STORE_NAME.stocks, STORE_NAME.v6Scores, STORE_NAME.orders, STORE_NAME.customAgents],
    write: [STORE_NAME.stocks, STORE_NAME.orders, STORE_NAME.customAgents],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.strategy]: {
    read: [
      STORE_NAME.stocks,
      STORE_NAME.v6Scores,
      STORE_NAME.dailyQuotes,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
      STORE_NAME.rotationScores,
      STORE_NAME.signals,
    ],
    write: [STORE_NAME.hotSectorScores, STORE_NAME.valuePitScores, STORE_NAME.signals],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update],
  },
  [MODULE_ID.orderstore]: {
    read: [STORE_NAME.orders],
    write: [STORE_NAME.orders],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.holdingsStore]: {
    read: [STORE_NAME.stocks, STORE_NAME.orders],
    write: [],
    actions: [DB_OPERATION.select],
  },
  [MODULE_ID.executionPlans]: {
    read: [STORE_NAME.executionPlans],
    write: [STORE_NAME.executionPlans],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.executionLogs]: {
    read: [STORE_NAME.executionLogs],
    write: [STORE_NAME.executionLogs],
    actions: [DB_OPERATION.insert],
  },
  [MODULE_ID.missingReports]: {
    read: [STORE_NAME.missingReports],
    write: [STORE_NAME.missingReports],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.portfolios]: {
    read: [STORE_NAME.portfolios],
    write: [STORE_NAME.portfolios],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.tradeReviews]: {
    read: [STORE_NAME.tradeReviews],
    write: [STORE_NAME.tradeReviews],
    actions: [DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
  [MODULE_ID.datalayer]: {
    read: Object.values(STORE_NAME),
    write: [],
    actions: [DB_OPERATION.select],
  },
  [MODULE_ID.rbac]: {
    read: [
      STORE_NAME.rbacUsers,
      STORE_NAME.rbacRoles,
      STORE_NAME.rbacPermissions,
      STORE_NAME.rbacUserRoles,
      STORE_NAME.rbacRolePermissions,
      STORE_NAME.rbacPermissionAuditLogs,
    ],
    write: [
      STORE_NAME.rbacUsers,
      STORE_NAME.rbacRoles,
      STORE_NAME.rbacPermissions,
      STORE_NAME.rbacUserRoles,
      STORE_NAME.rbacRolePermissions,
      // 注意：审计日志表遵循 append-only 原则，只能通过 saveRbacAuditLog action 追加
      // 例外：归档服务（RBAC-S3）通过 deleteRbacAuditLog action 删除已导出的过期日志
      // 详见 auditLogArchiveService.deleteArchivedLogs()
      STORE_NAME.rbacPermissionAuditLogs,
    ],
    actions: [DB_OPERATION.select, DB_OPERATION.insert, DB_OPERATION.update, DB_OPERATION.delete],
  },
}

export interface EnvelopeMeta {
  source: ModuleId
  target: EnvelopeTarget
  action: EnvelopeAction
  traceId: string
  timestamp: number
}
