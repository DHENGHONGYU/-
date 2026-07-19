import { memo, forwardRef } from 'react'
import {
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

interface AreaChartProps {
  data?: Array<Record<string, unknown>>
  xKey: string
  areas: Array<{ dataKey: string; name?: string; color?: string; fillOpacity?: number }>
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  className?: string
  /** 加载状态（显示骨架屏），默认 false */
  loading?: boolean
  /** 空数据占位文案，默认「暂无数据」 */
  emptyText?: string
}

const DEFAULT_COLORS = [
  CHART_PALETTE.series1,
  CHART_PALETTE.series2,
  CHART_PALETTE.series3,
  CHART_PALETTE.series4,
  CHART_PALETTE.series5,
  CHART_PALETTE.series6,
]

/**
 * AreaChart
 */
export const AreaChart = memo(
  forwardRef<HTMLDivElement, AreaChartProps>(
    (
      {
        data,
        xKey,
        areas,
        height = 300,
        showGrid = true,
        showTooltip = true,
        showLegend = true,
        className,
        loading = false,
        emptyText,
      },
      ref,
    ) => {
      const safeData = data ?? []
      const pointCount = safeData.length
      usePerfTrace('AreaChart', { points: pointCount, series: areas.length })

      // 加载状态骨架屏
      if (loading) {
        return (
          <div ref={ref} className={cn('w-full animate-pulse', className)}>
            <div className="rounded-lg bg-gray-100" style={{ height }} />
          </div>
        )
      }

      // 空数据占位
      if (pointCount === 0) {
        return (
          <div ref={ref} className={cn('w-full flex items-center justify-center text-muted-foreground text-sm', className)} style={{ height }}>
            {emptyText ?? '暂无数据'}
          </div>
        )
      }

      return (
        <div ref={ref} className={cn('w-full', className)}>
          <ResponsiveContainer width="100%" height={height}>
            <RechartsArea
              data={safeData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_PALETTE.grid}
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={xKey}
                tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                axisLine={{ stroke: CHART_PALETTE.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              {showTooltip && (
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_PALETTE.tooltipBg,
                    border: 'none',
                    borderRadius: 8,
                    color: CHART_PALETTE.tooltipText,
                  }}
                  labelStyle={{ color: CHART_PALETTE.tooltipText }}
                />
              )}
              {showLegend && <Legend />}
              {areas.map((area, index) => {
                const color = area.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                const gradientId = `areaGradient-${area.dataKey}-${index}`
                return (
                  <defs key={area.dataKey}>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={area.fillOpacity ?? 0.4} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                )
              })}
              {areas.map((area, index) => {
                const color = area.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                const gradientId = `areaGradient-${area.dataKey}-${index}`
                return (
                  <Area
                    key={area.dataKey}
                    type="monotone"
                    dataKey={area.dataKey}
                    name={area.name}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    fillOpacity={area.fillOpacity ?? 0.4}
                    dot={false}
                    activeDot={{ r: 5, fill: color }}
                  />
                )
              })}
            </RechartsArea>
          </ResponsiveContainer>
        </div>
      )
    },
  ),
)

AreaChart.displayName = 'AreaChart'

export default AreaChart