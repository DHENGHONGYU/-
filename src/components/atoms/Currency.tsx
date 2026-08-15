interface CurrencyProps {
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
  /** 自定义 className */
  className?: string
}

/**
 * 货币金额格式化组件
 * - 自动千分位分隔
 * - 正数显示 + 号
 * - 支持紧凑模式（万/亿）
 */
export function Currency({
  value,
  symbol = '¥',
  decimals = 2,
  showSign = true,
  compact = false,
  className = '',
}: CurrencyProps) {
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
    <span className={className}>
      {showSign && sign}{symbol}{display}
    </span>
  )
}