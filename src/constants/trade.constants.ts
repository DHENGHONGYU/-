/**
 * @module TradeConstants
 * @description 交易持仓模块常量定义。所有枚举值、颜色映射、配置数值必须从此文件引用，禁止在组件中硬编码。
 */

// ============================================================
// 交易方向枚举
// ============================================================

/** 交易方向 */
export const TRADE_DIRECTION = {
  BUY: 'BUY' as const,
  SELL: 'SELL' as const,
  ALL: 'ALL' as const,
} as const

export type TradeDirection = (typeof TRADE_DIRECTION)[keyof typeof TRADE_DIRECTION]

/** 交易方向显示标签 */
export const TRADE_DIRECTION_LABELS: Record<TradeDirection, string> = {
  [TRADE_DIRECTION.BUY]: '买入',
  [TRADE_DIRECTION.SELL]: '卖出',
  [TRADE_DIRECTION.ALL]: '全部',
}

/** 交易方向选项列表（用于下拉选择器） */
export const TRADE_DIRECTION_OPTIONS = [
  { value: TRADE_DIRECTION.ALL, label: TRADE_DIRECTION_LABELS[TRADE_DIRECTION.ALL] },
  { value: TRADE_DIRECTION.BUY, label: TRADE_DIRECTION_LABELS[TRADE_DIRECTION.BUY] },
  { value: TRADE_DIRECTION.SELL, label: TRADE_DIRECTION_LABELS[TRADE_DIRECTION.SELL] },
] as const

// ============================================================
// 策略类型枚举
// ============================================================

/** 策略类型 */
export const STRATEGY_TYPE = {
  CORE: 'CORE' as const,
  HOT: 'HOT' as const,
  VALUE: 'VALUE' as const,
} as const

export type StrategyType = (typeof STRATEGY_TYPE)[keyof typeof STRATEGY_TYPE]

/** 策略类型显示标签 */
export const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  [STRATEGY_TYPE.CORE]: '核心仓',
  [STRATEGY_TYPE.HOT]: '热点短线',
  [STRATEGY_TYPE.VALUE]: '价值洼地',
}

