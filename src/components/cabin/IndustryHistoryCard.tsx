import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { IndustryScore, ResearchLog } from '@/data/types'

interface Props {
  history: IndustryScore[]
  logs: ResearchLog[]
}

export function IndustryHistoryCard({ history, logs }: Props): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>版本日志与纵向比对</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">综合分</th>
                <th className="px-3 py-2 text-left">模型</th>
                <th className="px-3 py-2 text-left">缺失字段</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id ?? record.scoredAt} className="border-t">
                  <td className="px-3 py-2">{new Date(record.scoredAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{record.overallScore?.toFixed(2) ?? 'N/A'}</td>
                  <td className="px-3 py-2">{record.configSnapshot.model}</td>
                  <td className="px-3 py-2">{record.missingFields.join(', ') || '无'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">操作日志</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
              {logs.slice(-10).map((log) => (
                <li key={log.id ?? log.timestamp}>
                  {new Date(log.timestamp).toLocaleString()} · {log.action} · {log.actor}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
