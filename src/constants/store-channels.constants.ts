/**
 * Store 与 Channel 名称常量
 *
 * @description
 * 集中管理 V9 项目中跨模块复用的 channel、store、event 名称字面量，
 * 避免散落在各处的字符串不一致。所有数据流广播/订阅必须引用此处的常量。
 *
 * @module constants/store-channels
 * @created 2026-06-30 - G1 批次低风险优化（重复字面量提取）
 */

/**
 * 数据流通道名称（DataChannel）
 * @see {@link dataflowTypes.ts}
 */
export const DATA_CHANNELS = {
  /** 大盘指数数据 */
  MARKET_INDEX: 'market:index',
  /** 板块行情数据 */
  MARKET_SECTOR: 'market:sector',
  /** 资金流向数据 */
  MARKET_FUNDFLOW: 'market:fundflow',
  /** 市场情绪数据 */
  MARKET_EMOTION: 'market:emotion',
  /** 组合汇总数据 */
  PORTFOLIO_SUMMARY: 'portfolio:summary',
  /** 组合持仓数据 */
  PORTFOLIO_HOLDING: 'portfolio:holding',
  /** 策略信号 */
  STRATEGY_SIGNAL: 'strategy:signal',
  /** 策略评分 */
  STRATEGY_SCORE: 'strategy:score',
  /** Agent 状态 */
  AGENT_STATUS: 'agent:status',
  /** 系统健康 */
  SYSTEM_HEALTH: 'system:health',
} as const

export type DataChannelName = (typeof DATA_CHANNELS)[keyof typeof DATA_CHANNELS]

/**
 * EventBus 事件命名常量
 */
export const EVENT_NAMES = {
  STOCKS_CHANGED: 'stocks:changed',
  ORDERS_CHANGED: 'orders:changed',
  SIGNALS_CHANGED: 'signals:changed',
  V6_SCORES_CHANGED: 'v6_scores:changed',
  HOT_SECTOR_CHANGED: 'strategy:hotSectorChanged',
  VALUE_PIT_CHANGED: 'strategy:valuePitChanged',
  ROTATION_SIGNAL_TRIGGERED: 'strategy:rotationSignalTriggered',
  AGENT_STATUS_CHANGED: 'agent:statusChanged',
  SYSTEM_HEALTH_CHANGED: 'system:healthChanged',
  // ---- D-3 批次新增：Store 写操作广播 ----
  /** 股票池数据变更（poolStore 写操作触发） */
  STOCK_POOL_CHANGED: 'stock_pool:changed',
  /** 输出/导出操作完成（outputStore 写操作触发） */
  OUTPUT_CHANGED: 'output:changed',
  /** 分析评分变更（analysisStore 写操作触发） */
  SCORES_CHANGED: 'scores:changed',
  /** 持仓数据变更（holdingsStore / positionStore 写操作触发） */
  HOLDINGS_CHANGED: 'holdings:changed',
  /** 智能评分变更（intelligentScoreStore 写操作触发） */
  INTELLIGENT_SCORES_CHANGED: 'intelligent_scores:changed',
  /** 行业评分变更（industryScoreStore 写操作触发） */
  INDUSTRY_SCORES_CHANGED: 'industry_scores:changed',
  /** 策略快照变更（strategySnapshotStore 写操作触发） */
  STRATEGY_SNAPSHOTS_CHANGED: 'strategy_snapshots:changed',
  // ---- D-3 批次扩展：其余 Store 写操作广播 ----
  /** 总控舱数据变更（commandStore 写操作触发） */
  COMMAND_CHANGED: 'command:changed',
  /** 采集测试数据变更（dataTestStore 写操作触发） */
  DATA_TEST_CHANGED: 'data_test:changed',
  /** 双策略数据变更（dualStrategyStore 写操作触发） */
  DUAL_STRATEGY_CHANGED: 'dual_strategy:changed',
  /** 板块分析数据变更（sectorAnalysisStore 写操作触发） */
  SECTOR_ANALYSIS_CHANGED: 'sector_analysis:changed',
  /** 风控数据变更（riskStore 写操作触发） */
  RISK_CHANGED: 'risk:changed',
  /** 信号质量数据变更（signalQualityStore 写操作触发） */
  SIGNAL_QUALITY_CHANGED: 'signal_quality:changed',
  /** 轮动评分数据变更（rotationSignalStore 写操作触发） */
  ROTATION_SCORES_CHANGED: 'rotation_scores:changed',
  /** 市场数据变更（marketDataStore 写操作触发） */
  MARKET_DATA_CHANGED: 'market_data:changed',
  /** 交易纪律数据变更（disciplineStore 写操作触发） */
  DISCIPLINE_CHANGED: 'discipline:changed',
  /** 回测数据变更（backtestStore 写操作触发） */
  BACKTEST_CHANGED: 'backtest:changed',
  /** 评分文档数据变更（scoreDocStore 写操作触发） */
  SCORE_DOCS_CHANGED: 'score_docs:changed',
  /** 本地文档数据变更（localKnowledgeStore 写操作触发） */
  LOCAL_DOCS_CHANGED: 'local_docs:changed',
} as const

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES]

/**
 * 变更后缀，用于 `${channel}:changed` 事件命名
 */
export const CHANGED_SUFFIX = ':changed' as const

/**
 * 模块数据 store 名称（IndexedDB objectStore）
 * 与 {@link STORE_NAME} 保持一致；此处仅做业务语义注释
 */
export const STORE_DISPLAY_NAMES = {
  stocks: '股票池',
  v6_scores: 'V6 评分',
  intelligent_scores: '智能评分',
  industry_scores: '行业评分',
  orders: '订单',
  watchlists: '观察列表',
  signals: '信号',
  research_logs: '研究日志',
  daily_quotes: '日线行情',
  rotation_scores: '轮动评分',
  sector_scores: '板块评分',
  score_docs: '评分文档',
  strategy_snapshots: '策略快照',
  local_docs: '本地文档',
  news: '资讯',
  news_stock_map: '资讯-股票映射',
  sentiment_cache: '情感缓存',
  news_bookmarks: '资讯收藏',
  hot_sector_scores: '热门板块评分',
  value_pit_scores: '价值洼地评分',
  execution_plans: '执行计划',
  execution_logs: '执行日志',
  missing_reports: '缺失报告',
} as const
