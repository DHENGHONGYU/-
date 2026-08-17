import {
  forwardRef,
  memo,
  useMemo,
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
import { CHART_PALETTE, CHART_SEMANTIC_PALETTE } from '@/constants/theme.tokens'
import { getSemanticColor } from '@/components/chart/shared.config'
import { usePerfTrace } from '@/hooks/usePerfTrace'

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
  /**
   * V8: 按维度名指定颜色映射（如 { '估值': '#3b82f6', '质量': '#10b981' }）
   * 提供后每个维度独立着色；未提供则回退到单色渲染
   */
  dimensionColors?: Record<string, string>
  /**
   * V8: 启用语义色自动匹配（默认 false）
   * 为 true 时，自动用 getSemanticColor() 为每个维度匹配语义色
   */
  useSemanticColors?: boolean
}

const ScoreRadar = forwardRef<HTMLDivElement, ScoreRadarProps>(
  ({ data, height = 300, colors, dimensionColors, useSemanticColors = false, ...divProps }, ref) => {
    // 默认颜色：从设计令牌读取，禁止硬编码
    const fillColor = colors?.fill ?? CHART_PALETTE.radarDefault
    const strokeColor = colors?.stroke ?? CHART_PALETTE.radarDefault

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

    // V8: 维度颜色映射（优先 dimensionColors，其次 useSemanticColors 自动推导）
    const resolvedDimensionColors = useMemo<Record<string, string> | null>(() => {
      if (dimensionColors) return dimensionColors
      if (useSemanticColors) {
        const map: Record<string, string> = {}
        for (const item of data) {
          map[item.dimension] = getSemanticColor(item.dimension)
        }
        return map
      }
      return null
    }, [dimensionColors, useSemanticColors, data])

    // V8: 多维度独立着色 → 将数据透视为一维对象
    const pivotedData = useMemo(() => {
      if (!resolvedDimensionColors) return null
      const row: Record<string, string | number> = { dimension: '__pivot__' }
      for (const item of normalizedData) {
        row[item.dimension] = item.score
      }
      return [row]
    }, [normalizedData, resolvedDimensionColors])

    const dimensionKeys = useMemo(
      () => (resolvedDimensionColors ? normalizedData.map((d) => d.dimension) : []),
      [normalizedData, resolvedDimensionColors]
    )

    usePerfTrace('ScoreRadar', { points: data.length })

    // V8: 多维度独立着色模式
    if (resolvedDimensionColors && pivotedData) {
      return (
        <div ref={ref} style={{ height }} {...divProps}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={pivotedData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke={CHART_PALETTE.gridLight} />
              <PolarAngleAxis
                dataKey="dimension"
                tick={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: CHART_PALETTE.axis, fontSize: 10 }}
                tickCount={5}
              />
              {dimensionKeys.map((dim) => {
                const c = resolvedDimensionColors[dim] ?? CHART_SEMANTIC_PALETTE.benchmark.primary
                return (
                  <Radar
                    key={dim}
                    name={dim}
                    dataKey={dim}
                    stroke={c}
                    fill={c}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                )
              })}
            </RadarChart>
          </ResponsiveContainer>
          {/* 维度图例 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            {dimensionKeys.map((dim) => {
              const c = resolvedDimensionColors[dim] ?? CHART_SEMANTIC_PALETTE.benchmark.primary
              return (
                <span key={dim} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: CHART_PALETTE.axis }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c, display: 'inline-block' }} />
                  {dim}
                </span>
              )
            })}
          </div>
        </div>
      )
    }

    // 传统单色模式
    return (
      <div ref={ref} style={{ height }} {...divProps}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={normalizedData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid stroke={CHART_PALETTE.gridLight} />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: CHART_PALETTE.axis, fontSize: 10 }}
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
/**
 * ScoreRadarChart
 */
export const ScoreRadarChart = ScoreRadarMemo
export { ScoreRadarChart as ScoreRadar }
export default ScoreRadarMemo
