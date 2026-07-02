import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import {
  parseV6Export,
  transformV6ToV9,
  importToV9,
  generateMigrationReport,
  runV6Migration,
  type V6ExportShape,
  type V9ImportShape,
  type MigrationReport,
} from '@/services/system/v6MigrationService'

export default function MigrationPanel(): React.JSX.Element {
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [v6Export, setV6Export] = useState<V6ExportShape | null>(null)
  const [transformed, setTransformed] = useState<V9ImportShape | null>(null)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')

  const handleFile = useCallback((file: File) => {
    setError('')
    setReport(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result
        const text = typeof raw === 'string' ? raw : ''
        const parsed = JSON.parse(text)
        setRawJson(parsed)
        const v6 = parseV6Export(parsed)
        setV6Export(v6)
        const v9 = transformV6ToV9(v6)
        setTransformed(v9)
        setActiveTab('preview')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`解析失败：${message}`)
        setV6Export(null)
        setTransformed(null)
      }
    }
    reader.onerror = () => {
      setError('读取文件失败')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const handleImport = useCallback(async () => {
    if (!transformed) return
    setLoading(true)
    setError('')
    try {
      const result = await importToV9(transformed, { overwriteExisting: overwrite })
      setReport(result)
      setActiveTab('report')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`导入失败：${message}`)
    } finally {
      setLoading(false)
    }
  }, [transformed, overwrite])

  const handleRunMigration = useCallback(async () => {
    if (!rawJson) return
    setLoading(true)
    setError('')
    try {
      const result = await runV6Migration(rawJson, { overwriteExisting: overwrite })
      if (result.success && result.data) {
        setReport(result.data)
        setActiveTab('report')
      } else {
        setError(result.error ?? '迁移失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`迁移失败：${message}`)
    } finally {
      setLoading(false)
    }
  }, [rawJson, overwrite])

  const v6Overview = v6Export
    ? [
        { key: 'stocks', label: '股票', count: v6Export.stocks?.length ?? 0 },
        { key: 'daily_quotes', label: '行情', count: v6Export.daily_quotes?.length ?? 0 },
        { key: 'v6_scores', label: 'V6评分', count: v6Export.v6_scores?.length ?? 0 },
        { key: 'orders', label: '订单', count: v6Export.orders?.length ?? 0 },
        { key: 'sector_scores', label: '板块评分', count: v6Export.sector_scores?.length ?? 0 },
        { key: 'rotation_scores', label: '轮动评分', count: v6Export.rotation_scores?.length ?? 0 },
        { key: 'score_docs', label: '评分文档', count: v6Export.score_docs?.length ?? 0 },
        { key: 'strategy_snapshots', label: '策略快照', count: v6Export.strategy_snapshots?.length ?? 0 },
        { key: 'local_docs', label: '本地文档', count: v6Export.local_docs?.length ?? 0 },
        { key: 'news', label: '资讯', count: v6Export.news?.length ?? 0 },
        { key: 'news_stock_map', label: '资讯关联', count: v6Export.news_stock_map?.length ?? 0 },
        { key: 'sentiment_cache', label: '情感缓存', count: v6Export.sentiment_cache?.length ?? 0 },
      ]
    : []

  const v9Overview = transformed
    ? [
        { key: 'stocks', label: '股票', count: transformed.stocks.length },
        { key: 'daily_quotes', label: '聚合行情', count: transformed.dailyQuotes.length },
        { key: 'v6_scores', label: 'V6评分', count: transformed.v6Scores.length },
        { key: 'score_docs', label: '评分文档', count: transformed.scoreDocs.length + transformed.scoreDocsFromScores.length },
        { key: 'orders', label: '订单', count: transformed.orders.length },
        { key: 'sector_scores', label: '板块评分', count: transformed.sectorScores.length },
        { key: 'rotation_scores', label: '轮动评分', count: transformed.rotationScores.length },
        { key: 'strategy_snapshots', label: '策略快照', count: transformed.strategySnapshots.length },
        { key: 'local_docs', label: '本地文档', count: transformed.localDocs.length },
        { key: 'news', label: '资讯', count: transformed.news.length },
        { key: 'news_stock_map', label: '资讯关联', count: transformed.newsStockMaps.length },
        { key: 'sentiment_cache', label: '情感缓存', count: transformed.sentimentCache.length },
      ]
    : []

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>V6 Pro → V9 数据迁移</CardTitle>
        <CardDescription>
          上传 V6 Pro 的 JSON 全量导出文件，预览并导入到 V9。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upload">上传</TabsTrigger>
            <TabsTrigger value="preview" disabled={!transformed}>预览</TabsTrigger>
            <TabsTrigger value="report" disabled={!report}>报告</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50"
            >
              <p className="text-sm text-muted-foreground">拖拽 JSON 文件到此处，或点击选择</p>
              <input
                type="file"
                accept="application/json"
                aria-label="上传 V6 导出 JSON"
                onChange={handleInputChange}
                className="mt-4 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {transformed && (
              <>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="h-4 w-4"
                    />
                    覆盖已存在数据
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-medium">V6 源数据概览</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {v6Overview.map((item) => (
                        <div key={item.key} className="rounded-md border p-2 text-center">
                          <p className="text-lg font-bold">{item.count}</p>
                          <Badge variant="outline">{item.label}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-medium">V9 转换后概览</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {v9Overview.map((item) => (
                        <div key={item.key} className="rounded-md border p-2 text-center">
                          <p className="text-lg font-bold">{item.count}</p>
                          <Badge variant="outline">{item.label}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleImport} disabled={loading}>
                    {loading ? '导入中...' : '执行导入'}
                  </Button>
                  <Button variant="outline" onClick={handleRunMigration} disabled={loading}>
                    一键迁移（解析+导入）
                  </Button>
                </div>
              </>
            )}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            {report && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-bold">{report.summary.totalStores}</p>
                    <Badge variant="outline">存储区</Badge>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-bold">{report.summary.importedRecords}</p>
                    <Badge variant="outline">成功</Badge>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-bold">{report.summary.skippedRecords}</p>
                    <Badge variant="outline">跳过</Badge>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-lg font-bold">{report.summary.failedRecords}</p>
                    <Badge variant="outline">失败</Badge>
                  </div>
                </div>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
                  {generateMigrationReport(report)}
                </pre>
                <Button variant="outline" onClick={() => { setRawJson(null); setV6Export(null); setTransformed(null); setReport(null); setActiveTab('upload') }}>
                  重新上传
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
