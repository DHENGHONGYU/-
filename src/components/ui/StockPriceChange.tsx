import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  getStockColorHex,
  getStockColorClass,
  getStockColorBg,
} from '@/constants/theme.tokens'

/**
 * 涨跌方向枚举
 * @remarks 与 STOCK_COLOR_TOKENS 的键对应，确保类型安全
 */
export type StockChangeDirection = 'up' | 'down' | 'neutral'

/**
 * StockPriceChange 组件 Props
 * @description 股价涨跌可视化组件，严格遵循 A 股红涨绿跌标准
 * @remarks
 * - 颜色通过 STOCK_COLOR_TOKENS 令牌系统获取，禁止硬编码
 * - 支持 Tailwind 类名模式（className）和 inline style 模式（style）
 * - 未来如需修改涨跌颜色规则，只需修改 theme.tokens.ts 中的 STOCK_COLOR_TOKENS
 */
export interface StockPriceChangeProps {
  /** 涨跌值（正数=上涨，负数=下跌，0=平盘） */
  change: number
  /** 涨跌百分比（用于显示文本，如 3.25 显示为 +3.25%） */
  changePercent?: number
  /** 显示模式：text=文字颜色, bg=背景颜色, both=文字+背景 */
  mode?: 'text' | 'bg' | 'both'
  /** 是否显示涨跌图标 */
  showIcon?: boolean
  /** 图标尺寸（默认 h-4 w-4） */
  iconSize?: string
  /** 小数位数（默认 2） */
  decimals?: number
  /** 是否显示正号（默认 true） */
  showPlus?: boolean
  /** 自定义 className（会与涨跌颜色类合并） */
  className?: string
  /** 自定义 style（会与涨跌颜色 style 合并） */
  style?: React.CSSProperties
  /** 子元素（如果不传，则显示格式化后的涨跌幅文本） */
  children?: React.ReactNode
}

/**
 * 股价涨跌可视化组件
 * @description 动态显示股价涨跌，红涨绿跌（A股标准），颜色通过令牌系统获取
 *
 * @example
 * // 基础用法：显示涨跌幅文字
 * <StockPriceChange change={3.25} />
 * // 输出: <span class="text-red-500">+3.25%</span>
 *
 * @example
 * // 带图标
 * <StockPriceChange change={-1.80} showIcon />
 * // 输出: <span class="text-green-500"><TrendingDown /> -1.80%</span>
 *
 * @example
 * // 背景模式
 * <StockPriceChange change={0} mode="bg" className="px-2 py-1 rounded">
 *   平盘
 * </StockPriceChange>
 *
 * @example
 * // 自定义内容
 * <StockPriceChange change={5.0}>
 *   <Badge>涨停</Badge>
 * </StockPriceChange>
 */
export function StockPriceChange({
  change,
  changePercent,
  mode = 'text',
  showIcon = false,
  iconSize = 'h-4 w-4',
  decimals = 2,
  showPlus = true,
  className,
  style,
  children,
}: StockPriceChangeProps): React.JSX.Element {
  // 涨跌方向判断（业务规则：>0 涨, <0 跌, =0 平）
  const direction: StockChangeDirection =
    change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'

  // 通过令牌系统获取颜色（零硬编码）
  const hexColor = getStockColorHex(change)

  // 格式化涨跌幅文本
  const displayPercent = changePercent ?? change
  const sign = showPlus && displayPercent > 0 ? '+' : ''
  const formattedText = `${sign}${displayPercent.toFixed(decimals)}%`

  // 根据 mode 获取对应的颜色类名
  const getColorClass = (): string => {
    switch (mode) {
      case 'bg':
        return getStockColorBg(change)
      case 'both':
        return `${getStockColorClass(change)} ${getStockColorBg(change)}`
      case 'text':
      default:
        return getStockColorClass(change)
    }
  }

  // 涨跌图标（通过 getStockColorHex 获取颜色，不硬编码）
  const renderIcon = () => {
    if (!showIcon) return null
    const iconColor = hexColor
    switch (direction) {
      case 'up':
        return <TrendingUp className={iconSize} style={{ color: iconColor }} />
      case 'down':
        return <TrendingDown className={iconSize} style={{ color: iconColor }} />
      case 'neutral':
        return <Minus className={iconSize} style={{ color: iconColor }} />
    }
  }

  // 文本模式：使用 Tailwind 类名
  if (mode !== 'bg') {
    return (
      <span
        className={`${getColorClass()} ${className ?? ''}`.trim()}
        style={style}
        data-testid="stock-price-change"
        data-direction={direction}
      >
        {renderIcon()}
        {children ?? formattedText}
      </span>
    )
  }

  // 背景模式：使用 inline style（Tailwind 动态类名无法 JIT 编译）
  return (
    <span
      className={className}
      style={{ backgroundColor: hexColor, ...style }}
      data-testid="stock-price-change"
      data-direction={direction}
    >
      {renderIcon()}
      {children ?? formattedText}
    </span>
  )
}

