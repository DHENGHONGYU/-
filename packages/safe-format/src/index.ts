/**
 * @finsightv9/safe-format — Safe number formatting utilities
 *
 * Prevents TypeError, Infinity display, and RangeError from raw .toFixed() calls.
 * Designed for financial UI applications where null/undefined/NaN/Infinity values
 * are common and must not crash the page.
 *
 * @example
 * ```typescript
 * import { safeFormatNumber, safeFormatPercent } from '@finsightv9/safe-format'
 *
 * safeFormatNumber(null, 2)        // '--'
 * safeFormatNumber(Infinity, 2)    // '--'
 * safeFormatNumber(3.14159, 2)     // '3.14'
 * safeFormatNumber(42, -1)         // '42' (decimals clamped to 0)
 *
 * safeFormatPercent(1.5, 2)        // '+1.50%'
 * safeFormatPercent(-1.5, 2)       // '-1.50%'
 * safeFormatPercent(null, 2)       // '--'
 * ```
 */

const DEFAULT_FALLBACK = '--'

/**
 * Safely format a number with fixed decimal places.
 *
 * Guards against:
 * - `null` / `undefined` → returns fallback (default '--')
 * - `NaN` / `Infinity` / `-Infinity` → returns fallback
 * - `decimals` out of range → clamped to [0, 20]
 * - `decimals` not integer → truncated to integer
 * - `decimals` is NaN → treated as 0
 *
 * @param value - The number to format (null/undefined safe)
 * @param decimals - Number of decimal places (clamped to [0, 20])
 * @param fallback - String to return for invalid values (default '--')
 * @returns Formatted string or fallback
 */
export function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  const safeDecimals = Math.max(0, Math.min(20, Math.trunc(decimals) || 0))
  return value.toFixed(safeDecimals)
}

/**
 * Safely format a number as a percentage with sign prefix.
 *
 * Automatically adds '+' prefix for positive numbers.
 * Same null/NaN/Infinity/decimals guards as safeFormatNumber.
 *
 * @param value - The number to format as percentage (e.g., 1.5 for +1.50%)
 * @param decimals - Number of decimal places (default 2, clamped to [0, 20])
 * @param fallback - String to return for invalid values (default '--')
 * @returns Formatted percentage string with sign, or fallback
 *
 * @example
 * ```typescript
 * safeFormatPercent(1.5, 2)     // '+1.50%'
 * safeFormatPercent(-1.5, 2)    // '-1.50%'
 * safeFormatPercent(0, 2)       // '0.00%'
 * safeFormatPercent(null, 2)    // '--'
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
  const safeDecimals = Math.max(0, Math.min(20, Math.trunc(decimals) || 0))
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(safeDecimals)}%`
}

/**
 * Safely format a number with thousands separators.
 *
 * Combines safeFormatNumber's null/NaN guards with locale-aware
 * thousands separators for large financial figures.
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default 2)
 * @param fallback - String to return for invalid values (default '--')
 * @returns Formatted string with thousands separators, or fallback
 */
export function safeFormatCurrency(
  value: number | undefined | null,
  decimals: number = 2,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  const safeDecimals = Math.max(0, Math.min(20, Math.trunc(decimals) || 0))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals,
  })
}

export { DEFAULT_FALLBACK }
export default { safeFormatNumber, safeFormatPercent, safeFormatCurrency }
