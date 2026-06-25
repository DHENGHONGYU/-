import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { NewsCard } from '@/components/news/NewsCard'
import { NewsFilterPanel, type NewsFilterState } from '@/components/news/NewsFilterPanel'
import type { NewsArticle } from '@/data/types'
import { generateMockArticles, listNews, saveNewsArticles } from '@/services/news/newsService'

export default function NewsPage(): React.JSX.Element {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<NewsFilterState>({
    keyword: '',
    category: '',
    sentiment: '',
    source: '',
  })
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  const loadNews = useCallback(async () => {
    setLoading(true)
    const result = await listNews({
      keyword: filter.keyword || undefined,
      category: filter.category || undefined,
      sentiment: filter.sentiment || undefined,
      source: filter.source || undefined,
    })
    if (result.success && result.data) {
      setArticles(result.data)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    void loadNews()
  }, [loadNews])

  const handleGenerateMock = async () => {
    await saveNewsArticles(generateMockArticles(5))
    await loadNews()
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
        <Button onClick={handleGenerateMock} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          生成模拟资讯
        </Button>
        <Button variant="outline" onClick={loadNews} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <NewsFilterPanel filter={filter} onChange={setFilter} />
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
                  onClick={() => setSelectedArticle(article)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={selectedArticle !== null} onOpenChange={(open) => !open && setSelectedArticle(null)}>
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
                        ? 'bg-emerald-500 text-white hover:bg-emerald-500/80'
                        : selectedArticle.sentiment === 'neutral'
                          ? 'bg-slate-500 text-white hover:bg-slate-500/80'
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
