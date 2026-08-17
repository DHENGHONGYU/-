/**
 * @fileoverview 筹码分布图组件（CYQ 模型可视化）
 *
 * 基于 Python 后端 calculate_cyq_distribution 返回的 CollectChipData，
 * 渲染水平条形图展示各价格区间的筹码占比，并标注：
 * - 当前价格线（金色实线）
 * - 平均成本线（蓝色实线）
 * - 筹码峰位线（紫色虚线）
 * - 90% 筹码集中区（浅色背景高亮）
 * - 获利盘（绿色）vs 套牢盘（红色）
 * - 买卖点标记（右侧三角箭头 + 价格标签）
 *
 * @module components/chart/ChipDistributionChart
 * @created 2026-08-09 - P1 阶段筹码分布数据接入
 * @updated 2026-08-10 - 像素级精准渲染 + 买卖点标记
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CHART_PALETTE, COLOR_SHADES, THEME_TOKENS } from '@/constants/theme.tokens'
import type { CollectChipData } from '@/services/fetcher/fetcherTypes'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 数值安全 fallback（单值版）：用于数组单项、局部中间值等不绑定到 CollectChipData key 的场景。
 * - undefined / null → fallback（静默）
 * - 非 number / NaN → logger.warn + fallback
 */
function toSingleNum(value: unknown, fieldName: string, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  logger.warn(`[ChipDistributionChart] ${fieldName} 非有效数字，请核对上游写入`, {
    value,
    type: typeof value,
  })
  return fallback
}

/** 筹码图买卖点标注（基于价格维度） */
export interface ChipTradePoint {
  price: number
  direction: 'buy' | 'sell'
  label?: string
  color?: string
}

export interface ChipDistributionChartProps {
  data: CollectChipData
  height?: number
  className?: string
  tradePoints?: ChipTradePoint[]
}

const DEFAULT_HEIGHT = 360
const FALLBACK_WIDTH = 800

const PAD_LEFT = 56
const PAD_RIGHT = 112
const PAD_TOP = 12
const PAD_BOTTOM = 12
const BAR_GAP_RATIO = 0.15
const MIN_BAR_WIDTH_PX = 2
const PRICE_LABEL_COUNT = 6
const MARKER_SIZE = 7
const MARKER_LABEL_FONT = 9.5

const BUY_COLOR = COLOR_SHADES.red.hex[600]
const SELL_COLOR = COLOR_SHADES.green.hex[600]

