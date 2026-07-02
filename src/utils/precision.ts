/**
 * 金融数值精度工具
 * v0.9.11 P2-TS002
 * 用途：统一处理股票价格、涨跌幅、百分比等数值的精度控制
 */

// 小数位精度常量
export const PRECISION = {
  PRICE: 2,       // 股票价格：2位小数
  CHANGE: 2,      // 涨跌额：2位小数
  CHANGE_RATE: 2, // 涨跌幅：2位小数（百分比）
  PERCENT: 1,     // 百分比：1位小数
  VOLUME: 0,      // 成交量：整数
  AMOUNT: 2,      // 成交额：2位小数
} as const

/**
 * 格式化价格（自动处理精度）
 * @param value 数值
 * @param decimals 小数位数，默认2位
 * @returns 格式化后的价格字符串，无效值返回 '--'
 */
export function formatPrice(value: number | undefined | null, decimals = PRECISION.PRICE): string {
  if (value == null || isNaN(value)) return '--'
  return value.toFixed(decimals)
}

/**
 * 格式化涨跌幅（%）
 * @param value 涨跌幅数值（如 5.23 表示 5.23%）
 * @returns 带正负号和百分号的字符串，无效值返回 '--'
 */
export function formatChangeRate(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(PRECISION.CHANGE_RATE)}%`
}

/**
 * 格式化涨跌额
 * @param value 涨跌额数值
 * @returns 带正负号的字符串，无效值返回 '--'
 */
export function formatChange(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(PRECISION.CHANGE)}`
}

/**
 * 格式化成交量（万/亿单位）
 * @param value 成交量数值
 * @param unit 显示单位，'auto'自动选择，'wan'万，'yi'亿
 * @returns 格式化后的成交量字符串
 */
export function formatVolume(value: number | undefined | null, unit: 'auto' | 'wan' | 'yi' = 'auto'): string {
  if (value == null || isNaN(value)) return '--'

  if (unit === 'wan' || (unit === 'auto' && value < 100000000)) {
    const wan = value / 10000
    return `${wan.toFixed(PRECISION.VOLUME)}万`
  }

  const yi = value / 100000000
  return `${yi.toFixed(2)}亿`
}

/**
 * 格式化成交额（万/亿单位）
 * @param value 成交额数值（元）
 * @param unit 显示单位，'auto'自动选择，'wan'万，'yi'亿
 * @returns 格式化后的成交额字符串
 */
export function formatAmount(value: number | undefined | null, unit: 'auto' | 'wan' | 'yi' = 'auto'): string {
  if (value == null || isNaN(value)) return '--'

  if (unit === 'wan' || (unit === 'auto' && value < 100000000)) {
    const wan = value / 10000
    return `${wan.toFixed(PRECISION.AMOUNT)}万`
  }

  const yi = value / 100000000
  return `${yi.toFixed(PRECISION.AMOUNT)}亿`
}

/**
 * 格式化百分比
 * @param value 0-1之间的小数或数值
 * @param decimals 小数位数
 * @returns 带百分号的字符串
 */
export function formatPercent(value: number | undefined | null, decimals = PRECISION.PERCENT): string {
  if (value == null || isNaN(value)) return '--'
  // 如果值大于1，假设是百分比形式（如 50 表示 50%）
  const percentValue = value > 1 ? value : value * 100
  return `${percentValue.toFixed(decimals)}%`
}

/**
 * 安全数组索引访问（配合 noUncheckedIndexedAccess）
 * @param arr 数组
 * @param index 索引
 * @param fallback 越界时的默认值
 * @returns 数组元素或默认值
 */
export function safeArrayGet<T>(arr: T[], index: number): T | undefined
export function safeArrayGet<T>(arr: T[], index: number, fallback: T): T
export function safeArrayGet<T>(arr: T[], index: number, fallback?: T): T | undefined {
  return arr[index] ?? fallback
}

/**
 * 安全获取数组第一个元素（配合 noUncheckedIndexedAccess）
 * @param arr 数组
 * @returns 第一个元素或 undefined
 */
export function safeFirst<T>(arr: T[]): T | undefined {
  return arr[0]
}

/**
 * 安全获取数组最后一个元素（配合 noUncheckedIndexedAccess）
 * @param arr 数组
 * @returns 最后一个元素或 undefined
 */
export function safeLast<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1]
}

/**
 * 安全获取对象属性（链式访问）
 * @param obj 对象
 * @param keyPath 属性路径，如 'a.b.c'
 * @param fallback 默认值
 * @returns 属性值或默认值
 */
export function safeGet<T>(obj: Record<string, unknown> | null | undefined, keyPath: string, fallback: T): T {
  if (obj == null) return fallback

  const keys = keyPath.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback
    current = (current as Record<string, unknown>)[key]
  }

  return (current as T) ?? fallback
}

/**
 * 补充：金融数值格式化
 * v0.9.11 P2-DATA003
 */

// 大数格式化（万/亿）
export function formatLargeNumber(value: number | undefined | null, _unit = '万'): string {
  if (value == null || isNaN(value)) return '--'
  if (Math.abs(value) >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`
  }
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(2)}万`
  }
  return value.toFixed(2)
}

// 涨跌幅颜色（配合 COLOR_TOKENS）
export function getChangeColor(value: number): 'up' | 'down' | 'neutral' {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

// 格式化市值
export function formatMarketCap(value: number | undefined | null): string {
  return formatLargeNumber(value, '万')
}

// 格式化成交量
export function formatShares(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '--'
  return formatLargeNumber(value, '股')
}
