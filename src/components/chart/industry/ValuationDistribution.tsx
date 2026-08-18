import { forwardRef, memo, type ComponentPropsWithoutRef, useMemo } from 'react'
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

export interface ValuationDistributionBin {
  range: string
  min: number
  max: number
  count: number
  isCurrent?: boolean
}

export interface ValuationDistributionProps extends ComponentPropsWithoutRef<'div'> {
  data: ValuationDistributionBin[]
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  currentValue?: number
  currentValueLabel?: string
  valueUnit?: string
  barColor?: string
  highlightColor?: string
  xAxisLabel?: string
  yAxisLabel?: string
}

function buildHistogram(values: number[], binCount: number = 10): ValuationDistributionBin[] {
  if (values.length === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  const binWidth = (max - min) / binCount || 1

  const bins: ValuationDistributionBin[] = []
  for (let i = 0; i < binCount; i++) {
    const binMin = min + i * binWidth
    const binMax = min + (i + 1) * binWidth
    const count = values.filter((v) => v >= binMin && (i === binCount - 1 ? v <= binMax : v < binMax)).length
    bins.push({
      range: `${binMin.toFixed(1)}-${binMax.toFixed(1)}`,
      min: binMin,
      max: binMax,
      count,
    })
  }

  return bins
}

const ValuationDistribution = forwardRef<HTMLDivElement, ValuationDistributionProps>(
  (
    {
      data,
      height = 220,
      showGrid = true,
      showTooltip = true,
      currentValue,
      currentValueLabel = '当前',
      valueUnit = 'x',
      barColor = CHART_PALETTE.series1,
      highlightColor = CHART_PALETTE.series4,
      xAxisLabel,
      yAxisLabel,
      ...divProps
    },
    ref,
  ) => {
    usePerfTrace('ValuationDistribution', { bins: data.length })

    const currentBinIndex = useMemo(() => {
      if (currentValue === undefined) return -1
      return data.findIndex((bin) => currentValue >= bin.min && currentValue <= bin.max)
    }, [data, currentValue])

    return (
      <div ref={ref} style={{ width: '100%', height }} {...divProps} role="img" aria-label="估值分布图">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBar
            data={data}
            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_PALETTE.grid}
                vertical={false}
              />
            )}
            <XAxis
              dataKey="range"
              tick={{ fill: CHART_PALETTE.axis, fontSize: 10 }}
              axisLine={{ stroke: CHART_PALETTE.grid }}
              tickLine={false}
              angle={-25}
              textAnchor="end"
              height={50}
              label={
                xAxisLabel
                  ? {
                      value: xAxisLabel,
                      position: 'insideBottom',
                      offset: -5,
                      fill: CHART_PALETTE.axis,
                      fontSize: 11,
                    }
                  : undefined
              }
            />
            <YAxis
              tick={{ fill: CHART_PALETTE.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      fill: CHART_PALETTE.axis,
                      fontSize: 11,
                    }
                  : undefined
              }
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
                formatter={(value) => [`${Number(value)} 只股票`, '数量']}
                labelFormatter={(label) => `估值区间: ${String(label)}${valueUnit}`}
              />
            )}
            {currentValue !== undefined && (
              <ReferenceLine
                x={currentBinIndex >= 0 ? data[currentBinIndex]?.range : undefined}
                stroke={highlightColor}
                strokeWidth={2}
                strokeDasharray="5 3"
                label={{
                  value: `${currentValueLabel}: ${currentValue.toFixed(2)}${valueUnit}`,
                  position: 'top',
                  fill: highlightColor,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === currentBinIndex ? highlightColor : barColor}
                  fillOpacity={index === currentBinIndex ? 1 : 0.7}
                />
              ))}
            </Bar>
          </RechartsBar>
        </ResponsiveContainer>
      </div>
    )
  },
)

ValuationDistribution.displayName = 'ValuationDistribution'

const ValuationDistributionMemo = memo(ValuationDistribution)
ValuationDistributionMemo.displayName = 'ValuationDistribution'

/** 估值分布图表：以散点或分布图展示行业估值范围。 */
export const ValuationDistributionChart = ValuationDistributionMemo
export { ValuationDistributionChart as ValuationDistribution }
export default ValuationDistributionMemo
// eslint-disable-next-line react-refresh/only-export-components
export { buildHistogram }
