/**
 * @module MockDataCollection
 * @description 数据采集模块 Mock 数据生成器。提供本地开发时使用的模拟采集任务、
 * 数据源配置、原始市场数据以及任务调度器行为模拟。
 *
 * 注意：此文件可被 vite.config.ts 的 mock 中间件或 vitest 动态导入，
 * 因此所有类型和常量均内联定义，避免模块路径解析问题。
 *
 * 覆盖接口：DataSourceConfig, CollectionTask, RawMarketData, CollectorConfig,
 *          BaseCollector 行为, TaskScheduler 行为, MarketDataAdapter 行为,
 *          MockCollector / RestCollector / WebSocketCollector 实现
 */

import { DATA_COLLECTION_TIMEOUT_MS } from '@/config/timeouts'
import { MockStockAnalysisScoringStrategy } from '@/services/stock-analysis/scoringStrategy'
import { getTradeReviewScoreCalculator } from '@/services/trading/tradeReviewScoring'

/** 评分数据生成策略实例（P5-7：评分计算从采集层移回分析层） */
const stockAnalysisScoring = new MockStockAnalysisScoringStrategy()

// ============================================================
// 内联类型（避免 @/ 别名导入在 vite.config 上下文中无法解析）
// ============================================================

type DataSourceType = 'mock' | 'rest' | 'websocket'
type CollectionMode = 'polling' | 'once' | 'streaming'
type CollectionTaskStatus = 'pending' | 'running' | 'paused' | 'error' | 'completed'
type DataType =
  | 'indices'
  | 'sectors'
  | 'fundFlow'
  | 'sentiment'
  | 'watchlist'
  | 'portfolio'
  | 'tradeReview'
  | 'analysisScores'
  | 'modelComparison'
  | 'poolBoard'
  | 'chatHistory'

const DATA_SOURCE_TYPE = { MOCK: 'mock' as const, REST: 'rest' as const, WEBSOCKET: 'websocket' as const }
const COLLECTION_MODE = { POLLING: 'polling' as const, ONCE: 'once' as const, STREAMING: 'streaming' as const }
const COLLECTION_TASK_STATUS = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  PAUSED: 'paused' as const,
  ERROR: 'error' as const,
  COMPLETED: 'completed' as const,
}

// ============================================================
// 接口 1: DataSourceConfig — 数据源配置
// ============================================================

interface DataSourceConfig {
  type: DataSourceType
  mode: CollectionMode
  interval: number
  endpoint?: string
  params?: Record<string, unknown>
  enabled: boolean
}

// ============================================================
// 接口 2: CollectionTask — 采集任务定义
// ============================================================

interface CollectionTask {
  taskId: string
  widgetId: string
  instanceId: string
  dataSource: DataSourceConfig
  status: CollectionTaskStatus
  error?: string
  lastRun?: number
  nextRun?: number
  runCount: number
  successCount: number
  failCount: number
}

// ============================================================
// 接口 3: RawMarketData — 原始市场数据
// ============================================================

interface RawMarketData {
  dataType: DataType
  source: string
  payload: unknown
  timestamp: number
}

// ============================================================
// 接口 4: CollectorConfig — 采集器配置
// ============================================================

interface CollectorConfig {
  timeout: number
  retryCount: number
  retryInterval: number
}

// ============================================================
// 接口 5/6/7/8 相关: 辅助数据类型
// ============================================================

/** 大盘指数数据 */
interface MarketIndexData {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  high?: number
  low?: number
  volume?: string
}

/** 板块热力图数据 */
interface SectorHeatmapData {
  name: string
  code: string
  changePercent: number
  turnover?: string
}

/** 资金流向数据 */
interface FundFlowData {
  type: string
  name: string
  value: number
  unit: string
}

/** 市场情绪数据 */
interface SentimentData {
  fearGreedIndex: number
  fearGreedLabel: string
  totalStocks: number
  up: number
  down: number
  flat: number
  limitUp: number
  limitDown: number
}

/** 自选股数据 */
interface WatchlistData {
  name: string
  code: string
  price: number
  changePercent: number
}

/** 持仓概览数据 */
interface PortfolioData {
  totalAssets: string
  availableFunds: string
  todayPnL: string
  todayPnLPercent: number
  totalPnL: string
  totalPnLPercent: number
  holdings: number
}

