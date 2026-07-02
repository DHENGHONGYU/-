/**
 * 将任意字段格式化为可显示字符串
 */
export function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'number') return value.toString()
  return String(value)
}
