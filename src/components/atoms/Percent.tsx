import React from 'react'

interface PercentProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 百分比数值（如 5.2 表示 5.2%） */
  value: number
  /** 小数位数，默认 2 */
  decimals?: number
  /** 是否显示正负号，默认 true */
  showSign?: boolean
  /** 是否根据正负自动着色，默认 true */
  colored?: boolean
}

/**
 * 百分比格式化组件
 * - 自动着色：正数 var(--stock-up) 红色，负数 var(--stock-down) 绿色
 * - 正数显示 + 号
 */
export const Percent = React.forwardRef<HTMLSpanElement, PercentProps>((
  {
    value,
    decimals = 2,
    showSign = true,
    colored = true,
    className = '',
    ...rest
  },
  ref
) => {
  if (value === undefined || value === null || isNaN(value)) {
    return <span className={className} ref={ref} {...rest}>--</span>
  }

  const sign = showSign
    ? value > 0
      ? '+'
      : value < 0
        ? '-'
        : ''
    : value < 0
      ? '-'
      : ''
  const display = `${sign}${Math.abs(value).toFixed(decimals)}%`

  const colorClass = colored
    ? value > 0
      ? 'text-[hsl(var(--stock-up))]'
      : value < 0
        ? 'text-[hsl(var(--stock-down))]'
        : 'text-[hsl(var(--muted-foreground))]'
    : ''

  return (
    <span className={`${colorClass} ${className}`.trim()} ref={ref} {...rest}>
      {display}
    </span>
  )
})

Percent.displayName = 'Percent'