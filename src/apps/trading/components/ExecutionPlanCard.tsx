import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { PhaseStepper } from './PhaseStepper'
import type { ExecutionPlan, ExecutionPhase, RiskCheckItem } from '@/data/types'
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, Info } from 'lucide-react'
import { COLOR_SHADES } from '@/constants/theme.tokens'

export interface ExecutionPlanCardProps {
  plan: ExecutionPlan
  onConfirm?: (planId: string) => void
  onExecute?: (planId: string) => void
  onCancel?: (planId: string) => void
  onReview?: (planId: string) => void
}

const PHASE_BADGE_COLORS: Record<ExecutionPhase, string> = {
  plan: 'bg-info/10 text-info',
  confirmed: 'bg-info/10 text-info',
  pending: 'bg-warning/10 text-warning',
  executed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
  reviewed: 'bg-info/10 text-info',
}

const PHASE_LABELS: Record<ExecutionPhase, string> = {
  plan: '计划',
  confirmed: '已确认',
  pending: '执行中',
  executed: '已执行',
  cancelled: '已取消',
  reviewed: '已复盘',
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

function getStepperPhase(plan: ExecutionPlan): ExecutionPhase {
  if (plan.phase !== 'cancelled') return plan.phase
  // 根据时间戳推断取消前最后到达的阶段
  if ((plan.executedAt ?? 0) > 0) return 'pending'
  if ((plan.confirmedAt ?? 0) > 0) return 'confirmed'
  return 'plan'
}

export function ExecutionPlanCard({
  plan,
  onConfirm,
  onExecute,
  onCancel,
  onReview,
}: ExecutionPlanCardProps): React.JSX.Element {
  const [riskExpanded, setRiskExpanded] = useState(false)

  const directionLabel = plan.direction === 'buy' ? '买入' : '卖出'
  const directionClass =
    plan.direction === 'buy'
      ? `${COLOR_SHADES.green[100]} ${COLOR_SHADES.green[800]}`
      : `${COLOR_SHADES.red[100]} ${COLOR_SHADES.red[800]}`

  const phaseClass = PHASE_BADGE_COLORS[plan.phase]
  const stepperPhase = getStepperPhase(plan)
  const isCancelled = plan.phase === 'cancelled'

  // 操作按钮可见性
  const canConfirm = plan.phase === 'plan' && !!onConfirm
  const canExecute = (plan.phase === 'plan' || plan.phase === 'confirmed') && !!onExecute
  const canCancel =
    (plan.phase === 'plan' || plan.phase === 'confirmed' || plan.phase === 'pending') && !!onCancel
  const canReview =
    (plan.phase === 'executed' || plan.phase === 'cancelled') && !!onReview

  const riskChecks = plan.risk?.checks ?? []

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-sm">{plan.symbol}</span>
            <Badge className={cn(directionClass)}>{directionLabel}</Badge>
            <Badge className={cn(phaseClass)}>{PHASE_LABELS[plan.phase]}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            置信度 {(plan.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* 状态机步骤条 */}
        <PhaseStepper
          phase={stepperPhase}
          cancelled={isCancelled}
          result={plan.result}
        />

        {/* 详情区 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">数量 / 仓位</p>
            <p className="font-medium">
              {plan.sizing ? `${plan.sizing.quantity}股 / ${(plan.sizing.positionPct * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">风控检查</p>
            <div className="flex items-center gap-1 font-medium">
              {plan.risk ? (
                <>
                  {plan.risk.passed ? (
                    <ShieldCheck className={`h-3.5 w-3.5 ${COLOR_SHADES.green[600]}`} />
                  ) : (
                    <ShieldAlert className={`h-3.5 w-3.5 ${COLOR_SHADES.red[600]}`} />
                  )}
                  <span className={plan.risk.passed ? COLOR_SHADES.green[700] : COLOR_SHADES.red[700]}>
                    {plan.risk.passed ? '通过' : '未通过'}
                  </span>
                  <span className="text-muted-foreground">({plan.risk.checks.length}项)</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">订单号</p>
            <p className="font-medium truncate">{plan.orderId ?? '—'}</p>
          </div>
        </div>

        {/* 风控明细可展开 */}
        {riskChecks.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setRiskExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {riskExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              风控明细 ({riskChecks.length}项)
            </button>
            {riskExpanded && (
              <div className="mt-2 space-y-1.5">
                {riskChecks.map((check: RiskCheckItem, idx: number) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs',
                      check.severity === 'blocker' && 'bg-destructive/10 bg-destructive/20 text-destructive',
                      check.severity === 'warning' && 'bg-warning/10 bg-warning/20 text-warning',
                      check.severity === 'info' && 'bg-muted/50 bg-muted text-muted-foreground'
                    )}
                  >
                    {check.severity === 'blocker' && <ShieldAlert className={`h-3.5 w-3.5 ${COLOR_SHADES.red[600]} mt-0.5 shrink-0`} />}
                    {check.severity === 'warning' && <ShieldCheck className={`h-3.5 w-3.5 ${COLOR_SHADES.yellow[600]} mt-0.5 shrink-0`} />}
                    {check.severity === 'info' && <Info className={`h-3.5 w-3.5 ${COLOR_SHADES.gray[500]} mt-0.5 shrink-0`} />}
                    <div>
                      <span className="font-medium">{check.name}:</span>{' '}
                      <span>{check.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {(plan.errorMessage ?? '') !== '' && (
          <p className={`text-xs ${COLOR_SHADES.red[600]} ${COLOR_SHADES.red[50]} rounded-md px-2 py-1.5 border ${COLOR_SHADES.red[200]}`}>
            {plan.errorMessage}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button size="sm" onClick={() => onConfirm?.(plan.id)}>
              确认
            </Button>
          )}
          {canExecute && (
            <Button size="sm" onClick={() => onExecute?.(plan.id)}>
              执行
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => onCancel?.(plan.id)}>
              取消
            </Button>
          )}
          {canReview && (
            <Button variant="secondary" size="sm" onClick={() => onReview?.(plan.id)}>
              复盘
            </Button>
          )}
        </div>

        {/* 底部时间 */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
          <span>创建于 {formatRelativeTime(plan.createdAt)}</span>
          {plan.accountType && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {plan.accountType === 'paper' ? '模拟盘' : plan.accountType === 'real' ? '实盘' : plan.accountType}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
