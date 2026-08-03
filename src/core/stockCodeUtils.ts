/**
 * @module stockCodeUtils
 * @description 股票代码格式转换工具（腾讯/新浪/网易/新浪财经格式）。
 *
 * ⚠️ 收敛说明：原 `services/data-collector/directDataAPI.ts` 与
 * `services/fetcher/directDataAPI.ts` 各自维护了代码格式转换逻辑。
 * 此文件为 extracted canonical，两个文件应通过此模块获取代码转换函数。
 *
 * @created 2026-07-19 — P1-6 directDataAPI 双副本统一阶段 1（共享工具抽取）
  * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/

/**
 * 将 6 位代码转换为腾讯格式（sh/sz/bj 前缀）
 * 自动剥离 .SH/.SZ/.BJ 后缀（兼容带后缀的输入）。
 * @example toTencentCode('600519') → 'sh600519'
 * @example toTencentCode('600519.SH') → 'sh600519'
 */
export function toTencentCode(code: string): string {
  // 剥离 .SH/.SZ/.BJ 后缀（大小写不敏感）
  const bare = code.replace(/\.(SH|SZ|BJ)$/i, '')
  if (bare.startsWith('6')) return `sh${bare}`
  if (bare.startsWith('0') || bare.startsWith('3')) return `sz${bare}`
  if (bare.startsWith('8') || bare.startsWith('4')) return `bj${bare}`
  return `sh${bare}`
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
