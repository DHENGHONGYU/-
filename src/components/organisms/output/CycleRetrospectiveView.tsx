/**
 * @fileoverview 周期复盘可视化组件
 *
 * 渲染 CycleRetrospectiveReport 三大区块：
 * 1. 准确率仪表盘 — directionAccuracy / rangeAccuracy 环形进度（纯 inline SVG）
 * 2. 因子 IC/IR 排名表 — IC、IR、命中率、状态（颜色徽章）
 * 3. 权重调整建议 — 当前 vs 建议权重 + 升降箭头
 *
 * 仅依赖 Tailwind CSS + 项目内类型，无外部图表库。
 *
 * @module components/organisms/output/CycleRetrospectiveView
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033]
 */

import { memo } from 'react'
import type {
  CycleRetrospectiveReport,
  FactorEffectiveness,
  FactorICStat,
  MarketCycle,
} from '@/types/modules/prediction.types'
import { THEME_TOKENS, twBg, twText } from '@/constants/theme.tokens'

// ============================================================
// 常量与样式映射
// ============================================================

/** 市场周期中文标签 */
const CYCLE_LABELS: Record<MarketCycle, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

/** 因子有效性状态 -> 徽章样式 + 中文标签 */
const STATUS_BADGE: Record<FactorEffectiveness, { label: string; className: string }> = {
  effective: { label: '有效', className: `${twBg('green', 100)} ${twText('green', 700)} dark:${twBg('green', 900)}/40 dark:${twText('green', 300)}` },
  weakening: { label: '衰减', className: `${twBg('amber', 100)} ${twText('amber', 700)} dark:${twBg('amber', 900)}/40 dark:${twText('amber', 300)}` },
  ineffective: { label: '失效', className: `${twBg('red', 100)} ${twText('red', 700)} dark:${twBg('red', 900)}/40 dark:${twText('red', 300)}` },
}

/** 按准确率值选取环形进度颜色 */
function accuracyColor(value: number): string {
  if (value >= 0.6) return THEME_TOKENS.color.successRaw
  if (value >= 0.4) return THEME_TOKENS.color.warningRaw
  return THEME_TOKENS.color.dangerRaw
}

/** 权重升降箭头方向 */
type ArrowDirection = 'up' | 'down' | 'flat'

function weightArrow(current: number, suggested: number): ArrowDirection {
  if (suggested > current) return 'up'
  if (suggested < current) return 'down'
  return 'flat'
}

// ============================================================
// 准确率环形仪表
// ============================================================

interface AccuracyGaugeProps {
  /** 准确率，0-1 */
  value: number
  /** 仪表盘标题 */
  label: string
}

