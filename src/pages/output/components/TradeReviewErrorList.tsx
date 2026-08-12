/**
 * @fileoverview 纪律分析组件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { TradeReviewReport } from '@/types/modules/tradeReviewAI.types'

type DisciplineAnalysis = TradeReviewReport['disciplineAnalysis']

interface TradeReviewErrorListProps {
  analysis: DisciplineAnalysis
}

export function TradeReviewErrorList({ analysis }: TradeReviewErrorListProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>纪律分析</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">计划遵守率</p>
            <p className="text-xl font-bold">{analysis.planAdherenceRate.toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">止损执行率</p>
            <p className="text-xl font-bold">{analysis.stopLossExecutionRate.toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">仓位管理</p>
            <p className="text-xl font-bold">{analysis.positionManagementScore.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">情绪控制</p>
            <p className="text-xl font-bold">{analysis.emotionControlScore.toFixed(1)}</p>
          </div>
        </div>
        {analysis.improvements.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">改善建议：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {analysis.improvements.map((imp, i) => (
                <li key={i}>{imp}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
