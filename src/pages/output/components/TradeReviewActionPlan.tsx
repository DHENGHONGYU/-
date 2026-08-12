/**
 * @fileoverview 行动计划组件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { TradeReviewReport } from '@/types/modules/tradeReviewAI.types'

type ActionPlan = TradeReviewReport['actionPlan']

interface TradeReviewActionPlanProps {
  plan: ActionPlan
}

export function TradeReviewActionPlan({ plan }: TradeReviewActionPlanProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>行动计划</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.immediate.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">立即执行：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {plan.immediate.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.shortTerm.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">短期（1个月）：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {plan.shortTerm.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.longTerm.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">长期（3个月）：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {plan.longTerm.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
