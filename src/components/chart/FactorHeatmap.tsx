import {
  forwardRef,
  memo,
  type ComponentPropsWithoutRef,
} from 'react'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { EmptyState } from '@/components/molecules'

const EPSILON = 1e-10

export interface FactorHeatmapData {
  name: string
  value: number
  category?: string
}

export interface FactorHeatmapProps extends ComponentPropsWithoutRef<'div'> {
  data: FactorHeatmapData[]
  minValue?: number
  maxValue?: number
  height?: number
  /** 空状态文案（可选，默认"暂无因子数据"） */
  emptyText?: string
}

const FactorHeatmap = forwardRef<HTMLDivElement, FactorHeatmapProps>(
  ({ data, minValue = -1, maxValue = 1, height = 200, emptyText, ...divProps }, ref) => {
    // 空数据守卫：避免 colCount=0 导致静默空白渲染
    if (data.length === 0) {
      return (
        <div ref={ref} {...divProps}>
          <EmptyState title={emptyText ?? '暂无因子数据'} />
        </div>
      )
    }

    // 计算列数（根据数据量动态调整）
    const colCount = Math.min(Math.ceil(Math.sqrt(data.length)), 6)

    // 将值映射到颜色渐变：低(-1) -> 中(0) -> 高(1)
    // 颜色端点全部来自 CHART_PALETTE，禁止硬编码
    const range = maxValue - minValue
    const hasRange = Math.abs(range) > EPSILON

    const valueToColor = (value: number): string => {
      // 守卫：minValue ≈ maxValue 时，避免除零产生 NaN，返回中点色
      const normalized = hasRange ? (value - minValue) / range : 0.5

      const parseRgb = (hex: string): [number, number, number] => {
        const n = Number.parseInt(hex.replace('#', ''), 16)
        return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
      }

      const low = parseRgb(CHART_PALETTE.factorHeatmapLow)
      const mid = parseRgb(CHART_PALETTE.factorHeatmapMid)
      const high = parseRgb(CHART_PALETTE.factorHeatmapHigh)

      if (normalized <= 0.5) {
        const ratio = normalized * 2
        const r = Math.round(low[0] + (mid[0] - low[0]) * ratio)
        const g = Math.round(low[1] + (mid[1] - low[1]) * ratio)
        const b = Math.round(low[2] + (mid[2] - low[2]) * ratio)
        return `rgb(${r}, ${g}, ${b})`
      } else {
        const ratio = (normalized - 0.5) * 2
        const r = Math.round(mid[0] + (high[0] - mid[0]) * ratio)
        const g = Math.round(mid[1] + (high[1] - mid[1]) * ratio)
        const b = Math.round(mid[2] + (high[2] - mid[2]) * ratio)
        return `rgb(${r}, ${g}, ${b})`
      }
    }

    // 根据类别分组
    const categories = [...new Set(data.map((item) => item.category ?? '默认'))]
    const groupedData = categories.map((category) => ({
      category,
      items: data.filter((item) => (item.category ?? '默认') === category),
    }))

    return (
      <div ref={ref} {...divProps}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height }}>
          {groupedData.map((group) => (
            <div key={group.category}>
              {categories.length > 1 && (
                <div
                  style={{
                    fontSize: '12px',
                    color: CHART_PALETTE.axis,
                    marginBottom: '6px',
                    fontWeight: 500,
                  }}
                >
                  {group.category}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                  gap: '4px',
                }}
              >
                {group.items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    style={{
                      backgroundColor: valueToColor(item.value),
                      borderRadius: '6px',
                      padding: '8px 6px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '60px',
                      color: CHART_PALETTE.tooltipBg,
                      fontSize: '11px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        marginBottom: '2px',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {item.value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
)

FactorHeatmap.displayName = 'FactorHeatmap'

// 同时导出 named + default
const FactorHeatmapMemo = memo(FactorHeatmap)
FactorHeatmapMemo.displayName = 'FactorHeatmap'
/**
 * FactorHeatmapChart
 */
export const FactorHeatmapChart = FactorHeatmapMemo
export { FactorHeatmapChart as FactorHeatmap }
export default FactorHeatmapMemo
