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
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

interface BarChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  bars: Array<{ dataKey: string; name?: string; color?: string; stackId?: string }>
  height?: number
  layout?: 'horizontal' | 'vertical'
  showGrid?: boolean
  showTooltip?: boolean
  className?: string
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
      },
      ref,
    ) => {
      const isHorizontal = layout === 'vertical'

      usePerfTrace('BarChart', { points: data.length, series: bars.length })

      return (
        <div ref={ref} className={cn('w-full', className)}>
          <ResponsiveContainer width="100%" height={height}>
            <RechartsBar
              data={data}
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