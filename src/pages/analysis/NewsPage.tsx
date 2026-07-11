import { useEffect } from 'react'
import { Link } from 'react-router'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/Dialog'
import { NewsCard } from '@/components/organisms/news/NewsCard'
import { NewsFilterPanel, type NewsFilterState } from '@/components/organisms/news/NewsFilterPanel'
import { NewsSentimentTrend } from '@/components/organisms/analysis/news/NewsSentimentTrend'
import { useAnalysisNewsStore } from '@/store/analysisNewsStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * NewsPage
 */
export default function NewsPage(): React.JSX.Element {
  // 从 Store 获取状态
  const articles = useAnalysisNewsStore((s) => s.articles)
  const loading = useAnalysisNewsStore((s) => s.loading)
  const filter = useAnalysisNewsStore((s) => s.filter)
  const selectedArticle = useAnalysisNewsStore((s) => s.selectedArticle)

  // 从 Store 获取 actions
  const setFilter = useAnalysisNewsStore((s) => s.setFilter)
  const selectArticle = useAnalysisNewsStore((s) => s.selectArticle)
  const fetchArticles = useAnalysisNewsStore((s) => s.fetchArticles)
  const generateMockArticles = useAnalysisNewsStore((s) => s.generateMockArticles)

  // 初始化加载 & filter 变化时重新加载
  useEffect(() => {
    logger.info('[NewsPage] 初始化或 filter 变化，加载资讯', {
      keyword: filter.keyword,
      category: filter.category,
      sentiment: filter.sentiment,
      source: filter.source,
    })
    void fetchArticles()
  }, [filter, fetchArticles])

  const handleGenerateMock = async (): Promise<void> => {
    logger.info('[NewsPage] 生成模拟资讯')
    await generateMockArticles()
  }

  const handleFilterChange = (newFilter: NewsFilterState): void => {
    logger.info('[NewsPage] filter 变化', { newFilter })
    setFilter(newFilter)
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/analysis/hub">分析舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>智能资讯</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">智能资讯</h1>
          <p className="text-muted-foreground">资讯抓取、情感分析与关联个股</p>
        </div>
        <Badge variant="secondary">News Feed</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleGenerateMock()} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          生成模拟资讯
        </Button>
        <Button variant="outline" onClick={() => void fetchArticles()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <NewsFilterPanel filter={filter} onChange={handleFilterChange} />
        </aside>

        <main>
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center shadow-sm">
              <p className="text-muted-foreground">暂无资讯，点击生成模拟资讯</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  onClick={() => selectArticle(article)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 资讯情感趋势图 */}
      {articles.length > 0 && <NewsSentimentTrend />}

      <Dialog open={selectedArticle !== null} onOpenChange={(open) => !open && selectArticle(null)}>
        <DialogContent>
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedArticle.category}</Badge>
                  <Badge
                    variant={
                      selectedArticle.sentiment === 'negative'
                        ? 'destructive'
                        : selectedArticle.sentiment === 'positive'
                          ? 'default'
                          : 'secondary'
                    }
                    className={
                      selectedArticle.sentiment === 'positive'
                        ? 'bg-success text-success-foreground hover:bg-success/80'
                        : selectedArticle.sentiment === 'neutral'
                          ? 'bg-muted text-foreground hover:bg-muted/80'
                          : ''
                    }
                  >
                    {selectedArticle.sentiment === 'positive'
                      ? '正面'
                      : selectedArticle.sentiment === 'negative'
                        ? '负面'
                        : '中性'}
                  </Badge>
                </div>
                <DialogTitle>{selectedArticle.title}</DialogTitle>
                <DialogDescription>
                  {selectedArticle.source} · {new Date(selectedArticle.publishTime).toLocaleString('zh-CN')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">{selectedArticle.content}</p>
                {selectedArticle.relatedStocks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.relatedStocks.map((symbol) => (
                      <Badge key={symbol} variant="secondary">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