/** AI 交易复盘数据 */
interface TradeReviewData {
  totalTrades: number
  profitable: number
  losing: number
  winRate: number
  profitLossRatio: number
  disciplineScore: number
}

/** 投资画像指标 */
interface ProfileMetric {
  name: string
  score: number
  description: string
  icon?: string
}

/** 投资画像数据 */
interface InvestmentProfile {
  tags: string[]
  metrics: ProfileMetric[]
}

/** KAI 维度评分 */
interface KaiDimension {
  name: string
  score: number
  weight: number
  status: string
  color: string
}

/** KAI 维度细项 */
interface KaiDetailItem {
  dimensionName: string
  itemName: string
  score: number
  weight: number
  color: string
}

/** KAI 综合评分 */
interface KaiScore {
  totalScore: number
  sentiment: number
  trend: number
  flow: number
  dimensions: KaiDimension[]
  detailDistribution: KaiDetailItem[]
}

/** 分析评分汇总 */
interface AnalysisScores {
  profile: InvestmentProfile
  kai: KaiScore
}

/** 模型信息 */
interface ModelInfo {
  id: string
  name: string
  version: string
  score: number
}

/** 模型对比维度 */
interface CompareDimension {
  name: string
  leftScore: number
  rightScore: number
  weight: number
}

/** 模型对比数据 */
interface ModelComparison {
  leftModel: ModelInfo
  rightModel: ModelInfo
  dimensions: CompareDimension[]
  riskHint: string
}

/** 股票池看板条目 */
interface PoolBoardItem {
  code: string
  name: string
  price: number
  changePercent: number
  turnover: string
  turnoverRate: string
  statusColor: string
  statusLabel: string
}

/** 股票池看板数据 */
interface PoolBoard {
  items: PoolBoardItem[]
  total: number
  page: number
  pageSize: number
}

/** 聊天消息 */
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** 聊天历史 */
interface ChatHistory {
  target: string
  targetType: 'stock' | 'market'
  messages: ChatMessage[]
}

/** 任务采集结果回调 */
type CollectionResultCallback = (data: { taskId: string; widgetId: string; instanceId: string; data: RawMarketData }) => void

/** 任务调度器状态摘要 */
interface SchedulerStats {
  totalTasks: number
  pendingTasks: number
  runningTasks: number
  failedTasks: number
  completedTasks: number
}

// ============================================================
// 确定性随机数生成器（保证每次生成数据一致）
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const rand = seededRandom(99)

/** 生成指定范围内的随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

/** 生成指定范围内的随机浮点数 */
function randFloat(min: number, max: number, decimals = 2): number {
  return Number((rand() * (max - min) + min).toFixed(decimals))
}

// ============================================================
// 1. Mock DataSourceConfig — 数据源配置
// ============================================================

const WIDGET_IDS = [
  'marketIndices',
  'sectorHeatmap',
  'fundFlow',
  'marketSentiment',
  'watchlist',
  'portfolioOverview',
  'aiTradeReview',
  'investmentProfile',
  'poolBoard',
  'kaiScore',
  'modelCompare',
  'stockChat',
]

const WIDGET_ENDPOINTS: Record<string, string> = {
  marketIndices: '/market/indices',
  sectorHeatmap: '/market/sectors',
  fundFlow: '/market/fund-flow',
  marketSentiment: '/market/sentiment',
  watchlist: '/user/watchlist',
  portfolioOverview: '/portfolio/overview',
  aiTradeReview: '/trade/review',
  investmentProfile: '/stock-analysis/profile',
  poolBoard: '/stock-analysis/pool',
  kaiScore: '/stock-analysis/kai-score',
  modelCompare: '/stock-analysis/model-compare',
  stockChat: '/chat/stock-analysis',
}

/**
 * 为指定 Widget 生成数据源配置
 */
export function generateDataSourceConfig(widgetId: string, overrides?: Partial<DataSourceConfig>): DataSourceConfig {
  return {
    type: overrides?.type ?? DATA_SOURCE_TYPE.MOCK,
    mode: overrides?.mode ?? COLLECTION_MODE.POLLING,
    interval: overrides?.interval ?? 5000,
    endpoint: overrides?.endpoint ?? WIDGET_ENDPOINTS[widgetId] ?? `/data/${widgetId}`,
    params: overrides?.params ?? {},
    enabled: overrides?.enabled ?? true,
  }
}

