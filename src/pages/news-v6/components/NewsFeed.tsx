// ============================================================
// V6 风格资讯流组件 — 迁移至 V9
// 含筛选、搜索、排序、分页功能
// 状态管理已从 useState 迁移至 useNewsStore (Zustand)
// ============================================================

import { useMemo, useCallback, useEffect } from 'react'
import { Loader2, RefreshCw, Search, SlidersHorizontal, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import NewsCard from './NewsCard'
import FilterPanel, { type NewsFilter } from './FilterPanel'
import type { V6NewsArticle } from '../types'
import { matchesFilter, sortArticles } from './newsFeedUtils'
import { useNewsStore } from '@/store/newsStore'
import { useDebounce } from '@/hooks/useDebounce'

export interface NewsFeedProps {
  onLoadMore?: () => void
  onRefresh?: () => void
  onFilterChange?: (filter: NewsFilter) => void
  onArticleClick?: (article: V6NewsArticle) => void
  pageSize?: number
}

export default function NewsFeed({
  onLoadMore,
  onRefresh,
  onFilterChange,
  onArticleClick,
  pageSize = 20,
}: NewsFeedProps) {
  const {
    articles, loading, hasMore,
    bookmarkedIds, filter, searchInput, showFilter, displayCount,
    setFilter, setSearchInput, setShowFilter, setDisplayCount, resetDisplay,
    toggleBookmark,
  } = useNewsStore()

  // 筛选+排序
  const filteredArticles = useMemo(() => {
    const filtered = articles.filter((a: V6NewsArticle) => matchesFilter(a, filter))
    return sortArticles(filtered, filter.sortBy)
  }, [articles, filter])

  // 分页展示
  const displayedArticles = useMemo(() => {
    return filteredArticles.slice(0, displayCount)
  }, [filteredArticles, displayCount])

  // 来源列表（用于筛选面板）
  const sources = useMemo(() => {
    const set = new Set<string>()
    articles.forEach((a: V6NewsArticle) => a.source && set.add(a.source))
    return Array.from(set)
  }, [articles])

  // 搜索输入即时更新 UI，但过滤逻辑防抖 300ms
  const debouncedSearchQuery = useDebounce(searchInput, 300)

  useEffect(() => {
    const trimmed = debouncedSearchQuery.trim()
    if (trimmed !== filter.searchQuery) {
      setFilter({ ...filter, searchQuery: trimmed })
      resetDisplay()
    }
  }, [debouncedSearchQuery, filter, setFilter, resetDisplay])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value.trimStart())
    },
    [setSearchInput],
  )

  // 筛选变更 — 委托 store 管理 filter
  const handleFilterChange = useCallback(
    (newFilter: NewsFilter) => {
      setFilter(newFilter)
      resetDisplay()
      onFilterChange?.(newFilter)
    },
    [onFilterChange, setFilter, resetDisplay],
  )

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (loading) return
    const newCount = displayCount + pageSize
    if (newCount >= filteredArticles.length) {
      onLoadMore?.()
    }
    setDisplayCount(newCount)
  }, [loading, displayCount, pageSize, filteredArticles.length, onLoadMore, setDisplayCount])

  // 刷新
  const handleRefresh = useCallback(() => {
    resetDisplay()
    onRefresh?.()
  }, [resetDisplay, onRefresh])

  // 统计信息
  const stats = {
    total: articles.length,
    filtered: filteredArticles.length,
    positive: articles.filter((a: V6NewsArticle) => (a.sentiment || 0) > 0.3).length,
    negative: articles.filter((a: V6NewsArticle) => (a.sentiment || 0) < -0.3).length,
  }

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-slate-800">智能资讯流</h2>
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
            {stats.filtered}/{stats.total}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* 搜索框 */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索标题、内容、股票代码..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm w-full sm:w-64"
            />
          </div>

          {/* 排序选择 */}
          <select
            value={filter.sortBy}
            onChange={(e) => handleFilterChange({ ...filter, sortBy: e.target.value as NewsFilter['sortBy'] })}
            className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="time">最新发布</option>
            <option value="sentiment">情感强度</option>
            <option value="source">来源</option>
            <option value="relevance">相关度</option>
          </select>

          {/* 筛选按钮 */}
          <Button
            variant="outline"
            size="sm"
            className={`h-9 ${showFilter ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : ''}`}
            onClick={() => setShowFilter(!showFilter)}
          >
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            筛选
          </Button>

          {/* 刷新按钮 */}
          <Button variant="outline" size="sm" className="h-9" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 情感统计条 */}
      {articles.length > 0 && (
        <div className="flex items-center gap-4 text-xs bg-white px-4 py-2 rounded-lg border border-slate-200">
          <span className="text-slate-500">情感分布:</span>
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            看多 {stats.positive}
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            看空 {stats.negative}
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            中性 {stats.total - stats.positive - stats.negative}
          </span>
        </div>
      )}

      {/* 筛选面板 */}
      {showFilter && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <FilterPanel filter={filter} sources={sources} onChange={handleFilterChange} />
        </div>
      )}

      {/* 资讯列表 */}
      <div className="space-y-3">
        {displayedArticles.map((article) => (
          <NewsCard
            key={article.id}
            article={article}
            onClick={onArticleClick}
            onBookmark={toggleBookmark}
            isBookmarked={bookmarkedIds.has(article.id)}
          />
        ))}

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-slate-500">加载中...</span>
          </div>
        )}

        {/* 空状态 */}
        {!loading && displayedArticles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
            <Newspaper className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">暂无资讯</p>
            <p className="text-xs text-slate-400 mt-1">试试调整筛选条件或稍后刷新</p>
          </div>
        )}
      </div>

      {/* 加载更多 */}
      {!loading && displayedArticles.length > 0 && (hasMore || displayedArticles.length < filteredArticles.length) && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading} className="min-w-[200px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            加载更多
          </Button>
        </div>
      )}

      {/* 已加载全部 */}
      {!loading && displayedArticles.length > 0 && !hasMore && displayedArticles.length >= filteredArticles.length && (
        <div className="text-center py-4 text-xs text-slate-400">已加载全部 {filteredArticles.length} 条资讯</div>
      )}
    </div>
  )
}

