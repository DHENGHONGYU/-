/**
 * @doc []
 */
import {
  API_SYSTEM_AGENT_HEALTH,
  API_SYSTEM_RISK_MONITOR,
  API_TRADE_PNL_ANALYSIS,
  API_TRADE_POSITIONS,
  API_TRADE_SIGNALS,
} from '@/config/apiPaths'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { DataSourceConfig, DataSourceType, WidgetDomain, WidgetPerspective } from '@/types/modules/widget.types'

/**
 * AI 生成内容免责声明（合规：C07）。
 * 所有 AI 对话/分析类界面应统一展示，避免"保证收益/必涨"等表述。
 */
export const AI_DISCLAIMER_TEXT =
  'AI 生成内容仅供参考，不构成投资建议或交易依据。市场有风险，投资需谨慎。'

export const GRID_COLUMNS = 4

export const GRID_ROW_HEIGHT = 120

export const GRID_GAP = 16

/** Cockpit 布局间距令牌（8px 栅格体系，Phase 1 纵横交叉布局使用） */
export const COCKPIT_LAYOUT = {
  /** 业务域分区之间 */
  SECTION_GAP: 24,
  /** 域标题与 Widget 网格之间 */
  SECTION_HEADER_GAP: 12,
  /** Widget 之间（复用 GRID_GAP） */
  WIDGET_GAP: 16,
  /** 左轨与内容区之间 */
  ZONE_PADDING: 16,
  /** 矩阵总览单元格间距 */
  MATRIX_CELL_GAP: 4,
} as const

export const PRELOAD_WIDGETS = [
  'marketIndices',
  'sectorHeatmap',
  'fundFlow',
  'watchlist',
  'portfolioOverview',
  'aiTradeReview',
] as const

/**
 * 实时行情查询的 SLA 延迟预算（毫秒）
 *
 * 盘中问答/行情的最大可接受延迟。
 * - WebSocket 实时推送：目标 < 500ms
 * - REST 轮询（1s interval）：目标 < 2000ms
 * - Mock 模式（开发环境）：不受此限制
 *
 * 当实际延迟超过此值时，UI 应显示"数据延迟"警告。
 */
export const REALTIME_SLA_MS = 2_000

export const WIDGET_SIZE = {
  FULL_WIDTH: { cols: 4, rows: 2 },
  HALF_WIDTH: { cols: 2, rows: 2 },
  THIRD_WIDTH: { cols: 1, rows: 2 },
  LARGE_HEIGHT: { cols: 4, rows: 3 },
  CHAT_HEIGHT: { cols: 4, rows: 4 },
}

export const MARKET_INDEX_CODES = {
  SHANGHAI: '000001',
  SHENZHEN: '399001',
  CHINEXT: '399006',
  STAR: '000688',
} as const

export const MARKET_INDEX_NAMES: Record<string, string> = {
  [MARKET_INDEX_CODES.SHANGHAI]: '上证指数',
  [MARKET_INDEX_CODES.SHENZHEN]: '深证成指',
  [MARKET_INDEX_CODES.CHINEXT]: '创业板指',
  [MARKET_INDEX_CODES.STAR]: '科创50',
}

export const FUND_FLOW_TYPES = {
  MAIN: 'main',
  RETAIL: 'retail',
  NORTH: 'north',
} as const

export const FUND_FLOW_NAMES: Record<string, string> = {
  [FUND_FLOW_TYPES.MAIN]: '主力净流入',
  [FUND_FLOW_TYPES.RETAIL]: '散户净流入',
  [FUND_FLOW_TYPES.NORTH]: '北向净流入',
}

export const SECTOR_COLOR_MAPPING = {
  STRONG_UP: 'bg-green-500',
  UP: 'bg-green-400',
  WEAK_UP: 'bg-green-300',
  FLAT: 'bg-gray-300',
  WEAK_DOWN: 'bg-red-300',
  DOWN: 'bg-red-400',
  STRONG_DOWN: 'bg-red-500',
}

