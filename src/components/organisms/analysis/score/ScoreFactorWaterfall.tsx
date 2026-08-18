/**
 * @module ScoreFactorWaterfall
 * @description V6 评分因子贡献瀑布图组件。
 * - 数据只读：优先 V6ScoreEngine.audit().factorContributions；audit 缺失时从维度分 DimensionScore[] 派生
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
import { LoadingState } from '@/components/molecules/LoadingState'
import { EmptyState } from '@/components/molecules/EmptyState'
import { ErrorState } from '@/components/molecules/states/ErrorState'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { FactorContribution, ScoreAuditTrail } from '@/services/scoring/v6-engine'
import type { DimensionScore } from '@/data/types'

// ============================================================
// Types
// ============================================================

export interface ScoreFactorWaterfallProps {
  /** V6ScoreEngine.audit() 输出；组件只读，优先级高于 dimensionScores */
  audit?: ScoreAuditTrail | null
  /** 评分维度分（DimensionScore[]）；当 audit 缺失时，从维度分派生瀑布 */
  dimensionScores?: DimensionScore[]
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
  dimensionInfo?: { score: number; weight: number }
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

/**
 * 当 audit 缺失时，从评分维度分（DimensionScore[]）派生瀑布数据。
 * 每个维度贡献 = score * weight，终点为各维度加权得分之和。
 */
function buildWaterfallFromDimensions(dimensions: DimensionScore[]): WaterfallRow[] {
  const valid = dimensions.filter(
    (d) => typeof d.score === 'number' && Number.isFinite(d.score),
  )
  if (valid.length === 0) return []

  const rows: WaterfallRow[] = []
  let cumulative = 0
  for (const d of valid) {
    const score = d.score as number
    const value = score * d.weight
    rows.push({
      label: d.name,
      base: cumulative,
      value,
      isTotal: false,
      dimensionInfo: { score, weight: d.weight },
    })
    cumulative += value
  }

  rows.push({
    label: '维度加权总分',
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
  if (!active || !payload || payload.length === 0) return <></>

  const row = payload[0]?.payload
  if (!row) return <></>
  if (row.isTotal) {
    return (
      <div className="rounded-md border p-2 shadow-sm text-xs bg-muted">
        <div className="font-medium">{row.label}</div>
        <div className="text-muted-foreground">{formatScore(row.value)}</div>
      </div>
    )
  }

  const c = row.contribution
  if (!c) {
    if (row.dimensionInfo) {
      const { score, weight } = row.dimensionInfo
      return (
        <div className="rounded-md border p-2 shadow-sm text-xs space-y-1 bg-muted">
          <div className="font-medium">{row.label}</div>
          <div className="text-muted-foreground">维度得分: {score.toFixed(2)}</div>
          <div className="text-muted-foreground">权重: {formatPercent(weight)}</div>
          <div className="text-muted-foreground">
            加权贡献: {score.toFixed(2)} × {formatPercent(weight)} = {(score * weight).toFixed(3)}
          </div>
        </div>
      )
    }
    return <></>
  }

  return (
    <div className="rounded-md border p-2 shadow-sm text-xs space-y-1 bg-muted">
      <div className="font-medium">{c.label}</div>
      <div className="text-muted-foreground">原始得分: {c.score.toFixed(2)}</div>
      <div className="text-muted-foreground">权重: {formatPercent(c.normalizedWeight)}</div>
      <div className={c.signedContribution >= 0 ? 'text-success' : 'text-destructive'}>
        {c.signedContribution >= 0 ? '正向贡献' : '负向贡献'}: {c.signedContribution >= 0 ? '+' : ''}
        {c.signedContribution.toFixed(2)} 分
      </div>
      <div className="text-muted-foreground">绝对贡献: {c.contribution.toFixed(2)} 分 ({formatPercent(c.contributionRate)})</div>
    </div>
  )
}

/**
 * ScoreFactorWaterfall
 */
export function ScoreFactorWaterfall({
  audit,
  dimensionScores,
  loading = false,
  error = null,
  height = 360,
}: ScoreFactorWaterfallProps) {
  const contributions = useMemo(() => audit?.factorContributions ?? [], [audit?.factorContributions])

  const rows = useMemo(() => {
    if (contributions.length > 0) return buildWaterfallData(contributions)
    if (dimensionScores && dimensionScores.length > 0) return buildWaterfallFromDimensions(dimensionScores)
    return []
  }, [contributions, dimensionScores])

  if (loading) {
    return <LoadingState message="正在计算因子贡献..." />
  }

  if (error) {
    return <ErrorState error={error} variant="card" title="因子贡献加载失败" />
  }

  if ((contributions.length === 0 && (dimensionScores?.length ?? 0) === 0) || rows.length === 0) {
    return <EmptyState title="暂无因子贡献数据" description="请先生成或刷新 V6 评分" />
  }

  return (
    <div className="space-y-4" data-testid="score-factor-waterfall">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