/**
 * 生成所有 Widget 的数据源配置列表
 */
export function generateAllDataSourceConfigs(): DataSourceConfig[] {
  return WIDGET_IDS.map((id) => generateDataSourceConfig(id))
}

// ============================================================
// 2. Mock CollectionTask — 采集任务定义
// ============================================================

let taskCounter = 0

/**
 * 为指定 Widget 生成采集任务
 */
export function generateCollectionTask(
  widgetId: string,
  instanceId?: string,
  overrides?: Partial<CollectionTask>,
): CollectionTask {
  taskCounter++
  const instId = instanceId ?? `${widgetId}_1`
  const now = Date.now()
  const runCount = overrides?.runCount ?? randInt(0, 50)
  const failCount = overrides?.failCount ?? (runCount > 0 ? randInt(0, Math.min(3, runCount)) : 0)

  return {
    taskId: overrides?.taskId ?? `task_${widgetId}_${instId}_${taskCounter}`,
    widgetId,
    instanceId: instId,
    dataSource: overrides?.dataSource ?? generateDataSourceConfig(widgetId),
    status: overrides?.status ?? COLLECTION_TASK_STATUS.RUNNING,
    error: overrides?.error,
    lastRun: overrides?.lastRun ?? now - randInt(1000, 10000),
    nextRun: overrides?.nextRun ?? now + 5000,
    runCount,
    successCount: runCount - failCount,
    failCount,
  }
}

/**
 * 生成所有 Widget 的采集任务（含多种状态以覆盖测试场景）
 */
export function generateAllCollectionTasks(): CollectionTask[] {
  const statuses: CollectionTaskStatus[] = ['running', 'running', 'running', 'running', 'pending', 'pending', 'paused', 'error', 'completed', 'running', 'running', 'running']
  return WIDGET_IDS.map((id, i) =>
    generateCollectionTask(id, undefined, {
      status: statuses[i % statuses.length]!,
      error: statuses[i % statuses.length] === 'error' ? 'Network timeout: exceeded 10000ms' : undefined,
    }),
  )
}

/**
 * 导出固定的采集任务集合（用于测试断言）
 */
export const MOCK_COLLECTION_TASKS: CollectionTask[] = generateAllCollectionTasks()

// ============================================================
// 3. Mock RawMarketData — 原始市场数据 + 各 dataType 的 payload
// ============================================================

/** 生成大盘指数 payload */
function generateIndicesPayload(): MarketIndexData[] {
  const indices = [
    { code: '000001', name: '上证指数', basePrice: 3350 },
    { code: '399001', name: '深证成指', basePrice: 10850 },
    { code: '399006', name: '创业板指', basePrice: 2150 },
    { code: '000688', name: '科创50', basePrice: 980 },
  ]
  return indices.map((idx) => {
    const changePercent = randFloat(-3, 3)
    const change = Number((idx.basePrice * changePercent / 100).toFixed(2))
    return {
      code: idx.code,
      name: idx.name,
      price: Number((idx.basePrice + change).toFixed(2)),
      change,
      changePercent,
      high: Number((idx.basePrice + Math.abs(change) * 1.5).toFixed(2)),
      low: Number((idx.basePrice - Math.abs(change) * 1.2).toFixed(2)),
      volume: `${randInt(100, 500)}亿`,
    }
  })
}

/** 生成板块热力图 payload */
function generateSectorsPayload(): SectorHeatmapData[] {
  const sectors = [
    '银行', '白酒', '新能源汽车', '医药', '非银金融', '食品饮料',
    '电力设备', '电子', '房地产', '计算机', '家用电器', '商贸零售',
  ]
  return sectors.map((name) => ({
    name,
    code: `SECTOR_${name}`,
    changePercent: randFloat(-5, 5),
    turnover: `${randFloat(10, 200, 1)}亿`,
  }))
}

/** 生成资金流向 payload */
function generateFundFlowPayload(): FundFlowData[] {
  return [
    { type: 'main', name: '主力净流入', value: randFloat(-200, 200), unit: '亿' },
    { type: 'retail', name: '散户净流入', value: randFloat(-100, 100), unit: '亿' },
    { type: 'north', name: '北向净流入', value: randFloat(-50, 50), unit: '亿' },
  ]
}

