import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { FolderOpen, Search, BarChart3, Plus } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/molecules/Tabs'
import { LocalDocCard } from '@/components/organisms/localDoc/LocalDocCard'
import { useLocalKnowledgeStore, type LocalKnowledgeTab } from '@/store/localKnowledgeStore'
import type { LocalDoc } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { PageContainer, PageHeader } from '@/components/templates'

const logger = getLogger()

const CATEGORIES: LocalDoc['category'][] = [
  '研报',
  '财报',
  '行业分析',
  '新闻',
  '策略笔记',
  '其他',
]

/**
 * LocalKnowledgePage
 */
export default function LocalKnowledgePage(): React.JSX.Element {
  const { toast } = useToast()

  // 从 Store 获取状态
  const activeTab = useLocalKnowledgeStore((s) => s.activeTab)
  const docs = useLocalKnowledgeStore((s) => s.docs)
  const symbolFilter = useLocalKnowledgeStore((s) => s.symbolFilter)
  const keyword = useLocalKnowledgeStore((s) => s.keyword)
  const searchResults = useLocalKnowledgeStore((s) => s.searchResults)
  const message = useLocalKnowledgeStore((s) => s.message)
  const loading = useLocalKnowledgeStore((s) => s.loading)
  const error = useLocalKnowledgeStore((s) => s.error)

  // 从 Store 获取 actions
  const setActiveTab = useLocalKnowledgeStore((s) => s.setActiveTab)
  const loadDocs = useLocalKnowledgeStore((s) => s.loadDocs)
  const searchDocs = useLocalKnowledgeStore((s) => s.searchDocs)
  const scanFolder = useLocalKnowledgeStore((s) => s.scanFolder)
  const importSampleDocs = useLocalKnowledgeStore((s) => s.importSampleDocs)
  const setSymbolFilter = useLocalKnowledgeStore((s) => s.setSymbolFilter)
  const setKeyword = useLocalKnowledgeStore((s) => s.setKeyword)

  // 监听 symbolFilter 变化，自动加载文档
  useEffect(() => {
    logger.info('[LocalKnowledgePage] symbolFilter 变化，加载文档', { symbolFilter })
    void loadDocs()
  }, [symbolFilter, loadDocs])

  // 监听 error 变化，显示 toast
  useEffect(() => {
    if (error) {
      toast({
        variant: 'error',
        title: '操作失败',
        description: error,
      })
    }
  }, [error, toast])

  const symbols = useMemo(() => {
    const set = new Set(docs.map((d) => d.symbol))
    return ['全部', ...Array.from(set).sort()]
  }, [docs])

  const handleImportSamples = async () => {
    logger.info('[LocalKnowledgePage] 导入示例文档')
    await importSampleDocs()
  }

  const handleScanFolder = async () => {
    logger.info('[LocalKnowledgePage] 扫描文件夹')
    await scanFolder()
  }

  const handleSearch = async () => {
    logger.info('[LocalKnowledgePage] 搜索文档', { keyword })
    await searchDocs(keyword)
  }

  const stats = useMemo(() => {
    const totalDocs = docs.length
    const uniqueStocks = new Set(docs.map((d) => d.symbol)).size
    const counts = CATEGORIES.map((category) => ({
      category,
      count: docs.filter((d) => d.category === category).length,
    }))
    return { totalDocs, uniqueStocks, counts }
  }, [docs])

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
              <Link to="/input/hub">输入舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>本地知识库</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="本地知识库"
        description="管理本地文档、研报、财报与策略笔记"
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleScanFolder()} disabled={loading}>
            <FolderOpen className="mr-2 h-4 w-4" />
            导入文件夹
          </Button>
        }
      />

      {message && (
        <div
          className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {message}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LocalKnowledgeTab)}>
        <TabsList>
          <TabsTrigger value="browse">浏览</TabsTrigger>
          <TabsTrigger value="search">搜索</TabsTrigger>
          <TabsTrigger value="stats">统计</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="symbol-filter" className="text-sm font-medium">
                股票筛选
              </label>
              <select
                id="symbol-filter"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void handleImportSamples()} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              导入示例数据
            </Button>
          </div>

          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无文档，点击“导入示例数据”进行测试。</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <LocalDocCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="输入关键词搜索文档、股票代码或标签"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSearch()
                }
              }}
            />
            <Button onClick={() => void handleSearch()} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>

          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {keyword ? '未找到匹配的文档' : '输入关键词后点击搜索'}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((doc) => (
                <LocalDocCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  文档总数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDocs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  涉及股票数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.uniqueStocks}</div>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  分类分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {stats.counts.map(({ category, count }) => (
                    <Badge key={category} variant={count > 0 ? 'default' : 'outline'}>
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
