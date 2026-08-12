/**
 * @fileoverview 交易摘要卡片组件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'

interface TradeReviewSummaryProps {
  totalTrades: number
  winRate: number
  profitLossRatio: number
  disciplineScore: number
  loading?: boolean
}

export function TradeReviewSummary({
  totalTrades,
  winRate,
  profitLossRatio,
  disciplineScore,
  loading,
}: TradeReviewSummaryProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>交易摘要</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">总交易笔数</p>
            <p className="text-2xl font-bold">{loading === true ? '...' : totalTrades}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">胜率</p>
            <p className="text-2xl font-bold">{winRate.toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">盈亏比</p>
            <p className="text-2xl font-bold">{profitLossRatio.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">纪律评分</p>
            <p className="text-2xl font-bold">{disciplineScore.toFixed(1)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
