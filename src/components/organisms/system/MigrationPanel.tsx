import React, { useCallback, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { getLogger } from '@/lib/logger'
import { useMcpMigration } from './migration/useMcpMigration'
import { MigrationUploadTab } from './migration/MigrationUploadTab'
import { MigrationPreviewTab } from './migration/MigrationPreviewTab'
import { MigrationReportTab } from './migration/MigrationReportTab'
import type { MigrationReport, V6ExportShape, V9ImportShape } from '@/services/system/v6MigrationService'

const logger = getLogger()

export interface BackupSnapshot {
  data: Record<string, unknown[]>
  createdAt: number
  stores: number
  totalRecords: number
}

/**
 * MigrationPanel
 */
export default function MigrationPanel(): React.JSX.Element {
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [v6Export, setV6Export] = useState<V6ExportShape | null>(null)
  const [transformed, setTransformed] = useState<V9ImportShape | null>(null)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [backup, setBackup] = useState<BackupSnapshot | null>(null)
  const [rollbackStatus, setRollbackStatus] = useState<'idle' | 'rolling' | 'done' | 'failed'>('idle')

  const {
    parseV6Export,
    transformV6ToV9,
    importToV9,
    runV6Migration,
    generateMigrationReport,
    exportAll,
  } = useMcpMigration()

  const handleFile = useCallback(async (file: File) => {
    logger.info('[MigrationPanel] handleFile/start', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: Date.now(),
    })
    setError('')
    setReport(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const raw = e.target?.result
        const text = typeof raw === 'string' ? raw : ''
        const parsed = JSON.parse(text)
        setRawJson(parsed)

        const v6 = await parseV6Export(parsed)
        setV6Export(v6)

        const v9 = await transformV6ToV9(v6)
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
  }, [parseV6Export, transformV6ToV9])

  async function prepareBackup(): Promise<BackupSnapshot | null> {
    logger.info('[MigrationPanel] overwrite=true,触发二次确认对话框')
    const confirmed = window.confirm(
      '⚠️ 警告:覆盖式导入将删除现有数据!\n\n' +
      '系统将在导入前自动备份当前数据。\n' +
      '如导入失败,可使用「回滚到备份」按钮恢复。\n\n' +
      '确定继续执行覆盖式导入?'
    )
    if (!confirmed) {
      logger.info('[MigrationPanel] 用户取消覆盖式导入')
      return null
    }
    logger.info('[MigrationPanel] 用户确认覆盖式导入,开始备份')
    try {
      logger.info('[MigrationPanel] exportAll/start')
      const backupResult = await exportAll()
      logger.info('[MigrationPanel] exportAll/response', {
        success: backupResult.success,
        hasData: !!backupResult.data,
        error: backupResult.error,
      })
      if (!backupResult.success || !backupResult.data) {
        const backupError = backupResult.error ?? '未知错误'
        setError(`备份失败,已中止导入(防止数据丢失):${backupError}`)
        logger.error('[MigrationPanel] 备份失败,中止导入', {
          error: backupError,
          timestamp: Date.now(),
        })
        return null
      }
      const backupData = backupResult.data
      const stores = Object.keys(backupData)
      const totalRecords = stores.reduce(
        (sum, store) => sum + (backupData[store]?.length ?? 0),
        0,
      )
      const snapshot: BackupSnapshot = {
        data: backupData,
        createdAt: Date.now(),
        stores: stores.length,
        totalRecords,
      }
      setBackup(snapshot)
      logger.info('[MigrationPanel] 备份完成', {
        stores: stores.length,
        totalRecords,
        storeNames: stores,
      })
      return snapshot
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`备份异常,已中止导入:${message}`)
      logger.error('[MigrationPanel] 备份异常', {
        error: message,
        stack: err instanceof Error ? err.stack : undefined,
      })
      return null
    }
  }

  const handleImport = useCallback(async () => {
    if (!transformed) return
    logger.info('[MigrationPanel] handleImport/start', {
      overwrite,
      hasTransformed: transformed !== null,
      stocksCount: transformed.stocks.length,
      timestamp: Date.now(),
    })

    let backupSnapshot: BackupSnapshot | null = null
    if (overwrite) {
      backupSnapshot = await prepareBackup()
      if (backupSnapshot === null) return
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
  }, [transformed, overwrite, exportAll, importToV9])

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

  const handleRollback = useCallback(() => {
    if (!backup) return
    logger.warn('[MigrationPanel] handleRollback/start', {
      backupCreatedAt: backup.createdAt,
      backupStores: backup.stores,
      backupTotalRecords: backup.totalRecords,
      timestamp: Date.now(),
    })
    setRollbackStatus('rolling')
    logger.info('[MigrationPanel] 触发备份下载以供手动恢复')
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
  }, [rawJson, overwrite, runV6Migration])

  const handleReset = useCallback(() => {
    setRawJson(null)
    setV6Export(null)
    setTransformed(null)
    setReport(null)
    setBackup(null)
    setRollbackStatus('idle')
    setError('')
    setActiveTab('upload')
  }, [])

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

          <TabsContent value="upload">
            <MigrationUploadTab error={error} onFileSelected={handleFile} />
          </TabsContent>

          <TabsContent value="preview">
            <MigrationPreviewTab
              v6Export={v6Export}
              transformed={transformed}
              overwrite={overwrite}
              onOverwriteChange={setOverwrite}
              onImport={handleImport}
              onRunMigration={handleRunMigration}
              loading={loading}
              error={error}
              backup={backup}
              onDownloadBackup={handleDownloadBackup}
              onRollback={handleRollback}
              rollbackStatus={rollbackStatus}
            />
          </TabsContent>

          <TabsContent value="report">
            <MigrationReportTab
              report={report}
              onGenerateReport={generateMigrationReport}
              onReset={handleReset}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}