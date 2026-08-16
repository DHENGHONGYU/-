import React from 'react'

interface CurrencyProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 金额数值 */
  value: number
  /** 货币符号，默认 ¥ */
  symbol?: string
  /** 小数位数，默认 2 */
  decimals?: number
  /** 是否显示正负号，默认 true */
  showSign?: boolean
  /** 是否使用紧凑模式（万/亿），默认 false */
  compact?: boolean
}

/**
 * 货币金额格式化组件
 * - 自动千分位分隔
 * - 正数显示 + 号
 * - 支持紧凑模式（万/亿）
 */
export const Currency = React.forwardRef<HTMLSpanElement, CurrencyProps>((
  {
    value,
    symbol = '¥',
    decimals = 2,
    showSign = true,
    compact = false,
    className = '',
    ...rest
  },
  ref
) => {
  const absValue = Math.abs(value)
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''

  let display: string
  if (compact) {
    if (absValue >= 1e8) {
      display = `${(absValue / 1e8).toFixed(decimals)}亿`
    } else if (absValue >= 1e4) {
      display = `${(absValue / 1e4).toFixed(decimals)}万`
    } else {
      display = absValue.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }
  } else {
    display = absValue.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  return (
    <span className={className} ref={ref} {...rest}>
      {showSign && sign}{symbol}{display}
    </span>
  )
})

Currency.displayName = 'Currency'