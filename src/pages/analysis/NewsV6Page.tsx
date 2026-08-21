import { useEffect } from 'react'
import { Link } from 'react-router'
import { RefreshCw, Sparkles, Newspaper, Layers } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/molecules/Dialog'
import { NewsFilterPanel, type NewsFilterState } from '@/components/organisms/news/NewsFilterPanel'
import { NewsSentimentTrend } from '@/components/organisms/analysis/news/NewsSentimentTrend'
import { useAnalysisNewsStore } from '@/store/analysisNewsStore'
import { EmptyState } from '@/components/molecules'
import type { NewsArticle } from '@/types'
import { newsColors, type NewsCategory } from '@/constants/newsColorTokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * NewsV6Page — 智能资讯 V6（蓝图第 19 项）
 *
 * 复用 /analysis/news 的同一数据层（analysisNewsStore），但在渲染层采用
 * news-v6 语义化颜色令牌（newsColors）：分类标签用 V6 配色、情感色左边框。
 * 与 /analysis/news 保持数据一致，仅视觉风格升级为 V6。
 */
export default function NewsV6Page(): React.JSX.Element {
  const articles = useAnalysisNewsStore((s) => s.articles)
  const loading = useAnalysisNewsStore((s) => s.loading)
  const filter = useAnalysisNewsStore((s) => s.filter)
  const selectedArticle = useAnalysisNewsStore((s) => s.selectedArticle)

  const setFilter = useAnalysisNewsStore((s) => s.setFilter)
  const selectArticle = useAnalysisNewsStore((s) => s.selectArticle)
  const fetchArticles = useAnalysisNewsStore((s) => s.fetchArticles)
  const generateMockArticles = useAnalysisNewsStore((s) => s.generateMockArticles)

  useEffect(() => {
    logger.info('[NewsV6Page] 初始化或 filter 变化，加载资讯', {
      keyword: filter.keyword,
      category: filter.category,
      sentiment: filter.sentiment,
      source: filter.source,
    })
    void fetchArticles()
  }, [filter, fetchArticles])

  const handleGenerateMock = async (): Promise<void> => {
    logger.info('[NewsV6Page] 生成模拟资讯')
    await generateMockArticles()
  }

  const handleFilterChange = (newFilter: NewsFilterState): void => {
    setFilter(newFilter)
  }

  const categoryClass = (category: string): string =>
    newsColors.category[category as NewsCategory] ?? newsColors.category.default

  const sentimentBorder = (sentiment: NewsArticle['sentiment']): string => {
    if (sentiment === 'positive') return `border-l-4 ${newsColors.positive.borderSoft}`
    if (sentiment === 'negative') return `border-l-4 ${newsColors.negative.borderSoft}`
    return `border-l-4 ${newsColors.neutral.borderSoft}`
  }

  const sentimentLabel = (sentiment: NewsArticle['sentiment']): string =>
    sentiment === 'positive' ? '正面' : sentiment === 'negative' ? '负面' : '中性'

  const sentimentText = (sentiment: NewsArticle['sentiment']): string => {
    if (sentiment === 'positive') return newsColors.positive.textSoft
    if (sentiment === 'negative') return newsColors.negative.text
    return newsColors.neutral.text
  }

  return (
    <PageContainer className="space-y-6">
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
            <BreadcrumbPage>智能资讯 V6</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="智能资讯 V6"
        description="资讯抓取、情感分析与关联个股（V6 视觉风格）"
        actions={
          <Badge variant="secondary" className={newsColors.accent.blue}>
            <Layers className="mr-1 h-3 w-3" />
            News V6
          </Badge>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleGenerateMock()} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          生成模拟资讯
        </Button>
        <Button variant="outline" onClick={() => void fetchArticles()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/analysis/news">切换到经典版 →</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <NewsFilterPanel filter={filter} onChange={handleFilterChange} />
        </aside>

        <main>
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center shadow-sm">
              <EmptyState
                icon={<Newspaper className="h-12 w-12 text-muted-foreground/40" />}
                title="暂无资讯"
                description="当前没有符合条件的资讯，点击下方按钮生成模拟资讯"
                action={{
                  label: '生成模拟资讯',
                  onClick: () => void handleGenerateMock(),
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectArticle(article)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectArticle(article)
                    }
                  }}
                  className={`cursor-pointer rounded-lg bg-card p-4 shadow-sm transition-shadow hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${sentimentBorder(article.sentiment)}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={categoryClass(article.category)}>{article.category}</Badge>
                    <span className={`text-xs font-medium ${sentimentText(article.sentiment)}`}>
                      {sentimentLabel(article.sentiment)}
                    </span>
                    {article.sentimentConfidence > 0 && (
                      <span className="text-xs text-muted-foreground">
                        置信度 {(article.sentimentConfidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-medium leading-snug hover:text-primary">{article.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {article.content.length > 120 ? `${article.content.slice(0, 120)}...` : article.content}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {article.relatedStocks.map((symbol) => (
                      <Badge key={symbol} variant="secondary" className="text-xs">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{article.source}</span>
                    <span>{new Date(article.publishTime).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {articles.length > 0 && <NewsSentimentTrend />}

      <Dialog open={selectedArticle !== null} onOpenChange={(open) => !open && selectArticle(null)}>
        <DialogContent>
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={categoryClass(selectedArticle.category)}>{selectedArticle.category}</Badge>
                  <Badge
                    variant={
                      selectedArticle.sentiment === 'negative'
                        ? 'destructive'
                        : selectedArticle.sentiment === 'positive'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {sentimentLabel(selectedArticle.sentiment)}
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
    </PageContainer>
  )
}
