import { COLOR_SHADES } from '@/constants/theme.tokens'
import { DEBUG_LOG_NAMESPACE } from './types'

/**
 * 灰色地带日志缓冲区（module 级，跨分析调用累积）
 * 浏览器环境下通过内存缓冲 + Blob 下载实现 debug.log 归档
 * 命名空间：chipStrategyGrayZone
 */
const debugLogBuffer: string[] = []
let debugLogSessionStart: string | null = null

/** 追加一条 debug 日志（同时输出到控制台便于实时观察） */
export function appendDebugLog(content: string): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${content}`
  debugLogBuffer.push(line)
  // 同时输出到控制台便于实时观察，但不再使用 console.warn（避免污染控制台）
  // eslint-disable-next-line no-console
  console.log(`%c[${DEBUG_LOG_NAMESPACE}]`, `color: ${COLOR_SHADES.amber.hex[500]}; font-weight: bold;`, line)
}

/** 标记 debug 日志会话开始（首次调用时设置） */
export function markDebugLogSessionStart(): void {
  if ((debugLogSessionStart ?? '') === '') {
    debugLogSessionStart = new Date().toISOString()
  }
}

/** 获取当前 debug.log 全文（含会话头） */
export function getDebugLogContent(): string {
  const header = (debugLogSessionStart ?? '') !== ''
    ? `# 筹码策略复盘 debug.log\n# 会话开始: ${debugLogSessionStart}\n# 会话结束: ${new Date().toISOString()}\n# 日志条数: ${debugLogBuffer.length}\n${'='.repeat(80)}\n\n`
    : `# 筹码策略复盘 debug.log\n# 暂无日志记录\n`
  return header + debugLogBuffer.join('\n\n')
}

/** 清空 debug 日志缓冲区 */
export function clearDebugLog(): void {
  debugLogBuffer.length = 0
  debugLogSessionStart = null
}

/** 返回当前缓冲区日志条数 */
export function getDebugLogCount(): number {
  return debugLogBuffer.length
}


/** 下载 debug.log 文件（灰色地带判定归档） */
export function downloadDebugLogFile(): number {
  const content = getDebugLogContent()
  const count = getDebugLogCount()
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `debug_${DEBUG_LOG_NAMESPACE}_${new Date().toISOString().slice(0, 10)}.log`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return count
}
