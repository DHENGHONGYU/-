import React from 'react'
import { cn } from '@/lib/utils'
import type { ExecutionPhase } from '@/data/types'
import { Loader2 } from 'lucide-react'
import { COLOR_SHADES, twBg, twText, twBorder } from '@/constants/theme.tokens'

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

const PHASE_COLORS: Record<ExecutionPhase, { bg: string; text: string; border: string }> = {
  plan: { bg: twBg('blue', 500), text: twText('blue', 500), border: twBorder('blue', 500) },
  confirmed: { bg: twBg('blue', 500), text: twText('blue', 500), border: twBorder('blue', 500) },
  pending: { bg: twBg('yellow', 500), text: twText('yellow', 500), border: twBorder('yellow', 500) },
  executed: { bg: twBg('green', 500), text: twText('green', 500), border: twBorder('green', 500) },
  cancelled: { bg: twBg('red', 500), text: twText('red', 500), border: twBorder('red', 500) },
  reviewed: { bg: twBg('purple', 500), text: twText('purple', 500), border: twBorder('purple', 500) },
}

export function PhaseStepper({ phase, cancelled, result }: PhaseStepperProps): React.JSX.Element {
  const currentIndex = PHASES.indexOf(phase)
  const cancelledIndex = PHASES.indexOf('cancelled')

  const isPhaseReached = (index: number): boolean => {
    if (cancelled) {
      // 取消模式下，当前 phase 及之前阶段为已到达，cancelled 本身也为已到达
      if (index === cancelledIndex) return true
      return index <= currentIndex
    }
    return index <= currentIndex
  }

  const isPhaseCurrent = (index: number): boolean => {
    if (cancelled) {
      return PHASES[index] === 'cancelled'
    }
    return index === currentIndex
  }

  const getLineStyle = (index: number): { bg: string; dashed: boolean } => {
    const nextIndex = index + 1
    if (nextIndex >= PHASES.length) return { bg: 'bg-transparent', dashed: false }

    const isNextReached = isPhaseReached(nextIndex)
    const isCurrentReached = isPhaseReached(index)

    // 取消模式下，从当前 phase 到 cancelled 的连线为红色断裂线
    if (cancelled && index === currentIndex && nextIndex === cancelledIndex) {
      return { bg: COLOR_SHADES.red[500], dashed: true }
    }

    // 取消模式下，cancelled 之后的连线灰色
    if (cancelled && index >= cancelledIndex) {
      return { bg: twBg('gray', 200), dashed: false }
    }

    if (isCurrentReached && isNextReached) {
      return { bg: COLOR_SHADES.blue[500], dashed: false }
    }

    return { bg: twBg('gray', 200), dashed: false }
  }

  return (
    <div className="flex items-center justify-between w-full">
      {PHASES.map((p, index) => {
        const reached = isPhaseReached(index)
        const current = isPhaseCurrent(index)
        const colors = PHASE_COLORS[p]!
        const lineStyle = getLineStyle(index)
        const isPendingSpinner = p === 'pending' && current && !cancelled

        return (
          <React.Fragment key={p}>
            {/* 节点 */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  'relative flex items-center justify-center rounded-full border-2 transition-colors',
                  'w-6 h-6',
                  reached || current
                    ? `${colors.bg} ${colors.border} text-white`
                    : `${twBg('slate', 50)} ${twBorder('slate', 300)} ${twText('slate', 400)}`,
                  current && !cancelled && 'ring-2 ring-offset-1',
                  current && !cancelled && colors.border.replace('border-', 'ring-')
                )}
              >
                {isPendingSpinner ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="text-[10px] font-bold">{index + 1}</span>
                )}

                {/* 结果指示器 */}
                {p === 'executed' && reached && result && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full border border-white',
                      result === 'success' && COLOR_SHADES.green[600],
                      result === 'failed' && COLOR_SHADES.red[600],
                      result === 'partial' && COLOR_SHADES.yellow[600]
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  reached || current ? colors.text : twText('gray', 400)
                )}
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
                    lineStyle.bg,
                    lineStyle.dashed && `bg-transparent border-t-2 border-dashed ${COLOR_SHADES.red[500]}`
                  )}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
