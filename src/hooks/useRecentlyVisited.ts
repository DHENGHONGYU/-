/**
 * useRecentlyVisited — 最近访问页面 Hook
 *
 * 追踪用户最近访问的侧边栏页面，持久化到 localStorage。
 * 在侧边栏顶部展示"最近访问"分组，减少导航查找成本。
 *
 * 设计决策：
 * - 仅追踪侧边栏中存在的页面
 * - 最多保留 5 个最近访问页面
 * - 当前激活页面不展示（避免重复）
 * - 300ms 防抖，避免快速连续跳转污染历史
 */

import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router'
import { getAllSidebarPaths } from '@/config/sidebarConfig'
import { getLogger } from '@/lib/logger'

const logger = getLogger()
const STORAGE_KEY = 'finsight_recently_visited'
const MAX_ITEMS = 5

function safeGetStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function safeSetStorage(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
  } catch {
    /* silently fail */
  }
}

export function useRecentlyVisited(): string[] {
  const location = useLocation()
  const [paths, setPaths] = useState<string[]>(() => safeGetStorage())

  const validPaths = getAllSidebarPaths()
  const validPathSet = new Set(validPaths)

  const recordVisit = useCallback(
    (path: string) => {
      if (!validPathSet.has(path)) return

      const current = safeGetStorage()
      const filtered = current.filter((p) => p !== path)
      const next = [path, ...filtered].slice(0, MAX_ITEMS)

      safeSetStorage(next)
      setPaths(next)
    },
    [validPathSet],
  )

  useEffect(() => {
    const pathname = location.pathname
    logger.debug('[useRecentlyVisited] 路径变化', { pathname })

    const timer = setTimeout(() => {
      recordVisit(pathname)
    }, 300)

    return () => clearTimeout(timer)
  }, [location.pathname, recordVisit])

  // 过滤掉当前页面，避免重复高亮
  return paths.filter((p) => p !== location.pathname)
}
