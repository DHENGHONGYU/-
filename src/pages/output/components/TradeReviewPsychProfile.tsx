/**
 * @fileoverview 心理画像组件
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import type { TradeReviewReport } from '@/types/modules/tradeReviewAI.types'

type PsychologicalProfile = TradeReviewReport['errorAnalysis']['psychologicalProfile']

interface TradeReviewPsychProfileProps {
  profile: PsychologicalProfile
}

export function TradeReviewPsychProfile({ profile }: TradeReviewPsychProfileProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>心理画像</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{profile.name}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.rootCause}
        </p>
        <div className="space-y-2">
          <p className="text-sm font-medium">特征：</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {profile.characteristics.map((char, i) => (
              <li key={i}>{char}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">改进方向：</p>
          <p className="text-sm text-muted-foreground">
            {profile.improvementDirection}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