export const SENTIMENT_LEVELS = {
  EXTREME_FEAR: { min: 0, max: 20, label: '极度恐惧', color: 'bg-red-600' },
  FEAR: { min: 20, max: 40, label: '恐惧', color: 'bg-red-400' },
  NEUTRAL: { min: 40, max: 60, label: '中性', color: 'bg-yellow-400' },
  GREEDY: { min: 60, max: 80, label: '贪婪', color: 'bg-green-400' },
  EXTREME_GREEDY: { min: 80, max: 100, label: '极度贪婪', color: 'bg-green-600' },
}

/** 评分等级映射
 * @remarks 用于 KAI 评分、投资画像等指标状态展示
 */
export const SCORE_LEVELS = {
  EXCELLENT: { min: 80, max: 100, label: '优秀', color: '#22c55e', bgClass: 'bg-green-500' },
  GOOD: { min: 60, max: 80, label: '良好', color: '#3b82f6', bgClass: 'bg-blue-500' },
  AVERAGE: { min: 40, max: 60, label: '一般', color: '#f59e0b', bgClass: 'bg-amber-500' },
  POOR: { min: 20, max: 40, label: '较弱', color: '#f97316', bgClass: 'bg-orange-500' },
  BAD: { min: 0, max: 20, label: '差', color: '#ef4444', bgClass: 'bg-red-500' },
}

/** KAI 选股评分维度名称映射
 * @remarks 六大类维度，后续扩展新维度时只需在此注册
 */
export const KAI_DIMENSION_NAMES = {
  COMPETITIVENESS: '竞争力',
  TECHNICAL: '技术面',
  FUNDAMENTAL: '基本面',
  SENTIMENT: '情绪面',
  FUND_FLOW: '资金面',
  INDUSTRY: '行业面',
} as const

/** AI 大模型版本映射
 * @remarks 用于 LLM 智能对比 Widget 的模型选择下拉框
 */
export const LLM_MODEL_VERSIONS = {
  KAILLM_V2_1: { id: 'kaillm-v2.1', name: 'KAILLM v2.1', version: 'v2.1' },
  KAILLM_V2_0: { id: 'kaillm-v2.0', name: 'KAILLM v2.0', version: 'v2.0' },
  BASELINE_V1_5: { id: 'baseline-v1.5', name: '基准模型 v1.5', version: 'v1.5' },
  BASELINE_V1_0: { id: 'baseline-v1.0', name: '基准模型 v1.0', version: 'v1.0' },
} as const

/** 投资画像指标名称映射
 * @remarks 用于投资画像/分析中心 Widget
 */
export const INVESTMENT_PROFILE_METRICS = {
  ABILITY: { name: '投资能力', description: '综合收益与风险控制能力' },
  STYLE: { name: '投资风格', description: '价值/成长/均衡等风格倾向' },
  RISK_CONTROL: { name: '风控能力', description: '回撤控制与仓位管理能力' },
  HOLDING: { name: '持仓透视', description: '集中度与行业配置分析' },
  TIMING: { name: '择时风格', description: '左侧/右侧交易倾向' },
} as const

/** 聊天界面示例标的
 * @remarks 用于个股/市场深度分析助手的下拉选择，生产环境可替换为用户的自选股列表
 */
export const CHAT_DEMO_TARGETS = [
  { code: '600519', name: '贵州茅台', type: 'stock' as const },
  { code: '000858', name: '五粮液', type: 'stock' as const },
  { code: '300750', name: '宁德时代', type: 'stock' as const },
  { code: '002594', name: '比亚迪', type: 'stock' as const },
  { code: 'market', name: '市场整体分析', type: 'market' as const },
]

/** 股票池状态颜色映射
 * @remarks 用于股票池列表状态条颜色
 */
export const POOL_STATUS_COLORS = {
  ACTIVE: { color: '#22c55e', bgClass: 'bg-green-500', label: '活跃' },
  WARM: { color: '#3b82f6', bgClass: 'bg-blue-500', label: '温热' },
  COOL: { color: '#f59e0b', bgClass: 'bg-amber-500', label: '冷清' },
  COLD: { color: '#9ca3af', bgClass: 'bg-gray-400', label: '冷淡' },
}

