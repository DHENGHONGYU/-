import { memo } from 'react'
import { Badge } from '@/components/atoms/Badge'
import type { BuySellPointReview } from '@/types/modules/buySellPoint.types'

interface BuySellPointReviewPanelProps {
  review: BuySellPointReview
}

export const BuySellPointReviewPanel = memo(function BuySellPointReviewPanel({
  review,
}: BuySellPointReviewPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">综合评分</span>
        <Badge variant={review.overallScore >= 70 ? 'default' : 'secondary'}>
          {review.overallScore}/100
        </Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>{review.summary}</p>
      </div>

      {review.coreSkills.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">核心技能提炼</h4>
          {review.coreSkills.map((skill, i) => (
            <div key={i} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{skill.skill}</span>
                <Badge variant="outline">{skill.priority}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{skill.insight}</p>
              <p className="mt-1 text-xs text-muted-foreground">建议: {skill.action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
