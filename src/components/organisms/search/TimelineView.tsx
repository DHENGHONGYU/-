/**
 * @fileoverview 时间线视图组件
 *
 * 按时间倒序展示检索结果，每项显示时间戳、来源、标题、摘要。
 *
 * @module components/organisms/search/TimelineView
 * @created 2026-07-14 - 双通道整改 P2-3
 */

import { BADGE_COLORS } from '@/constants/theme/theme.tokens.badges'
import type { SearchItem } from '@/types/modules/data-sync.types'

export interface TimelineViewProps {
  items: readonly SearchItem[]
  onItemClick?: (item: SearchItem) => void
}

/** 来源图标映射 */
const SOURCE_ICON: Record<string, string> = {
  'collection-history': '📡',
  'local-doc': '📄',
  'code-file': '🔧',
  'script-file': '📜',
}

/** 通道标签映射 */
const CHANNEL_LABEL: Record<string, string> = {
  'auto-collect': '自动采集',
  'file-import': '文件导入',
  'manual-trigger': '手动触发',
}

/** 格式化时间 */
function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

/**
 * 时间线视图
 *
 * 按时间倒序排列检索结果，左侧显示时间轴。
 */
export function TimelineView({ items, onItemClick }: TimelineViewProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        无检索结果
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const icon = SOURCE_ICON[item.source] ?? '📋'
        const channelLabel = CHANNEL_LABEL[item.details.channel as string] ?? item.source
        const status = item.details.status as string

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className="flex w-full gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent"
          >
            {/* 图标 */}
            <span className="text-lg leading-none">{icon}</span>

            {/* 内容 */}
            <div className="flex-1 space-y-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime(item.timestamp)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {channelLabel}
                </span>
                {status && (
                  <span className={`rounded px-1.5 py-0.5 text-xs ${
                    BADGE_COLORS.statusBadge[status as keyof typeof BADGE_COLORS.statusBadge]
                      ?? BADGE_COLORS.statusBadge.failed
                  }`}>
                    {status === 'success' ? '成功' : status === 'partial' ? '部分' : '失败'}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
