import React, { useState } from 'react'
import { Route, Routes } from 'react-router'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectItem } from '@/components/ui/Select'
import {
  useOutputStore,
  selectExportData,
  selectMessage,
  selectIsExporting,
} from '@/store/outputStore'
import { toSafeString } from '@/lib/safeCoerce'

const OutputHubPage = React.lazy(() => import('@/pages/output/OutputHubPage'))
const ResearchReportPage = React.lazy(() => import('@/pages/output/ResearchReportPage'))
const TradeReviewPage = React.lazy(() => import('@/pages/output/TradeReviewPage'))

// ---------- simple JSON -> CSV conversion ----------

function jsonToCsv(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr)
    // If it's an array of objects, flatten to CSV
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      const headers = Object.keys(parsed[0] as Record<string, unknown>)
      const rows = parsed.map((row: Record<string, unknown>) =>
        headers.map((h) => {
          const val = toSafeString(row[h])
          // Escape commas and quotes in values
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        }).join(','),
      )
      return [headers.join(','), ...rows].join('\n')
    }
    // Fallback: single-line string representation
    return jsonStr
  } catch {
    return jsonStr
  }
}

// ---------- Data Export Panel ----------

function DataExportPanel(): React.JSX.Element {
  const exportData = useOutputStore(selectExportData)
  const message = useOutputStore(selectMessage)
  const isExporting = useOutputStore(selectIsExporting)
  const handleExport = useOutputStore((state) => state.handleExport)

  const [format, setFormat] = useState<'json' | 'csv'>('json')

  const handleDownload = (): void => {
    if (!exportData) return
    const content = format === 'csv' ? jsonToCsv(exportData) : exportData
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `v9-export-${new Date().toISOString().slice(0, 10)}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            输出舱 · 数据导出
            <Badge variant="secondary">JSON / CSV</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
              className="w-28"
            >
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting ? '导出中...' : '导出全部数据'}
            </Button>
            {exportData && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                下载数据
              </Button>
            )}
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {exportData && (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
              {exportData}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- App with sub-routes ----------

export default function OutputApp(): React.JSX.Element {
  return (
    <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中...</div>}>
      <Routes>
        <Route path="/output" element={<OutputHubPage />} />
        <Route path="/output/export" element={<DataExportPanel />} />
        <Route path="/output/research" element={<ResearchReportPage />} />
        <Route path="/output/review" element={<TradeReviewPage />} />
      </Routes>
    </React.Suspense>
  )
}
