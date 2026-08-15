/**
 * @fileoverview 交易摘要卡片组件
 *
 * 商务风格：左侧色条 + 充足留白，去除背景色块与角标 Badge。
 * 面向专业投资者，数字突出但克制。
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'

interface TradeReviewSummaryProps {
  totalTrades: number
  winRate: number
  profitLossRatio: number
  disciplineScore: number
  loading?: boolean
}

/** 指标等级：优秀 / 良好 / 待改进 */
interface MetricTone {
  label: string
  barClass: string
  textClass: string
}

/** 胜率基准：>=50% 优秀，>=40% 良好，否则待改进 */
function winRateTone(v: number): MetricTone {
  if (v >= 50) return { label: '优秀', barClass: 'bg-success', textClass: 'text-success' }
  if (v >= 40) return { label: '良好', barClass: 'bg-warning', textClass: 'text-warning' }
  return { label: '待改进', barClass: 'bg-destructive', textClass: 'text-destructive' }
}

/** 盈亏比基准：>=1.5 优秀，>=1.0 良好，否则待改进 */
function plRatioTone(v: number): MetricTone {
  if (v >= 1.5) return { label: '优秀', barClass: 'bg-success', textClass: 'text-success' }
  if (v >= 1.0) return { label: '良好', barClass: 'bg-warning', textClass: 'text-warning' }
  return { label: '待改进', barClass: 'bg-destructive', textClass: 'text-destructive' }
}

/** 纪律评分基准：>=70 优秀，>=50 良好，否则待改进（0-100 制） */
function disciplineTone(v: number): MetricTone {
  if (v >= 70) return { label: '优秀', barClass: 'bg-success', textClass: 'text-success' }
  if (v >= 50) return { label: '良好', barClass: 'bg-warning', textClass: 'text-warning' }
  return { label: '待改进', barClass: 'bg-destructive', textClass: 'text-destructive' }
}

function MetricCell({
  label,
  value,
  suffix,
  tone,
  loading,
}: {
  label: string
  value: string
  suffix?: string
  tone?: MetricTone
  loading?: boolean
}): React.JSX.Element {
  return (
    <div className="relative pl-3">
      {/* 左侧色条：商务风的克制强调 */}
      {tone && !loading && (
        <span className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${tone.barClass}`} />
      )}
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-h1 font-semibold tabular-nums tracking-tight">
          {loading === true ? '—' : value}
        </span>
        {suffix && !loading && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
        {tone && !loading && (
          <span className={`ml-auto text-xs font-medium ${tone.textClass}`}>{tone.label}</span>
        )}
      </div>
    </div>
  )
}

export function TradeReviewSummary({
  totalTrades,
  winRate,
  profitLossRatio,
  disciplineScore,
  loading,
}: TradeReviewSummaryProps): React.JSX.Element {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">交易摘要</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell
            label="总交易笔数"
            value={String(totalTrades)}
            loading={loading}
          />
          <MetricCell
            label="胜率"
            value={winRate.toFixed(1)}
            suffix="%"
            tone={winRateTone(winRate)}
            loading={loading}
          />
          <MetricCell
            label="盈亏比"
            value={profitLossRatio.toFixed(2)}
            tone={plRatioTone(profitLossRatio)}
            loading={loading}
          />
          <MetricCell
            label="纪律评分"
            value={disciplineScore.toFixed(1)}
            tone={disciplineTone(disciplineScore)}
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  )
}
