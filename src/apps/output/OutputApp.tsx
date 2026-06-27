import React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { exportAll } from '@/services/system/systemService'

export default function OutputApp(): React.JSX.Element {
  const [exportData, setExportData] = useState('')
  const [message, setMessage] = useState('')

  const handleExport = async (): Promise<void> => {
    const result = await exportAll()
    if (result.success && result.data) {
      setExportData(JSON.stringify(result.data, null, 2))
      setMessage('')
    } else {
      setMessage(result.error ?? '导出失败')
      setExportData('')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>输出舱 · 数据导出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            导出全部数据
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
