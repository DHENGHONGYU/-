import { memo, forwardRef } from 'react'
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE } from '@/constants/theme.tokens'

interface LineChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  lines: Array<{ dataKey: string; name?: string; color?: string }>
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
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

export const LineChart = memo(
  forwardRef<HTMLDivElement, LineChartProps>(
    (
      {
        data,
        xKey,
        lines,
        height = 300,
        showGrid = true,
        showTooltip = true,
        showLegend = true,
        className,
      },
      ref,
    ) => {
      return (
        <div ref={ref} className={cn('w-full', className)}>
          <ResponsiveContainer width="100%" height={height}>
            <RechartsLine
              data={data}
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
              {lines.map((line, index) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: line.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      )
    },
  ),
)

LineChart.displayName = 'LineChart'

export default LineChart