/**
 * StockPriceChangeArrow 组件 Props
 * @description 仅显示涨跌方向图标的简化组件
 */
export interface StockPriceChangeArrowProps {
  /** 涨跌值 */
  change: number
  /** 图标尺寸 */
  iconSize?: string
  /** 自定义 className */
  className?: string
}

/**
 * 股价涨跌方向图标组件
 * @description 仅显示涨跌箭头图标，颜色通过令牌系统获取
 *
 * @example
 * <StockPriceChangeArrow change={3.25} />
 * // 输出红色 TrendingUp 图标
 */
export function StockPriceChangeArrow({
  change,
  iconSize = 'h-4 w-4',
  className,
}: StockPriceChangeArrowProps): React.JSX.Element {
  const direction: StockChangeDirection =
    change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  const hexColor = getStockColorHex(change)

  switch (direction) {
    case 'up':
      return (
        <TrendingUp
          className={`${iconSize} ${className ?? ''}`.trim()}
          style={{ color: hexColor }}
          data-testid="stock-change-arrow"
          data-direction="up"
        />
      )
    case 'down':
      return (
        <TrendingDown
          className={`${iconSize} ${className ?? ''}`.trim()}
          style={{ color: hexColor }}
          data-testid="stock-change-arrow"
          data-direction="down"
        />
      )
    case 'neutral':
      return (
        <Minus
          className={`${iconSize} ${className ?? ''}`.trim()}
          style={{ color: hexColor }}
          data-testid="stock-change-arrow"
          data-direction="neutral"
        />
      )
  }
}

/**
 * StockPriceChangeBadge 组件 Props
 * @description 带背景色的涨跌标签组件
 */
export interface StockPriceChangeBadgeProps {
  /** 涨跌值 */
  change: number
  /** 涨跌百分比 */
  changePercent?: number
  /** 小数位数 */
  decimals?: number
  /** 自定义 className */
  className?: string
}

/**
 * 股价涨跌标签组件
 * @description 带背景色的涨跌标签，颜色通过令牌系统获取
 *
 * @example
 * <StockPriceChangeBadge change={-1.80} />
 * // 输出: 绿色背景的 "-1.80%" 标签
 */
export function StockPriceChangeBadge({
  change,
  changePercent,
  decimals = 2,
  className,
}: StockPriceChangeBadgeProps): React.JSX.Element {
  const hexColor = getStockColorHex(change)
  const displayPercent = changePercent ?? change
  const sign = displayPercent > 0 ? '+' : ''
  const formattedText = `${sign}${displayPercent.toFixed(decimals)}%`

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${className ?? ''}`.trim()}
      style={{ backgroundColor: hexColor }}
      data-testid="stock-price-badge"
    >
      {formattedText}
    </span>
  )
}

export default StockPriceChange