/** 策略类型颜色映射（标签背景色） */
export const STRATEGY_TYPE_COLORS: Record<StrategyType, { bg: string; text: string; border: string }> = {
  [STRATEGY_TYPE.CORE]: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  [STRATEGY_TYPE.HOT]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  [STRATEGY_TYPE.VALUE]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

// ============================================================
// 操作类型枚举
// ============================================================

/** 持仓操作类型 */
export const HOLDING_ACTION = {
  ADD_POSITION: 'ADD_POSITION' as const,
  CLOSE_POSITION: 'CLOSE_POSITION' as const,
} as const

export type HoldingAction = (typeof HOLDING_ACTION)[keyof typeof HOLDING_ACTION]

/** 持仓操作显示标签 */
export const HOLDING_ACTION_LABELS: Record<HoldingAction, string> = {
  [HOLDING_ACTION.ADD_POSITION]: '补仓',
  [HOLDING_ACTION.CLOSE_POSITION]: '平仓',
}

// ============================================================
// A股涨跌颜色映射（红涨绿跌）
// ============================================================

/** 涨跌颜色常量 */
export const PNL_COLORS = {
  /** 上涨 / 正收益 - 红色 */
  UP: '#ef4444',
  UP_HEX: '#ef4444',
  UP_CLASS: 'text-red-500',
  UP_BG_CLASS: 'bg-red-50',
  /** 下跌 / 负收益 - 绿色 */
  DOWN: '#22c55e',
  DOWN_HEX: '#22c55e',
  DOWN_CLASS: 'text-green-500',
  DOWN_BG_CLASS: 'bg-green-50',
  /** 中性 / 平盘 - 灰色 */
  NEUTRAL: '#6b7280',
  NEUTRAL_HEX: '#6b7280',
  NEUTRAL_CLASS: 'text-gray-500',
  NEUTRAL_BG_CLASS: 'bg-gray-50',
} as const

/**
 * 根据盈亏值获取语义化颜色类名
 * @param value 盈亏数值
 * @returns Tailwind 颜色类名
 */
export function getPnlColorClass(value: number): string {
  if (value > 0) return PNL_COLORS.UP_CLASS
  if (value < 0) return PNL_COLORS.DOWN_CLASS
  return PNL_COLORS.NEUTRAL_CLASS
}

/**
 * 根据盈亏值获取语义化背景色类名
 * @param value 盈亏数值
 * @returns Tailwind 背景色类名
 */
export function getPnlBgClass(value: number): string {
  if (value > 0) return PNL_COLORS.UP_BG_CLASS
  if (value < 0) return PNL_COLORS.DOWN_BG_CLASS
  return PNL_COLORS.NEUTRAL_BG_CLASS
}

/**
 * 根据盈亏值获取颜色 HEX 值
 * @param value 盈亏数值
 * @returns 颜色 HEX 字符串
 */
export function getPnlColor(value: number): string {
  if (value > 0) return PNL_COLORS.UP_HEX
  if (value < 0) return PNL_COLORS.DOWN_HEX
  return PNL_COLORS.NEUTRAL_HEX
}

// ============================================================
// 分页配置
// ============================================================

/** 分页默认值 */
export const PAGINATION_DEFAULTS = {
  /** 默认页码 */
  DEFAULT_PAGE: 1,
  /** 默认每页条数 */
  DEFAULT_PAGE_SIZE: 10,
  /** 可选每页条数 */
  PAGE_SIZE_OPTIONS: [10, 20, 50] as const,
} as const

/** 分页最大显示页数 */
export const PAGINATION_MAX_VISIBLE = 5

// ============================================================
// API 端点配置
// ============================================================

/** 交易持仓 API 端点 */
export const HOLDINGS_API = {
  /** 持仓列表 */
  LIST: '/api/v1/trade/holdings',
  /** 补仓操作 */
  ADD_POSITION: '/api/v1/trade/add-position',
  /** 平仓操作 */
  CLOSE_POSITION: '/api/v1/trade/close-position',
  /** 导出 Excel */
  EXPORT: '/api/v1/trade/holdings/export',
} as const

// ============================================================
// 请求超时与重试配置
// ============================================================

/** 请求配置 */
export const HOLDINGS_REQUEST_CONFIG = {
  /** 请求超时时间（毫秒） */
  TIMEOUT: 15000,
  /** 最大重试次数 */
  MAX_RETRIES: 2,
  /** 重试间隔（毫秒） */
  RETRY_DELAY: 1000,
} as const

// ============================================================
// 表格列配置
// ============================================================

/** 持仓列表表格列宽 */
export const HOLDINGS_TABLE_COL_WIDTHS = {
  CODE: 'w-[100px]',
  NAME: 'w-[120px]',
  QUANTITY: 'w-[90px]',
  CURRENT_PRICE: 'w-[100px]',
  AVG_COST: 'w-[100px]',
  PNL: 'w-[160px]',
  MARKET_VALUE_RATIO: 'w-[100px]',
  STRATEGY: 'w-[100px]',
  ACTION: 'w-[140px]',
} as const

/** 表格列固定配置 */
export const HOLDINGS_TABLE_FIXED = {
  /** 左侧固定列数 */
  LEFT_FIXED_COUNT: 2,
  /** 右侧固定列 */
  RIGHT_FIXED: 'action' as const,
} as const

// ============================================================
// 筛选区配置
// ============================================================

/** 筛选区默认值 */
export const FILTER_DEFAULTS = {
  /** 默认日期范围（天） */
  DEFAULT_DATE_RANGE_DAYS: 30,
} as const

// ============================================================
// 操作确认弹窗配置
// ============================================================

/** 交易确认弹窗标题 */
export const TRADE_MODAL_TITLES: Record<HoldingAction, string> = {
  [HOLDING_ACTION.ADD_POSITION]: '确认补仓',
  [HOLDING_ACTION.CLOSE_POSITION]: '确认平仓',
}

/** 交易确认弹窗描述模板 */
export const TRADE_MODAL_DESCRIPTIONS: Record<HoldingAction, (name: string, code: string) => string> = {
  [HOLDING_ACTION.ADD_POSITION]: (name, code) => `确认对 ${name}（${code}）执行补仓操作？`,
  [HOLDING_ACTION.CLOSE_POSITION]: (name, code) => `确认对 ${name}（${code}）执行平仓操作？请确认当前持仓数量。`,
}

// ============================================================
// 加载状态配置
// ============================================================

/** 骨架屏行数 */
export const SKELETON_ROW_COUNT = 8

/** 骨架屏列配置 */
export const SKELETON_COLUMNS = [
  { width: 'w-16', className: '' },
  { width: 'w-20', className: '' },
  { width: 'w-14', className: '' },
  { width: 'w-16', className: '' },
  { width: 'w-16', className: '' },
  { width: 'w-24', className: '' },
  { width: 'w-16', className: '' },
  { width: 'w-16', className: '' },
  { width: 'w-20', className: '' },
] as const