import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { IndustryV4Radar } from './IndustryV4Radar'
import { SubIndicatorBar } from './SubIndicatorBar'
import { CHART_PALETTE } from '@/constants/theme.tokens'

export type V4DimensionName = 'prosperity' | 'competition' | 'policy' | 'technology'

export interface IndustryV4PanelProps extends ComponentPropsWithoutRef<'div'> {
  dimensions: Array<{
    name: V4DimensionName
    label: string
    score: number
    subIndicators: Array<{
      key: string
      label: string
      value: number | null
      unit?: string
      maxValue?: number
    }>
  }>
  compositeScore: number | null
  height?: number | string
  activeDimension?: V4DimensionName
  onDimensionChange?: (dimension: V4DimensionName) => void
  showRadar?: boolean
  showSubIndicators?: boolean
}

const DIMENSION_COLORS: Record<V4DimensionName, string> = {
  prosperity: CHART_PALETTE.series1,
  competition: CHART_PALETTE.series2,
  policy: CHART_PALETTE.series3,
  technology: CHART_PALETTE.series5,
}

const IndustryV4Panel = forwardRef<HTMLDivElement, IndustryV4PanelProps>(
  (
    {
      dimensions,
      compositeScore,
      height = 400,
      activeDimension = 'prosperity',
      onDimensionChange,
      showRadar = true,
      showSubIndicators = true,
      className,
      ...divProps
    },
    ref,
  ) => {
    const radarData = dimensions.map((d) => ({
      dimension: d.name,
      label: d.label,
      score: d.score,
      fullMark: 5,
    }))

    const activeDim = dimensions.find((d) => d.name === activeDimension)

    return (
      <div
        ref={ref}
        className={className}
        style={{
          width: '100%',
          height,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
        {...divProps}
      >
        {compositeScore !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${CHART_PALETTE.series1}15, ${CHART_PALETTE.series5}15)`,
              border: `1px solid ${CHART_PALETTE.grid}`,
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: CHART_PALETTE.axisDark }}>
              V4 综合评分
            </span>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: CHART_PALETTE.series1,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {compositeScore.toFixed(2)}
              <span style={{ fontSize: '14px', fontWeight: 400, color: CHART_PALETTE.axis }}>
                {' '}/ 5.0
              </span>
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
          {showRadar && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <IndustryV4Radar
                data={radarData}
                height="100%"
                maxValue={5}
              />
            </div>
          )}

          {showSubIndicators && activeDim && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                {dimensions.map((dim) => (
                  <button
                    key={dim.name}
                    onClick={() => onDimensionChange?.(dim.name)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${activeDimension === dim.name ? DIMENSION_COLORS[dim.name] : CHART_PALETTE.grid}`,
                      background: activeDimension === dim.name ? `${DIMENSION_COLORS[dim.name]}10` : 'transparent',
                      color: activeDimension === dim.name ? DIMENSION_COLORS[dim.name] : CHART_PALETTE.axis,
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {dim.label}
                    <span style={{ marginLeft: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {dim.score.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
              <SubIndicatorBar
                data={activeDim.subIndicators.map((s) => ({
                  name: s.key,
                  label: s.label,
                  value: s.value,
                  maxValue: s.maxValue ?? 5,
                  unit: s.unit,
                }))}
                layout="vertical"
                height="100%"
                barColor={DIMENSION_COLORS[activeDimension]}
                sortByValue="desc"
                labelPosition="right"
              />
            </div>
          )}
        </div>
      </div>
    )
  },
)

IndustryV4Panel.displayName = 'IndustryV4Panel'

const IndustryV4PanelMemo = memo(IndustryV4Panel)
IndustryV4PanelMemo.displayName = 'IndustryV4Panel'

export default IndustryV4PanelMemo
export { IndustryV4PanelMemo as IndustryV4Panel }
