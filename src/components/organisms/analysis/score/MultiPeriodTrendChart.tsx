/**
 * MultiPeriodTrendChart - 多周期评分趋势对比组件（DA-001）
 *
 * 支持周/月/季度切换，面积图展示综合评分走势，并高亮周期波动。
 * 统一处理 loading / error / empty 三态。
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { Badge } from '@/components/atoms/Badge'
import { DataState } from '@/components/molecules/DataState'
import { AreaChart } from '@/components/chart/AreaChart'
import {
  SCORE_TREND_PERIOD_OPTIONS,
  TREND_CHART_CONFIG,
  TREND_CHART_LABELS,
} from '@/constants/score.constants'
import type { ScoreTrendData, ScoreTrendPeriod } from '@/services/analysis/scoreTrendService'
import { CHART_PALETTE } from '@/constants/theme.tokens'

export interface MultiPeriodTrendChartProps {
  data: ScoreTrendData | undefined
  period: ScoreTrendPeriod
  onPeriodChange: (period: ScoreTrendPeriod) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
}

function computeVolatility(points: ScoreTrendData['points']): number {
  if (points.length < 2) return 0
  const values = points.map((p) => p.composite)
  return Number((Math.max(...values) - Math.min(...values)).toFixed(2))
}

/**
 * MultiPeriodTrendChart
 */
export const MultiPeriodTrendChart = memo(function MultiPeriodTrendChart({
  data,
  period,
  onPeriodChange,
  loading,
  error,
  onRetry,
  className,
}: MultiPeriodTrendChartProps) {
  const points = useMemo(() => data?.points ?? [], [data?.points])
  const volatility = useMemo(() => computeVolatility(points), [points])
  const isEmpty = !loading && !error && points.length === 0

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">{TREND_CHART_LABELS.title}</CardTitle>
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as ScoreTrendPeriod)}>
          <TabsList className="grid w-auto grid-cols-3">
            {SCORE_TREND_PERIOD_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="px-3 py-1 text-xs">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-0">
        <DataState
          isLoading={loading ?? false}
          isError={!!error}
          isEmpty={isEmpty}
          data={points}
          loadingProps={{ message: '加载中...' }}
          errorProps={{ error: error ?? '加载失败', onRetry, showErrorDetail: true }}
          emptyProps={{ title: TREND_CHART_LABELS.emptyTitle, description: TREND_CHART_LABELS.emptyDescription }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              {volatility > 0 && (
                <Badge variant="outline" className="text-xs">
                  {TREND_CHART_LABELS.volatility}: {volatility}
                </Badge>
              )}
              {points.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  {points[points.length - 1]!.count} {TREND_CHART_LABELS.sampleCount}
                </span>
              )}
            </div>
            <AreaChart
              data={points as unknown as Record<string, unknown>[]}
              xKey="period"
              areas={[
                {
                  dataKey: 'composite',
                  name: TREND_CHART_LABELS.title,
                  color: CHART_PALETTE.series1,
                  fillOpacity: TREND_CHART_CONFIG.areaOpacity,
                },
              ]}
              height={TREND_CHART_CONFIG.height}
              showGrid
              showTooltip
              showLegend={false}
            />
          </div>
        </DataState>
      </CardContent>
    </Card>
  )
})
