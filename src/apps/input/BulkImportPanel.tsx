import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Progress } from '@/components/atoms/Progress'
import { Badge } from '@/components/atoms/Badge'
import {
  parseBulkInput,
  parseFile,
  importStocksWithProgress,
  downloadTemplate,
  detectDuplicates,
  type BulkImportRow,
  type BulkImportResult,
  type ImportStocksOptions,
} from '@/services/input/batchImportService'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { collectPoolSymbols } from '@/services/pool/collectionService'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const logger = getLogger()

type InputMode = 'text' | 'file'
type ImportPhase = 'idle' | 'preview' | 'importing' | 'done'

interface FileInfo {
  name: string
  size: number
  type: string
}

// 模式切换分段控件按钮样式常量（宋韵 stone 系列）
const SEGMENT_BASE = 'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200'
const SEGMENT_ACTIVE = cn('bg-background', 'shadow-sm', 'text-foreground')
const SEGMENT_INACTIVE = cn('text-muted-foreground', 'hover:text-foreground')

// 步骤指示器色（宋韵天青/完成绿）
const STEP_DONE_TEXT = 'text-success'
const STEP_DONE_BG = 'bg-success text-success-foreground'
const STEP_IDLE_TEXT = 'text-muted-foreground/70'
const STEP_IDLE_BG = 'bg-muted text-muted-foreground/70'

