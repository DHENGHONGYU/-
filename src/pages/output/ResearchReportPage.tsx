import { memo, useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { FileText, Download, RefreshCw, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectItem } from '@/components/ui/Select'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { useToast } from '@/hooks/useToast'
import { usePageGuard } from '@/hooks/usePageGuard'
import type { ScoreDocVersion } from '@/data/types'

export default memo(function ResearchReportPage(): React.JSX.Element {
  const [symbols, setSymbols] = useState<string[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()
  const { guardProps } = usePageGuard('research-report')
  // 阶段 B-2：从 store 读取所有 scoreDoc versions，并按 selectedSymbol 过滤（持久化在 IDB）
  const versions = useScoreDocStore((s) => s.versions)
  const setSymbol = useScoreDocStore((s) => s.setSymbol)
  const { loadStockSymbols, generateReport: generateReportFromStore, loadVersions } = useScoreDocStore()

  // 当前选中股票的报告列表（按 updatedAt 倒序）
  const reports = useMemo<ScoreDocVersion[]>(
    () => versions.filter((v) => v.symbol === selectedSymbol).slice().sort((a, b) => b.version - a.version),
    [versions, selectedSymbol],
  )

  useEffect(() => {
    const abortController = new AbortController()
    void loadSymbols(abortController.signal)
    return () => abortController.abort()
  }, [loadVersions])

  // 阶段 B-2：selectedSymbol 变化时先写入 store.symbol 再拉取 versions
  useEffect(() => {
    if (selectedSymbol) {
      setSymbol(selectedSymbol)
      void loadVersions()
    }
  }, [selectedSymbol, setSymbol, loadVersions])

  const loadSymbols = async (signal?: AbortSignal): Promise<void> => {
    setLoading(true)
    let error: Error | null = null
    let symbols: string[] = []
    try {
      symbols = await loadStockSymbols()
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
    }

    if (signal?.aborted) {
      return
    }

    if (error) {
      toast({
        variant: 'error',
        title: '加载股票列表失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } else {
      setSymbols(symbols)
    }
    setLoading(false)
  }

  const generateReport = async (): Promise<void> => {
    if (!selectedSymbol) {
      toast({
        variant: 'error',
        title: '请选择股票',
        description: '请先选择一个股票再生成报告',
      })
      return
    }

    setGenerating(true)
    try {
      const report = await generateReportFromStore(selectedSymbol)
      // 阶段 B-2：生成后立即重新拉取当前 selectedSymbol 的 versions，确保 UI 看到最新版本
      void loadVersions()
      toast({
        title: '报告生成成功',
        description: `${selectedSymbol} V${report.version} 研究报告已生成`,
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '生成报告失败',
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = (report: ScoreDocVersion): void => {
    const blob = new Blob([report.reportMd], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.symbol}_V${report.version}_研究报告_${report.scoreDate}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({
      title: '下载成功',
      description: `${report.symbol} 研究报告已下载`,
    })
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>研究报告</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">研究报告</h1>
            <p className="text-muted-foreground">基于评分文档生成个股研究报告</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/output">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              生成报告
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择股票</label>
                <Select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  disabled={loading || generating}
                >
                  <SelectItem value="">请选择股票</SelectItem>
                  {symbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  {...guardProps}
                  onClick={() => void generateReport()}
                  disabled={guardProps.disabled || !selectedSymbol || generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      生成报告
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {reports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>已生成报告</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reports.map((report) => (
                <div key={report.docId} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{report.symbol}</Badge>
                      <Badge variant="outline">V{report.version}</Badge>
                      <span className="text-sm text-muted-foreground">{report.scoreDate}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      {...guardProps}
                      onClick={() => downloadReport(report)}
                      disabled={guardProps.disabled}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      下载
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-auto rounded-md bg-muted/50 p-4">
                    <pre className="text-xs whitespace-pre-wrap">{report.reportMd}</pre>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  )
})
