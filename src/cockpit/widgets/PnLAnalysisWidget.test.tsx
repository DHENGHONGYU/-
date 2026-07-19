/**
 * @fileoverview PnLAnalysisWidget 单元测试
 * @description 验证盈亏分析 Widget 的渲染逻辑、核心/次要指标条件着色、盈亏曲线、月度盈亏、
 * 交易统计、以及加载/错误/空态。
 *
 * 覆盖关键点：
 * - 默认 props 渲染 / 标题来自 config
 * - 错误态（COLOR_TOKENS.danger 内联色）
 * - 加载骨架（4 个 animate-pulse：3×h-16 + 1×h-32）
 * - 空态（orders.length === 0 或 tradePairs.length === 0 → 暂无盈亏数据）
 * - 核心指标：总盈亏（>=0 绿 / <0 红）、胜率（绿）、盈亏比（yellow-500）
 * - 盈亏曲线：最近 20 点柱状图，正→success 色 / 负→danger 色
 * - 月度盈亏：最近 6 条，>=0 绿 / <0 红；空→暂无月度数据
 * - 交易统计：盈利/亏损/总计笔数
 * - useEffect 清理：initOrderStoreSubscriptions 返回的 cleanup 在卸载时被调用
 * - 挂载即触发 store.refresh()
 *
 * 颜色断言遵循 AGENTS.md §3.5.5：使用 COLOR_TOKENS 令牌引用，
 * 内联色做 hex→rgb 容错比较（jsdom 可能归一化）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'
import { buildWidgetConfig } from '../../../tests/fixtures'
import type { PnLSummary } from '@/services/trading/pnlComputer'

// ============================================================
// Mock: orderStore（PnLAnalysisWidget 依赖）
// 使用 vi.hoisted 确保 mock 函数在 vi.mock 提升之前已定义，避免 TDZ / unused-vars。
// ============================================================
const {
  mockUseOrderStore,
  mockInitOrderStoreSubscriptions,
  mockRefresh,
} = vi.hoisted(() => ({
  mockUseOrderStore: vi.fn(),
  mockInitOrderStoreSubscriptions: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/store/orderStore', () => ({
  useOrderStore: mockUseOrderStore,
  initOrderStoreSubscriptions: () => mockInitOrderStoreSubscriptions(),
}))

// useOrderStore.getState().refresh() 在 useEffect 内被调用，需提供 getState 桥接
mockUseOrderStore.mockImplementation(() => ({
  orders: [{ id: 'o1' }],
  tradePairs: [{ id: 'p1' }],
  pnlSummary: {},
  loading: false,
  error: null,
  isRefreshing: false,
  lastUpdated: 0,
  refresh: mockRefresh,
}))
;(mockUseOrderStore as unknown as { getState: () => unknown }).getState = () => ({
  refresh: mockRefresh,
})

// 延迟导入被测组件，确保 vi.mock 先生效
const PnLAnalysisWidget = (await import('./PnLAnalysisWidget')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '盈亏分析'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'pnl-analysis-1',
    widgetId: 'pnlAnalysis',
    title,
  })
}

/** 构建一组合理的默认 PnLSummary（盈利基线） */
function buildPnlSummary(overrides: Partial<PnLSummary> = {}): PnLSummary {
  return {
    totalRealizedPnl: 12.5,
    totalUnrealizedPnl: 0,
    winRate: 65,
    profitFactor: 2.3,
    totalTrades: 20,
    profitTrades: 12,
    lossTrades: 8,
    monthlyPnL: [
      { month: '2026-01', pnl: 5.2, trades: 10 },
      { month: '2026-02', pnl: -1.8, trades: 8 },
    ],
    dailyCurve: [
      { date: '2026-01-01', cumulativePnL: 3 },
      { date: '2026-01-02', cumulativePnL: -2 },
      { date: '2026-01-03', cumulativePnL: 6 },
    ],
    ...overrides,
  }
}

/** 配置 mock store 返回指定 pnlSummary（默认 orders/tradePairs 非空、loading=false、error=null） */
function setupPnl(
  pnlSummary: PnLSummary,
  opts: {
    orders?: unknown[]
    tradePairs?: unknown[]
    loading?: boolean
    error?: string | null
  } = {},
): void {
  const { orders = [{ id: 'o1' }], tradePairs = [{ id: 'p1' }], loading = false, error = null } = opts
  mockUseOrderStore.mockReturnValue({
    orders,
    tradePairs,
    pnlSummary,
    loading,
    error,
    isRefreshing: false,
    lastUpdated: 0,
    refresh: mockRefresh,
  } as never)
  ;(mockUseOrderStore as unknown as { getState: () => unknown }).getState = () => ({
    refresh: mockRefresh,
  })
}