/** 生成市场情绪 payload */
function generateSentimentPayload(): SentimentData {
  const fearGreedIndex = randInt(0, 100)
  const labels = ['极度恐惧', '恐惧', '中性', '贪婪', '极度贪婪']
  const thresholds = [20, 40, 60, 80]
  let labelIdx = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (fearGreedIndex >= thresholds[i]!) labelIdx = i + 1
  }

  const totalStocks = randInt(4500, 5200)
  const up = randInt(1000, 3500)
  const down = Math.min(totalStocks - up - randInt(100, 500), totalStocks - up)
  const flat = totalStocks - up - down

  return {
    fearGreedIndex,
    fearGreedLabel: labels[labelIdx]!,
    totalStocks,
    up,
    down,
    flat,
    limitUp: randInt(20, 120),
    limitDown: randInt(0, 30),
  }
}

/** 生成自选股 payload */
function generateWatchlistPayload(): WatchlistData[] {
  const stocks = [
    { code: '600519', name: '贵州茅台' },
    { code: '000858', name: '五粮液' },
    { code: '300750', name: '宁德时代' },
    { code: '002594', name: '比亚迪' },
    { code: '600036', name: '招商银行' },
    { code: '601318', name: '中国平安' },
    { code: '600276', name: '恒瑞医药' },
    { code: '000333', name: '美的集团' },
  ]
  return stocks.map((s) => ({
    ...s,
    price: randFloat(10, 2000),
    changePercent: randFloat(-5, 5),
  }))
}

/** 生成持仓概览 payload */
function generatePortfolioPayload(): PortfolioData {
  const totalAssets = randFloat(500000, 5000000, 0)
  const todayPnLPercent = randFloat(-5, 5)
  const totalPnLPercent = randFloat(-20, 40)
  return {
    totalAssets: totalAssets.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }).replace('CN¥', '¥'),
    availableFunds: (totalAssets * randFloat(0.1, 0.5)).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }).replace('CN¥', '¥'),
    todayPnL: (totalAssets * todayPnLPercent / 100).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }).replace('CN¥', '¥'),
    todayPnLPercent,
    totalPnL: (totalAssets * totalPnLPercent / 100).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }).replace('CN¥', '¥'),
    totalPnLPercent,
    holdings: randInt(3, 25),
  }
}

/** 生成 AI 交易复盘 payload */
function generateTradeReviewPayload(): TradeReviewData {
  const totalTrades = randInt(50, 300)
  const profitable = randInt(20, Math.floor(totalTrades * 0.8))
  return {
    totalTrades,
    profitable,
    losing: totalTrades - profitable,
    winRate: Number((profitable / totalTrades).toFixed(2)),
    profitLossRatio: randFloat(1.0, 3.5),
    // P5-7：纪律分通过交易复盘评分计算器获取，采集层不再硬编码
    disciplineScore: getTradeReviewScoreCalculator().calculateDisciplineScore(),
  }
}

/** 生成投资画像 + KAI 评分 payload */
function generateAnalysisScoresPayload(): AnalysisScores {
  // P5-7：评分计算委托给分析层策略，采集层不再硬编码评分
  return stockAnalysisScoring.generateAnalysisScores() as AnalysisScores
}

/** 生成模型对比 payload */
function generateModelComparisonPayload(): ModelComparison {
  // P5-7：评分计算委托给分析层策略，采集层不再硬编码评分
  return stockAnalysisScoring.generateModelComparison()
}

/** 生成股票池看板 payload */
function generatePoolBoardPayload(): PoolBoard {
  const statusColors = ['#22c55e', '#3b82f6', '#f59e0b', '#9ca3af']
  const statusLabels = ['活跃', '温热', '冷清', '冷淡']
  const items: PoolBoardItem[] = [
    { code: '600519', name: '贵州茅台' },
    { code: '000858', name: '五粮液' },
    { code: '300750', name: '宁德时代' },
    { code: '002594', name: '比亚迪' },
    { code: '600036', name: '招商银行' },
    { code: '601318', name: '中国平安' },
    { code: '600276', name: '恒瑞医药' },
    { code: '000333', name: '美的集团' },
    { code: '600030', name: '中信证券' },
    { code: '688981', name: '中芯国际' },
  ].map((s, i) => {
    const statusIdx = i % statusColors.length
    return {
      ...s,
      price: randFloat(10, 2000),
      changePercent: randFloat(-5, 5),
      turnover: `${randFloat(1, 100, 1)}亿`,
      turnoverRate: `${randFloat(0.1, 15, 2)}%`,
      statusColor: statusColors[statusIdx]!,
      statusLabel: statusLabels[statusIdx]!,
    }
  })

  return { items, total: 50, page: 1, pageSize: 10 }
}

