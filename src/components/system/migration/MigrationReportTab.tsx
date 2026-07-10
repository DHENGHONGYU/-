import React from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { MigrationReport } from '@/services/system/v6MigrationService'

interface MigrationReportTabProps {
  report: MigrationReport | null
  onGenerateReport: (report: MigrationReport) => Promise<string>
  onReset: () => void
}

/**
 * MigrationReportTab
 * @param onGenerateReport
 * @param onReset }
 */
export function MigrationReportTab({ report, onGenerateReport, onReset }: MigrationReportTabProps): React.JSX.Element {
  const [reportText, setReportText] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (report && !reportText) {
      setLoading(true)
      onGenerateReport(report)
        .then(setReportText)
        .finally(() => setLoading(false))
    }
  }, [report, reportText, onGenerateReport])

  if (!report) return <></>

  const { summary } = report

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold">{summary.totalStores}</p>
          <Badge variant="outline">存储区</Badge>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold">{summary.importedRecords}</p>
          <Badge variant="outline">成功</Badge>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold">{summary.skippedRecords}</p>
          <Badge variant="outline">跳过</Badge>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold">{summary.failedRecords}</p>
          <Badge variant="outline">失败</Badge>
        </div>
      </div>

      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
        {loading ? '生成报告中...' : reportText}
      </pre>

      <Button variant="outline" onClick={onReset}>
        重新上传
      </Button>
    </div>
  )
}