/** 单个环形进度仪表（inline SVG，无外部依赖） */
function AccuracyGauge({ value, label }: AccuracyGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)
  const percent = (clamped * 100).toFixed(1)
  const color = accuracyColor(clamped)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${label} ${(percent)}%`}>
          {/* 背景轨道 */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* 进度环 */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">{percent}%</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

// ============================================================
// 因子 IC/IR 排名表
// ============================================================

interface FactorICTableProps {
  factorICs: ReadonlyArray<FactorICStat>
}

function FactorICTable({ factorICs }: FactorICTableProps) {
  if (factorICs.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无因子 IC 数据</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">因子</th>
            <th className="py-2 pr-4 font-medium">IC</th>
            <th className="py-2 pr-4 font-medium">IR</th>
            <th className="py-2 pr-4 font-medium">命中率</th>
            <th className="py-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          {factorICs.map((stat) => {
            const badge = STATUS_BADGE[stat.status]
            return (
              <tr key={stat.factorId} className="border-b last:border-0" data-testid="factor-ic-row">
                <td className="py-2 pr-4">
                  <div className="font-medium">{stat.factorName}</div>
                  <div className="text-xs text-muted-foreground">{stat.factorId}</div>
                </td>
                <td className="py-2 pr-4 tabular-nums">{stat.ic.toFixed(3)}</td>
                <td className="py-2 pr-4 tabular-nums">{stat.ir.toFixed(3)}</td>
                <td className="py-2 pr-4 tabular-nums">{(stat.hitRate * 100).toFixed(0)}%</td>
                <td className="py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// 权重调整建议表
// ============================================================

interface WeightAdjustmentTableProps {
  adjustments: CycleRetrospectiveReport['weightAdjustments']
}

function WeightAdjustmentTable({ adjustments }: WeightAdjustmentTableProps) {
  if (adjustments.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无权重调整建议</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">因子</th>
            <th className="py-2 pr-4 font-medium">当前权重</th>
            <th className="py-2 pr-4 font-medium">建议权重</th>
            <th className="py-2 pr-4 font-medium">调整</th>
            <th className="py-2 font-medium">理由</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((adj) => {
            const dir = weightArrow(adj.currentWeight, adj.suggestedWeight)
            const arrow =
              dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
            const arrowLabel = dir === 'up' ? '上调' : dir === 'down' ? '下调' : '持平'
            const arrowColor =
              dir === 'up'
                ? `${twText('green', 600)} dark:${twText('green', 400)}`
                : dir === 'down'
                  ? `${twText('red', 600)} dark:${twText('red', 400)}`
                  : 'text-muted-foreground'
            return (
              <tr key={adj.factorId} className="border-b last:border-0" data-testid="weight-adj-row">
                <td className="py-2 pr-4">
                  <div className="font-medium">{adj.factorName}</div>
                  <div className="text-xs text-muted-foreground">{adj.factorId}</div>
                </td>
                <td className="py-2 pr-4 tabular-nums">{adj.currentWeight.toFixed(2)}</td>
                <td className="py-2 pr-4 tabular-nums">{adj.suggestedWeight.toFixed(2)}</td>
                <td className={`py-2 pr-4 font-semibold ${arrowColor}`} aria-label={arrowLabel}>
                  {arrow}
                </td>
                <td className="py-2 text-xs text-muted-foreground">{adj.reason}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

interface CycleRetrospectiveViewProps {
  /** 周期复盘报告 */
  report: CycleRetrospectiveReport
}

/**
 * 周期复盘可视化组件。
 *
 * 三区块布局：准确率仪表盘 / 因子 IC/IR 排名表 / 权重调整建议表。
 */
export const CycleRetrospectiveView = memo(function CycleRetrospectiveView({
  report,
}: CycleRetrospectiveViewProps) {
  const { period, marketCycle, totalPredictions, directionAccuracy, rangeAccuracy, factorICs, weightAdjustments, generatedAt } = report

  return (
    <div className="space-y-6">
      {/* 报告头 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">周期复盘报告 — {period}</h3>
          <p className="text-xs text-muted-foreground">
            市场周期：{CYCLE_LABELS[marketCycle]} · 总预测数：{totalPredictions}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">生成于 {generatedAt}</span>
      </div>

      {/* 一、准确率仪表盘 */}
      <section className="rounded-lg border p-4" data-testid="accuracy-dashboard">
        <h4 className="mb-4 text-sm font-medium">准确率仪表盘</h4>
        <div className="flex flex-wrap items-center justify-around gap-6">
          <AccuracyGauge value={directionAccuracy} label="方向准确率" />
          <AccuracyGauge value={rangeAccuracy} label="幅度准确率" />
        </div>
      </section>

      {/* 二、因子 IC/IR 排名表 */}
      <section className="rounded-lg border p-4" data-testid="factor-ic-table">
        <h4 className="mb-4 text-sm font-medium">因子 IC/IR 排名</h4>
        <FactorICTable factorICs={factorICs} />
      </section>

      {/* 三、权重调整建议 */}
      <section className="rounded-lg border p-4" data-testid="weight-adjustment-table">
        <h4 className="mb-4 text-sm font-medium">权重调整建议</h4>
        <WeightAdjustmentTable adjustments={weightAdjustments} />
      </section>
    </div>
  )
})