export const COLORS = {
  UP: '#22c55e',
  DOWN: '#ef4444',
  NEUTRAL: '#9ca3af',
  PRIMARY: '#3b82f6',
  SECONDARY: '#6b7280',
  BACKGROUND: '#f8fafc',
  CARD: '#ffffff',
}

/**
 * A 股涨跌颜色映射（红涨绿跌）
 * @remarks 与 STOCK_COLOR_TOKENS 保持一致，供测试与历史代码引用
 */
export const STOCK_COLOR_MAPPING = {
  UP: STOCK_COLOR_TOKENS.up.hex,
  DOWN: STOCK_COLOR_TOKENS.down.hex,
  UP_CLASS: STOCK_COLOR_TOKENS.up.tailwind,
  DOWN_CLASS: STOCK_COLOR_TOKENS.down.tailwind,
}

// ============================================================
// 数据采集层常量
// ============================================================

/** 数据源类型 */
export const DATA_SOURCE_TYPE = {
  MOCK: 'mock' as const,
  REST: 'rest' as const,
  WEBSOCKET: 'websocket' as const,
}

/** 采集模式 */
export const COLLECTION_MODE = {
  POLLING: 'polling' as const,
  ONCE: 'once' as const,
  STREAMING: 'streaming' as const,
}

/** 采集器默认配置 */
export const COLLECTOR_DEFAULT_CONFIG = {
  /** API 超时时间（毫秒） */
  TIMEOUT: 10000,
  /** 重试次数 */
  RETRY_COUNT: 3,
  /** 重试间隔（毫秒） */
  RETRY_INTERVAL: 2000,
  /** 默认轮询间隔（毫秒） */
  DEFAULT_POLLING_INTERVAL: 5000,
  /** 最小轮询间隔（毫秒） */
  MIN_POLLING_INTERVAL: 1000,
  /** 最大轮询间隔（毫秒） */
  MAX_POLLING_INTERVAL: 60000,
}

/** Mock 数据采集器配置 */
export const MOCK_COLLECTOR_CONFIG = {
  /** 模拟延迟最小值（毫秒） */
  MIN_DELAY: 200,
  /** 模拟延迟最大值（毫秒） */
  MAX_DELAY: 1000,
  /** 随机数据波动范围 */
  PRICE_FLUCTUATION: 0.02,
  /** 默认随机种子 */
  DEFAULT_SEED: 'v9-market-data',
}

/** REST 采集器配置 */
export const REST_COLLECTOR_CONFIG = {
  /** 基础 API URL */
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  /** 默认请求头 */
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
}

/** WebSocket 采集器配置 */
export const WEBSOCKET_COLLECTOR_CONFIG = {
  /** WebSocket URL */
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  /** 重连间隔（毫秒） */
  RECONNECT_INTERVAL: 3000,
  /** 最大重连次数 */
  MAX_RECONNECT_COUNT: 5,
}

/** 环境变量驱动的数据源类型
 * @remarks 开发环境默认 mock，生产环境可配置为 rest 或 websocket
 */
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
export const ACTIVE_DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE_TYPE || DATA_SOURCE_TYPE.MOCK

/** 各 Widget 默认数据源配置
 * @remarks 新增 5 个金融业务 Widget 的数据源配置
 */
const activeDs: DataSourceType = ACTIVE_DATA_SOURCE as DataSourceType