/** 生成聊天历史 payload */
function generateChatHistoryPayload(): ChatHistory {
  const now = Date.now()
  return {
    target: '600519',
    targetType: 'stock',
    messages: [
      { id: 'msg_1', role: 'user', content: '分析一下贵州茅台最近走势', timestamp: now - 60000 },
      { id: 'msg_2', role: 'assistant', content: '贵州茅台近期走势稳中偏强。从技术面看，股价在 1800 元附近获得支撑...', timestamp: now - 55000 },
      { id: 'msg_3', role: 'user', content: '估值方面怎么看？', timestamp: now - 30000 },
      { id: 'msg_4', role: 'assistant', content: '当前 PE 约 28 倍，处于近 5 年 30% 分位，估值合理偏低...', timestamp: now - 25000 },
    ],
  }
}

/**
 * 按 dataType 生成原始市场数据
 */
export function generateRawMarketData(
  dataType: DataType,
  source = 'mock',
  timestamp?: number,
): RawMarketData {
  const payloadGenerators: Record<DataType, () => unknown> = {
    indices: generateIndicesPayload,
    sectors: generateSectorsPayload,
    fundFlow: generateFundFlowPayload,
    sentiment: generateSentimentPayload,
    watchlist: generateWatchlistPayload,
    portfolio: generatePortfolioPayload,
    tradeReview: generateTradeReviewPayload,
    analysisScores: generateAnalysisScoresPayload,
    modelComparison: generateModelComparisonPayload,
    poolBoard: generatePoolBoardPayload,
    chatHistory: generateChatHistoryPayload,
  }

  return {
    dataType,
    source,
    payload: (payloadGenerators[dataType] ?? (() => ({})))() ,
    timestamp: timestamp ?? Date.now(),
  }
}

/**
 * 生成所有 11 种数据类型的原始市场数据
 */
export function generateAllRawMarketData(): RawMarketData[] {
  const types: DataType[] = [
    'indices', 'sectors', 'fundFlow', 'sentiment', 'watchlist',
    'portfolio', 'tradeReview', 'analysisScores', 'modelComparison',
    'poolBoard', 'chatHistory',
  ]
  return types.map((t) => generateRawMarketData(t))
}

/** 固定数据集（用于测试断言） */
export const MOCK_RAW_MARKET_DATA: RawMarketData[] = generateAllRawMarketData()

// ============================================================
// 4. Mock CollectorConfig — 采集器配置
// ============================================================

/**
 * 生成默认采集器配置
 */
export function generateDefaultCollectorConfig(): CollectorConfig {
  return {
    timeout: DATA_COLLECTION_TIMEOUT_MS,
    retryCount: 3,
    retryInterval: 2000,
  }
}

/**
 * 生成 Mock 采集器配置
 */
export function generateMockCollectorConfig(): CollectorConfig & { minDelay: number; maxDelay: number; priceFluctuation: number; defaultSeed: string } {
  return {
    timeout: DATA_COLLECTION_TIMEOUT_MS,
    retryCount: 3,
    retryInterval: 2000,
    minDelay: 200,
    maxDelay: 1000,
    priceFluctuation: 0.02,
    defaultSeed: 'v9-market-data',
  }
}

/**
 * 生成 REST 采集器配置
 */
export function generateRestCollectorConfig(): CollectorConfig & { baseUrl: string; defaultHeaders: Record<string, string> } {
  return {
    timeout: DATA_COLLECTION_TIMEOUT_MS,
    retryCount: 3,
    retryInterval: 2000,
    baseUrl: '/api',
    defaultHeaders: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }
}

/**
 * 生成 WebSocket 采集器配置
 */
export function generateWebSocketCollectorConfig(): CollectorConfig & { wsUrl: string; reconnectInterval: number; maxReconnectCount: number } {
  return {
    timeout: DATA_COLLECTION_TIMEOUT_MS,
    retryCount: 3,
    retryInterval: 2000,
    wsUrl: 'ws://localhost:8080/ws',
    reconnectInterval: 3000,
    maxReconnectCount: 5,
  }
}

