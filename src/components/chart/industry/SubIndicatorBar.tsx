import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

export interface SubIndicatorBarDataItem {
  name: string
  label: string
  value: number | null
  maxValue?: number
  unit?: string
  category?: string
}

export interface SubIndicatorBarProps extends ComponentPropsWithoutRef<'div'> {
  data: SubIndicatorBarDataItem[]
  height?: number | string
  layout?: 'horizontal' | 'vertical'
  showGrid?: boolean
  showTooltip?: boolean
  valueDomain?: [number, number]
  barColor?: string
  barRadius?: number
  labelPosition?: 'top' | 'right' | 'inside' | 'none'
  sortByValue?: 'asc' | 'desc' | 'none'
}

const SubIndicatorBar = forwardRef<HTMLDivElement, SubIndicatorBarProps>(
  (
    {
      data,
      height = 300,
      layout = 'horizontal',
      showGrid = true,
      showTooltip = true,
      valueDomain,
      barColor = CHART_PALETTE.series1,
      barRadius = 4,
      labelPosition = 'top',
      sortByValue = 'none',
      ...divProps
    },
    ref,
  ) => {
    usePerfTrace('SubIndicatorBar', { points: data.length })

    const sortedData = [...data].filter((d) => d.value !== null).sort((a, b) => {
      if (sortByValue === 'asc') return (a.value ?? 0) - (b.value ?? 0)
      if (sortByValue === 'desc') return (b.value ?? 0) - (a.value ?? 0)
      return 0
    })

    const isVertical = layout === 'vertical'

    const defaultDomain: [number, number] = valueDomain ?? [
      0,
      Math.max(...sortedData.map((d) => d.maxValue ?? d.value ?? 0), 1) * 1.1,
    ]

    return (
      <div ref={ref} style={{ width: '100%', height }} {...divProps}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBar
            data={sortedData}
            layout={isVertical ? 'vertical' : 'horizontal'}
            margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_PALETTE.grid}
                horizontal={!isVertical}
                vertical={isVertical}
              />
            )}
            {isVertical ? (
              <>
                <XAxis
                  type="number"
                  domain={defaultDomain}
                  tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
                  axisLine={{ stroke: CHART_PALETTE.grid }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
                  axisLine={{ stroke: CHART_PALETTE.grid }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  domain={defaultDomain}
                  tick={{ fill: CHART_PALETTE.axis, fontSize: 11 }}
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
                formatter={(value, _name, props) => {
                  const payload = props?.payload as SubIndicatorBarDataItem | undefined
                  const unit = payload?.unit ?? ''
                  return [Number(value).toFixed(2) + unit, payload?.name ?? '']
                }}
              />
            )}
            <Bar
              dataKey="value"
              fill={barColor}
              radius={isVertical ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0]}
              label={
                labelPosition !== 'none'
                  ? {
                      position: isVertical ? 'right' : 'top',
                      fill: CHART_PALETTE.axisDark,
                      fontSize: 10,
                      formatter: (value) => Number(value).toFixed(1),
                    }
                  : undefined
              }
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={typeof barColor === 'string' ? barColor : barColor}
                  fillOpacity={entry.value === null ? 0.3 : 1}
                />
              ))}
            </Bar>
          </RechartsBar>
        </ResponsiveContainer>
      </div>
    )
  },
)

SubIndicatorBar.displayName = 'SubIndicatorBar'

const SubIndicatorBarMemo = memo(SubIndicatorBar)
SubIndicatorBarMemo.displayName = 'SubIndicatorBar'

/** 子指标柱状图：展示行业 V4 各子维度的对比条形图。 */
export const SubIndicatorBarChart = SubIndicatorBarMemo
export { SubIndicatorBarChart as SubIndicatorBar }
export default SubIndicatorBarMemo
