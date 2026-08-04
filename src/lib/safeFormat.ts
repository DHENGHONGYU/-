/**
 * @module safeFormat
 * @description 安全数值格式化模块，防御 undefined/null/NaN/Infinity 导致的运行时错误。
 *
 * 本模块提供 4 个工具函数，用于在金融数据组件中安全地格式化数值：
 * - `safeFormatNumber` — 安全格式化数值为指定小数位数字符串
 * - `safeFormatPercent` — 安全格式化百分比，正数自动添加 + 前缀
 * - `safeFormatInt` — 安全格式化整数
 * - `isValidNumber` — 类型守卫，判断值是否为有效有限数字
 *
 * @example 基本用法
 * ```typescript
 * import { safeFormatNumber, safeFormatPercent, isValidNumber } from '@/lib/safeFormat'
 *
 * // 正常值
 * safeFormatNumber(1688.88, 2)        // → "1688.88"
 * safeFormatPercent(2.35)             // → "+2.35%"
 *
 * // 空值 / 异常值
 * safeFormatNumber(undefined, 2)      // → "--"
 * safeFormatNumber(null, 2)           // → "--"
 * safeFormatNumber(NaN, 2)            // → "--"
 * safeFormatNumber(Infinity, 2)       // → "--"
 *
 * // 类型守卫
 * if (isValidNumber(stock.price)) {
 *   // 此处 stock.price 已收窄为 number 类型
 *   const marketValue = stock.price * shares
 * }
 * ```
 *
 * @doc [V9-DOC-FRONT-037]
 */

/**
 * 默认占位符，当值为空或非有限数字时返回。
 */
export const DEFAULT_FALLBACK = '--'

/**
 * 判断值是否为有效的有限数字（类型守卫）。
 *
 * 用于在条件分支中收窄 `number | undefined | null` 到 `number`，
 * 避免后续运算或格式化时出现运行时错误。
 *
 * @param v - 待检查的值
 * @returns 如果是有效有限数字返回 `true`，否则 `false`
 *
 * @example
 * ```typescript
 * isValidNumber(42)          // → true
 * isValidNumber(0)           // → true
 * isValidNumber(-3.14)       // → true
 * isValidNumber(undefined)   // → false
 * isValidNumber(null)        // → false
 * isValidNumber(NaN)         // → false
 * isValidNumber(Infinity)    // → false
 * isValidNumber(-Infinity)   // → false
 *
 * // 类型守卫用法
 * const price: number | undefined = data.price
 * if (isValidNumber(price)) {
 *   // price 已收窄为 number
 *   console.log(price.toFixed(2))  // 安全调用
 * }
 * ```
 */
export function isValidNumber(v: number | undefined | null): v is number {
  return v !== undefined && v !== null && Number.isFinite(v)
}

/**
 * 安全格式化数值为指定小数位数的字符串。
 *
 * 当值为 `undefined`、`null`、`NaN`、`Infinity` 或 `-Infinity` 时，
 * 返回占位符（默认 `--`），而非抛出 `TypeError`。
 *
 * @param value - 待格式化的数值，允许为 undefined/null
 * @param decimals - 小数位数（0-20），传给 `Number.prototype.toFixed`
 * @param fallback - 空值时的占位符，默认为 `'--'`
 * @returns 格式化后的字符串，或占位符
 *
 * @example
 * ```typescript
 * safeFormatNumber(1688.88, 2)        // → "1688.88"
 * safeFormatNumber(0, 2)              // → "0.00"
 * safeFormatNumber(-3.14, 2)          // → "-3.14"
 * safeFormatNumber(undefined, 2)      // → "--"
 * safeFormatNumber(null, 2)           // → "--"
 * safeFormatNumber(NaN, 2)            // → "--"
 * safeFormatNumber(Infinity, 2)       // → "--"
 * safeFormatNumber(42, 0)             // → "42"
 * safeFormatNumber(undefined, 2, 'N/A')  // → "N/A"（自定义占位符）
 * ```
 */
export function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  return value.toFixed(decimals)
}

/**
 * 安全格式化百分比字符串。
 *
 * 正数自动添加 `+` 前缀，负数保留 `-` 前缀，零无前缀。
 * 空值或非有限数字时返回占位符。
 *
 * @param value - 待格式化的百分比值，允许为 undefined/null
 * @param decimals - 小数位数，默认为 2
 * @param fallback - 空值时的占位符，默认为 `'--'`
 * @returns 格式化后的百分比字符串（含 `%` 符号），或占位符
 *
 * @example
 * ```typescript
 * safeFormatPercent(2.35)         // → "+2.35%"
 * safeFormatPercent(0)            // → "0.00%"
 * safeFormatPercent(-1.5)         // → "-1.50%"
 * safeFormatPercent(undefined)    // → "--"
 * safeFormatPercent(null)         // → "--"
 * safeFormatPercent(NaN)          // → "--"
 * safeFormatPercent(2.35, 1)      // → "+2.4%"（1 位小数）
 * safeFormatPercent(2.35, 2, '—') // → "+2.35%"（自定义占位符不会用于正值）
 * safeFormatPercent(undefined, 2, 'N/A')  // → "N/A"
 * ```
 */
export function safeFormatPercent(
  value: number | undefined | null,
  decimals: number = 2,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * 安全格式化整数字符串。
 *
 * 等价于 `safeFormatNumber(value, 0, fallback)`，语义更明确。
 *
 * @param value - 待格式化的数值，允许为 undefined/null
 * @param fallback - 空值时的占位符，默认为 `'--'`
 * @returns 格式化后的整数字符串，或占位符
 *
 * @example
 * ```typescript
 * safeFormatInt(42)              // → "42"
 * safeFormatInt(0)               // → "0"
 * safeFormatInt(-7)              // → "-7"
 * safeFormatInt(undefined)       // → "--"
 * safeFormatInt(null)            // → "--"
 * safeFormatInt(NaN)             // → "--"
 * safeFormatInt(undefined, 'N/A')  // → "N/A"
 * ```
 */
export function safeFormatInt(
  value: number | undefined | null,
  fallback: string = DEFAULT_FALLBACK,
): string {
  return safeFormatNumber(value, 0, fallback)
}
