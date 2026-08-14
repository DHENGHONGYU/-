import { forwardRef, memo, type ComponentPropsWithoutRef, useMemo } from 'react'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { THEME_TOKENS } from '@/constants/theme/theme.tokens.base'
import { usePerfTrace } from '@/hooks/usePerfTrace'

/** ITU-R BT.601 luminance coefficients */
const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114
const DEFAULT_HEATMAP_HEIGHT = 280

export interface IndustryHeatmapDataItem {
  code: string
  name: string
  value: number
  category?: string
  subValue?: number
  subLabel?: string
}

export type HeatmapColorScheme =
  | 'redGreen'
  | 'blueYellow'
  | 'purpleGreen'
  | 'monoBlue'

export interface IndustryHeatmapProps extends ComponentPropsWithoutRef<'div'> {
  data: IndustryHeatmapDataItem[]
  minValue?: number
  maxValue?: number
  height?: number
  columns?: number
  colorScheme?: HeatmapColorScheme
  showValue?: boolean
  showSubValue?: boolean
  groupByCategory?: boolean
  cellMinHeight?: number
  onCellClick?: (item: IndustryHeatmapDataItem) => void
}

const COLOR_SCHEMES: Record<HeatmapColorScheme, { low: string; mid: string; high: string }> = {
  redGreen: CHART_PALETTE.heatmapRedGreen,
  blueYellow: CHART_PALETTE.heatmapBlueYellow,
  purpleGreen: CHART_PALETTE.heatmapPurpleGreen,
  monoBlue: CHART_PALETTE.heatmapMonoBlue,
}

function parseRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function interpolateColor(color1: string, color2: string, ratio: number): string {
  const [r1, g1, b1] = parseRgb(color1)
  const [r2, g2, b2] = parseRgb(color2)
  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)
  return `rgb(${r}, ${g}, ${b})`
}

function getLuminance(r: number, g: number, b: number): number {
  return (LUMA_R * r + LUMA_G * g + LUMA_B * b) / 255
}

const IndustryHeatmap = forwardRef<HTMLDivElement, IndustryHeatmapProps>(
  (
    {
      data,
      minValue,
      maxValue,
      height = DEFAULT_HEATMAP_HEIGHT,
      columns,
      colorScheme = 'redGreen',
      showValue = true,
      showSubValue = false,
      groupByCategory = false,
      cellMinHeight = 56,
      onCellClick,
      ...divProps
    },
    ref,
  ) => {
    usePerfTrace('IndustryHeatmap', { points: data.length })

    const scheme = COLOR_SCHEMES[colorScheme]

    const { min, max } = useMemo(() => {
      const values = data.map((d) => d.value)
      const computedMin = minValue ?? Math.min(...values, 0)
      const computedMax = maxValue ?? Math.max(...values, 1)
      return { min: computedMin, max: computedMax }
    }, [data, minValue, maxValue])

    const colCount = columns ?? Math.min(Math.ceil(Math.sqrt(data.length)), 8)

    const valueToColor = (value: number): { bg: string; text: string } => {
      const normalized = max === min ? 0.5 : (value - min) / (max - min)
      const clamped = Math.max(0, Math.min(1, normalized))

      let bg: string
      if (clamped <= 0.5) {
        const ratio = clamped * 2
        bg = interpolateColor(scheme.low, scheme.mid, ratio)
      } else {
        const ratio = (clamped - 0.5) * 2
        bg = interpolateColor(scheme.mid, scheme.high, ratio)
      }

      const match = bg.match(/rgb\((\d+), (\d+), (\d+)\)/)
      const luminance = match
        ? getLuminance(Number(match[1]), Number(match[2]), Number(match[3]))
        : 0.5
      const text = luminance > 0.6 ? CHART_PALETTE.heatmapTextDark : CHART_PALETTE.heatmapTextLight

      return { bg, text }
    }

    const groupedData = useMemo(() => {
      if (!groupByCategory) return [{ category: '', items: data }]
      const categories = [...new Set(data.map((d) => d.category ?? '其他'))]
      return categories.map((category) => ({
        category,
        items: data.filter((d) => (d.category ?? '其他') === category),
      }))
    }, [data, groupByCategory])

    return (
      <div ref={ref} style={{ width: '100%', height, overflow: 'auto' }} {...divProps}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groupedData.map((group) => (
            <div key={group.category || 'default'}>
              {groupByCategory && group.category && (
                <div
                  style={{
                    fontSize: '12px',
                    color: CHART_PALETTE.axisDark,
                    fontWeight: 600,
                    marginBottom: '6px',
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
                {group.items.map((item) => {
                  const { bg, text } = valueToColor(item.value)
                  return (
                    <div
                      key={item.code}
                      role={onCellClick ? 'button' : undefined}
                      tabIndex={onCellClick ? 0 : undefined}
                      onClick={() => onCellClick?.(item)}
                      onKeyDown={(e) => {
                        if (!onCellClick) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onCellClick(item)
                        }
                      }}
                      className={onCellClick
                        ? `focus-visible:outline-none focus-visible:${THEME_TOKENS.focusVisible.ringWidth} focus-visible:${THEME_TOKENS.focusVisible.ringColor} focus-visible:${THEME_TOKENS.focusVisible.ringOffset}`
                        : undefined}
                      style={{
                        backgroundColor: bg,
                        color: text,
                        borderRadius: '6px',
                        padding: '8px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: cellMinHeight,
                        fontSize: '11px',
                        cursor: onCellClick ? 'pointer' : 'default',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (onCellClick) {
                          ;(e.currentTarget).style.transform = 'scale(1.03)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget).style.transform = 'scale(1)'
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          marginBottom: showValue || showSubValue ? '2px' : 0,
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
                      {showValue && (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 500 }}>
                          {item.value.toFixed(2)}
                        </span>
                      )}
                      {showSubValue && item.subValue !== undefined && item.subLabel && (
                        <span style={{ fontSize: '10px', opacity: 0.85 }}>
                          {item.subLabel}: {item.subValue.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
)

IndustryHeatmap.displayName = 'IndustryHeatmap'

const IndustryHeatmapMemo = memo(IndustryHeatmap)
IndustryHeatmapMemo.displayName = 'IndustryHeatmap'

/** 行业热力图：以矩阵色块展示板块涨跌和资金流向的二维视图。 */
export const IndustryHeatmapChart = IndustryHeatmapMemo
export { IndustryHeatmapChart as IndustryHeatmap }
export default IndustryHeatmapMemo
