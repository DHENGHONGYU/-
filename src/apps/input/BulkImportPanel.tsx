import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, SelectItem } from '@/components/ui/Select'
import {
  parseBulkInput,
  importStocks,
  type BulkImportRow,
  type BulkImportResult,
} from '@/services/input/batchImportService'
import { usePoolData } from '@/components/pool/usePoolData'

export default function BulkImportPanel(): React.JSX.Element {
  const { refresh, allGroups } = usePoolData()
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<BulkImportRow[]>([])
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [targetGroup, setTargetGroup] = useState('')

  const handleParseImport = (text: string): void => {
    setImportText(text)
    setImportResult(null)
    setMessage('')
    const rows = parseBulkInput(text)
    setImportPreview(rows)
  }

  const handleConfirmImport = async (): Promise<void> => {
    const rows = importPreview
    if (rows.length === 0) {
      setMessage('未解析到有效股票')
      return
    }

    setImporting(true)
    const result = await importStocks(rows, {
      fetchBasicAfterAdd: false,
      group: targetGroup || undefined,
    })
    setImporting(false)

    if (result.success && result.data) {
      setImportResult(result.data)
      setMessage(
        `批量导入完成：成功 ${result.data.success} 条，失败 ${result.data.failed} 条`,
      )
      await refresh()
    } else {
      setMessage(result.error ?? '批量导入失败')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>批量导入候选股票</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            支持粘贴 CSV / 文本，每行格式：代码,名称（如 600519,贵州茅台）
          </p>
          <textarea
            className="min-h-[160px] w-full rounded-md border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder={`600519,贵州茅台\n000001,平安银行\n300750,宁德时代`}
            value={importText}
            onChange={(e) => handleParseImport(e.target.value)}
          />

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

          {importPreview.length > 0 && (
            <div className="max-h-60 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">序号</th>
                    <th className="px-3 py-2 text-left">代码</th>
                    <th className="px-3 py-2 text-left">名称</th>
                    <th className="px-3 py-2 text-left">标准化代码</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, idx) => (
                    <tr key={`${row.symbol}-${idx}`} className="border-t">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.symbol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importResult && importResult.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
              <p className="font-medium text-red-700 dark:text-red-400">失败明细：</p>
              <ul className="mt-1 list-inside list-disc text-red-600 dark:text-red-300">
                {importResult.errors.map((e, idx) => (
                  <li key={idx}>
                    第 {e.row} 行 {e.raw}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => void handleConfirmImport()}
              disabled={importPreview.length === 0 || importing}
            >
              {importing ? '导入中...' : `确认导入 (${importPreview.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
