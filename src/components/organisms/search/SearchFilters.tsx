/**
 * @fileoverview 搜索筛选器组件
 *
 * 提供时间范围、通道、状态、文件类型等多维度筛选。
 *
 * @module components/organisms/search/SearchFilters
 * @created 2026-07-14 - 双通道整改 P2-3
 */

import { useSearchStore } from '@/store/searchStore'
import type { SearchState } from '@/store/searchStore'

const DATE_PRESETS: ReadonlyArray<{ label: string; value: SearchState['datePreset'] }> = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: 'last7days' },
  { label: '近30天', value: 'last30days' },
]

const CHANNEL_OPTIONS: ReadonlyArray<{ label: string; value: 'auto-collect' | 'file-import' | 'manual-trigger' }> = [
  { label: '自动采集', value: 'auto-collect' },
  { label: '文件导入', value: 'file-import' },
  { label: '手动触发', value: 'manual-trigger' },
]

const STATUS_OPTIONS: ReadonlyArray<{ label: string; value: 'success' | 'partial' | 'failed' }> = [
  { label: '成功', value: 'success' },
  { label: '部分成功', value: 'partial' },
  { label: '失败', value: 'failed' },
]

const FILE_TYPE_OPTIONS = ['csv', 'json', 'xlsx', 'md', 'pdf', 'docx', 'ts', 'txt']

/**
 * 搜索筛选器
 *
 * 多维度筛选面板，支持通道、状态、文件类型的 toggle 选择。
 */
export function SearchFilters(): React.JSX.Element {
  const datePreset = useSearchStore(s => s.datePreset)
  const channels = useSearchStore(s => s.channels)
  const statuses = useSearchStore(s => s.statuses)
  const fileTypes = useSearchStore(s => s.fileTypes)
  const setDatePreset = useSearchStore(s => s.setDatePreset)
  const toggleChannel = useSearchStore(s => s.toggleChannel)
  const toggleStatus = useSearchStore(s => s.toggleStatus)
  const toggleFileType = useSearchStore(s => s.toggleFileType)

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
      {/* 时间范围 */}
      <div className="space-y-2">
        <span className="text-sm font-medium">时间范围</span>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setDatePreset(preset.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                datePreset === preset.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 通道筛选 */}
      <div className="space-y-2">
        <span className="text-sm font-medium">采集通道</span>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleChannel(opt.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                channels.includes(opt.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="space-y-2">
        <span className="text-sm font-medium">执行状态</span>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                statuses.includes(opt.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 文件类型 */}
      <div className="space-y-2">
        <span className="text-sm font-medium">文件类型</span>
        <div className="flex flex-wrap gap-2">
          {FILE_TYPE_OPTIONS.map(ext => (
            <button
              key={ext}
              type="button"
              onClick={() => toggleFileType(ext)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                fileTypes.includes(ext)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              .{ext}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
