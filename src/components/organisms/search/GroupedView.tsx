/**
 * @fileoverview 分组视图组件
 *
 * 按来源/通道/状态分组展示检索结果。
 *
 * @module components/organisms/search/GroupedView
 * @created 2026-07-14 - 双通道整改 P2-3
 */

import { useMemo } from 'react'
import { BADGE_COLORS } from '@/constants/theme/theme.tokens.badges'
import type { SearchItem } from '@/types/modules/data-sync.types'

export interface GroupedViewProps {
  items: readonly SearchItem[]
  groupBy?: 'source' | 'channel' | 'status'
  onItemClick?: (item: SearchItem) => void
}

const GROUP_LABELS: Record<string, string> = {
  'collection-history': '采集历史',
  'local-doc': '本地文档',
  'code-file': '代码文件',
  'script-file': '脚本文件',
  'auto-collect': '自动采集',
  'file-import': '文件导入',
  'manual-trigger': '手动触发',
  'success': '成功',
  'partial': '部分成功',
  'failed': '失败',
}

const GROUP_COLORS: Record<string, string> = {
  'collection-history': BADGE_COLORS.groupBorder['collection-history'],
  'local-doc': BADGE_COLORS.groupBorder['local-doc'],
  'code-file': BADGE_COLORS.groupBorder['code-file'],
  'script-file': BADGE_COLORS.groupBorder['script-file'],
  'auto-collect': BADGE_COLORS.groupBorder['auto-collect'],
  'file-import': BADGE_COLORS.groupBorder['file-import'],
  'manual-trigger': BADGE_COLORS.groupBorder['manual-trigger'],
  'success': BADGE_COLORS.groupBorder.success,
  'partial': BADGE_COLORS.groupBorder.partial,
  'failed': BADGE_COLORS.groupBorder.failed,
}

/**
 * 分组视图
 *
 * 按指定维度分组展示检索结果，每组可折叠。
 */
export function GroupedView({ items, groupBy = 'source', onItemClick }: GroupedViewProps): React.JSX.Element {
  const groups = useMemo(() => {
    const map = new Map<string, SearchItem[]>()
    for (const item of items) {
      let key: string
      if (groupBy === 'source') key = item.source
      else if (groupBy === 'channel') key = (item.details.channel as string) ?? 'unknown'
      else key = (item.details.status as string) ?? 'unknown'

      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [items, groupBy])

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        无检索结果
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(([key, groupItems]) => {
        const label = GROUP_LABELS[key] ?? key
        const colorClass = GROUP_COLORS[key] ?? BADGE_COLORS.groupBorder.unknown

        return (
          <div key={key} className={`rounded-lg border-l-4 ${colorClass} bg-card shadow-sm`}>
            {/* 组头 */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">{label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {groupItems.length} 项
              </span>
            </div>

            {/* 组内容 */}
            <div className="divide-y">
              {groupItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  className="block w-full px-4 py-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {item.snippet}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
