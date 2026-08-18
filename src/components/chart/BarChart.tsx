import { memo, forwardRef } from 'react'
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE, COLOR_SHADES } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface BarChartProps {
  data?: Array<Record<string, unknown>>
  xKey: string
  bars: Array<{ dataKey: string; name?: string; color?: string; stackId?: string }>
  height?: number
  layout?: 'horizontal' | 'vertical'
  showGrid?: boolean
  showTooltip?: boolean
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
 * BarChart
 */
export const BarChart = memo(
  forwardRef<HTMLDivElement, BarChartProps>(
    (
      {
        data,
        xKey,
        bars,
        height = 300,
        layout = 'horizontal',
        showGrid = true,
        showTooltip = true,
        className,
        loading = false,
        emptyText,
      },
      ref,
    ) => {
      const safeData = data ?? []
      const pointCount = safeData.length
      usePerfTrace('BarChart', { points: pointCount, series: bars.length })

      // 加载状态骨架屏
      if (loading) {
        return (
          <div ref={ref} className={cn('w-full animate-pulse', className)}>
            <div className={cn('rounded-lg', COLOR_SHADES.gray[100])} style={{ height }} />
          </div>
        )
      }

      // 空数据占位
      if (pointCount === 0) {
        const resolvedEmptyText: string =
          emptyText === undefined
            ? '暂无数据'
            : typeof emptyText === 'string'
              ? emptyText
              : (() => {
                  logger.warn('[BarChart] emptyText 非字符串类型', { type: typeof emptyText })
                  return String(emptyText)
                })()
        return (
          <div ref={ref} className={cn('w-full flex items-center justify-center text-muted-foreground text-sm', className)} style={{ height }}>
            {resolvedEmptyText}
          </div>
        )
      }

      const isHorizontal = layout === 'vertical'

      return (
        <div ref={ref} className={cn('w-full', className)} role="img" aria-label="柱状图">
          <ResponsiveContainer width="100%" height={height}>
            <RechartsBar
              data={safeData}
              layout={isHorizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_PALETTE.grid}
                  horizontal={!isHorizontal}
                  vertical={isHorizontal}
                />
              )}
              {isHorizontal ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                    axisLine={{ stroke: CHART_PALETTE.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey={xKey}
                    tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                </>
              ) : (
                <>
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
                </>
              )}
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
              <Legend />
              {bars.map((bar, index) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.name}
                  fill={bar.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  stackId={bar.stackId}
                  radius={bar.stackId ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                />
              ))}
            </RechartsBar>
          </ResponsiveContainer>
        </div>
      )
    },
  ),
)

BarChart.displayName = 'BarChart'

export default BarChart