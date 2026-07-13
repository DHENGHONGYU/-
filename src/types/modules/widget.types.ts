/**
 * @module WidgetFramework
 * @lifecycle @Route
 * @description Widget 框架模块，提供组件注册、实例管理、生命周期控制能力
 */

// ============================================================
// 数据源配置类型
// ============================================================

/** 数据源类型 */
export type DataSourceType = 'mock' | 'rest' | 'websocket'

/** 采集模式 */
export type CollectionMode = 'polling' | 'once' | 'streaming'

/** Widget 数据源配置 */
export interface DataSourceConfig {
  /** 数据源类型 */
  type: DataSourceType
  /** 采集模式 */
  mode: CollectionMode
  /** 轮询间隔（毫秒） */
  interval: number
  /** API 端点（REST 数据源时使用） */
  endpoint?: string
  /** 额外请求参数 */
  params?: Record<string, unknown>
  /** 是否启用 */
  enabled: boolean
}

/** 原始市场数据（来自 API 或 WebSocket） */
export interface RawMarketData {
  /** 时间戳 */
  timestamp: number
  /** 数据类型标识
   * @remarks 新增金融分析维度类型，用于 MarketDataAdapter 路由到对应适配器
   */
  dataType:
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
    | 'hotSectors'
    | 'valuePit'
  /** 原始 payload */
  payload: unknown
  /** 数据来源标识 */
  source: string
}

/** 标准化市场数据（经过 Adapter 转换后）
 * @remarks 所有 Widget 统一消费此接口，新增 4 个金融业务数据字段
 */
export interface MarketData {
  /** 数据生成时间 */
  timestamp: number
  /** 大盘指数数据 */
  indices: MarketIndexData[]
  /** 板块热力图数据 */
  sectors: SectorHeatmapData[]
  /** 资金流向数据 */
  fundFlows: FundFlowData[]
  /** 市场情绪数据 */
  sentiment: SentimentData
  /** 自选股数据 */
  watchlist: WatchlistData[]
  /** 持仓概览数据 */
  portfolio: PortfolioData
  /** AI 交易复盘数据 */
  tradeReview: TradeReviewData
  /** 投资画像 / 分析评分数据（新增） */
  analysisScores: AnalysisScores
  /** AI 大模型对比数据（新增） */
  modelComparison: ModelComparison
  /** 股票池管理与监控数据（新增） */
  poolBoard: PoolBoard
  /** 个股深度分析 / 市场分析聊天数据（新增） */
  chatHistory: ChatHistory
  /** 热门板块策略评分数据（新增） */
  hotSectors: HotSectorData[]
  /** 价值洼地策略评分数据（新增） */
  valuePit: ValuePitData[]
}

export interface MarketIndexData {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  high?: number
  low?: number
  volume?: string
}

export interface SectorHeatmapData {
  name: string
  code: string
  changePercent: number
  turnover?: string
  /** 资金流向（净流入为正，净流出为负，null 表示无数据） */
  fundFlow?: number | null
}

export interface FundFlowData {
  type: string
  name: string
  value: number
  unit: string
}

export interface SentimentData {
  fearGreedIndex: number
  fearGreedLabel: string
  totalStocks: number
  up: number
  down: number
  flat: number
  limitUp: number
  limitDown: number
}

export interface WatchlistData {
  name: string
  code: string
  price: number
  changePercent: number
}

/** 持仓列表项（用于 PortfolioOverviewWidget 持仓列表渲染） */
export interface HoldingItem {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 持仓股数 */
  shares: number
  /** 当前价格（格式化字符串） */
  price: string
  /** 持仓市值（格式化字符串） */
  marketValue: string
  /** 当前权重（百分比，0-100） */
  weight: number
  /** 目标权重（百分比，0-100） */
  targetWeight: number
  /** 持仓盈亏（格式化字符串） */
  pnl: string
  /** 持仓盈亏百分比 */
  pnlPercent: number
}

