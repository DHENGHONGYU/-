import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { twText, COLOR_SHADES } from '@/constants/theme.tokens'

export interface ScoreUpdateAlertProps {
  lastScoredAt: number | undefined
  onRefresh: () => void
  loading?: boolean
}

const HALF_WEEK_MS = 3.5 * 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * ScoreUpdateAlert
 * @param onRefresh
 * @param loading }
 */
export function ScoreUpdateAlert({ lastScoredAt, onRefresh, loading }: ScoreUpdateAlertProps): React.JSX.Element | null {
  const now = Date.now()
  const elapsed = lastScoredAt ? now - lastScoredAt : Number.POSITIVE_INFINITY

  if (!lastScoredAt) {
    return (
      <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-destructive">尚未评分</p>
          <p className="text-xs text-muted-foreground">建议每周至少运行两次大模型评分</p>
        </div>
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? '评分中...' : '立即评分'}
        </Button>
      </div>
    )
  }

  if (elapsed > WEEK_MS) {
    const days = Math.floor(elapsed / (24 * 60 * 60 * 1000))
    return (
      <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-destructive">已超期 {days} 天未更新</p>
          <p className="text-xs text-muted-foreground">
            上次评分: {new Date(lastScoredAt).toLocaleString()}，建议立即重新评分
          </p>
        </div>
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? '评分中...' : '重新评分'}
        </Button>
      </div>
    )
  }

  if (elapsed > HALF_WEEK_MS) {
    const days = Math.floor(elapsed / (24 * 60 * 60 * 1000))
    return (
      <div
        className={`flex items-center justify-between rounded-md border p-3 ${twText('amber', 700)}`}
        style={{
          borderColor: `${COLOR_SHADES.amber.hex[500]}4D`,
          backgroundColor: `${COLOR_SHADES.amber.hex[500]}1A`,
        }}
      >
        <div className="space-y-0.5">
          <p className={`text-sm font-medium ${twText('amber', 700)}`}>
            建议更新 <Badge variant="outline">已 {days} 天</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            上次评分: {new Date(lastScoredAt).toLocaleString()}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? '评分中...' : '重新评分'}
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
      评分较新（上次: {new Date(lastScoredAt).toLocaleString()}），建议每周至少更新两次。
    </div>
  )
}
