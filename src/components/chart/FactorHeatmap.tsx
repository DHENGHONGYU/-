import {
  forwardRef,
  memo,
  type ComponentPropsWithoutRef,
} from 'react'

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
}

const FactorHeatmap = forwardRef<HTMLDivElement, FactorHeatmapProps>(
  ({ data, minValue = -1, maxValue = 1, height = 200, ...divProps }, ref) => {
    // 计算列数（根据数据量动态调整）
    const colCount = Math.min(Math.ceil(Math.sqrt(data.length)), 6)

    // 将值映射到颜色渐变：红(-1) -> 黄(0) -> 绿(1)
    const valueToColor = (value: number): string => {
      const normalized = (value - minValue) / (maxValue - minValue)

      if (normalized <= 0.5) {
        // 红 -> 黄
        const ratio = normalized * 2
        const r = Math.round(255)
        const g = Math.round(200 * ratio)
        const b = Math.round(50 * ratio)
        return `rgb(${r}, ${g}, ${b})`
      } else {
        // 黄 -> 绿
        const ratio = (normalized - 0.5) * 2
        const r = Math.round(255 * (1 - ratio))
        const g = Math.round(200 + 55 * ratio)
        const b = Math.round(50 + 15 * ratio)
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
                    color: 'hsl(220, 9%, 46%)',
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
                      color: 'hsl(222, 47%, 11%)',
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
export const FactorHeatmapChart = FactorHeatmapMemo
export { FactorHeatmapChart as FactorHeatmap }
export default FactorHeatmapMemo