// ============================================================
// 5. Mock BaseCollector 行为 — 采集器模拟
// ============================================================

/**
 * 模拟采集器基类行为：fetch 返回随机延迟后的 RawMarketData
 * @param dataType 数据类型
 * @param delayMin 延迟最小值（毫秒）
 * @param delayMax 延迟最大值（毫秒）
 * @param failRate 失败率（0-1）
 */
export async function mockCollectorFetch(
  dataType: DataType,
  delayMin = 200,
  delayMax = 1000,
  failRate = 0,
): Promise<RawMarketData> {
  const delay = randInt(delayMin, delayMax)
  await new Promise((resolve) => setTimeout(resolve, delay))

  if (Math.random() < failRate) {
    throw new Error(`[MockCollector] fetch failed for dataType="${dataType}": simulated network error`)
  }

  return generateRawMarketData(dataType, 'mock')
}

/**
 * 带重试的采集模拟
 */
export async function mockCollectorFetchWithRetry(
  dataType: DataType,
  maxRetries = 3,
  retryInterval = 2000,
): Promise<RawMarketData> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const outcome = await attemptMockCollectorFetch(dataType, maxRetries, retryInterval, attempt)
    if (outcome.done) return outcome.result
  }

  throw new Error('Collector fetch failed after retries')
}

async function attemptMockCollectorFetch(
  dataType: DataType,
  maxRetries: number,
  retryInterval: number,
  attempt: number,
): Promise<{ done: true; result: RawMarketData } | { done: false }> {
  try {
    const result = await mockCollectorFetch(dataType, 200, 1000, 0)
    return { done: true, result }
  } catch {
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval))
    }
    return { done: false }
  }
}

// ============================================================
// 6. Mock TaskScheduler 行为 — 任务调度器模拟
// ============================================================

/**
 * 模拟 TaskScheduler：管理任务注册、启动、停止、状态查询
 */
export function createMockTaskScheduler() {
  const tasks = new Map<string, CollectionTask>()
  const intervalIds = new Map<string, ReturnType<typeof setInterval>>()
  const subscribers = new Set<CollectionResultCallback>()

  function registerTask(
    widgetId: string,
    instanceId: string,
    dataSource?: Partial<DataSourceConfig>,
  ): string {
    const task = generateCollectionTask(widgetId, instanceId, {
      dataSource: dataSource
        ? generateDataSourceConfig(widgetId, dataSource)
        : undefined,
      status: COLLECTION_TASK_STATUS.PENDING,
    })
    tasks.set(task.taskId, task)
    return task.taskId
  }

  async function startTask(taskId: string): Promise<void> {
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    task.status = COLLECTION_TASK_STATUS.RUNNING
    tasks.set(taskId, task)

    const dataTypeMap: Record<string, DataType> = {
      marketIndices: 'indices',
      sectorHeatmap: 'sectors',
      fundFlow: 'fundFlow',
      marketSentiment: 'sentiment',
      watchlist: 'watchlist',
      portfolioOverview: 'portfolio',
      aiTradeReview: 'tradeReview',
      investmentProfile: 'analysisScores',
      poolBoard: 'poolBoard',
      kaiScore: 'analysisScores',
      modelCompare: 'modelComparison',
      stockChat: 'chatHistory',
    }

    const dataType = dataTypeMap[task.widgetId] ?? 'indices'

    const intervalId = setInterval(() => {
      void (async () => {
        try {
          task.lastRun = Date.now()
          task.runCount++
          const rawData = await mockCollectorFetch(dataType)
          task.successCount++
          task.nextRun = Date.now() + task.dataSource.interval

          // 通知订阅者
          subscribers.forEach((cb) => {
            try {
              cb({ taskId, widgetId: task.widgetId, instanceId: task.instanceId, data: rawData })
            } catch {
              /* ignore subscriber errors */
            }
          })
        } catch (err) {
          task.failCount++
          task.error = err instanceof Error ? err.message : String(err)
        }
        tasks.set(taskId, { ...task })
      })()
    }, task.dataSource.interval)

    intervalIds.set(taskId, intervalId)
    tasks.set(taskId, { ...task })
  }

  function stopTask(taskId: string): void {
    const intervalId = intervalIds.get(taskId)
    if (intervalId) {
      clearInterval(intervalId)
      intervalIds.delete(taskId)
    }
    const task = tasks.get(taskId)
    if (task) {
      task.status = COLLECTION_TASK_STATUS.PAUSED
      tasks.set(taskId, { ...task })
    }
  }

  function stopAll(): void {
    intervalIds.forEach((id) => clearInterval(id))
    intervalIds.clear()
    tasks.forEach((task) => {
      tasks.set(task.taskId, { ...task, status: COLLECTION_TASK_STATUS.PAUSED })
    })
  }

  function getTask(taskId: string): CollectionTask | undefined {
    return tasks.get(taskId)
  }

  function getAllTasks(): CollectionTask[] {
    return Array.from(tasks.values())
  }

  function subscribe(callback: CollectionResultCallback): () => void {
    subscribers.add(callback)
    return () => {
      subscribers.delete(callback)
    }
  }

  function getStats(): SchedulerStats {
    const all = Array.from(tasks.values())
    return {
      totalTasks: all.length,
      pendingTasks: all.filter((t) => t.status === 'pending').length,
      runningTasks: all.filter((t) => t.status === 'running').length,
      failedTasks: all.filter((t) => t.status === 'error').length,
      completedTasks: all.filter((t) => t.status === 'completed').length,
    }
  }

  return { registerTask, startTask, stopTask, stopAll, getTask, getAllTasks, subscribe, getStats, tasks }
}

