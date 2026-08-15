/**
 * 维度健康度卡片
 *
 * 显示单个维度的成功率与状态（健康/警告/异常）。
 * 颜色逻辑：success > 85% 健康，60%~85% 警告，< 60% 异常。
 *
 * @module CollectTask/components/DimHealthCard
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import { Progress } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

interface DimHealthCardProps {
  code: string
  name: string
  total: number
  success: number
}

const RATE_WARNING_THRESHOLD = 85
const RATE_CRITICAL_THRESHOLD = 60

/**
 * DimHealthCard
 * @param name
 * @param total
 * @param success }
 */
export function DimHealthCard({ code, name, total, success }: DimHealthCardProps): React.JSX.Element {
  const rate = total > 0 ? (success / total) * 100 : 0
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (total === 0 || rate < RATE_CRITICAL_THRESHOLD) {
    status = 'critical'
  } else if (rate < RATE_WARNING_THRESHOLD) {
    status = 'warning'
  }

  const colorKey = status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'danger'
  const badgeLabel = status === 'healthy' ? '健康' : status === 'warning' ? '警告' : '异常'
  const badgeVariant = colorKey === 'success' ? 'success' : colorKey === 'warning' ? 'warning' : 'destructive'

  return (
    <Card
      className="transition-shadow transition-colors duration-200 hover:shadow-elevation-2"
      style={{ borderLeftColor: COLOR_TOKENS[colorKey].hex, borderLeftWidth: 3 }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {code} · {name}
          </CardTitle>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-h1 font-bold" style={{ color: COLOR_TOKENS[colorKey].hex }}>
            {rate.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">% 成功</span>
        </div>
        <Progress value={rate} max={100} showMax={false} />
        <p className="text-xs text-muted-foreground">
          {success} / {total} 成功
        </p>
      </CardContent>
    </Card>
  )
}
