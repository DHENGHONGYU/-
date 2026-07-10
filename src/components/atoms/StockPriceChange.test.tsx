import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  StockPriceChange,
  StockPriceChangeArrow,
  StockPriceChangeBadge,
} from './StockPriceChange'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * 将 HEX 颜色转换为 RGB 格式（jsdom 会自动转换）
 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

describe('StockPriceChange 组件', () => {
  describe('红涨绿跌规则验证（A 股标准）', () => {
    it('上涨（正数）使用红色文字', () => {
      render(<StockPriceChange change={3.25} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.textContent).toBe('+3.25%')
      expect(el.getAttribute('data-direction')).toBe('up')
      expect(el.className).toContain('text-red-500')
    })

    it('下跌（负数）使用绿色文字', () => {
      render(<StockPriceChange change={-1.80} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.textContent).toBe('-1.80%')
      expect(el.getAttribute('data-direction')).toBe('down')
      expect(el.className).toContain('text-green-500')
    })

    it('平盘（零）使用灰色文字', () => {
      render(<StockPriceChange change={0} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.textContent).toBe('0.00%')
      expect(el.getAttribute('data-direction')).toBe('neutral')
      expect(el.className).toContain('text-gray-400')
    })

    it('上涨不显示正号时省略 + 号', () => {
      render(<StockPriceChange change={2.5} showPlus={false} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.textContent).toBe('2.50%')
    })

    it('自定义小数位数', () => {
      render(<StockPriceChange change={3.256} decimals={1} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.textContent).toBe('+3.3%')
    })
  })

  describe('背景模式', () => {
    it('bg 模式使用 HEX 背景色（上涨=红色）', () => {
      render(<StockPriceChange change={5.0} mode="bg" />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
    })

    it('bg 模式使用 HEX 背景色（下跌=绿色）', () => {
      render(<StockPriceChange change={-3.0} mode="bg" />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.down.hex))
    })

    it('both 模式同时使用文字和背景颜色类', () => {
      render(<StockPriceChange change={1.5} mode="both" />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.className).toContain('text-red-500')
      expect(el.className).toContain('bg-red-500')
    })
  })

  describe('图标模式', () => {
    it('showIcon=true 时渲染涨跌图标', () => {
      render(<StockPriceChange change={3.25} showIcon />)
      const container = screen.getByTestId('stock-price-change')
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(container.getAttribute('data-direction')).toBe('up')
    })

    it('showIcon=true 下跌时渲染向下箭头', () => {
      render(<StockPriceChange change={-1.80} showIcon />)
      const container = screen.getByTestId('stock-price-change')
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(container.getAttribute('data-direction')).toBe('down')
    })

    it('showIcon=true 平盘时渲染横线图标', () => {
      render(<StockPriceChange change={0} showIcon />)
      const container = screen.getByTestId('stock-price-change')
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(container.getAttribute('data-direction')).toBe('neutral')
    })

    it('图标颜色使用 HEX 值（非硬编码）', () => {
      render(<StockPriceChange change={3.25} showIcon />)
      const container = screen.getByTestId('stock-price-change')
      const svg = container.querySelector('svg')
      expect(svg!.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
    })
  })

  describe('自定义内容', () => {
    it('children 覆盖默认文本', () => {
      render(
        <StockPriceChange change={3.25}>
          <span>涨停</span>
        </StockPriceChange>,
      )
      expect(screen.getByText('涨停')).toBeTruthy()
    })

    it('changePercent 覆盖 change 用于显示文本', () => {
      render(<StockPriceChange change={0} changePercent={5.0} />)
      const el = screen.getByTestId('stock-price-change')
      // 方向由 change 决定（0=neutral），文本由 changePercent 决定
      expect(el.getAttribute('data-direction')).toBe('neutral')
      expect(el.textContent).toBe('+5.00%')
    })
  })

  describe('颜色令牌一致性', () => {
    it('上涨颜色与 STOCK_COLOR_TOKENS.up 一致', () => {
      render(<StockPriceChange change={1} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.className).toContain(STOCK_COLOR_TOKENS.up.tailwind)
    })

    it('下跌颜色与 STOCK_COLOR_TOKENS.down 一致', () => {
      render(<StockPriceChange change={-1} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.className).toContain(STOCK_COLOR_TOKENS.down.tailwind)
    })

    it('平盘颜色与 STOCK_COLOR_TOKENS.neutral 一致', () => {
      render(<StockPriceChange change={0} />)
      const el = screen.getByTestId('stock-price-change')
      expect(el.className).toContain(STOCK_COLOR_TOKENS.neutral.tailwind)
    })
  })
})

describe('StockPriceChangeArrow 组件', () => {
  it('上涨渲染 TrendingUp 图标', () => {
    render(<StockPriceChangeArrow change={3.25} />)
    const arrow = screen.getByTestId('stock-change-arrow')
    expect(arrow.getAttribute('data-direction')).toBe('up')
    expect(arrow.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
  })

  it('下跌渲染 TrendingDown 图标', () => {
    render(<StockPriceChangeArrow change={-1.80} />)
    const arrow = screen.getByTestId('stock-change-arrow')
    expect(arrow.getAttribute('data-direction')).toBe('down')
    expect(arrow.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.down.hex))
  })

  it('平盘渲染 Minus 图标', () => {
    render(<StockPriceChangeArrow change={0} />)
    const arrow = screen.getByTestId('stock-change-arrow')
    expect(arrow.getAttribute('data-direction')).toBe('neutral')
    expect(arrow.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.neutral.hex))
  })
})

describe('StockPriceChangeBadge 组件', () => {
  it('上涨标签使用红色背景', () => {
    render(<StockPriceChangeBadge change={3.25} />)
    const badge = screen.getByTestId('stock-price-badge')
    expect(badge.textContent).toBe('+3.25%')
    expect(badge.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
  })

  it('下跌标签使用绿色背景', () => {
    render(<StockPriceChangeBadge change={-1.80} />)
    const badge = screen.getByTestId('stock-price-badge')
    expect(badge.textContent).toBe('-1.80%')
    expect(badge.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.down.hex))
  })

  it('平盘标签使用灰色背景', () => {
    render(<StockPriceChangeBadge change={0} />)
    const badge = screen.getByTestId('stock-price-badge')
    expect(badge.textContent).toBe('0.00%')
    expect(badge.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.neutral.hex))
  })

  it('changePercent 覆盖 change 用于显示文本', () => {
    render(<StockPriceChangeBadge change={0} changePercent={5.0} />)
    const badge = screen.getByTestId('stock-price-badge')
    expect(badge.textContent).toBe('+5.00%')
    expect(badge.style.backgroundColor).toBe(hexToRgb(STOCK_COLOR_TOKENS.neutral.hex))
  })
})
