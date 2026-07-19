/**
 * PositionControlWidget 单元测试
 *
 * 覆盖场景：
 * 1. 标题渲染
 * 2. 错误态使用 danger 颜色令牌（内联 hex）
 * 3. 加载态渲染骨架（animate-pulse）
 * 4. 资金概览：totalValue / availableFunds 经 formatCurrency 格式化为 亿/万
 * 5. 仓位比例 Badge 三档配色：>80 危险红 / >50 黄色 / 其他 成功绿
 * 6. 仓位比例进度条 backgroundColor 三档（danger.hex / warningRaw / success.hex）
 * 7. 持仓分布列表渲染（名称 / 占比）
 * 8. 空持仓显示「暂无持仓」
 *
 * 颜色断言遵循 AGENTS.md §3.5：内联色做 hex→rgb 容错比较。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { buildWidgetConfig } from '../../../tests/fixtures'

const { mockUsePositionStore, mockInitSubscriptions, mockRefresh } = vi.hoisted(() => ({
  mockUsePositionStore: vi.fn(),
  mockInitSubscriptions: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/store/positionStore', () => ({
  usePositionStore: mockUsePositionStore,
  initPositionStoreSubscriptions: () => mockInitSubscriptions(),
}))

const PositionControlWidget = (await import('./PositionControlWidget')).default

const WIDGET_INSTANCE_ID = 'widget-position-control-1'

function buildConfig(title = '仓位控制'): WidgetConfig {
  return buildWidgetConfig({ instanceId: WIDGET_INSTANCE_ID, widgetId: 'positionControl', title })
}

function setupPositionStore(state: Record<string, unknown> = {}): void {
  mockUsePositionStore.mockReturnValue({
    totalValue: 0,
    availableFunds: 0,
    positionRatio: 0,
    holdings: [] as unknown[],
    loading: false,
    error: null,
    refresh: mockRefresh,
    ...state,
  })
}

/** 容错比较内联 style.color / backgroundColor（jsdom 可能归一化 hex→rgb） */
function expectInlineColor(el: HTMLElement, hex: string): void {
  const actual = el.style.color || el.style.backgroundColor
  const m = hex.replace('#', '')
  const rgb = `rgb(${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)})`
  expect(actual === hex || actual === rgb).toBe(true)
}

describe('PositionControlWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitSubscriptions.mockReturnValue(() => {})
    mockRefresh.mockResolvedValue(undefined)
  })

  it('渲染配置的标题', () => {
    setupPositionStore()
    render(<PositionControlWidget config={buildConfig('实时仓位')} />)
    expect(screen.getByText('实时仓位')).toBeInTheDocument()
  })

  it('错误态使用 danger 颜色令牌（AGENTS.md §3.5）', () => {
    setupPositionStore({ error: '仓位数据加载失败' })
    render(<PositionControlWidget config={buildConfig()} />)
    const errText = screen.getByText('仓位数据加载失败')
    expect(errText.parentElement).toHaveClass(COLOR_TOKENS.danger.tailwind)
  })

  it('加载态渲染骨架（animate-pulse）且不含持仓数据', () => {
    setupPositionStore({ loading: true, holdings: [{ name: '浦发银行' }] })
    render(<PositionControlWidget config={buildConfig()} />)
    expect(screen.queryByText('浦发银行')).not.toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('资金概览：totalValue / availableFunds 格式化为 亿 / 万', () => {
    setupPositionStore({ totalValue: 1.5e8, availableFunds: 50000 })
    render(<PositionControlWidget config={buildConfig()} />)
    expect(screen.getByText('1.5亿')).toBeInTheDocument()
    expect(screen.getByText('5.0万')).toBeInTheDocument()
  })

  it('仓位比例 >80 时 Badge 使用 danger 红', () => {
    setupPositionStore({ positionRatio: 85, holdings: [] })
    render(<PositionControlWidget config={buildConfig()} />)
    const badge = screen.getByText('85%')
    expect(badge.className).toContain(COLOR_TOKENS.danger.tailwind) // text-red-500
    expect(badge.className).toContain('border-red-300')
  })

  it('仓位比例 50~80 时 Badge 使用黄色', () => {
    setupPositionStore({ positionRatio: 60, holdings: [] })
    render(<PositionControlWidget config={buildConfig()} />)
    const badge = screen.getByText('60%')
    expect(badge.className).toContain('text-yellow-500')
    expect(badge.className).toContain('border-yellow-300')
  })

  it('仓位比例 ≤50 时 Badge 使用 success 绿', () => {
    setupPositionStore({ positionRatio: 30, holdings: [] })
    render(<PositionControlWidget config={buildConfig()} />)
    const badge = screen.getByText('30%')
    expect(badge.className).toContain(COLOR_TOKENS.success.tailwind) // text-success
    expect(badge.className).toContain('border-green-300')
  })

  it('仓位比例进度条 backgroundColor：>80 用 danger.hex', () => {
    setupPositionStore({ positionRatio: 85, holdings: [] })
    const { container } = render(<PositionControlWidget config={buildConfig()} />)
    // 持仓为空时，唯一带内联 backgroundColor 且 width 的进度条即仓位比例条
    const bar = container.querySelector<HTMLElement>('[style*="width"]')
    expect(bar).not.toBeNull()
    expectInlineColor(bar as HTMLElement, COLOR_TOKENS.danger.hex)
  })

  it('仓位比例进度条 backgroundColor：≤50 用 success.hex', () => {
    setupPositionStore({ positionRatio: 30, holdings: [] })
    const { container } = render(<PositionControlWidget config={buildConfig()} />)
    const bar = container.querySelector<HTMLElement>('[style*="width"]')
    expect(bar).not.toBeNull()
    expectInlineColor(bar as HTMLElement, COLOR_TOKENS.success.hex)
  })

  it('持仓分布列表渲染名称与占比', () => {
    setupPositionStore({
      holdings: [
        { symbol: 'SH600000', name: '浦发银行', value: 100, ratio: 30, color: '#ef4444', direction: 'buy' },
      ],
    })
    render(<PositionControlWidget config={buildConfig()} />)
    expect(screen.getByText('浦发银行')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('空持仓显示「暂无持仓」', () => {
    setupPositionStore({ holdings: [] })
    render(<PositionControlWidget config={buildConfig()} />)
    expect(screen.getByText('暂无持仓')).toBeInTheDocument()
  })
})