/** 再平衡计划项（用于 PortfolioOverviewWidget 再平衡计划展示） */
export interface RebalancePlanItem {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 操作动作：买入/卖出/持有 */
  action: 'buy' | 'sell' | 'hold'
  /** 调整股数（正数） */
  shares: number
  /** 调整理由 */
  reason: string
}

export interface PortfolioData {
  totalAssets: string
  availableFunds: string
  todayPnL: string
  todayPnLPercent: number
  totalPnL: string
  totalPnLPercent: number
  holdings: number
  /** 持仓列表（用于持仓列表渲染，空数组表示无持仓） */
  holdingsList: HoldingItem[]
  /** 再平衡计划（空数组表示组合已平衡） */
  rebalancePlan: RebalancePlanItem[]
}

export interface TradeReviewData {
  totalTrades: number
  profitable: number
  losing: number
  winRate: number
  profitLossRatio: number
  disciplineScore: number
}

// ============================================================
// 新增金融业务数据类型
// ============================================================

/** 投资画像 / 分析评分数据
 * @remarks 由量化模型或用户画像服务提供，当前由 Mock 数据模拟
 */
export interface AnalysisScores {
  /** 用户投资画像 */
  profile: InvestmentProfile
  /** KAI 选股综合评分 */
  kai: KaiScore
}

/** 投资画像 */
export interface InvestmentProfile {
  /** 用户标签列表，如 "老股民"、"择时" */
  tags: string[]
  /** 核心指标卡片 */
  metrics: ProfileMetric[]
}

/** 投资画像指标卡片 */
export interface ProfileMetric {
  /** 指标名称 */
  name: string
  /** 指标评分 0-100 */
  score: number
  /** 指标说明 */
  description?: string
  /** 图标标识（可选） */
  icon?: string
}

/** KAI 选股综合评分 */
export interface KaiScore {
  /** 综合评分 0-100 */
  totalScore: number
  /** 情绪值 0-100 */
  sentiment: number
  /** 趋势值 0-100 */
  trend: number
  /** 流量值 0-100 */
  flow: number
  /** 六大类维度评分 */
  dimensions: KaiDimension[]
  /** 维度细项分布表 */
  detailDistribution: KaiDetailItem[]
}

/** KAI 评分维度 */
export interface KaiDimension {
  /** 维度名称 */
  name: string
  /** 维度得分 0-100 */
  score: number
  /** 权重 0-1 */
  weight: number
  /** 评分状态文本 */
  status: string
  /** 颜色标签（来自常量映射） */
  color: string
}

/** KAI 维度细项 */
export interface KaiDetailItem {
  /** 所属维度名称 */
  dimensionName: string
  /** 细项名称 */
  itemName: string
  /** 细项得分 0-100 */
  score: number
  /** 细项权重 0-1 */
  weight: number
  /** 颜色标签 */
  color: string
}

/** 模型对比数据
 * @remarks 用于 AI 大模型（LLM）智能对比 Widget
 */
export interface ModelComparison {
  /** 左侧模型信息 */
  leftModel: ModelInfo
  /** 右侧模型信息 */
  rightModel: ModelInfo
  /** 对比维度列表 */
  dimensions: CompareDimension[]
  /** 风险提示文本 */
  riskHint: string
}

/** 模型信息 */
export interface ModelInfo {
  /** 模型 ID */
  id: string
  /** 模型名称 */
  name: string
  /** 模型版本号 */
  version: string
  /** 模型综合得分 */
  score: number
}

/** 模型对比维度 */
export interface CompareDimension {
  /** 维度名称 */
  name: string
  /** 左侧模型得分 */
  leftScore: number
  /** 右侧模型得分 */
  rightScore: number
  /** 维度权重 0-1 */
  weight: number
}

/** 股票池看板数据
 * @remarks 用于股票池管理与监控列表 Widget
 */
