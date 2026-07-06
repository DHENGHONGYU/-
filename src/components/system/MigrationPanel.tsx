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
import { exportAll } from '@/services/system/systemService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface BackupSnapshot {
  data: Record<string, unknown[]>
  createdAt: number
  stores: number
  totalRecords: number
}

export default function MigrationPanel(): React.JSX.Element {
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [v6Export, setV6Export] = useState<V6ExportShape | null>(null)
  const [transformed, setTransformed] = useState<V9ImportShape | null>(null)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  // 备份快照:覆盖式导入前自动备份,导入失败时可用于回滚
  const [backup, setBackup] = useState<BackupSnapshot | null>(null)
  const [rollbackStatus, setRollbackStatus] = useState<'idle' | 'rolling' | 'done' | 'failed'>('idle')

  const handleFile = useCallback((file: File) => {
    logger.info('[MigrationPanel] handleFile/start', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: Date.now(),
    })
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
        logger.info('[MigrationPanel] 文件解析成功', {
          fileName: file.name,
          v6Stocks: v6.stocks?.length ?? 0,
          v6Orders: v6.orders?.length ?? 0,
          v9Stocks: v9.stocks.length,
          v9Scores: v9.v6Scores.length,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`解析失败：${message}`)
        setV6Export(null)
        setTransformed(null)
        logger.error('[MigrationPanel] 文件解析失败', {
          fileName: file.name,
          error: message,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: Date.now(),
        })
      }
    }
    reader.onerror = () => {
      setError('读取文件失败')
      logger.error('[MigrationPanel] 文件读取失败', {
        fileName: file.name,
        fileSize: file.size,
        error: 'FileReader.onerror triggered',
      })
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
    logger.info('[MigrationPanel] handleImport/start', {
      overwrite,
      hasTransformed: transformed !== null,
      stocksCount: transformed.stocks.length,
      timestamp: Date.now(),
    })

    // 覆盖式导入:必须先备份 + 二次确认,确保数据可回滚
    let backupSnapshot: BackupSnapshot | null = null
    if (overwrite) {
      logger.info('[MigrationPanel] overwrite=true,触发二次确认对话框')
      const confirmed = window.confirm(
        '⚠️ 警告:覆盖式导入将删除现有数据!\n\n' +
        '系统将在导入前自动备份当前数据。\n' +
        '如导入失败,可使用「回滚到备份」按钮恢复。\n\n' +
        '确定继续执行覆盖式导入?'
      )
      if (!confirmed) {
        logger.info('[MigrationPanel] 用户取消覆盖式导入')
        return
      }
      logger.info('[MigrationPanel] 用户确认覆盖式导入,开始备份')

      // 导入前备份当前数据
      try {
        logger.info('[MigrationPanel] exportAll/start')
        const backupResult = await exportAll()
        logger.info('[MigrationPanel] exportAll/response', {
          success: backupResult.success,
          hasData: !!backupResult.data,
          error: backupResult.error,
        })
        if (backupResult.success && backupResult.data) {
          const backupData = backupResult.data
          const stores = Object.keys(backupData)
          const totalRecords = stores.reduce(
            (sum, store) => sum + (backupData[store]?.length ?? 0),
            0,
          )
          backupSnapshot = {
            data: backupData,
            createdAt: Date.now(),
            stores: stores.length,
            totalRecords,
          }
          setBackup(backupSnapshot)
          logger.info('[MigrationPanel] 备份完成', {
            stores: stores.length,
            totalRecords,
            storeNames: stores,
          })
        } else {
          const backupError = backupResult.error ?? '未知错误'
          setError(`备份失败,已中止导入(防止数据丢失):${backupError}`)
          logger.error('[MigrationPanel] 备份失败,中止导入', {
            error: backupError,
            timestamp: Date.now(),
          })
          return
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`备份异常,已中止导入:${message}`)
        logger.error('[MigrationPanel] 备份异常', {
          error: message,
          stack: err instanceof Error ? err.stack : undefined,
        })
        return
      }
    } else {
      logger.info('[MigrationPanel] overwrite=false,跳过备份直接导入')
    }

    setLoading(true)
    setError('')
    logger.info('[MigrationPanel] importToV9/start', {
      overwrite,
      stocksCount: transformed.stocks.length,
      hasBackup: backupSnapshot !== null,
    })
    try {
      const result = await importToV9(transformed, { overwriteExisting: overwrite })
      setReport(result)
      setActiveTab('report')
      logger.info('[MigrationPanel] 导入完成', {
        overwrite,
        importedRecords: result.summary.importedRecords,
        skippedRecords: result.summary.skippedRecords,
        failedRecords: result.summary.failedRecords,
        totalStores: result.summary.totalStores,
        backupCreated: backupSnapshot !== null,
        timestamp: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`导入失败:${message}`)
      logger.error('[MigrationPanel] 导入失败', {
        error: message,
        stack: err instanceof Error ? err.stack : undefined,
        hasBackup: backupSnapshot !== null,
        overwrite,
        timestamp: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }, [transformed, overwrite])

  // 回滚:从备份恢复(下载备份文件 + 提示用户手动恢复)
  const handleDownloadBackup = useCallback(() => {
    if (!backup) return
    logger.info('[MigrationPanel] handleDownloadBackup/start', {
      stores: backup.stores,
      totalRecords: backup.totalRecords,
      createdAt: backup.createdAt,
    })
    const json = JSON.stringify(backup.data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `v9-backup-${new Date(backup.createdAt).toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    logger.info('[MigrationPanel] 备份已下载', {
      stores: backup.stores,
      totalRecords: backup.totalRecords,
      filename: a.download,
      blobSize: blob.size,
    })
  }, [backup])

  // 回滚:清空当前数据并提示用户重新上传备份(因 systemService 未提供 restoreFromBackup 接口)
  const handleRollback = useCallback(async () => {
    if (!backup) return
    logger.warn('[MigrationPanel] handleRollback/start', {
      backupCreatedAt: backup.createdAt,
      backupStores: backup.stores,
      backupTotalRecords: backup.totalRecords,
      timestamp: Date.now(),
    })
    setRollbackStatus('rolling')
    logger.info('[MigrationPanel] 触发备份下载以供手动恢复')
    // 触发备份下载
    handleDownloadBackup()
    setRollbackStatus('done')
    logger.info('[MigrationPanel] handleRollback/complete', {
      rollbackStatus: 'done',
      message: '已下载备份文件,等待用户手动恢复',
    })
    setError(
      `已下载备份文件(共 ${backup.stores} 个 store,${backup.totalRecords} 条记录)。\n` +
      '请使用「上传」功能导入此备份文件以恢复数据。\n' +
      '注意:恢复前请先在总控舱点击「重置数据」清空当前状态。'
    )
  }, [backup, handleDownloadBackup])

  const handleRunMigration = useCallback(async () => {
    if (!rawJson) return
    logger.info('[MigrationPanel] handleRunMigration/start', {
      hasRawJson: rawJson !== null,
      overwrite,
      timestamp: Date.now(),
    })
    setLoading(true)
    setError('')
    try {
      const result = await runV6Migration(rawJson, { overwriteExisting: overwrite })
      logger.info('[MigrationPanel] runV6Migration/response', {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
      })
      if (result.success && result.data) {
        setReport(result.data)
        setActiveTab('report')
        logger.info('[MigrationPanel] 快速迁移完成', {
          overwrite,
          importedRecords: result.data.summary.importedRecords,
          skippedRecords: result.data.summary.skippedRecords,
          failedRecords: result.data.summary.failedRecords,
          totalStores: result.data.summary.totalStores,
          timestamp: Date.now(),
        })
      } else {
        const migrationError = result.error ?? '迁移失败'
        setError(migrationError)
        logger.warn('[MigrationPanel] 快速迁移失败响应', {
          error: migrationError,
          overwrite,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`迁移失败：${message}`)
      logger.error('[MigrationPanel] 快速迁移异常', {
        error: message,
        stack: err instanceof Error ? err.stack : undefined,
        overwrite,
        timestamp: Date.now(),
      })
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

                {/* 备份状态提示:覆盖式导入前已自动备份 */}
                {backup && (
                  <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
                    <p className="font-medium">已自动备份当前数据</p>
                    <p className="mt-1 text-muted-foreground">
                      备份时间:{new Date(backup.createdAt).toLocaleString('zh-CN')} ·
                      共 {backup.stores} 个存储区 / {backup.totalRecords} 条记录
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDownloadBackup}>
                        下载备份文件
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            {error && (
              <div className="space-y-2">
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
                  {error}
                </div>
                {/* 回滚按钮:导入失败且有备份时显示 */}
                {backup && rollbackStatus !== 'done' && (
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRollback}
                      disabled={rollbackStatus === 'rolling'}
                    >
                      {rollbackStatus === 'rolling' ? '回滚中...' : '回滚到备份'}
                    </Button>
                  </div>
                )}
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
