/**
 * ValuePitWidget 单元测试
 *
 * 覆盖场景：
 * 1. 标题渲染
 * 2. 空数据 → 「暂无价值洼地策略数据」
 * 3. 渲染候选名称与综合评分（toFixed(2)）
 * 4. getActionLabel 四动作（立即建仓 / 试探 / 等轮动 / 不建）
 * 5. getScoreColor 五档颜色（score/20：优秀/良好/一般/较弱/差）
 * 6. 五维（六维）评分渲染（催化/估值/筹码/轮动/流动性/综合）
 * 7. 轮动信号徽章（rotationSignal=true）
 *
 * 说明：组件通过 useOptionalMarketData() 读取 valuePit（支持 data prop 注入）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig, ValuePitData } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'
import { buildWidgetConfig } from '../../../tests/fixtures'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('lucide-react', () => ({
  Gem: () => null,
  Sparkles: () => null,
  DollarSign: () => null,
  Users: () => null,
  RotateCcw: () => null,
  Droplets: () => null,
}))

const mockUseOptionalMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseOptionalMarketData,
  useOptionalMarketData: mockUseOptionalMarketData,
}))

// 延迟导入被测组件，确保 vi.mock 先生效
const ValuePitWidget = (await import('./ValuePitWidget')).default

const WIDGET_INSTANCE_ID = 'widget-value-pit-1'

function buildItem(o: Partial<ValuePitData> = {}): ValuePitData {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    score: 4.5,
    action: 'immediate',
    rotationSignal: true,
    dimensions: { catalyst: 4.2, valuation: 3.1, chip: 2.8, rotation: 1.9, liquidity: 0.7, composite: 4.9 },
    ...o,
  }
}

function buildConfig(title = '价值洼地'): WidgetConfig {
  return buildWidgetConfig({ instanceId: WIDGET_INSTANCE_ID, widgetId: 'valuePit', title })
}

function expectInlineColor(el: HTMLElement, hex: string): void {
  const actual = el.style.color
  const m = hex.replace('#', '')
  const rgb = `rgb(${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)})`
  expect(actual === hex || actual === rgb).toBe(true)
}

describe('ValuePitWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOptionalMarketData.mockReturnValue(undefined)
  })

  it('渲染配置的标题', () => {
    render(<ValuePitWidget config={buildConfig('价值洼地策略')} data={{ valuePit: [buildItem()] }} />)
    expect(screen.getByText('价值洼地策略')).toBeInTheDocument()
  })

  it('空数据 → 「暂无价值洼地策略数据」', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [] }} />)
    expect(screen.getByText('暂无价值洼地策略数据')).toBeInTheDocument()
  })

  it('渲染候选名称与综合评分（toFixed(2)）', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ name: '贵州茅台', score: 4.5 })] }} />)
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.getByText('4.50')).toBeInTheDocument()
  })

  it('动作 immediate → 「立即建仓」', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ action: 'immediate' })] }} />)
    expect(screen.getByText('立即建仓')).toBeInTheDocument()
  })

  it('动作 probe → 「试探」', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ action: 'probe' })] }} />)
    expect(screen.getByText('试探')).toBeInTheDocument()
  })

  it('动作 wait → 「等轮动」', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ action: 'wait' })] }} />)
    expect(screen.getByText('等轮动')).toBeInTheDocument()
  })

  it('动作 ignore → 「不建」', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ action: 'ignore' })] }} />)
    expect(screen.getByText('不建')).toBeInTheDocument()
  })

  it('评分 ≥4 → 优秀 / EXCELLENT 颜色', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ score: 4.5 })] }} />)
    expectInlineColor(screen.getByText('4.50'), SCORE_LEVELS.EXCELLENT.color)
  })

  it('评分 3-4 → 良好 / GOOD 颜色', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ score: 3.5 })] }} />)
    expect(screen.getByText('3.50')).toBeInTheDocument()
    expectInlineColor(screen.getByText('3.50'), SCORE_LEVELS.GOOD.color)
  })

  it('评分 2-3 → 一般 / AVERAGE 颜色', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ score: 2.5 })] }} />)
    expectInlineColor(screen.getByText('2.50'), SCORE_LEVELS.AVERAGE.color)
  })

  it('评分 1-2 → 较弱 / POOR 颜色', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ score: 1.5 })] }} />)
    expectInlineColor(screen.getByText('1.50'), SCORE_LEVELS.POOR.color)
  })

  it('评分 <1 → 差 / BAD 颜色', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ score: 0.5 })] }} />)
    expectInlineColor(screen.getByText('0.50'), SCORE_LEVELS.BAD.color)
  })

  it('渲染六维评分名称', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem()] }} />)
    expect(screen.getByText('催化')).toBeInTheDocument()
    expect(screen.getByText('估值')).toBeInTheDocument()
    expect(screen.getByText('筹码')).toBeInTheDocument()
    expect(screen.getByText('轮动')).toBeInTheDocument()
    expect(screen.getByText('流动性')).toBeInTheDocument()
    expect(screen.getByText('综合')).toBeInTheDocument()
  })

  it('rotationSignal=true 时显示轮动信号徽章', () => {
    render(<ValuePitWidget config={buildConfig()} data={{ valuePit: [buildItem({ rotationSignal: true })] }} />)
    const badge = screen.getByText('轮动信号')
    expect(badge).toHaveClass('bg-success')
  })
})
