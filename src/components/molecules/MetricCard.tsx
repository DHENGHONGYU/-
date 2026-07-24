import { cn } from '@/lib/utils'
import { Card, CardContent, Badge } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

export interface MetricCardProps {
  /** 指标标题 */
  title: string
  /** 指标数值 */
  value: string | number
  /** 单位 */
  unit?: string
  /** 趋势方向 */
  trend?: 'up' | 'down' | 'neutral'
  /** 变化文本 */
  change?: string
  /** 是否加载中 */
  loading?: boolean
  /** 强调色（hex），作用于数值文字色；与 border 配合时同时作为左边框色 */
  color?: string
  /** 是否以左边框强调（需配合 color） */
  border?: boolean
  /** 容器 className */
  className?: string
}

/**
 * 指标卡分子
 *
 * 组合：Card + 标题 + 数值 + 趋势变化
 */
export function MetricCard({
  title,
  value,
  unit,
  trend = 'neutral',
  change,
  loading,
  color,
  border = false,
  className,
}: MetricCardProps) {
  const trendColor =
    trend === 'up'
      ? COLOR_TOKENS.success.tailwind
      : trend === 'down'
        ? COLOR_TOKENS.danger.tailwind
        : COLOR_TOKENS.textMuted.tailwind

  const isLoading = loading === true
  const showUnit = unit != null && unit.length > 0
  const showChange = !isLoading && change != null && change.length > 0

  return (
    <Card
      className={cn('p-4', border ? 'border-l-4' : '', className)}
      style={border && color ? { borderLeftColor: color } : undefined}
    >
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        {isLoading ? (
          <div className="mt-1 h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className="text-2xl font-semibold tracking-tight"
              style={color ? { color } : undefined}
            >
              {value}
            </span>
            {showUnit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        )}
        {showChange && (
          <Badge variant="outline" className={cn('mt-2', trendColor)}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'} {change}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
