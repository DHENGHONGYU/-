/**
 * @module stockCodeUtils
 * @description 股票代码格式转换工具（腾讯/新浪/网易/新浪财经格式）。
 *
 * ⚠️ 收敛说明：原 `services/data-collector/directDataAPI.ts` 与
 * `services/fetcher/directDataAPI.ts` 各自维护了代码格式转换逻辑。
 * 此文件为 extracted canonical，两个文件应通过此模块获取代码转换函数。
 *
 * @created 2026-07-19 — P1-6 directDataAPI 双副本统一阶段 1（共享工具抽取）
 */

/**
 * 将 6 位代码转换为腾讯格式（sh/sz/bj 前缀）
 * @example toTencentCode('600519') → 'sh600519'
 */
export function toTencentCode(code: string): string {
  if (code.startsWith('6')) return `sh${code}`
  if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`
  if (code.startsWith('8') || code.startsWith('4')) return `bj${code}`
  return `sh${code}`
}

/**
 * 将 6 位代码转换为新浪格式（同腾讯格式）
 * @example toSinaCode('000001') → 'sz000001'
 */
export function toSinaCode(code: string): string {
  return toTencentCode(code)
}

/**
 * 将 6 位代码转换为网易格式（0=沪/1=深 前缀）
 * @example toNeteaseCode('600519') → '0600519'
 */
export function toNeteaseCode(code: string): string {
  if (code.startsWith('6')) return `0${code}`
  return `1${code}`
}