export function ChipDistributionChart({
  data,
  height = DEFAULT_HEIGHT,
  className,
  tradePoints,
}: ChipDistributionChartProps): React.JSX.Element {
  const {
    priceBins,
    chipPercent,
    costLow,
    costHigh,
    costCenter,
    profitRatio,
    avgCost,
    concentration,
    currentPrice,
    priceMin,
    priceMax,
    barsUsed,
    coverageRatio,
    avgTurnoverRate,
    maxTurnoverRate,
  } = data

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(FALLBACK_WIDTH)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth || FALLBACK_WIDTH)
    return () => ro.disconnect()
  }, [])

  const chartWidth = Math.max(containerWidth - PAD_LEFT - PAD_RIGHT, 100)
  const chartHeight = height - PAD_TOP - PAD_BOTTOM

  const { maxPct, priceToY } = useMemo(() => {
    const mp = Math.max(...chipPercent, 1)
    const range = (priceMax ?? 0) - (priceMin ?? 0) || 1
    const toY = (price: number): number => {
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      const ratio = (price - (priceMin ?? 0)) / range
      return PAD_TOP + (1 - ratio) * chartHeight
    }
    return { maxPct: mp, priceToY: toY }
  }, [chipPercent, priceMin, priceMax, chartHeight])

  const stats = useMemo(() => {
    const profit = profitRatio ?? 0
    const loss = 100 - profit
    const profitColor =
      profit >= 60 ? CHART_PALETTE.upColor : profit >= 30 ? CHART_PALETTE.series3 : CHART_PALETTE.downColor
    // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
    const coverage = coverageRatio ?? 0
    const coverageColor =
      coverage >= 80 ? CHART_PALETTE.upColor : coverage >= 50 ? CHART_PALETTE.series3 : CHART_PALETTE.downColor
    const coverageLabel = coverage >= 80 ? '良好' : coverage >= 50 ? '一般' : '不足'
    return {
      profit,
      loss,
      profitColor,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      avgCost: avgCost ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      concentration: concentration ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      currentPrice: currentPrice ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      costCenter: costCenter ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      costLow: costLow ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      costHigh: costHigh ?? 0,
      coverage,
      coverageColor,
      coverageLabel,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      avgTurnoverRate: avgTurnoverRate ?? 0,
      // 静默回退(数值零兜底)：确认数据源可能为 undefined/null
      maxTurnoverRate: maxTurnoverRate ?? 0,
    }
  }, [
    profitRatio,
    avgCost,
    concentration,
    currentPrice,
    costCenter,
    costLow,
    costHigh,
    coverageRatio,
    avgTurnoverRate,
    maxTurnoverRate,
  ])

  const priceLabelData = useMemo(() => {
    const step = Math.max(Math.ceil(priceBins.length / PRICE_LABEL_COUNT), 1)
    const items: Array<{ index: number; price: number; y: number }> = []
    for (let i = 0; i < priceBins.length; i += step) {
      const bin = priceBins[i]
      const price = toSingleNum(bin, `priceBins[${i}]`)
      items.push({ index: i, price, y: priceToY(price) })
    }
    const lastIdx = priceBins.length - 1
    if (lastIdx >= 0 && (items.length === 0 || items[items.length - 1]!.index !== lastIdx)) {
      const lastBin = priceBins[lastIdx]
      const price = toSingleNum(lastBin, `priceBins[${lastIdx}]`)
      items.push({ index: lastIdx, price, y: priceToY(price) })
    }
    return items
  }, [priceBins, priceToY])

  const costLowY = costLow != null ? priceToY(costLow) : null
  const costHighY = costHigh != null ? priceToY(costHigh) : null
  const currentPriceY = currentPrice != null ? priceToY(currentPrice) : null
  const avgCostY = avgCost != null ? priceToY(avgCost) : null
  const costCenterY = costCenter != null ? priceToY(costCenter) : null

  const barHeightPx = chartHeight / chipPercent.length
  const barHeightActual = barHeightPx * (1 - BAR_GAP_RATIO)

  const labelStyle: CSSProperties = {
    fontSize: '11px',
    fill: CHART_PALETTE.axis,
  }

  return (
    <div className={className} style={{ width: '100%' }}>
      {/* 统计指标头 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <StatCard label="获利盘比例" value={`${stats.profit.toFixed(1)}%`} color={stats.profitColor} />
        <StatCard label="平均成本" value={`¥${stats.avgCost.toFixed(2)}`} color={CHART_PALETTE.series1} />
        <StatCard label="筹码集中度" value={`${stats.concentration.toFixed(1)}%`} color={CHART_PALETTE.series5} />
        <StatCard label="当前价格" value={`¥${stats.currentPrice.toFixed(2)}`} color={CHART_PALETTE.series3} />
      </div>

      {/* 数据质量指标行 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <StatCard
          label="数据覆盖率"
          value={`${stats.coverage.toFixed(1)}%`}
          color={stats.coverageColor}
          subtitle={stats.coverageLabel}
        />
        <StatCard label="平均换手率" value={`${stats.avgTurnoverRate.toFixed(2)}%`} color={CHART_PALETTE.axis} />
        <StatCard label="最大换手率" value={`${stats.maxTurnoverRate.toFixed(2)}%`} color={CHART_PALETTE.axis} />
        <StatCard label="采样深度" value={`${barsUsed} 根`} color={CHART_PALETTE.axis} />
      </div>

      {/* 筹码分布图 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          background: THEME_TOKENS.color.mutedBackgroundRaw,
          borderRadius: '6px',
          border: `1px solid ${CHART_PALETTE.grid}`,
          overflow: 'hidden',
        }}
      >
        <svg
          width={containerWidth}
          height={height}
          viewBox={`0 0 ${containerWidth} ${height}`}
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="chipProfitBar" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={CHART_PALETTE.upColor} stopOpacity="0.85" />
              <stop offset="100%" stopColor={CHART_PALETTE.upColor} stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="chipLossBar" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={CHART_PALETTE.downColor} stopOpacity="0.85" />
              <stop offset="100%" stopColor={CHART_PALETTE.downColor} stopOpacity="0.6" />
            </linearGradient>
            <filter id="chipLabelShadow" x="-0.5" y="-0.5" width="2" height="2">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* 90% 筹码集中区背景 */}
          {costLowY != null && costHighY != null && (
            <rect
              x={PAD_LEFT}
              y={Math.min(costLowY, costHighY)}
              width={chartWidth}
              height={Math.abs(costHighY - costLowY)}
              fill={CHART_PALETTE.series1}
              fillOpacity="0.05"
            />
          )}

          {/* 水平网格线 */}
          {priceLabelData.map(({ y }) => (
            <line
              key={`grid-${y.toFixed(1)}`}
              x1={PAD_LEFT}
              y1={y}
              x2={PAD_LEFT + chartWidth}
              y2={y}
              stroke={CHART_PALETTE.grid}
              strokeWidth="0.5"
              strokeOpacity="0.5"
            />
          ))}

          {/* 价格标签（左侧） */}
          {priceLabelData.map(({ index, price, y }) => (
            <text
              key={`price-${index}`}
              x={PAD_LEFT - 6}
              y={y + 3.5}
              textAnchor="end"
              fontSize="11"
              fill={CHART_PALETTE.axis}
              fontFamily="monospace"
            >
              {price.toFixed(2)}
            </text>
          ))}

          {/* 筹码条形 */}
          {chipPercent.map((pct, i) => {
            const y = PAD_TOP + i * barHeightPx
            const widthPx = Math.max((pct / maxPct) * chartWidth, MIN_BAR_WIDTH_PX)
            const price = priceBins[i] ?? 0
            const isProfit = currentPrice != null && price < currentPrice
            return (
              <rect
                key={`bar-${i}`}
                x={PAD_LEFT}
                y={y + (barHeightPx - barHeightActual) / 2}
                width={widthPx}
                height={barHeightActual}
                fill={isProfit ? 'url(#chipProfitBar)' : 'url(#chipLossBar)'}
                rx="1.5"
              />
            )
          })}

          {/* 当前价格线 */}
          {currentPriceY != null && (
            <g>
              <line
                x1={PAD_LEFT}
                y1={currentPriceY}
                x2={PAD_LEFT + chartWidth}
                y2={currentPriceY}
                stroke={CHART_PALETTE.series3}
                strokeWidth="1.4"
              />
              <rect
                x={PAD_LEFT + chartWidth + 2}
                y={currentPriceY - 8}
                width={96}
                height={16}
                rx="3"
                fill={CHART_PALETTE.series3}
                fillOpacity="0.12"
              />
              <text
                x={PAD_LEFT + chartWidth + 6}
                y={currentPriceY + 3.5}
                fontSize="10"
                fontWeight="600"
                fill={CHART_PALETTE.series3}
                fontFamily="monospace"
              >
                现价 ¥{stats.currentPrice.toFixed(2)}
              </text>
            </g>
          )}

          {/* 平均成本线 */}
          {avgCostY != null && (
            <g>
              <line
                x1={PAD_LEFT}
                y1={avgCostY}
                x2={PAD_LEFT + chartWidth}
                y2={avgCostY}
                stroke={CHART_PALETTE.series1}
                strokeWidth="1.2"
              />
              <rect
                x={PAD_LEFT + chartWidth + 2}
                y={avgCostY - 8}
                width={96}
                height={16}
                rx="3"
                fill={CHART_PALETTE.series1}
                fillOpacity="0.12"
              />
              <text
                x={PAD_LEFT + chartWidth + 6}
                y={avgCostY + 3.5}
                fontSize="10"
                fontWeight="500"
                fill={CHART_PALETTE.series1}
                fontFamily="monospace"
              >
                成本 ¥{stats.avgCost.toFixed(2)}
              </text>
            </g>
          )}

          {/* 筹码峰位线（虚线） */}
          {costCenterY != null && (
            <g>
              <line
                x1={PAD_LEFT}
                y1={costCenterY}
                x2={PAD_LEFT + chartWidth}
                y2={costCenterY}
                stroke={CHART_PALETTE.series5}
                strokeWidth="1"
                strokeDasharray="4,2"
              />
              <rect
                x={PAD_LEFT + chartWidth + 2}
                y={costCenterY - 8}
                width={96}
                height={16}
                rx="3"
                fill={CHART_PALETTE.series5}
                fillOpacity="0.12"
              />
              <text
                x={PAD_LEFT + chartWidth + 6}
                y={costCenterY + 3.5}
                fontSize="10"
                fontWeight="500"
                fill={CHART_PALETTE.series5}
                fontFamily="monospace"
              >
                峰位 ¥{stats.costCenter.toFixed(2)}
              </text>
            </g>
          )}

          {/* 买卖点标记 */}
          {tradePoints?.map((tp, i) => {
            const y = priceToY(tp.price)
            if (y < PAD_TOP || y > height - PAD_BOTTOM) return null
            const isBuy = tp.direction === 'buy'
            const color = tp.color ?? (isBuy ? BUY_COLOR : SELL_COLOR)
            const markerX = PAD_LEFT + chartWidth + 4
            const labelX = markerX + MARKER_SIZE + 3

            const points = isBuy
              ? `${markerX},${y + MARKER_SIZE / 2} ${markerX + MARKER_SIZE / 2},${y - MARKER_SIZE / 2} ${markerX + MARKER_SIZE},${y + MARKER_SIZE / 2}`
              : `${markerX},${y - MARKER_SIZE / 2} ${markerX + MARKER_SIZE / 2},${y + MARKER_SIZE / 2} ${markerX + MARKER_SIZE},${y - MARKER_SIZE / 2}`

            return (
              <g key={`tp-${i}`}>
                {/* 水平虚线指向价格位置 */}
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={markerX}
                  y2={y}
                  stroke={color}
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                  strokeOpacity="0.4"
                />
                {/* 三角形标记 */}
                <polygon points={points} fill={color} stroke="white" strokeWidth="0.5" />
                {/* 标签 */}
                <text
                  x={labelX}
                  y={y + 3}
                  fontSize={MARKER_LABEL_FONT}
                  fontWeight="600"
                  fill={color}
                  fontFamily="monospace"
                >
                  {tp.label ?? `${isBuy ? '买' : '卖'} ¥${tp.price.toFixed(2)}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 图例 + 集中区信息 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <LegendItem color={CHART_PALETTE.upColor} label={`获利盘 ${stats.profit.toFixed(1)}%`} />
          <LegendItem color={CHART_PALETTE.downColor} label={`套牢盘 ${stats.loss.toFixed(1)}%`} />
          {costLow != null && costHigh != null && (
            <LegendItem
              color={CHART_PALETTE.series1}
              label={`90%集中区 ¥${stats.costLow.toFixed(2)}-¥${stats.costHigh.toFixed(2)}`}
              opacity={0.3}
            />
          )}
          {tradePoints && tradePoints.length > 0 && (
            <>
              <LegendItem color={BUY_COLOR} label={`买点`} shape="triangle-up" />
              <LegendItem color={SELL_COLOR} label={`卖点`} shape="triangle-down" />
            </>
          )}
        </div>
        <span style={{ ...labelStyle, color: CHART_PALETTE.axis }}>
          基于 {barsUsed} 根日K线 · CYQ 模型 · 覆盖率 {stats.coverage.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string
  value: string
  color: string
  subtitle?: string
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: '6px',
        background: THEME_TOKENS.color.mutedBackgroundRaw,
        border: `1px solid ${THEME_TOKENS.color.borderRaw}`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '11px', color: THEME_TOKENS.color.mutedRaw, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 600, color }}>{value}</div>
      {subtitle != null && (
        <div style={{ fontSize: '10px', color, marginTop: '1px' }}>{subtitle}</div>
      )}
    </div>
  )
}

function LegendItem({
  color,
  label,
  opacity = 0.7,
  shape = 'rect',
}: {
  color: string
  label: string
  opacity?: number
  shape?: 'rect' | 'triangle-up' | 'triangle-down'
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {shape === 'rect' && (
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            background: color,
            opacity,
          }}
        />
      )}
      {shape === 'triangle-up' && (
        <span
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: `10px solid ${color}`,
          }}
        />
      )}
      {shape === 'triangle-down' && (
        <span
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `10px solid ${color}`,
          }}
        />
      )}
      <span style={{ fontSize: '11px', color: THEME_TOKENS.color.mutedRaw }}>{label}</span>
    </div>
  )
}

export default memo(ChipDistributionChart)