/** 预构建的调度器实例（用于测试） */
export const MOCK_SCHEDULER = createMockTaskScheduler()

// ============================================================
// 7. Mock MarketDataAdapter 行为 — 数据适配器模拟
// ============================================================

/**
 * 模拟 MarketDataAdapter：将 RawMarketData 适配为标准化 MarketData
 * @param rawData 原始市场数据
 * @returns 适配后的 MarketData 片段
 */
export function mockAdaptMarketData(rawData: RawMarketData): Record<string, unknown> {
  switch (rawData.dataType) {
    case 'indices':
      return { indices: rawData.payload }
    case 'sectors':
      return { sectors: rawData.payload }
    case 'fundFlow':
      return { fundFlows: rawData.payload }
    case 'sentiment':
      return { sentiment: rawData.payload }
    case 'watchlist':
      return { watchlist: rawData.payload }
    case 'portfolio':
      return { portfolio: rawData.payload }
    case 'tradeReview':
      return { tradeReview: rawData.payload }
    case 'analysisScores':
      return { analysisScores: rawData.payload }
    case 'modelComparison':
      return { modelComparison: rawData.payload }
    case 'poolBoard':
      return { poolBoard: rawData.payload }
    case 'chatHistory':
      return { chatHistory: rawData.payload }
    default:
      return {}
  }
}

/**
 * 模拟完整 MarketData 合并：聚合多个 RawMarketData → 完整 MarketData
 */
export function mockMergeMarketData(rawDataList: RawMarketData[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    timestamp: Date.now(),
  }
  rawDataList.forEach((raw) => {
    Object.assign(merged, mockAdaptMarketData(raw))
  })
  return merged
}

/**
 * 生成完整的 MarketData Mock（包含所有 11 种数据类型）
 */
export function generateFullMarketData(): Record<string, unknown> {
  return mockMergeMarketData(MOCK_RAW_MARKET_DATA)
}

// ============================================================
// 导出汇总：一键获取所有 Mock 数据
// ============================================================

/**
 * 获取数据采集模块的完整 Mock 数据集
 * 包含：所有配置、任务、原始数据、适配后数据
 */
export function getMockDataCollectionSuite() {
  const configs = generateAllDataSourceConfigs()
  const tasks = MOCK_COLLECTION_TASKS
  const rawData = MOCK_RAW_MARKET_DATA
  const defaultCollectorConfig = generateDefaultCollectorConfig()
  const mockCollectorConfig = generateMockCollectorConfig()
  const restCollectorConfig = generateRestCollectorConfig()
  const wsCollectorConfig = generateWebSocketCollectorConfig()
  const fullMarketData = generateFullMarketData()

  return {
    configs,
    tasks,
    rawData,
    defaultCollectorConfig,
    mockCollectorConfig,
    restCollectorConfig,
    wsCollectorConfig,
    fullMarketData,
    scheduler: MOCK_SCHEDULER,
  }
}