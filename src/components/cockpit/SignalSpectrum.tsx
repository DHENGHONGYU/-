/**
 * @fileoverview P2 签名视觉锚点：信号强度谱（SignalSpectrum）
 *
 * 全局统一的「信号强度」母题，将 0-100 的评分/信号强度映射为
 * 弱(琥珀) → 中(蓝) → 强(翠绿) 的连续谱，并标注当前位置。
 * 纯展示组件，全部引用令牌，无硬编码颜色。
 *
 * @module components/cockpit/SignalSpectrum
 */
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

export interface SignalSpectrumProps extends HTMLAttributes<HTMLDivElement> {
  /** 信号强度 0-100 */
  value: number
  /** 标签文案 */
  label?: string
  /** 是否显示数值 */
  showValue?: boolean
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = {
  sm: { track: 'h-1.5', text: THEME_TOKENS.typography.fontSize.xs },
  md: { track: 'h-2.5', text: THEME_TOKENS.typography.fontSize.sm },
  lg: { track: 'h-3.5', text: THEME_TOKENS.typography.fontSize.base },
} as const

/**
 * SignalSpectrum
 */
export function SignalSpectrum({
  value,
  label,
  showValue = true,
  size = 'md',
  className,
  ...props
}: SignalSpectrumProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const gradient = `linear-gradient(to right, ${COLOR_TOKENS.warning.hex} 0%, ${COLOR_TOKENS.info.hex} 50%, ${COLOR_TOKENS.emerald.hex} 100%)`

  return (
    <div className={cn('flex w-full flex-col', THEME_TOKENS.gap.xs, className)} {...props}>
      {(label ?? showValue) && (
        <div
          className={cn(
            'flex items-center justify-between',
            SIZE_MAP[size].text,
            THEME_TOKENS.typography.fontWeight.medium,
          )}
        >
          {label && <span className={COLOR_TOKENS.textMuted.tailwind}>{label}</span>}
          {showValue && (
            <span className={COLOR_TOKENS.emerald.tailwind}>{Math.round(clamped)}</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'relative w-full',
          THEME_TOKENS.radius.full,
          THEME_TOKENS.color.mutedBackground,
          SIZE_MAP[size].track,
        )}
      >
        <div
          className={cn('absolute inset-y-0 left-0', THEME_TOKENS.radius.full)}
          style={{ width: `${clamped}%`, background: gradient }}
        />
        <div
          className={cn(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow',
            THEME_TOKENS.radius.full,
            SIZE_MAP[size].track,
          )}
          style={{ left: `${clamped}%`, background: COLOR_TOKENS.emerald.hex }}
        />
      </div>
    </div>
  )
}

export default SignalSpectrum