export const WIDGET_DEFAULT_DATA_SOURCE: Record<string, DataSourceConfig> = {
  marketIndices: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/indices',
    enabled: true,
  },
  sectorHeatmap: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/sectors',
    enabled: true,
  },
  fundFlow: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/fund-flow',
    enabled: true,
  },
  marketSentiment: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/sentiment',
    enabled: true,
  },
  watchlist: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/user/watchlist',
    enabled: true,
  },
  portfolioOverview: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/user/portfolio',
    enabled: true,
  },
  aiTradeReview: {
    type: activeDs,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/ai/trade-review',
    enabled: true,
  },
  // ============================================================
  // 系统机制健康监控已移至 Command，不再在 Cockpit 注册
  // ============================================================
  investmentProfile: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/profile',
    enabled: true,
  },
  poolBoard: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/pool',
    enabled: true,
  },
  kaiScore: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/kai',
    enabled: true,
  },
  modelCompare: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/compare',
    enabled: true,
  },
  stockChat: {
    type: activeDs,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/stock-analysis/chat',
    enabled: true,
  },
  hotSector: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/strategy/hot-sectors',
    enabled: true,
  },
  valuePit: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/strategy/value-pit',
    enabled: true,
  },
  signalQuality: {
    type: activeDs,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/strategy/signal-quality',
    enabled: true,
  },
  // 系统监控 Widget 数据源（engineStatus/systemArchitecture/mechanismHealth 已移至 Command）
  // ============================================================
  agentPerformance: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: 30000,
    endpoint: API_SYSTEM_AGENT_HEALTH,
    enabled: true,
  },
  pnlAnalysis: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: 60000,
    endpoint: API_TRADE_PNL_ANALYSIS,
    enabled: true,
  },
  positionControl: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: 15000,
    endpoint: API_TRADE_POSITIONS,
    enabled: true,
  },
  riskMonitor: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: 30000,
    endpoint: API_SYSTEM_RISK_MONITOR,
    enabled: true,
  },
  signalMonitor: {
    type: activeDs,
    mode: COLLECTION_MODE.POLLING,
    interval: 60000,
    endpoint: API_TRADE_SIGNALS,
    enabled: true,
  },
  industryChain: {
    type: activeDs,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/industry/chain',
    enabled: true,
  },
}

export const DEFAULT_WIDGET_CONFIG = {
  marketIndices: {
    title: '大盘指数',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'market',
  },
  sectorHeatmap: {
    title: '板块热力图',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'market',
  },
  fundFlow: {
    title: '资金流向',
    size: WIDGET_SIZE.HALF_WIDTH,
    category: 'market',
  },
  marketSentiment: {
    title: '市场情绪',
    size: WIDGET_SIZE.HALF_WIDTH,
    category: 'market',
  },
  watchlist: {
    title: '自选股',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'portfolio',
  },
  portfolioOverview: {
    title: '持仓概览',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'portfolio',
  },
  aiTradeReview: {
    title: 'AI交易复盘',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'ai',
  },
  // ============================================================
  // 金融业务 Widget 默认配置
  // ============================================================
  investmentProfile: {
    title: '投资画像/分析中心',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'market',
  },
  poolBoard: {
    title: '股票池看板',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'market',
  },
  kaiScore: {
    title: 'KAI 选股综合评分',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'market',
  },
  modelCompare: {
    title: 'AI 大模型智能对比',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'ai',
  },
  stockChat: {
    title: '个股/市场深度分析助手',
    size: WIDGET_SIZE.CHAT_HEIGHT,
    category: 'ai',
  },
  hotSector: {
    title: '热门板块策略',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'strategy',
  },
  valuePit: {
    title: '价值洼地策略',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'strategy',
  },
  signalQuality: {
    title: '信号质量复盘',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'strategy',
  },
  // ============================================================
  // 系统监控 Widget（engineStatus/systemArchitecture/mechanismHealth 已移至 Command）
  // agentPerformance 归入 AI 决策域（category: 'ai'）
  // ============================================================
  agentPerformance: {
    title: '智能体性能追踪',
    category: 'ai',
    size: WIDGET_SIZE.HALF_WIDTH,
  },
  pnlAnalysis: {
    title: '盈亏分析',
    category: 'portfolio',
    size: WIDGET_SIZE.HALF_WIDTH,
  },
  positionControl: {
    title: '仓位控制',
    category: 'portfolio',
    size: WIDGET_SIZE.HALF_WIDTH,
  },
  riskMonitor: {
    title: '风险监控',
    category: 'portfolio',
    size: WIDGET_SIZE.HALF_WIDTH,
  },
  signalMonitor: {
    title: '信号监控',
    category: 'strategy',
    size: WIDGET_SIZE.THIRD_WIDTH,
  },
  industryChain: {
    title: '产业链图谱',
    category: 'market',
    size: WIDGET_SIZE.HALF_WIDTH,
  },
}

