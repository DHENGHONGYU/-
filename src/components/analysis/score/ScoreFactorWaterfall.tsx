/**
 * @module ScoreFactorWaterfall
 * @description V6 评分因子贡献瀑布图组件。
 * - 数据只读来自 V6ScoreEngine.audit().factorContributions
 * - 零硬编码：颜色、阈值均来自主题令牌与引擎配置
 * - 处理 loading / empty / data 三态
 */

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { COLOR_TOKENS, twText } from '@/constants/theme.tokens'
import type { FactorContribution, ScoreAuditTrail } from '@/services/scoring/v6-engine'

// ============================================================
// Types
// ============================================================

export interface ScoreFactorWaterfallProps {
  /** V6ScoreEngine.audit() 输出；组件只读 */
  audit?: ScoreAuditTrail | null
  /** 加载态 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 图表高度 */
  height?: number
}

interface WaterfallRow {
  label: string
  base: number
  value: number
  isTotal: boolean
  contribution?: FactorContribution
}

// ============================================================
// Helpers
// ============================================================

function getScale(contribution: FactorContribution): number {
  const denominator = contribution.score * contribution.normalizedWeight
  return denominator > 0 ? contribution.contribution / denominator : 20
}

function buildWaterfallData(contributions: FactorContribution[]): WaterfallRow[] {
  if (contributions.length === 0) return []

  const firstContribution = contributions[0]
  if (!firstContribution) return []

  const scale = getScale(firstContribution)
  const start = firstContribution.baseline * scale

  const rows: WaterfallRow[] = []
  let cumulative = start

  for (const c of contributions) {
    const base = cumulative
    const value = c.signedContribution
    rows.push({
      label: c.label,
      base,
      value,
      isTotal: false,
      contribution: c,
    })
    cumulative += value
  }

  rows.push({
    label: '综合得分',
    base: 0,
    value: cumulative,
    isTotal: true,
  })

  return rows
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatScore(value: number): string {
  return `${value.toFixed(1)} 分`
}

// ============================================================
// Components
// ============================================================

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: WaterfallRow }> }) {
  if (!active || !payload || payload.length === 0) return null

  const row = payload[0]?.payload
  if (!row) return null
  if (row.isTotal) {
    return (
      <div className="rounded-md border bg-white p-2 shadow-sm text-xs">
        <div className="font-medium">{row.label}</div>
        <div className={twText('slate', 600)}>{formatScore(row.value)}</div>
      </div>
    )
  }

  const c = row.contribution
  if (!c) return null

  return (
    <div className="rounded-md border bg-neutral-50 p-2 shadow-sm text-xs space-y-1">
      <div className="font-medium">{c.label}</div>
      <div className={twText('slate', 600)}>原始得分: {c.score.toFixed(2)}</div>
      <div className={twText('slate', 600)}>权重: {formatPercent(c.normalizedWeight)}</div>
      <div className={c.signedContribution >= 0 ? twText('green', 600) : twText('red', 600)}>
        {c.signedContribution >= 0 ? '正向贡献' : '负向贡献'}: {c.signedContribution >= 0 ? '+' : ''}
        {c.signedContribution.toFixed(2)} 分
      </div>
      <div className={twText('slate', 600)}>绝对贡献: {c.contribution.toFixed(2)} 分 ({formatPercent(c.contributionRate)})</div>
    </div>
  )
}

export function ScoreFactorWaterfall({
  audit,
  loading = false,
  error = null,
  height = 360,
}: ScoreFactorWaterfallProps) {
  const contributions = audit?.factorContributions ?? []

  const rows = useMemo(() => {
    return buildWaterfallData(contributions)
  }, [contributions])

  if (loading) {
    return <LoadingState message="正在计算因子贡献..." />
  }

  if (error) {
    return <ErrorState error={error} variant="card" title="因子贡献加载失败" />
  }

  if (contributions.length === 0 || rows.length === 0) {
    return <EmptyState title="暂无因子贡献数据" description="请先生成或刷新 V6 评分" />
  }

  return (
    <div className="space-y-4" data-testid="score-factor-waterfall">
      <div className={`flex flex-wrap items-center gap-4 text-xs ${twText('slate', 600)}`}>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_TOKENS.success.hex }} />
          <span>正向贡献</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_TOKENS.danger.hex }} />
          <span>负向贡献</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_TOKENS.info.hex }} />
          <span>综合得分</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 64, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_TOKENS.border.hex} vertical={false} />
          <XAxis
            dataKey="label"
            angle={-30}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fill: COLOR_TOKENS.textSecondary.hex, fontSize: 11 }}
            axisLine={{ stroke: COLOR_TOKENS.border.hex }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: COLOR_TOKENS.textSecondary.hex, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: '得分', angle: -90, position: 'insideLeft', fill: COLOR_TOKENS.textSecondary.hex, fontSize: 11 }}
          />
          <Tooltip content={WaterfallTooltip as never} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="waterfall" isAnimationActive={false}>
            {rows.map((row, index) => {
              if (row.isTotal) {
                return <Cell key={`cell-${index}`} fill={COLOR_TOKENS.info.hex} />
              }
              const isPositive = (row.value ?? 0) >= 0
              return <Cell key={`cell-${index}`} fill={isPositive ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ScoreFactorWaterfall
