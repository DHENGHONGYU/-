/**
 * GaugeChart — 宋韵 SVG 仪表盘
 *
 * 用途：评分 0-100、风险等级、覆盖率、进度百分比 的图形化展示
 * 零外部依赖，纯 SVG 绘制，支持宋韵色阶（天青→赭石→胭脂）
 */
import React, { useMemo } from 'react'

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

// 宋韵色阶
const COLOR_BANDS = {
  score: [
    { pct: 0, color: '#cbd5e1' },   // 石色 (低)
    { pct: 40, color: '#f59e0b' },  // 赭石 (中低)
    { pct: 60, color: '#14b8a6' },  // 青瓷 (中)
    { pct: 80, color: '#10b981' },  // 天青 (高)
  ],
  progress: [
    { pct: 0, color: '#e2e8f0' },
    { pct: 50, color: '#14b8a6' },
    { pct: 100, color: '#10b981' },
  ],
  risk: [
    { pct: 0, color: '#10b981' },   // 低风险 (青)
    { pct: 30, color: '#f59e0b' },  // 中风险 (赭石)
    { pct: 70, color: '#ef4444' },  // 高风险 (胭脂)
    { pct: 100, color: '#dc2626' },
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
          stroke="#e2e8f0"
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
          className="fill-stone-800 dark:fill-stone-100"
          style={{ fontSize: size * 0.16, fontWeight: 700 }}
        >
          {displayPct}
        </text>
        {/* 百分比符号 */}
        <text
          x={center + size * 0.06}
          y={center - 6}
          textAnchor="start"
          className="fill-stone-400 dark:fill-stone-500"
          style={{ fontSize: size * 0.08 }}
        >
          %
        </text>
      </svg>
      {/* 底部标签 */}
      {label && (
        <p
          className="mt-1 truncate text-xs font-medium text-stone-600 dark:text-stone-300"
          style={{ maxWidth: size }}
        >
          {label}
        </p>
      )}
      {sublabel && (
        <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">{sublabel}</p>
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
        stroke="#e2e8f0"
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
        className="fill-stone-700 dark:fill-stone-200"
        style={{ fontSize: size * 0.28, fontWeight: 600 }}
      >
        {Math.round((value / max) * 100)}
      </text>
    </svg>
  )
}
