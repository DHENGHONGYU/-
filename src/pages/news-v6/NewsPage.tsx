// ============================================================
// V6 风格 NewsPage — 迁移至 V9
// 保持 V6 UI 风格，接入 V9 DataBridge / newsService
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getLogger } from '@/lib/logger'
import { listNews, saveNewsArticles, generateMockArticles } from '@/services/news/newsService'
import type { NewsArticle as V9NewsArticle } from '@/data/types'
import NewsFeed from './components/NewsFeed'
import type { NewsFilter } from './components/FilterPanel'
import type { V6NewsArticle } from './types'
import { adaptV9ListToV6 } from './types'

const logger = getLogger()

/** 生成模拟数据并保存到 V9 DataLayer */
async function seedMockData(): Promise<V9NewsArticle[]> {
  const articles = generateMockArticles(15)
  const result = await saveNewsArticles(articles)
  if (result.success && result.data) {
    logger.info('[NewsPage] Mock data seeded', { count: result.data.length })
    return result.data
  }
  logger.warn('[NewsPage] Failed to seed mock data', { error: result.error })
  return []
}

export default function NewsPage(): React.JSX.Element {
  const [articles, setArticles] = useState<V6NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selectedArticle, setSelectedArticle] = useState<V6NewsArticle | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** 加载数据（接入 V9 newsService） */
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      logger.info('[NewsPage] Loading news via V9 newsService')
      const result = await listNews({ limit: 100 })

      if (result.success && result.data) {
        // V9 → V6 适配转换
        const adapted = adaptV9ListToV6(result.data)
        setArticles(adapted)
        setHasMore(result.data.length >= 100)
        logger.info('[NewsPage] News loaded', { count: adapted.length })
      } else {
        setError(result.error || '加载失败')
        logger.error('[NewsPage] Failed to load news', { error: result.error })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('[NewsPage] Exception loading news', { error: message })
    } finally {
      setLoading(false)
    }
  }, [])

  /** 初始加载 */
  useEffect(() => {
    void loadData()
  }, [loadData])

  /** 加载更多 */
  const loadMore = useCallback(() => {
    // V9 newsService 已做 limit/sort，本地分页逻辑由 NewsFeed 处理
    // 若需真实分页，可扩展 listNews 参数
    setHasMore(false)
  }, [])

  /** 刷新 */
  const handleRefresh = useCallback(() => {
    void loadData()
  }, [loadData])

  /** 生成模拟数据 */
  const handleGenerateMock = async () => {
    setLoading(true)
    await seedMockData()
    await loadData()
    setLoading(false)
  }

  /** 筛选变更 */
  const handleFilterChange = useCallback((filter: NewsFilter) => {
    logger.info('[NewsPage] Filter changed', { filter })
  }, [])

  /** 点击文章 */
  const handleArticleClick = useCallback((article: V6NewsArticle) => {
    setSelectedArticle(article)
  }, [])

  /** 收藏 */
  const handleBookmark = useCallback((id: string) => {
    logger.info('[NewsPage] Bookmark toggled', { id })
  }, [])

  return (
    <div className="space-y-4 p-4 max-w-6xl mx-auto">
      {/* 页面标题 — V6 风格 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">智能资讯中心</h1>
          <p className="text-sm text-slate-500 mt-1">AI驱动的金融资讯筛选与分析系统</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerateMock} disabled={loading}>
            <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
            生成模拟数据
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <p className="font-medium">加载失败</p>
          <p className="text-red-600/80">{error}</p>
          <Button variant="ghost" size="sm" className="mt-2 h-8 text-red-600" onClick={handleRefresh}>
            重试
          </Button>
        </div>
      )}

      {/* 资讯流 — V6 风格组件 */}
      <NewsFeed
        articles={articles}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRefresh={handleRefresh}
        onFilterChange={handleFilterChange}
        onArticleClick={handleArticleClick}
        onBookmark={handleBookmark}
        pageSize={20}
      />

      {/* 文章详情弹窗 — V6 风格 */}
      {selectedArticle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full mt-8 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {selectedArticle.category || '宏观'}
                  </span>
                  {selectedArticle.sentiment > 0.3 && (
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                      看多 ({Math.round((selectedArticle.sentimentConfidence || 0) * 100)}%)
                    </span>
                  )}
                  {selectedArticle.sentiment < -0.3 && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                      看空 ({Math.round((selectedArticle.sentimentConfidence || 0) * 100)}%)
                    </span>
                  )}
                  {selectedArticle.sentiment >= -0.3 && selectedArticle.sentiment <= 0.3 && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      中性
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-800">{selectedArticle.title}</h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {selectedArticle.content}
              </p>

              {/* 关联个股 */}
              {selectedArticle.relatedStocks && selectedArticle.relatedStocks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2">关联个股</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.relatedStocks.map((code) => (
                      <span
                        key={code}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 rounded-lg"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 关键词 */}
              {selectedArticle.keywords && selectedArticle.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2">关键词</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs px-2 py-1 bg-slate-50 text-slate-600 rounded-full border border-slate-100"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 元信息 */}
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-1">
                <p>来源: {selectedArticle.source}</p>
                <p>发布时间: {new Date(selectedArticle.publishTime).toLocaleString('zh-CN')}</p>
                <p>抓取时间: {new Date(selectedArticle.fetchTime).toLocaleString('zh-CN')}</p>
                {selectedArticle.url && (
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline inline-flex items-center gap-1 mt-2"
                  >
                    查看原文 →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
