import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, SelectItem } from '@/components/ui/Select'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import {
  parseBulkInput,
  parseFile,
  importStocksWithProgress,
  downloadTemplate,
  type BulkImportRow,
  type BulkImportResult,
  type ImportStocksOptions,
} from '@/services/input/batchImportService'
import { usePoolStore, getAllGroups } from '@/store/poolStore'
import { getLogger } from '@/lib/logger'
import { twText, twBg, twBorder } from '@/constants/theme.tokens'

const logger = getLogger()

type InputMode = 'text' | 'file'

interface FileInfo {
  name: string
  size: number
  type: string
}

export default function BulkImportPanel(): React.JSX.Element {
  const refresh = usePoolStore((s) => s.refresh)
  const stocks = usePoolStore((s) => s.stocks)
  const allGroups = useMemo(() => getAllGroups(), [stocks])

  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<BulkImportRow[]>([])
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [targetGroup, setTargetGroup] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    logger.info('[BulkImportPanel] 组件初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  // ── 文本输入解析 ──
  const handleParseImport = (text: string): void => {
    setImportText(text)
    setImportResult(null)
    setMessage('')
    const rows = parseBulkInput(text)
    setImportPreview(rows)
  }

  // ── 文件解析 ──
  const handleFile = useCallback(async (file: File): Promise<void> => {
    setParsing(true)
    setMessage('')
    setFileInfo({ name: file.name, size: file.size, type: file.type || file.name.split('.').pop() || 'unknown' })
    try {
      const rows = await parseFile(file)
      setImportPreview(rows)
      setImportResult(null)
      logger.info('[BulkImportPanel] 文件解析完成', { file: file.name, rows: rows.length })
    } catch (err) {
      setMessage(`文件解析失败：${err instanceof Error ? err.message : String(err)}`)
      setImportPreview([])
    } finally {
      setParsing(false)
    }
  }, [])

  // ── 拖拽事件 ──
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  // ── 导入执行 ──
  const handleConfirmImport = async (): Promise<void> => {
    const rows = importPreview
    if (rows.length === 0) {
      setMessage('未解析到有效股票')
      return
    }

    setImporting(true)
    setImportProgress(0)
    const options: ImportStocksOptions = {
      fetchBasicAfterAdd: false,
      group: targetGroup || undefined,
    }

    const result = await importStocksWithProgress(
      rows,
      options,
      (completed, total, percent) => {
        setImportProgress(percent)
      },
    )
    setImporting(false)

    if (result.success && result.data) {
      setImportResult(result.data)
      setImportProgress(100)
      setMessage(`批量导入完成：成功 ${result.data.success} 条，失败 ${result.data.failed} 条`)
      await refresh()
    } else {
      setMessage(result.error ?? '批量导入失败')
    }
  }

  const handleDownloadTemplate = (): void => {
    downloadTemplate()
    logger.info('[BulkImportPanel] 下载导入模板')
  }

  const handleReset = (): void => {
    setImportText('')
    setImportPreview([])
    setImportResult(null)
    setMessage('')
    setFileInfo(null)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 状态标签颜色映射 ──
  const statusBadge = (status: BulkImportRow['status']): React.JSX.Element => {
    const map: Record<BulkImportRow['status'], { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
      valid: { variant: 'success', label: '有效' },
      duplicate: { variant: 'warning', label: '重复' },
      invalid: { variant: 'destructive', label: '无效' },
    }
    const cfg = map[status]
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>
  }

  // ── 统计 ──
  const stats = useMemo(() => {
    const valid = importPreview.filter((r) => r.status === 'valid').length
    const duplicate = importPreview.filter((r) => r.status === 'duplicate').length
    const invalid = importPreview.filter((r) => r.status === 'invalid').length
    return { valid, duplicate, invalid, total: importPreview.length }
  }, [importPreview])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // ── 步骤指引 ──
  const steps = [
    { num: 1, label: '上传/粘贴', active: importPreview.length === 0 && !importing },
    { num: 2, label: '预览确认', active: importPreview.length > 0 && !importing },
    { num: 3, label: '导入', active: importing || importResult !== null },
  ]

  return (
    <div className="space-y-4">
      {/* 步骤指引 */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((step, idx) => (
          <React.Fragment key={step.num}>
            <div className={`flex items-center gap-1.5 ${step.active ? twText('blue', 600) : 'text-muted-foreground'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${step.active ? twBg('blue', 600) + ' ' + twText('white') : twBg('gray', 100)}`}>
                {step.num}
              </span>
              <span className="font-medium">{step.label}</span>
            </div>
            {idx < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>批量导入候选股票</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={importing}
              >
                下载模板
              </Button>
              {importPreview.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleReset} disabled={importing}>
                  清空
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 输入模式切换 */}
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('text')}
            >
              粘贴文本
            </Button>
            <Button
              variant={inputMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('file')}
            >
              上传文件
            </Button>
          </div>

          {/* 文本输入 */}
          {inputMode === 'text' && (
            <>
              <p className="text-sm text-muted-foreground">
                支持粘贴 CSV / 文本，每行格式：代码,名称（如 600519,贵州茅台）
              </p>
              <textarea
                className="min-h-[160px] w-full rounded-md border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                placeholder={`600519,贵州茅台\n000001,平安银行\n300750,宁德时代`}
                value={importText}
                onChange={(e) => handleParseImport(e.target.value)}
              />
            </>
          )}

          {/* 文件上传 */}
          {inputMode === 'file' && (
            <>
              <p className="text-sm text-muted-foreground">
                支持 CSV (.csv)、Excel (.xlsx)、JSON (.json) 格式
              </p>
              <div
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver
                    ? twBorder('blue', 400) + ' ' + twBg('blue', 50)
                    : twBorder('gray', 300) + ' hover:' + twBorder('blue', 300)
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {parsing ? (
                  <p className="text-sm text-muted-foreground">解析中...</p>
                ) : fileInfo ? (
                  <div className="text-center">
                    <p className="font-medium text-foreground">{fileInfo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileInfo.size)} · {fileInfo.type}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">点击更换文件</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">拖拽文件到此处</p>
                    <p className="text-xs text-muted-foreground">或点击选择文件</p>
                    <p className="mt-2 text-xs text-muted-foreground">支持 .csv / .xlsx / .json</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 目标分组 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">目标分组：</span>
            <Select
              className="h-8 w-auto min-w-[140px]"
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              aria-label="批量导入目标分组"
            >
              <SelectItem value="">默认分组</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* 统计概览 */}
          {importPreview.length > 0 && (
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">共 {stats.total} 条</span>
              <span className="text-green-600">有效 {stats.valid}</span>
              <span className="text-amber-600">重复 {stats.duplicate}</span>
              <span className="text-red-600">无效 {stats.invalid}</span>
            </div>
          )}

          {/* 预览表格 */}
          {importPreview.length > 0 && (
            <div className="max-h-60 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">序号</th>
                    <th className="px-3 py-2 text-left">代码</th>
                    <th className="px-3 py-2 text-left">名称</th>
                    <th className="px-3 py-2 text-left">标准化代码</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, idx) => (
                    <tr key={`${row.symbol}-${idx}`} className="border-t">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.symbol}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {statusBadge(row.status)}
                          {row.statusReason && (
                            <span className="text-xs text-muted-foreground" title={row.statusReason}>
                              {row.statusReason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 导入进度条 */}
          {importing && (
            <div className="space-y-1">
              <Progress value={importProgress} max={100} label={`导入进度 ${importProgress}%`} showMax={false} />
              <p className="text-xs text-muted-foreground">正在导入... {importProgress}%</p>
            </div>
          )}

          {/* 错误明细 */}
          {importResult && importResult.errors.length > 0 && (
            <div className={`max-h-40 overflow-auto rounded-md border p-3 text-sm ${twBorder('red', 200)} ${twBg('red', 50)} ${twText('red', 700)} dark:${twBorder('red', 900)} dark:${twBg('red', 950)}/30`}>
              <p className={`font-medium ${twText('red', 700)} dark:${twText('red', 400)}`}>失败明细：</p>
              <ul className={`mt-1 list-inside list-disc ${twText('red', 600)} dark:${twText('red', 300)}`}>
                {importResult.errors.map((e, idx) => (
                  <li key={idx}>
                    第 {e.row} 行 {e.raw}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 消息 */}
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => void handleConfirmImport()}
              disabled={importPreview.length === 0 || importing}
            >
              {importing ? `导入中... ${importProgress}%` : `确认导入 (${stats.valid})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
