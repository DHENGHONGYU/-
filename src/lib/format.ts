/**
 * 将任意字段格式化为可显示字符串
  * @doc [V9-DOC-FRONT-037]
*/
export function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol') return value.toString()
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- 回退分支：value 已经过所有基本类型检查，此处为 object，调用 String() 是合理的最后手段
  return String(value)
}

// ── 安全数值格式化（防御 undefined/NaN/Infinity） ────────────────────
export function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback: string = '--',
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  return value.toFixed(decimals)
}

export function safeFormatPercent(
  value: number | undefined | null,
  decimals: number = 2,
  fallback: string = '--',
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function safeFormatInt(
  value: number | undefined | null,
  fallback: string = '--',
): string {
  return safeFormatNumber(value, 0, fallback)
}

export function isValidNumber(
  v: number | undefined | null,
): v is number {
  return v !== undefined && v !== null && Number.isFinite(v)
}

/**
 * 将时间戳格式化为相对时间（如 "5分钟前"、"3小时前"）
 *
 * @param timestamp 目标时间戳（epoch ms）
 * @returns 相对时间字符串；1 分钟内返回 "刚刚"
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  // 未来时间戳：clock skew 或计划任务，返回"未来"避免被误判为"刚刚"
  if (diff < 0) return '未来'
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}
