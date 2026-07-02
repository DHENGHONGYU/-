/**
 * 将任意字段格式化为可显示字符串
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
