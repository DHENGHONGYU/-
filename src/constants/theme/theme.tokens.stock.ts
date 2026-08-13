/**
 * @fileoverview L5 股票颜色（STOCK_COLOR_TOKENS + getStockColor* 函数）
 *
 * 从 theme.tokens.ts 拆分而来，职责：红涨绿跌例外规则（豁免主题切换）
 *
 * @important
 * 这是例外规则，不受通用颜色规范或主题切换影响：
 * - 股票上涨 → 红色（中国A股标准：红涨绿跌）
 * - 股票下跌 → 绿色（中国A股标准：红涨绿跌）
 * - 平盘 → 灰色
 * 这些颜色必须豁免主题切换（暗色模式不改变涨跌颜色）
 *
 * @module constants/theme/stock
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
/**
 * 股票涨跌颜色令牌（例外规则）
 *
 * @remarks
 * **这是例外规则**，不受通用颜色规范或主题切换影响：
 * - 股票上涨 → 红色（中国A股标准：红涨绿跌）
 * - 股票下跌 → 绿色（中国A股标准：红涨绿跌）
 * - 平盘 → 灰色
 *
 * @important
 * 这些颜色**必须**豁免主题切换（暗色模式不改变涨跌颜色）
 * 如需实现主题切换，请确保这些颜色不被修改
 *
 * @example
 * // ✅ 正确用法（使用 STOCK_COLOR_TOKENS，自动豁免主题切换）
 * import { STOCK_COLOR_TOKENS, getStockColor } from '@/constants/theme.tokens'
 * const color = getStockColor(3.2) // => STOCK_COLOR_TOKENS.up
 *
 * // ❌ 错误用法（使用 COLOR_TOKENS，可能被主题切换影响）
 * import { COLOR_TOKENS } from '@/constants/theme.tokens'
 * const color = change >= 0 ? COLOR_TOKENS.up.hex : COLOR_TOKENS.down.hex
  * @doc []
*/
export const STOCK_COLOR_TOKENS = {
  /** 上涨颜色（红色，中国A股标准） */
  up: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
    /** 80% 透明度版本（rgba 近似），用于 MACD histogram 等半透明柱状 / 面积叠层 */
    hexAlpha80: '#ef4444cc',
    /** 50% 透明度版本，用于弱提示填充背景 */
    hexAlpha50: '#ef444480',
  },
  /** 下跌颜色（绿色，中国A股标准） */
  down: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
    /** 80% 透明度版本，用于 MACD histogram 等半透明柱状 / 面积叠层 */
    hexAlpha80: '#22c55ecc',
    /** 50% 透明度版本，用于弱提示填充背景 */
    hexAlpha50: '#22c55e80',
  },
  /** 平盘/中性颜色（灰色） */
  neutral: {
    hex: '#9ca3af',
    tailwind: 'text-gray-400',
    bgClass: 'bg-gray-400',
    rgb: '156, 163, 175',
    hexAlpha80: '#9ca3afcc',
    hexAlpha50: '#9ca3af80',
  },
} as const

/** 股票颜色令牌类型 */
export type StockColorTokenKey = keyof typeof STOCK_COLOR_TOKENS

/**
 * 获取股票涨跌颜色（自动判断，豁免主题切换）
 * @param change - 涨跌值（正数=上涨，负数=下跌，0=平盘）
 * @returns 颜色令牌（包含 hex/tailwind/bgClass/rgb）
 *
 * @example
 * const color = getStockColor(3.2) // => STOCK_COLOR_TOKENS.up
 * const color = getStockColor(-1.5) // => STOCK_COLOR_TOKENS.down
 * const color = getStockColor(0) // => STOCK_COLOR_TOKENS.neutral
 */
export function getStockColor(change: number) {
  if (change > 0) return STOCK_COLOR_TOKENS.up
  if (change < 0) return STOCK_COLOR_TOKENS.down
  return STOCK_COLOR_TOKENS.neutral
}

/**
 * 获取股票涨跌 Tailwind 类名（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns Tailwind 类名（如 `text-red-500`）
 *
 * @example
 * const className = getStockColorClass(3.2) // => 'text-red-500'
 * const className = getStockColorClass(-1.5) // => 'text-green-500'
 */
export function getStockColorClass(change: number): string {
  return getStockColor(change).tailwind
}

/**
 * 获取股票涨跌 HEX 色值（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns HEX 色值（如 `#ef4444`）
 *
 * @example
 * const hex = getStockColorHex(3.2) // => '#ef4444'（红色）
 * const hex = getStockColorHex(-1.5) // => '#22c55e'（绿色）
 */
export function getStockColorHex(change: number): string {
  const result = getStockColor(change).hex
  // 调试日志：帮助排查颜色计算问题
  if (typeof window !== 'undefined' && (window as Window & { __DEBUG_STOCK_COLORS__?: boolean }).__DEBUG_STOCK_COLORS__) {
    // eslint-disable-next-line no-console
    console.debug(
      `[StockColor] getStockColorHex(${change}) => ${result}`,
      { change, result, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' }
    )
  }
  return result
}

/**
 * 获取股票涨跌背景类名（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns 背景类名（如 `bg-red-500`）
 */
export function getStockColorBg(change: number): string {
  return getStockColor(change).bgClass
}
