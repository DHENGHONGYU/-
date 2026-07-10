/**
 * GaugeChart — 宋韵 SVG 仪表盘
 *
 * 用途：评分 0-100、风险等级、覆盖率、进度百分比 的图形化展示
 * 零外部依赖，纯 SVG 绘制，支持宋韵色阶（天青→赭石→胭脂）
 */
import React, { useMemo } from 'react'
import { CHART_PALETTE, DARK, FILL, twText } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'

export interface GaugeChartProps {
  /** 当前值 (0-100) */
  value: number
  /** 最大值，默认 100 */
  max?: number
  /** 仪表盘尺寸 (px) */
  size?: number
  /** 弧线粗细 (px) */
  thickness?: number
  /** 标签文本 */
  label?: string
  /** 副标签（如等级文本） */
  sublabel?: string
  /** 色阶模式 */
  colorMode?: 'score' | 'progress' | 'risk'
  className?: string
}

const GAUGE_TRACK_COLOR = CHART_PALETTE.gaugeTrack
const COLOR_BANDS = {
  score: [
    { pct: 0, color: CHART_PALETTE.gaugeLow },
    { pct: 40, color: CHART_PALETTE.gaugeMidLow },
    { pct: 60, color: CHART_PALETTE.gaugeMid },
    { pct: 80, color: CHART_PALETTE.gaugeHigh },
  ],
  progress: [
    { pct: 0, color: CHART_PALETTE.gaugeTrack },
    { pct: 50, color: CHART_PALETTE.gaugeMid },
    { pct: 100, color: CHART_PALETTE.gaugeHigh },
  ],
  risk: [
    { pct: 0, color: CHART_PALETTE.gaugeHigh },
    { pct: 30, color: CHART_PALETTE.gaugeMidLow },
    { pct: 70, color: CHART_PALETTE.series4 },
    { pct: 100, color: CHART_PALETTE.gaugeRiskHigh },
  ],
}

function getColor(value: number, max: number, mode: 'score' | 'progress' | 'risk'): string {
  const pct = (value / max) * 100
  const bands = COLOR_BANDS[mode]
  for (let i = bands.length - 1; i >= 0; i--) {
    const band = bands[i]!
    if (pct >= band.pct) return band.color
  }
  return bands[0]!.color
}

export function GaugeChart({
  value,
  max = 100,
  size = 140,
  thickness = 10,
  label,
  sublabel,
  colorMode = 'score',
  className,
}: GaugeChartProps): React.JSX.Element {
  const center = size / 2
  const radius = center - thickness - 4

  // 背景弧路径
  const bgPath = useMemo(() => {
    const startAngle = -Math.PI * 0.78  // -140°
    const endAngle = Math.PI * 0.78     // 140°
    const sx = center + radius * Math.cos(startAngle)
    const sy = center + radius * Math.sin(startAngle)
    const ex = center + radius * Math.cos(endAngle)
    const ey = center + radius * Math.sin(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`
  }, [center, radius])

  // 进度弧路径
  const progressPath = useMemo(() => {
    const pct = Math.min(value / max, 1)
    const startAngle = -Math.PI * 0.78
    const endAngle = startAngle + (Math.PI * 1.56) * pct
    const sx = center + radius * Math.cos(startAngle)
    const sy = center + radius * Math.sin(startAngle)
    const ex = center + radius * Math.cos(endAngle)
    const ey = center + radius * Math.sin(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`
  }, [center, radius, value, max])

  const activeColor = getColor(value, max, colorMode)
  const displayPct = Math.round((value / max) * 100)

  return (
    <div className={className} style={{ width: size, textAlign: 'center' }}>
      <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`}>
        {/* 背景弧 */}
        <path
          d={bgPath}
          fill="none"
          stroke={GAUGE_TRACK_COLOR}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {/* 进度弧 */}
        <path
          d={progressPath}
          fill="none"
          stroke={activeColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
        {/* 数值文本 */}
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          className={cn(FILL.stone800, FILL.darkNeutral100)}
          style={{ fontSize: size * 0.16, fontWeight: 700 }}
        >
          {displayPct}
        </text>
        {/* 百分比符号 */}
        <text
          x={center + size * 0.06}
          y={center - 6}
          textAnchor="start"
          className={cn(FILL.stone400, FILL.darkNeutral500)}
          style={{ fontSize: size * 0.08 }}
        >
          %
        </text>
      </svg>
      {/* 底部标签 */}
      {label && (
        <p
          className={cn('mt-1 truncate text-xs font-medium', twText('stone', 600), DARK.textNeutral300)}
          style={{ maxWidth: size }}
        >
          {label}
        </p>
      )}
      {sublabel && (
        <p className={cn('truncate text-[11px]', twText('stone', 400), DARK.textNeutral500)}>{sublabel}</p>
      )}
    </div>
  )
}

/** 紧凑型进度环 — 用于卡片内联展示 */
export function GaugeRing({
  value,
  max = 100,
  size = 48,
  thickness = 4,
  colorMode = 'progress' as const,
}: GaugeChartProps): React.JSX.Element {
  const center = size / 2
  const radius = center - thickness
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(value / max, 1))
  const color = getColor(value, max, colorMode)

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={GAUGE_TRACK_COLOR}
        strokeWidth={thickness}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
      />
      <text
        x={center}
        y={center + 1}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn(FILL.stone700, FILL.darkNeutral200)}
        style={{ fontSize: size * 0.28, fontWeight: 600 }}
      >
        {Math.round((value / max) * 100)}
      </text>
    </svg>
  )
}