export interface PoolBoard {
  /** 股票列表 */
  items: PoolBoardItem[]
  /** 总条数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/** 股票池看板条目 */
export interface PoolBoardItem {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 最新价 */
  price: number
  /** 涨跌幅（%） */
  changePercent: number
  /** 成交额 */
  turnover: string
  /** 换手率 */
  turnoverRate: string
  /** 状态颜色条（来自常量映射） */
  statusColor: string
  /** 状态标签文本 */
  statusLabel: string
}

/** 聊天历史数据
 * @remarks 用于个股深度分析与市场分析聊天 Widget
 */
export interface ChatHistory {
  /** 当前选中的标的代码或市场标识 */
  target: string
  /** 标的类型 */
  targetType: 'stock' | 'market'
  /** 消息列表 */
  messages: ChatMessage[]
}

/** 聊天消息 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string
  /** 消息角色 */
  role: 'user' | 'assistant'
  /** 消息内容（Markdown 格式） */
  content: string
  /** 消息时间戳 */
  timestamp: number
}

// ============================================================
// 双策略数据类型（新增）
// ============================================================

/** 热门板块策略评分数据（用于驾驶舱 Widget） */
export interface HotSectorData {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 综合评分 0-5 */
  score: number
  /** 动作建议 */
  action: 'immediate' | 'probe' | 'ignore'
  /** 五维评分 */
  dimensions: {
    momentum: number
    sentiment: number
    technical: number
    valuation: number
    composite: number
  }
}

/** 价值洼地策略评分数据（用于驾驶舱 Widget） */
export interface ValuePitData {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 综合评分 0-5 */
  score: number
  /** 动作建议 */
  action: 'immediate' | 'probe' | 'wait' | 'ignore'
  /** 轮动信号是否触发 */
  rotationSignal: boolean
  /** 五维评分 */
  dimensions: {
    catalyst: number
    valuation: number
    chip: number
    rotation: number
    liquidity: number
    composite: number
  }
}

// ============================================================
// 采集任务类型
// ============================================================

/** 采集任务状态 */
export type CollectionTaskStatus = 'pending' | 'running' | 'paused' | 'error' | 'completed'

/** 采集任务定义 */
export interface CollectionTask {
  /** 任务唯一标识 */
  taskId: string
  /** 关联的 Widget ID */
  widgetId: string
  /** 关联的实例 ID */
  instanceId: string
  /** 数据源配置 */
  dataSource: DataSourceConfig
  /** 当前状态 */
  status: CollectionTaskStatus
  /** 错误信息 */
  error?: string
  /** 上次执行时间 */
  lastRun?: number
  /** 下次执行时间 */
  nextRun?: number
  /** 执行次数统计 */
  runCount: number
  /** 成功次数统计 */
  successCount: number
  /** 失败次数统计 */
  failCount: number
}

/** 采集结果回调 */
export type CollectionResultCallback = (taskId: string, data: RawMarketData | null, error?: Error) => void

/** 采集器配置 */
export interface CollectorConfig {
  /** 超时时间（毫秒） */
  timeout: number
  /** 重试次数 */
  retryCount: number
  /** 重试间隔（毫秒） */
  retryInterval: number
  /** 请求头 */
  headers?: Record<string, string>
}

// ============================================================
// Widget 框架类型
// ============================================================

export interface WidgetModuleInput {
  widgetId: string
  config: WidgetConfig
  data?: unknown
}

export interface WidgetModuleOutput {
  instanceId: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  lastRefresh?: number
}

export interface WidgetConfig {
  instanceId: string
  widgetId: string
  size: { cols: number; rows: number }
  position?: { x: number; y: number }
  title: string
  settings: Record<string, unknown>
  visible: boolean
  collapsed: boolean
  /** 数据源配置（新增） */
  dataSource?: DataSourceConfig
}

export interface WidgetMeta {
  id: string
  name: string
  category: string
  description: string
  defaultSize: { cols: number; rows: number }
  defaultConfig?: Record<string, unknown>
  /** 默认数据源配置（新增） */
  defaultDataSource?: DataSourceConfig
}

export interface WidgetRuntimeState {
  instanceId: string
  widgetId: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  lastRefresh?: number
}

export interface IOModule {
  input: WidgetModuleInput
  output: WidgetModuleOutput
}
