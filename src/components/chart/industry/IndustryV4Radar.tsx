import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

export interface IndustryV4RadarDataItem {
  dimension: string
  label: string
  score: number
  fullMark?: number
}

export interface IndustryV4RadarSeries {
  name: string
  dataKey: string
  color?: string
  fillOpacity?: number
}

export interface IndustryV4RadarProps extends ComponentPropsWithoutRef<'div'> {
  data: IndustryV4RadarDataItem[]
  series?: IndustryV4RadarSeries[]
  height?: number | string
  showLegend?: boolean
  maxValue?: number
  radarConfig?: {
    strokeWidth?: number
    dot?: boolean
    fillOpacity?: number
  }
}

const DEFAULT_SERIES: IndustryV4RadarSeries[] = [
  { name: '行业', dataKey: 'score', color: CHART_PALETTE.series1 },
]

const IndustryV4Radar = forwardRef<HTMLDivElement, IndustryV4RadarProps>(
  (
    {
      data,
      series = DEFAULT_SERIES,
      height = 320,
      showLegend = true,
      maxValue = 5,
      radarConfig,
      ...divProps
    },
    ref,
  ) => {
    usePerfTrace('IndustryV4Radar', { points: data.length, series: series.length })

    const chartData = data.map((item) => ({
      ...item,
      dimension: item.label,
    }))

    return (
      <div ref={ref} style={{ height, width: '100%' }} {...divProps}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={chartData}
            margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
          >
            <PolarGrid stroke={CHART_PALETTE.gridLight} />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, maxValue]}
              tick={{ fill: CHART_PALETTE.axis, fontSize: 10 }}
              tickCount={6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_PALETTE.tooltipBg,
                border: 'none',
                borderRadius: 8,
                color: CHART_PALETTE.tooltipText,
              }}
              labelStyle={{ color: CHART_PALETTE.tooltipText }}
              formatter={(value) => [Number(value).toFixed(2), '得分']}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            {series.map((s) => (
              <Radar
                key={s.dataKey}
                name={s.name}
                dataKey={s.dataKey}
                stroke={s.color ?? CHART_PALETTE.radarDefault}
                fill={s.color ?? CHART_PALETTE.radarDefault}
                fillOpacity={s.fillOpacity ?? radarConfig?.fillOpacity ?? 0.25}
                strokeWidth={radarConfig?.strokeWidth ?? 2}
                dot={radarConfig?.dot ?? false}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    )
  },
)

IndustryV4Radar.displayName = 'IndustryV4Radar'

const IndustryV4RadarMemo = memo(IndustryV4Radar)
IndustryV4RadarMemo.displayName = 'IndustryV4Radar'

/** 行业 V4 雷达图：四力模型（景气/竞争/政策/技术）五维度雷达展示。 */
export const IndustryV4RadarChart = IndustryV4RadarMemo
export { IndustryV4RadarChart as IndustryV4Radar }
export default IndustryV4RadarMemo