/** hex → rgb 字符串，用于 jsdom 内联样式归一化容错 */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/** 容错比较内联 style.color（jsdom 可能将 hex 归一化为 rgb） */
function expectInlineColor(el: HTMLElement, hex: string): void {
  const actual = el.style.color
  if (actual === hex || actual === hexToRgb(hex)) {
    expect(actual === hex || actual === hexToRgb(hex)).toBe(true)
    return
  }
  expect(actual).toBe(hex)
}

/** 容错比较内联 style.backgroundColor（jsdom 可能将 hex 归一化为 rgb） */
function expectInlineBg(el: HTMLElement, hex: string): void {
  const actual = el.style.backgroundColor
  if (actual === hex || actual === hexToRgb(hex)) {
    expect(actual === hex || actual === hexToRgb(hex)).toBe(true)
    return
  }
  expect(actual).toBe(hex)
}

// ============================================================
// 测试套件
// ============================================================
describe('PnLAnalysisWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitOrderStoreSubscriptions.mockReturnValue(() => {})
    mockRefresh.mockResolvedValue(undefined)
    setupPnl(buildPnlSummary())
  })

  // ----------------------------------------------------------
  // 默认 / 标题
  // ----------------------------------------------------------
  it('renders widget title from config by default', () => {
    setupPnl(buildPnlSummary())
    render(<PnLAnalysisWidget config={buildConfig('实时盈亏分析')} />)

    expect(screen.getByText('实时盈亏分析')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 错误态
  // ----------------------------------------------------------
  it('renders error message with danger color token when error is set', () => {
    setupPnl(buildPnlSummary(), { error: '盈亏数据加载失败' })
    const { container } = render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('盈亏数据加载失败')).toBeInTheDocument()
    const cardContent = container.querySelector('.text-center')
    expect(cardContent).not.toBeNull()
    // 源码错误态使用 COLOR_TOKENS.danger.tailwind（Tailwind 类名，非内联），校验 className
    expect((cardContent as HTMLElement).className).toContain(COLOR_TOKENS.danger.tailwind)
  })

  // ----------------------------------------------------------
  // 加载骨架
  // ----------------------------------------------------------
  it('renders 4 loading skeletons (animate-pulse) when loading is true', () => {
    setupPnl(buildPnlSummary(), { loading: true })
    const { container } = render(<PnLAnalysisWidget config={buildConfig('加载中盈亏')} />)

    expect(screen.getByText('加载中盈亏')).toBeInTheDocument()
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  // ----------------------------------------------------------
  // 空态（orders 或 tradePairs 为空）
  // ----------------------------------------------------------
  it('renders empty state when orders list is empty', () => {
    setupPnl(buildPnlSummary(), { orders: [] })
    render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('暂无盈亏数据')).toBeInTheDocument()
    expect(
      screen.getByText('完成交易后将自动生成盈亏分析与收益曲线'),
    ).toBeInTheDocument()
  })

  it('renders empty state when tradePairs list is empty', () => {
    setupPnl(buildPnlSummary(), { tradePairs: [] })
    render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('暂无盈亏数据')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 核心指标渲染 + 条件着色
  // ----------------------------------------------------------
  it('renders total realized PnL with + prefix and success color when >= 0', () => {
    setupPnl(buildPnlSummary({ totalRealizedPnl: 12.5 }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    const value = screen.getByText('+12.5%')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, COLOR_TOKENS.success.hex)
  })

  it('renders total realized PnL with danger color when < 0 (no + prefix)', () => {
    setupPnl(buildPnlSummary({ totalRealizedPnl: -3.2 }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    const value = screen.getByText('-3.2%')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, COLOR_TOKENS.danger.hex)
  })

  it('renders win rate with success color token', () => {
    setupPnl(buildPnlSummary({ winRate: 65 }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    const value = screen.getByText('65%')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, COLOR_TOKENS.success.hex)
  })

  it('renders profit factor with yellow-500 token', () => {
    setupPnl(buildPnlSummary({ profitFactor: 2.3 }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    const value = screen.getByText('2.3')
    expect(value).toBeInTheDocument()
    expect(value.className).toContain('text-yellow-500')
  })

  // ----------------------------------------------------------
  // 盈亏曲线着色（正→success / 负→danger）
  // ----------------------------------------------------------
  it('renders PnL curve bars colored by sign (positive=success, negative=danger)', () => {
    setupPnl(
      buildPnlSummary({
        dailyCurve: [
          { date: 'd1', cumulativePnL: 3 },
          { date: 'd2', cumulativePnL: -2 },
          { date: 'd3', cumulativePnL: 6 },
        ],
      }),
    )
    const { container } = render(<PnLAnalysisWidget config={buildConfig()} />)

    const bars = container.querySelectorAll('.rounded-t-sm')
    expect(bars.length).toBe(3)
    // 源码：柱体颜色为 style.backgroundColor（正→success / 负→danger），非 color
    expectInlineBg(bars[0] as HTMLElement, COLOR_TOKENS.success.hex) // +3
    expectInlineBg(bars[1] as HTMLElement, COLOR_TOKENS.danger.hex) // -2
    expectInlineBg(bars[2] as HTMLElement, COLOR_TOKENS.success.hex) // +6
  })

  it('slices daily curve to the last 20 points', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      date: `d${i}`,
      cumulativePnL: i - 12,
    }))
    setupPnl(buildPnlSummary({ dailyCurve: many }))
    const { container } = render(<PnLAnalysisWidget config={buildConfig()} />)

    const bars = container.querySelectorAll('.rounded-t-sm')
    expect(bars.length).toBe(20)
  })

  // ----------------------------------------------------------
  // 月度盈亏
  // ----------------------------------------------------------
  it('renders monthly PnL with sign coloring and trade count badge', () => {
    setupPnl(
      buildPnlSummary({
        monthlyPnL: [{ month: '2026-01', pnl: 5.2, trades: 10 }],
      }),
    )
    render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('2026-01')).toBeInTheDocument()
    expect(screen.getByText('+5.2%')).toBeInTheDocument()
    expect(screen.getByText('10笔')).toBeInTheDocument()
  })

  it('renders "暂无月度数据" when monthlyPnL is empty', () => {
    setupPnl(buildPnlSummary({ monthlyPnL: [] }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('暂无月度数据')).toBeInTheDocument()
  })

  it('limits monthly PnL display to the last 6 entries', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, '0')}`,
      pnl: i,
      trades: 5,
    }))
    setupPnl(buildPnlSummary({ monthlyPnL: many }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    // 仅渲染最后 6 条：2026-05 .. 2026-10
    expect(screen.queryByText('2026-01')).not.toBeInTheDocument()
    expect(screen.getByText('2026-10')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 交易统计
  // ----------------------------------------------------------
  it('renders trade statistics: profit / loss / total counts', () => {
    // 清空 monthlyPnL，避免月度「8笔」与亏损笔数「8笔」撞车
    setupPnl(buildPnlSummary({ profitTrades: 12, lossTrades: 8, totalTrades: 20, monthlyPnL: [] }))
    render(<PnLAnalysisWidget config={buildConfig()} />)

    expect(screen.getByText('12笔')).toBeInTheDocument()
    expect(screen.getByText('8笔')).toBeInTheDocument()
    expect(screen.getByText('20笔')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // useEffect 清理（AGENTS.md §3 事件监听清理）
  // ----------------------------------------------------------
  it('calls cleanup returned by initOrderStoreSubscriptions on unmount', () => {
    const cleanup = vi.fn()
    mockInitOrderStoreSubscriptions.mockReturnValue(cleanup)
    setupPnl(buildPnlSummary())

    const { unmount } = render(<PnLAnalysisWidget config={buildConfig()} />)
    expect(mockInitOrderStoreSubscriptions).toHaveBeenCalledTimes(1)

    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('invokes store refresh on mount via useEffect', async () => {
    setupPnl(buildPnlSummary())
    render(<PnLAnalysisWidget config={buildConfig()} />)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // ----------------------------------------------------------
  // 颜色常量一致性锚点（防御令牌被意外修改）
  // ----------------------------------------------------------
  it('COLOR_TOKENS / THEME_TOKENS 锚点值应与 PnLAnalysisWidget 源码引用一致', () => {
    // 源码 总盈亏/胜率 使用 COLOR_TOKENS.success.hex（与 text-success 一致）
    expect(COLOR_TOKENS.success.hex).toBe('#21c45d')
    expect(COLOR_TOKENS.success.tailwind).toBe('text-success')
    // 源码 亏损分支 使用 COLOR_TOKENS.danger.hex (#ef4444)
    expect(COLOR_TOKENS.danger.hex).toBe('#ef4444')
    // 源码 盈亏比 使用 twText('yellow', 500)
    expect(THEME_TOKENS).toBeTruthy()
  })
})