export default function BulkImportPanel(): React.JSX.Element {
  const refresh = useIntentionPoolStore((s) => s.refresh)
  const items = useIntentionPoolStore((s) => s.items)
  const allGroups = useMemo(() => getIntentionPoolGroups(), [])

  /** 意向池数据是否已加载完成（防止 refresh 未完成时误判重复） */
  const [poolReady, setPoolReady] = useState(false)

  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<BulkImportRow[]>([])
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle')
  const [importProgress, setImportProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [targetGroup, setTargetGroup] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [parsing, setParsing] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 同步 importPhase 状态
  useEffect(() => {
    if (importPreview.length === 0 && importResult === null) {
      setImportPhase('idle')
    } else if (importResult !== null) {
      setImportPhase('done')
    } else {
      setImportPhase('preview')
    }
  }, [importPreview.length, importResult])

  useEffect(() => {
    logger.info('[BulkImportPanel] 组件初始化，加载股票池数据')
    void (async () => {
      await refresh()
      setPoolReady(true)
    })()
  }, [refresh])

  // ── 文本输入解析 ──
  const handleParseImport = (text: string): void => {
    setImportText(text)
    setImportResult(null)
    setMessage('')
    const rows = parseBulkInput(text)
    const existingSymbols = new Set(items.map(s => s.symbol))
    const detectedRows = detectDuplicates(rows, existingSymbols)
    setImportPreview(detectedRows)
  }

  // ── 文件解析 ──
  const handleFile = useCallback(async (file: File): Promise<void> => {
    setParsing(true)
    setMessage('')
    setFileInfo({ name: file.name, size: file.size, type: file.type !== '' ? file.type : (file.name.split('.').pop() ?? 'unknown') })
    try {
      const rows = await parseFile(file)
      const existingSymbols = new Set(items.map(s => s.symbol))
      const detectedRows = detectDuplicates(rows, existingSymbols)
      setImportPreview(detectedRows)
      setImportResult(null)
      logger.info('[BulkImportPanel] 文件解析完成', { file: file.name, rows: rows.length })
    } catch (err) {
      setMessage(`文件解析失败：${err instanceof Error ? err.message : String(err)}`)
      setImportPreview([])
    } finally {
      setParsing(false)
    }
  }, [items])

  // ── 拖拽事件 ──
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
  }
  const acceptFile = (file?: File): void => {
    if (file) void handleFile(file)
  }
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files[0])
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    acceptFile(e.target.files?.[0])
  }

  // ── 导入执行 ──
  const handleConfirmImport = async (): Promise<void> => {
    const validRows = importPreview.filter(r => r.status === 'valid')
    if (validRows.length === 0) {
      setMessage('没有可导入的有效股票（全部重复或无效）')
      return
    }

    setImportPhase('importing')
    setImportProgress(0)
    setMessage('')
    const options: ImportStocksOptions = {
      fetchBasicAfterAdd: false,
      group: targetGroup || undefined,
    }

    try {
      const result = await importStocksWithProgress(
        importPreview,
        options,
        (_completed, _total, percent) => {
          setImportProgress(percent)
        },
      )

      if (result.success && result.data) {
        setImportResult(result.data)
        setImportProgress(100)
        setImportPhase('done')
        await refresh()
      } else {
        setImportPhase('done')
        setImportResult(null)
        setMessage(result.error ?? '批量导入失败')
      }
    } catch (err) {
      setImportPhase('done')
      setImportResult(null)
      setMessage(`导入异常：${err instanceof Error ? err.message : String(err)}`)
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
    setImportPhase('idle')
    setMessage('')
    setCollectMessage('')
    setFileInfo(null)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 立即采集：导入完成后直接触发七维度采集 ──
  const handleStartCollection = async (): Promise<void> => {
    // 从预览中提取所有有效代码（包括重复的，因为可能需要重新采集）
    const symbols = importPreview
      .filter((r) => r.status === 'valid' || r.status === 'duplicate')
      .map((r) => r.symbol)
      .filter(Boolean)
    if (symbols.length === 0) {
      setCollectMessage('没有可采集的标的')
      return
    }

    const config = useSevenDimConfigStore.getState().getCollectionConfig()
    setIsCollecting(true)
    setCollectMessage(`正在采集 ${symbols.length} 只标的的七维度数据...`)

    try {
      const result = await collectPoolSymbols(symbols, config)
      setCollectMessage(
        `采集完成：共 ${result.totalDimensions} 个维度，失败 ${result.failedDimensions} 个`,
      )
      logger.info('[BulkImportPanel] 立即采集完成', { symbols: symbols.length, ...result })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setCollectMessage(`采集失败：${errMsg}`)
      logger.error('[BulkImportPanel] 立即采集失败', { error: errMsg })
    } finally {
      setIsCollecting(false)
    }
  }

  // ── 状态标签 ──
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

  // ── 主按钮文案 ──
  const getPrimaryButton = (): {
    label: string
    variant: 'primary' | 'success' | 'secondary'
  } => {
    if (importPhase === 'importing') {
      return { label: `导入中 ${importProgress}%`, variant: 'secondary' }
    }
    if (importPhase === 'done' && importResult) {
      const isSuccess = importResult.success > 0
      return {
        label: `完成 · 成功 ${importResult.success} 条`,
        variant: isSuccess ? 'success' : 'primary',
      }
    }
    if (stats.valid === 0 && stats.total > 0) return { label: '无可导入行', variant: 'primary' }
    return { label: `确认导入${stats.valid > 0 ? ` (${stats.valid})` : ''}`, variant: 'primary' }
  }

  // ── 步骤指引 ──
  const steps = [
    { num: 1, label: '上传/粘贴', active: importPhase === 'idle' },
    { num: 2, label: '预览确认', active: importPhase === 'preview' },
    { num: 3, label: '导入', active: importPhase === 'importing' || importPhase === 'done' },
  ]
  const doneStep = importPhase === 'done'

  return (
    <div className="space-y-4">
      {/* ── 步骤指引 ── */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((step, idx) => {
          const isDone = doneStep && idx <= 1
          return (
            <React.Fragment key={step.num}>
              <div className={`flex items-center gap-1.5 transition-colors duration-300 ${
                isDone ? STEP_DONE_TEXT :
                step.active ? 'text-info' : STEP_IDLE_TEXT
              }`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  isDone
                    ? STEP_DONE_BG
                    : step.active
                      ? 'bg-primary text-primary-foreground'
                      : STEP_IDLE_BG
                }`}>
                  {isDone ? '✓' : step.num}
                </span>
                <span className="font-medium">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <span className={isDone ? 'text-success' : 'text-muted-foreground/50'}>→</span>
              )}
            </React.Fragment>
          )
        })}
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
                disabled={importPhase === 'importing'}
              >
                下载模板
              </Button>
              {(importPreview.length > 0 || importResult) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={importPhase === 'importing'}
                >
                  清空重来
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── 模式切换 — 分段控件风格 ── */}
          <div className={cn('inline-flex rounded-lg p-0.5 bg-muted')}>
            <button
              onClick={() => setInputMode('text')}
              disabled={importPhase === 'importing'}
              className={`${SEGMENT_BASE} ${inputMode === 'text' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
            >
              粘贴文本
            </button>
            <button
              onClick={() => setInputMode('file')}
              disabled={importPhase === 'importing'}
              className={`${SEGMENT_BASE} ${inputMode === 'file' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
            >
              上传文件
            </button>
          </div>

          {/* ── 文本输入 ── */}
          {inputMode === 'text' && (
            <>
              <p className={cn('text-xs text-muted-foreground')}>
                支持 CSV 文本，格式：代码,名称 或 代码.交易所,名称（如 600519.SH,贵州茅台）
              </p>
              <textarea
                className={cn('min-h-[160px] w-full rounded-md border p-3 text-sm outline-none transition-colors focus:ring-1 border-border bg-background text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-primary/30')}
                placeholder={`600519.SH,贵州茅台\n000001.SZ,平安银行\n300750.SZ,宁德时代`}
                value={importText}
                onChange={(e) => handleParseImport(e.target.value)}
                disabled={importPhase === 'importing'}
              />
            </>
          )}

          {/* ── 文件上传 ── */}
          {inputMode === 'file' && (
            <>
              <p className={cn('text-xs text-muted-foreground')}>
                支持 CSV (.csv)、Excel (.xlsx)、JSON (.json) 格式
              </p>
              <div
                className={cn(
                  'flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200',
                  dragOver
                    ? 'border-info bg-info/10 scale-[1.01]'
                    : 'border-input hover:border-primary hover:bg-muted'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => importPhase !== 'importing' && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {parsing ? (
                  <div className="text-center">
                    <div className={cn('mb-2 h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary')} />
                    <p className={cn('text-sm text-muted-foreground')}>解析中...</p>
                  </div>
                ) : fileInfo ? (
                  <div className="text-center">
                    <p className={cn('font-medium text-foreground')}>{fileInfo.name}</p>
                    <p className={cn('text-xs text-muted-foreground/70')}>
                      {formatFileSize(fileInfo.size)} · {fileInfo.type}
                    </p>
                    <p className={cn('mt-1 text-xs text-success')}>点击更换文件</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className={cn('mx-auto mb-2 h-8 w-8 text-muted-foreground/50')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className={cn('text-sm font-medium text-foreground')}>拖拽文件到此处</p>
                    <p className={cn('text-xs text-muted-foreground/70')}>或点击选择文件</p>
                    <p className={cn('mt-2 text-xs text-muted-foreground/70')}>.csv / .xlsx / .json</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 目标分组 ── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs text-muted-foreground')}>目标分组：</span>
            <Select
              className="h-8 w-auto min-w-[140px]"
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              aria-label="批量导入目标分组"
              disabled={importPhase === 'importing'}
            >
              <SelectItem value="">默认分组</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* ── 统计概览 ── */}
          {importPreview.length > 0 && (
            <div className={cn('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm border-border bg-muted/50')}>
              <span className={cn('text-muted-foreground')}>共 <strong className={cn('text-foreground')}>{stats.total}</strong> 条</span>
              <span className={cn('h-3.5 w-px bg-border')} />
              <span className="text-success">✓ 有效 <strong>{stats.valid}</strong></span>
              <span className="text-warning">⚠ 重复 <strong>{stats.duplicate}</strong></span>
              <span className="text-destructive">✕ 无效 <strong>{stats.invalid}</strong></span>
              {stats.valid === 0 && stats.total > 0 && (
                <span className={cn('text-xs text-muted-foreground/70')}>（所有行均不可导入）</span>
              )}
            </div>
          )}

          {/* ── 预览表格 ── */}
          {importPreview.length > 0 && (
            <div className={cn('max-h-64 overflow-auto rounded-md border border-border')}>
              <table className="w-full text-sm">
                <thead className={cn('sticky top-0 bg-muted')}>
                  <tr>
                    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>#</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>代码</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>名称</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>标准化</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>状态</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-border')}>
                  {importPreview.map((row, idx) => (
                    <tr key={`${row.symbol}-${idx}`} className={cn('hover:bg-muted/50')}>
                      <td className={cn('px-3 py-2 text-muted-foreground/70')}>{idx + 1}</td>
                      <td className={cn('px-3 py-2 font-mono text-foreground')}>{row.code}</td>
                      <td className={cn('px-3 py-2 text-foreground')}>{row.name}</td>
                      <td className={cn('px-3 py-2 font-mono text-xs text-muted-foreground')}>{row.symbol}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {statusBadge(row.status)}
                          {(row.statusReason ?? '') !== '' && (
                            <span className={cn('max-w-[120px] truncate text-xs text-muted-foreground/70')} title={row.statusReason}>
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

          {/* ── 导入进度 ── */}
          {importPhase === 'importing' && (
            <div className={cn('rounded-md border p-4 border-border bg-muted/50')}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className={cn('font-medium text-muted-foreground')}>正在导入...</span>
                <span className="text-muted-foreground/70">{importProgress}%</span>
              </div>
              <Progress value={importProgress} max={100} showMax={false} />
            </div>
          )}

          {/* ── 导入结果摘要 ── */}
          {importPhase === 'done' && importResult && (
            <div className={cn(
              'rounded-md border p-4 text-sm',
              importResult.failed > 0
                ? 'border-warning/30 bg-warning/10'
                : 'border-success/30 bg-success/10'
            )}>
              <div className="flex items-start gap-3">
                {importResult.failed > 0 ? (
                  <svg className={cn('mt-0.5 h-5 w-5 shrink-0 text-warning')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                ) : (
                  <svg className={cn('mt-0.5 h-5 w-5 shrink-0 text-success')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                )}
                <div>
                  <p className={cn(
                    'font-semibold',
                    importResult.failed > 0
                      ? 'text-warning'
                      : 'text-success'
                  )}>
                    {importResult.failed > 0 ? '导入完成（部分失败）' : '导入完成'}
                  </p>
                  <p className={cn('mt-0.5 text-muted-foreground')}>
                    成功 <strong className={cn('text-foreground')}>{importResult.success}</strong> 条
                    {importResult.skipped > 0 && (
                      <>，跳过 <strong className={cn('text-warning')}>{importResult.skipped}</strong> 条（已在池中）</>
                    )}
                    {importResult.failed > 0 && (
                      <>，失败 <strong className={cn('text-destructive')}>{importResult.failed}</strong> 条</>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className={cn('cursor-pointer text-xs text-muted-foreground hover:text-foreground')}>
                        查看 {importResult.errors.length} 条失败明细
                      </summary>
                      <ul className={cn('mt-2 space-y-0.5 text-xs text-muted-foreground')}>
                        {importResult.errors.map((e, idx) => (
                          <li key={idx} className="pl-2">· 第 {e.row} 行 {e.raw}：{e.error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── 消息 ── */}
          {message && (
            <p className={cn('rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground')}>
              {message}
            </p>
          )}

          {/* ── 采集消息 ── */}
          {collectMessage && (
            <p className={cn(
              'rounded-md px-3 py-2 text-sm',
              collectMessage.startsWith('采集失败')
                ? 'bg-destructive/10 text-destructive'
                : collectMessage.startsWith('采集完成')
                  ? 'bg-success/10 text-success'
                  : 'bg-info/10 text-info',
            )}>
              {collectMessage}
            </p>
          )}

          {/* ── 操作按钮区 ── */}
          <div className={cn('flex items-center justify-end gap-2 border-t pt-4 border-border')}>
            {importPhase === 'done' && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  继续导入
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleStartCollection()}
                  disabled={isCollecting}
                >
                  {isCollecting ? '采集中...' : '立即采集'}
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/input/seven-dim">前往采集配置</Link>
                </Button>
              </>
            )}
            <Button
              variant={getPrimaryButton().variant}
              size="sm"
              onClick={() => void handleConfirmImport()}
              disabled={stats.valid === 0 || importPhase === 'importing' || !poolReady}
            >
              {getPrimaryButton().label}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
