/**
 * 评分历史表格组件
 * v0.9.11 P2-CMP-004c
 * 显示评分历史记录表格
 */
import { memo } from 'react'
import type { IntelligentScore } from '@/data/types'

interface ScoreHistoryTableProps {
  /** 历史评分记录 */
  history: IntelligentScore[]
}

/**
 * 评分历史表格
 */
export const ScoreHistoryTable = memo(function ScoreHistoryTable({ history }: ScoreHistoryTableProps): React.JSX.Element {
  if (history.length === 0) {
    return <></>
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">时间</th>
            <th className="px-3 py-2 text-left">综合分</th>
            <th className="px-3 py-2 text-left">综合分Δ</th>
            <th className="px-3 py-2 text-left">最大变化因子</th>
            <th className="px-3 py-2 text-left">模型</th>
            <th className="px-3 py-2 text-left">缺失字段</th>
          </tr>
        </thead>
        <tbody>
          {history.map((record, index) => {
            const prev = history[index + 1]
            const overallDelta =
              record.overallScore !== null &&
              prev?.overallScore !== null &&
              prev?.overallScore !== undefined
                ? record.overallScore - prev.overallScore
                : null

            const deltas = record.dimensionScores
              .map((d) => {
                const pd = prev?.dimensionScores.find((p) => p.name === d.name)
                if (d.score === null || pd?.score === null || pd?.score === undefined) return null
                return { name: d.name, delta: d.score - pd.score }
              })
              .filter((item): item is { name: string; delta: number } => item !== null)

            const maxDelta = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]

            return (
              <tr key={record.id ?? record.scoredAt} className="border-t">
                <td className="px-3 py-2">{new Date(record.scoredAt).toLocaleString()}</td>
                <td className="px-3 py-2">{record.overallScore?.toFixed(2) ?? 'N/A'}</td>
                <td className="px-3 py-2">
                  {overallDelta !== null
                    ? `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(2)}`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  {maxDelta
                    ? `${maxDelta.name} ${maxDelta.delta > 0 ? '+' : ''}${maxDelta.delta.toFixed(2)}`
                    : '—'}
                </td>
                <td className="px-3 py-2">{record.configSnapshot.model}</td>
                <td className="px-3 py-2">{record.missingFields.join(', ') || '无'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
