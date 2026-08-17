/**
 * @fileoverview useDocumentTitle — 全局浏览器标签页标题管理
 * @module hooks/useDocumentTitle
 *
 * V11: 统一 document.title 管理，解决所有页面浏览器标题缺失问题。
 * 优先级：显式传入 title > PageHeader 自动同步 > 默认值
 *
 * 格式：「页面标题」- 舱室名 - FinSightV9
 *
 * @compliance AGENTS.md §三 用户体验规范
 */

import { useEffect } from 'react'

const APP_NAME = 'FinSightV9'

/** 舱室名映射（从路径前缀推导） */
const CABIN_LABEL_MAP: Record<string, string> = {
  input: '输入舱',
  analysis: '分析舱',
  trading: '交易舱',
  output: '输出舱',
  command: '总控舱',
}

/**
 * 从路径推导舱室名
 * 例：/analysis/intelligent-score → '分析舱'
 */
function deriveCabinLabel(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && segments[0]) {
    return CABIN_LABEL_MAP[segments[0]]
  }
  return undefined
}

/**
 * 设置浏览器标签页标题
 *
 * @param title - 页面标题（不含后缀）
 * @param cabin - 可选舱室名；未提供时从 window.location.pathname 自动推导
 *
 * @example
 * useDocumentTitle('个股智能分析') // → 「个股智能分析」- 分析舱 - FinSightV9
 * useDocumentTitle('首页')         // → 「首页」- FinSightV9
 * useDocumentTitle('')             // → FinSightV9（仅应用名）
 */
export function useDocumentTitle(title: string, cabin?: string): void {
  useEffect(() => {
    const cabinLabel = cabin ?? deriveCabinLabel(window.location.pathname)

    const parts: string[] = []
    if (title) parts.push(`「${title}」`)
    if (cabinLabel) parts.push(cabinLabel)
    parts.push(APP_NAME)

    const prev = document.title
    document.title = parts.join(' - ')

    return () => {
      // 卸载时恢复原标题（避免在 SPA 切换时残留）
      document.title = prev
    }
  }, [title, cabin])
}

export default useDocumentTitle