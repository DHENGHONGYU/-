import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  useOutputStore,
  selectExportData,
  selectMessage,
  selectIsExporting,
} from '@/store/outputStore'

export default function OutputApp(): React.JSX.Element {
  const exportData = useOutputStore(selectExportData)
  const message = useOutputStore(selectMessage)
  const isExporting = useOutputStore(selectIsExporting)
  const handleExport = useOutputStore((state) => state.handleExport)

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>输出舱 · 数据导出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" size="sm" onClick={() => void handleExport()} disabled={isExporting}>
            {isExporting ? '导出中...' : '导出全部数据'}
          </Button>
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
