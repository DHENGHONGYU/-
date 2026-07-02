import {
  forwardRef,
  memo,
  type ComponentPropsWithoutRef,
} from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

export interface ScoreRadarData {
  dimension: string
  score: number
  fullMark?: number
}

export interface ScoreRadarProps extends ComponentPropsWithoutRef<'div'> {
  data: ScoreRadarData[]
  height?: number
  colors?: {
    fill: string
    stroke: string
  }
}

const ScoreRadar = forwardRef<HTMLDivElement, ScoreRadarProps>(
  ({ data, height = 300, colors, ...divProps }, ref) => {
    // 默认颜色
    const fillColor = colors?.fill ?? 'hsl(195, 85%, 42%)'
    const strokeColor = colors?.stroke ?? 'hsl(195, 85%, 42%)'

    // 计算满分值，用于归一化
    const maxScore = Math.max(
      ...data.map((item) => item.fullMark ?? 100),
      1
    )

    // 格式化数据：归一化到 0-100 范围
    const normalizedData = data.map((item) => ({
      dimension: item.dimension,
      score: ((item.score / maxScore) * 100).toFixed(1),
      fullMark: 100,
    }))

    return (
      <div ref={ref} style={{ height }} {...divProps}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={normalizedData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid stroke="hsl(220, 13%, 91%)" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 10 }}
              tickCount={5}
            />
            <Radar
              name="评分"
              dataKey="score"
              stroke={strokeColor}
              fill={fillColor}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    )
  }
)

ScoreRadar.displayName = 'ScoreRadar'

// 同时导出 named + default（ScoreRadarMemo 避免与 forwardRef const 命名冲突）
const ScoreRadarMemo = memo(ScoreRadar)
ScoreRadarMemo.displayName = 'ScoreRadar'
export const ScoreRadarChart = ScoreRadarMemo
export { ScoreRadarChart as ScoreRadar }
export default ScoreRadarMemo
