/**
 * @fileoverview 检索结果列表
 *
 * 整合时间线视图和分组视图，提供视图切换。
 *
 * @module components/organisms/search/SearchResultList
 * @created 2026-07-14 - 双通道整改 P2-3
 */

import { useSearchStore } from '@/store/searchStore'
import type { SearchViewMode } from '@/store/searchStore'
import { TimelineView } from './TimelineView'
import { GroupedView } from './GroupedView'
import type { SearchItem } from '@/types/modules/data-sync.types'

export interface SearchResultListProps {
  items: readonly SearchItem[]
  total: number
  page: number
  pageSize: number
  onItemClick?: (item: SearchItem) => void
}

const VIEW_OPTIONS: ReadonlyArray<{ label: string; value: SearchViewMode }> = [
  { label: '时间线', value: 'timeline' },
  { label: '分组', value: 'grouped' },
]

/**
 * 检索结果列表
 *
 * 包含视图切换（时间线/分组）和分页信息。
 */
export function SearchResultList({
  items, total, page, pageSize, onItemClick,
}: SearchResultListProps): React.JSX.Element {
  const viewMode = useSearchStore(s => s.viewMode)
  const setViewMode = useSearchStore(s => s.setViewMode)

  const totalPages = Math.ceil(total / pageSize)
  const startIdx = total > 0 ? (page - 1) * pageSize + 1 : 0
  const endIdx = Math.min(page * pageSize, total)

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          共 {total} 条结果，显示 {startIdx}-{endIdx}
        </span>
        <div className="flex gap-1">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewMode(opt.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 结果列表 */}
      {viewMode === 'timeline' ? (
        <TimelineView items={items} onItemClick={onItemClick} />
      ) : (
        <GroupedView items={items} onItemClick={onItemClick} />
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
        </div>
      )}
    </div>
  )
}
