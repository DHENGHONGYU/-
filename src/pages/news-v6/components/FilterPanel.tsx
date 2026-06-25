// ============================================================
// V6 风格筛选面板 — 迁移至 V9
// ============================================================

import { Button } from '@/components/ui/Button'
import { X, Filter } from 'lucide-react'

export interface NewsFilter {
  category: string
  sentiment: string
  source: string
  stockCode: string
  dateRange: string
  searchQuery: string
  sortBy: 'time' | 'sentiment' | 'source' | 'relevance'
}

export interface FilterPanelProps {
  filter: NewsFilter
  sources: string[]
  onChange: (filter: NewsFilter) => void
}

const CATEGORIES = [
  { value: 'all', label: '全部分类' },
  { value: '个股', label: '个股' },
  { value: '行业', label: '行业' },
  { value: '宏观', label: '宏观' },
  { value: '政策', label: '政策' },
  { value: '公告', label: '公告' },
]

const SENTIMENTS = [
  { value: 'all', label: '全部情感' },
  { value: 'positive', label: '看多' },
  { value: 'negative', label: '看空' },
  { value: 'neutral', label: '中性' },
]

const DATE_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近7天' },
  { value: 'month', label: '最近30天' },
]

export default function FilterPanel({ filter, sources, onChange }: FilterPanelProps) {
  const activeFiltersCount = [
    filter.category !== 'all',
    filter.sentiment !== 'all',
    filter.source !== 'all',
    filter.stockCode !== '',
    filter.dateRange !== 'all',
  ].filter(Boolean).length

  const clearAll = () => {
    onChange({
      category: 'all',
      sentiment: 'all',
      source: 'all',
      stockCode: '',
      dateRange: 'all',
      searchQuery: '',
      sortBy: 'time',
    })
  }

  const FilterButton = ({
    options,
    value,
    onSelect,
  }: {
    options: { value: string; label: string }[]
    value: string
    onSelect: (v: string) => void
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
            value === opt.value
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">筛选条件</h3>
          {activeFiltersCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400" onClick={clearAll}>
            <X className="w-3 h-3 mr-1" />
            清空
          </Button>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">分类</label>
        <FilterButton
          options={CATEGORIES}
          value={filter.category}
          onSelect={(v) => onChange({ ...filter, category: v })}
        />
      </div>

      {/* 情感筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">情感倾向</label>
        <FilterButton
          options={SENTIMENTS}
          value={filter.sentiment}
          onSelect={(v) => onChange({ ...filter, sentiment: v })}
        />
      </div>

      {/* 来源筛选 */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">来源</label>
          <FilterButton
            options={[{ value: 'all', label: '全部来源' }, ...sources.map((s) => ({ value: s, label: s }))]}
            value={filter.source}
            onSelect={(v) => onChange({ ...filter, source: v })}
          />
        </div>
      )}

      {/* 个股代码筛选 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">关联个股</label>
        <input
          type="text"
          value={filter.stockCode}
          onChange={(e) => onChange({ ...filter, stockCode: e.target.value })}
          placeholder="输入股票代码"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      {/* 时间范围 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">时间范围</label>
        <FilterButton
          options={DATE_RANGES}
          value={filter.dateRange}
          onSelect={(v) => onChange({ ...filter, dateRange: v })}
        />
      </div>
    </div>
  )
}

export { CATEGORIES, SENTIMENTS, DATE_RANGES }
