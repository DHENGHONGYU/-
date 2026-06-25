/** 格式化相对时间（V6 风格） */
export function formatRelativeTime(isoTime: string): string {
  if (!isoTime) return ''
  try {
    const date = new Date(isoTime)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    if (diffHour < 24) return `${diffHour}小时前`
    if (diffDay < 7) return `${diffDay}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return isoTime
  }
}

/** 格式化来源（V6 风格） */
export function formatSource(source: string): string {
  const map: Record<string, string> = {
    sina: '新浪财经',
    eastmoney: '东方财富',
    cailianshe: '财联社',
    mock: '模拟数据',
  }
  return map[source] || source || '资讯'
}
