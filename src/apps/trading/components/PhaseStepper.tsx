import React from 'react'
import { cn } from '@/lib/utils'
import type { ExecutionPhase } from '@/types'
import { Loader2 } from 'lucide-react'

export interface PhaseStepperProps {
  phase: ExecutionPhase
  cancelled?: boolean
  result?: 'success' | 'failed' | 'partial'
}

const PHASES: ExecutionPhase[] = ['plan', 'confirmed', 'pending', 'executed', 'cancelled', 'reviewed']

const PHASE_LABELS: Record<ExecutionPhase, string> = {
  plan: '计划',
  confirmed: '确认',
  pending: '执行中',
  executed: '已执行',
  cancelled: '已取消',
  reviewed: '已复盘',
}

/** 阶段语义色映射 — 全部使用 CSS 变量，主题感知 */
const PHASE_STYLES: Record<ExecutionPhase, { bg: string; text: string; border: string }> = {
  plan: { bg: 'hsl(var(--info))', text: 'hsl(var(--info))', border: 'hsl(var(--info))' },
  confirmed: { bg: 'hsl(var(--info))', text: 'hsl(var(--info))', border: 'hsl(var(--info))' },
  pending: { bg: 'hsl(var(--warning))', text: 'hsl(var(--warning))', border: 'hsl(var(--warning))' },
  executed: { bg: 'hsl(var(--success))', text: 'hsl(var(--success))', border: 'hsl(var(--success))' },
  cancelled: { bg: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))', border: 'hsl(var(--destructive))' },
  reviewed: { bg: 'hsl(var(--primary))', text: 'hsl(var(--primary))', border: 'hsl(var(--primary))' },
}

export function PhaseStepper({ phase, cancelled, result }: PhaseStepperProps): React.JSX.Element {
  const currentIndex = PHASES.indexOf(phase)
  const cancelledIndex = PHASES.indexOf('cancelled')

  const isPhaseReached = (index: number): boolean =>
    (cancelled ?? false) === true
      ? index === cancelledIndex || index <= currentIndex
      : index <= currentIndex

  const isPhaseCurrent = (index: number): boolean => {
    if ((cancelled ?? false) === true) {
      return PHASES[index] === 'cancelled'
    }
    return index === currentIndex
  }

  const getLineStyle = (index: number): { bg: string; dashed: boolean } => {
    const nextIndex = index + 1
    if (nextIndex >= PHASES.length) return { bg: 'transparent', dashed: false }

    const isNextReached = isPhaseReached(nextIndex)
    const isCurrentReached = isPhaseReached(index)

    if ((cancelled ?? false) === true && index === currentIndex && nextIndex === cancelledIndex) {
      return { bg: 'hsl(var(--destructive))', dashed: true }
    }

    if ((cancelled ?? false) === true && index >= cancelledIndex) {
      return { bg: 'hsl(var(--divider))', dashed: false }
    }

    if (isCurrentReached && isNextReached) {
      return { bg: 'hsl(var(--info))', dashed: false }
    }

    return { bg: 'hsl(var(--divider))', dashed: false }
  }

  return (
    <div className="flex items-center justify-between w-full">
      {PHASES.map((p, index) => {
        const reached = isPhaseReached(index)
        const current = isPhaseCurrent(index)
        const styles = PHASE_STYLES[p]
        const lineStyle = getLineStyle(index)
        const isPendingSpinner = p === 'pending' && current && (cancelled ?? false) !== true

        return (
          <React.Fragment key={p}>
            {/* 节点 */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  'relative flex items-center justify-center rounded-full border-2 transition-colors',
                  'w-6 h-6',
                )}
                style={
                  reached || current
                    ? { backgroundColor: styles.bg, borderColor: styles.border, color: 'white' }
                    : { backgroundColor: 'hsl(var(--muted))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                }
              >
                {isPendingSpinner ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="text-[10px] font-bold">{index + 1}</span>
                )}

                {/* 结果指示器 */}
                {p === 'executed' && reached && result && (
                  <span
                    className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full border border-white"
                    style={{
                      backgroundColor:
                        result === 'success'
                          ? 'hsl(var(--success))'
                          : result === 'failed'
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--warning))',
                    }}
                  />
                )}
              </div>
              <span
                className="text-[10px] font-medium whitespace-nowrap"
                style={{ color: reached || current ? styles.text : 'hsl(var(--muted-foreground))' }}
              >
                {PHASE_LABELS[p]}
              </span>
            </div>

            {/* 连接线 */}
            {index < PHASES.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 relative">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full',
                    lineStyle.dashed && 'bg-transparent border-t-2 border-dashed',
                  )}
                  style={
                    lineStyle.dashed
                      ? { borderColor: lineStyle.bg }
                      : { backgroundColor: lineStyle.bg }
                  }
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