/**
 * Widget 纵横交叉布局元数据（Phase 1）
 *
 * domain（纵轴·业务域）：research | market | ai | portfolio
 * perspective（横轴·视角）：overview | analysis | signal | risk
 *
 * 交叉矩阵参见 docs/specs/architecture/cockpit-command-blueprint.md §4.6
 */
export const WIDGET_CROSS_LAYOUT: Record<string, { domain: WidgetDomain; perspective: WidgetPerspective }> = {
  // 研究全景域
  kaiScore:           { domain: 'research',  perspective: 'overview' },
  investmentProfile:  { domain: 'research',  perspective: 'overview' },
  poolBoard:          { domain: 'research',  perspective: 'analysis' },
  valuePit:           { domain: 'research',  perspective: 'signal' },

  // 市场背景域
  marketIndices:      { domain: 'market',    perspective: 'overview' },
  sectorHeatmap:      { domain: 'market',    perspective: 'overview' },
  fundFlow:           { domain: 'market',    perspective: 'analysis' },
  marketSentiment:    { domain: 'market',    perspective: 'analysis' },
  industryChain:      { domain: 'market',    perspective: 'analysis' },
  hotSector:          { domain: 'market',    perspective: 'signal' },

  // AI 决策域
  aiTradeReview:      { domain: 'ai',        perspective: 'overview' },
  agentPerformance:   { domain: 'ai',        perspective: 'overview' },
  modelCompare:       { domain: 'ai',        perspective: 'analysis' },
  stockChat:          { domain: 'ai',        perspective: 'analysis' },
  signalQuality:      { domain: 'ai',        perspective: 'signal' },

  // 持仓观察域
  portfolioOverview:  { domain: 'portfolio', perspective: 'overview' },
  watchlist:          { domain: 'portfolio', perspective: 'overview' },
  pnlAnalysis:        { domain: 'portfolio', perspective: 'analysis' },
  signalMonitor:      { domain: 'portfolio', perspective: 'signal' },
  positionControl:    { domain: 'portfolio', perspective: 'risk' },
  riskMonitor:        { domain: 'portfolio', perspective: 'risk' },
}

/**
 * 纵横交叉布局：业务域（纵轴）展示元数据（Phase 1 步骤 1.1）
 *
 * 与 WIDGET_CROSS_LAYOUT 的 domain 枚举一一对应，是 UI 分组的单一真相源。
 * CockpitCrossLayout 与 CrossMatrixOverview 均从此处导入，避免两处漂移。
 */
export const COCKPIT_CROSS_DOMAINS: readonly { id: WidgetDomain; label: string; icon: string }[] = [
  { id: 'research', label: '研究全景', icon: '🔬' },
  { id: 'market', label: '市场背景', icon: '📈' },
  { id: 'ai', label: 'AI 决策', icon: '🤖' },
  { id: 'portfolio', label: '持仓观察', icon: '💼' },
]

/**
 * 纵横交叉布局：视角（横轴）展示元数据（Phase 1 步骤 1.1）
 *
 * 与 WIDGET_CROSS_LAYOUT 的 perspective 枚举一一对应。
 */
export const COCKPIT_CROSS_PERSPECTIVES: readonly { id: WidgetPerspective; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'analysis', label: '深度分析' },
  { id: 'signal', label: '信号验证' },
  { id: 'risk', label: '风控' },
]

/**
 * 重型 Widget 收为 Sheet 抽屉触发（Phase 1 步骤 1.5）
 *
 * 这些 Widget 交互复杂或面积较大，在交叉网格中以触发卡片形式呈现，
 * 点击后通过 Sheet 抽屉展开完整内容，避免挤占网格空间。
 *
 * 参见 docs/specs/architecture/cockpit-command-blueprint.md §4.3
 */
export const DRAWER_WIDGETS: ReadonlySet<string> = new Set([
  'stockChat',
  'industryChain',
])
