import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

export interface TrendLineDataPoint {
  period: string
  timestamp?: number
  [key: string]: string | number | undefined
}

export interface TrendLineSeries {
  dataKey: string
  name: string
  color?: string
  strokeWidth?: number
  dot?: boolean
  smooth?: boolean
  type?: 'monotone' | 'linear' | 'step' | 'stepBefore' | 'stepAfter'
}

export interface TrendLineReferenceLine {
  y: number
  label?: string
  color?: string
  strokeDasharray?: string
}

export interface TrendLineChartProps extends ComponentPropsWithoutRef<'div'> {
  data: TrendLineDataPoint[]
  series: TrendLineSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  xAxisKey?: string
  yDomain?: [number | 'auto', number | 'auto']
  referenceLines?: TrendLineReferenceLine[]
}

const DEFAULT_COLORS = [
  CHART_PALETTE.series1,
  CHART_PALETTE.series2,
  CHART_PALETTE.series3,
  CHART_PALETTE.series4,
  CHART_PALETTE.series5,
  CHART_PALETTE.series6,
]

const TrendLineChart = forwardRef<HTMLDivElement, TrendLineChartProps>(
  (
    {
      data,
      series,
      height = 280,
      showGrid = true,
      showLegend = true,
      showTooltip = true,
      xAxisKey = 'period',
      yDomain = ['auto', 'auto'],
      referenceLines,
      ...divProps
    },
    ref,
  ) => {
    usePerfTrace('TrendLineChart', { points: data.length, series: series.length })

    return (
      <div ref={ref} style={{ width: '100%', height }} {...divProps} role="img" aria-label="趋势折线图">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLine
            data={data}
            margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_PALETTE.grid}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
              axisLine={{ stroke: CHART_PALETTE.grid }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={45}
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
            {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            {referenceLines?.map((line, index) => (
              <ReferenceLine
                key={`ref-${index}`}
                y={line.y}
                stroke={line.color ?? CHART_PALETTE.series3}
                strokeDasharray={line.strokeDasharray ?? '5 5'}
                label={
                  line.label
                    ? {
                        value: line.label,
                        position: 'right',
                        fill: line.color ?? CHART_PALETTE.series3,
                        fontSize: 10,
                      }
                    : undefined
                }
              />
            ))}
            {series.map((s, index) => (
              <Line
                key={s.dataKey}
                type={s.type ?? 'monotone'}
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                strokeWidth={s.strokeWidth ?? 2}
                dot={s.dot ?? false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </RechartsLine>
        </ResponsiveContainer>
      </div>
    )
  },
)

TrendLineChart.displayName = 'TrendLineChart'

const TrendLineChartMemo = memo(TrendLineChart)
TrendLineChartMemo.displayName = 'TrendLineChart'

/** 行业趋势折线图：展示多维度行业指标的时间序列趋势。 */
export const IndustryTrendChart = TrendLineChartMemo
export { IndustryTrendChart as TrendLineChart }
export default TrendLineChartMemo
