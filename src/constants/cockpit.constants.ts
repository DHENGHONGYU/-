import {
  API_SYSTEM_AGENT_HEALTH,
  API_SYSTEM_ENGINE_STATUS,
  API_SYSTEM_ARCHITECTURE,
  API_SYSTEM_RISK_MONITOR,
  API_TRADE_PNL_ANALYSIS,
  API_TRADE_POSITIONS,
  API_TRADE_SIGNALS,
} from '@/config/apiPaths'

export const GRID_COLUMNS = 4

export const GRID_ROW_HEIGHT = 120

export const GRID_GAP = 16

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

/** 股票涨跌颜色映射（A 股市场标准：红涨绿跌）
 * @deprecated 请使用 `STOCK_COLOR_TOKENS`（位于 `src/constants/theme.tokens.ts`）
 * @remarks 所有涉及涨跌幅颜色展示的组件必须从 `STOCK_COLOR_TOKENS` 读取，禁止硬编码
 * @see STOCK_COLOR_TOKENS
 */
export const STOCK_COLOR_MAPPING = {
  /** 上涨颜色 */
  UP: '#ef4444',
  /** 下跌颜色 */
  DOWN: '#22c55e',
  /** 平盘/中性颜色 */
  NEUTRAL: '#9ca3af',
  /** 上涨 Tailwind 类名 */
  UP_CLASS: 'text-red-500',
  /** 下跌 Tailwind 类名 */
  DOWN_CLASS: 'text-green-500',
  /** 中性 Tailwind 类名 */
  NEUTRAL_CLASS: 'text-gray-400',
  /** 上涨背景类名 */
  UP_BG_CLASS: 'bg-red-500',
  /** 下跌背景类名 */
  DOWN_BG_CLASS: 'bg-green-500',
  /** 中性背景类名 */
  NEUTRAL_BG_CLASS: 'bg-gray-400',
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
export const STOCK_POOL_STATUS_COLORS = {
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
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  /** 重连间隔（毫秒） */
  RECONNECT_INTERVAL: 3000,
  /** 最大重连次数 */
  MAX_RECONNECT_COUNT: 5,
}

/** 环境变量驱动的数据源类型
 * @remarks 开发环境默认 mock，生产环境可配置为 rest 或 websocket
 */
export const ACTIVE_DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE_TYPE || DATA_SOURCE_TYPE.MOCK

/** 各 Widget 默认数据源配置
 * @remarks 新增 5 个金融业务 Widget 的数据源配置
 */
export const WIDGET_DEFAULT_DATA_SOURCE = {
  marketIndices: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/indices',
    enabled: true,
  },
  sectorHeatmap: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/sectors',
    enabled: true,
  },
  fundFlow: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/fund-flow',
    enabled: true,
  },
  marketSentiment: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/market/sentiment',
    enabled: true,
  },
  watchlist: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/user/watchlist',
    enabled: true,
  },
  portfolioOverview: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/user/portfolio',
    enabled: true,
  },
  aiTradeReview: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/ai/trade-review',
    enabled: true,
  },
  // ============================================================
  // 新增金融业务 Widget 数据源
  // ============================================================
  investmentProfile: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/profile',
    enabled: true,
  },
  stockPool: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/pool',
    enabled: true,
  },
  kaiScore: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/kai',
    enabled: true,
  },
  modelCompare: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/stock-analysis/compare',
    enabled: true,
  },
  stockChat: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/stock-analysis/chat',
    enabled: true,
  },
  hotSector: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/strategy/hot-sectors',
    enabled: true,
  },
  valuePit: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL,
    endpoint: '/strategy/value-pit',
    enabled: true,
  },
  // ============================================================
  // 系统监控与高级分析 Widget 数据源
  // ============================================================
  agentPerformance: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 30000,
    endpoint: API_SYSTEM_AGENT_HEALTH,
    enabled: true,
  },
  engineStatus: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 10000,
    endpoint: API_SYSTEM_ENGINE_STATUS,
    enabled: true,
  },
  systemArchitecture: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 60000,
    endpoint: API_SYSTEM_ARCHITECTURE,
    enabled: true,
  },
  pnlAnalysis: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 60000,
    endpoint: API_TRADE_PNL_ANALYSIS,
    enabled: true,
  },
  positionControl: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 15000,
    endpoint: API_TRADE_POSITIONS,
    enabled: true,
  },
  riskMonitor: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 30000,
    endpoint: API_SYSTEM_RISK_MONITOR,
    enabled: true,
  },
  signalMonitor: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.POLLING,
    interval: 60000,
    endpoint: API_TRADE_SIGNALS,
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
    size: WIDGET_SIZE.HALF_WIDTH,
    category: 'portfolio',
  },
  aiTradeReview: {
    title: 'AI交易复盘',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'ai',
  },
  // ============================================================
  // 新增金融业务 Widget 默认配置
  // ============================================================
  investmentProfile: {
    title: '投资画像/分析中心',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'analysis',
  },
  stockPool: {
    title: '股票池管理与监控',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: 'analysis',
  },
  kaiScore: {
    title: 'KAI 选股综合评分',
    size: WIDGET_SIZE.LARGE_HEIGHT,
    category: 'analysis',
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
  // ============================================================
  // 系统监控与高级分析 Widget
  // ============================================================
  agentPerformance: {
    title: '智能体性能追踪',
    category: '系统监控',
    size: { cols: 2, rows: 2 },
  },
  engineStatus: {
    title: '引擎状态监控',
    category: '系统监控',
    size: { cols: 1, rows: 1 },
  },
  systemArchitecture: {
    title: '系统架构视图',
    category: '系统监控',
    size: { cols: 2, rows: 2 },
  },
  pnlAnalysis: {
    title: '盈亏分析',
    category: '交易分析',
    size: { cols: 2, rows: 2 },
  },
  positionControl: {
    title: '仓位控制',
    category: '投资组合',
    size: { cols: 2, rows: 2 },
  },
  riskMonitor: {
    title: '风险监控',
    category: '系统监控',
    size: { cols: 2, rows: 2 },
  },
  signalMonitor: {
    title: '信号监控',
    category: '交易分析',
    size: { cols: 1, rows: 2 },
  },
}
