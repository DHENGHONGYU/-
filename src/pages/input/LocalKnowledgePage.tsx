import { useEffect, useMemo, useState } from 'react'
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
} from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { LocalDocCard } from '@/components/localDoc/LocalDocCard'
import {
  createLocalDoc,
  listLocalDocs,
  searchLocalDocs,
  scanFolder,
} from '@/services/system/localDocService'
import type { LocalDoc } from '@/data/types'

const CATEGORIES: LocalDoc['category'][] = [
  '研报',
  '财报',
  '行业分析',
  '新闻',
  '策略笔记',
  '其他',
]

const SAMPLE_DOCS: Omit<LocalDoc, 'id' | 'addedAt'>[] = [
  {
    symbol: '600519.SH',
    name: '贵州茅台2024年研报',
    content:
      '贵州茅台2024年业绩稳健增长，白酒行业龙头地位稳固。公司持续推进产品结构升级，高端产品占比提升。渠道改革成效显著，直销比例持续扩大。',
    category: '研报',
    tags: ['白酒', '消费', '龙头'],
    sourcePath: '/samples/贵州茅台2024年研报.md',
    size: 2048,
  },
  {
    symbol: '00700.HK',
    name: '腾讯控股财报摘要',
    content:
      '腾讯控股最新季度财报显示，游戏业务恢复增长，广告业务受益于AI技术提升。视频号商业化加速，企业服务板块保持稳定。',
    category: '财报',
    tags: ['互联网', '游戏', '广告'],
    sourcePath: '/samples/腾讯控股财报摘要.md',
    size: 1536,
  },
  {
    symbol: 'ALL',
    name: '新能源行业策略笔记',
    content:
      '新能源行业处于政策与技术双轮驱动阶段。锂电产业链价格逐步企稳，储能需求保持高增。建议关注具备成本优势的龙头企业。',
    category: '策略笔记',
    tags: ['新能源', '储能', '策略'],
    sourcePath: '/samples/新能源行业策略笔记.md',
    size: 1024,
  },
]

export default function LocalKnowledgePage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('browse')
  const [docs, setDocs] = useState<LocalDoc[]>([])
  const [symbolFilter, setSymbolFilter] = useState<string>('全部')
  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<LocalDoc[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadDocs = async () => {
    setLoading(true)
    try {
      const result = await listLocalDocs(symbolFilter === '全部' ? undefined : symbolFilter)
      if (result.success && result.data) {
        setDocs(result.data)
      } else {
        toast({
          variant: 'error',
          title: '加载失败',
          description: result.error ?? '无法加载本地文档',
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '加载失败',
        description: err instanceof Error ? err.message : '无法加载本地文档',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolFilter])

  const symbols = useMemo(() => {
    const set = new Set(docs.map((d) => d.symbol))
    return ['全部', ...Array.from(set).sort()]
  }, [docs])

  const handleImportSamples = async () => {
    setLoading(true)
    let failed = 0
    let lastError: string | undefined
    try {
      for (const doc of SAMPLE_DOCS) {
        const result = await createLocalDoc(doc)
        if (!result.success) {
          failed += 1
          lastError = result.error
        }
      }
      await loadDocs()
      if (failed > 0) {
        toast({
          variant: 'error',
          title: '导入失败',
          description: lastError ?? `${failed} 条示例数据导入失败`,
        })
      } else {
        setMessage('示例数据导入成功')
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '导入失败',
        description: err instanceof Error ? err.message : '无法导入示例数据',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleScanFolder = async () => {
    const result = await scanFolder()
    if (result === null) {
      setMessage('请使用支持 File System Access API 的浏览器导入文件夹，或使用导入示例数据按钮')
    } else if (result.files.length === 0 && result.errors.length === 0) {
      setMessage('未在选择的文件夹中找到支持的文件')
    } else {
      setMessage(`扫描完成，发现 ${result.files.length} 个文件`)
    }
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const result = await searchLocalDocs(keyword)
      if (result.success && result.data) {
        setSearchResults(result.data)
      } else {
        toast({
          variant: 'error',
          title: '搜索失败',
          description: result.error ?? '无法搜索本地文档',
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '搜索失败',
        description: err instanceof Error ? err.message : '无法搜索本地文档',
      })
    } finally {
      setLoading(false)
    }
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
              <Link to="/input/hub">输入舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>本地知识库</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">本地知识库</h1>
          <p className="text-muted-foreground">管理本地文档、研报、财报与策略笔记</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleScanFolder} disabled={loading}>
          <FolderOpen className="mr-2 h-4 w-4" />
          导入文件夹
        </Button>
      </div>

      {message && (
        <div
          className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {message}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            <Button variant="secondary" size="sm" onClick={handleImportSamples} disabled={loading}>
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
            <Button onClick={handleSearch} disabled={loading}>
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
    </div>
  )
}
