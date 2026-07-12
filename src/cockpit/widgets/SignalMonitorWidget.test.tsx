/**
 * @fileoverview SignalMonitorWidget 单元测试
 * @description 验证信号监控 Widget 的渲染逻辑、信号方向显示、置信度色阶、
 * 加载/错误状态、统计颜色令牌（A 股惯例：红涨绿跌）以及 useEffect 清理。
 *
 * 覆盖关键点：
 * - 默认 props 渲染 / 空列表 / 多信号
 * - 信号方向（buy/sell/hold/watch）的图标与 Badge 文案
 * - 置信度四档色阶（高/中/低/极低）+ 边界值 0/100
 * - 加载骨架 / 错误态（使用 COLOR_TOKENS.danger）
 * - 信号统计颜色令牌（买入=红、卖出=绿，遵循 STOCK_COLOR_MAPPING / COLOR_TOKENS）
 * - useEffect 中 initSignalStoreSubscriptions 返回的 cleanup 在卸载时被调用
 *
 * 颜色断言遵循 AGENTS.md §3.5.5：使用令牌引用而非硬编码字符串。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig } from '@/types/modules/widget.types'
import type { Signal } from '@/data/types'
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { buildSignal, buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: signalStore（SignalMonitorWidget 依赖）
// 使用 vi.hoisted 确保 mock 函数在 vi.mock 提升之前已定义，
// 避免 TDZ 与 unused-vars 警告。
// ============================================================
const {
  mockUseSignalStore,
  mockTopSignals,
  mockInitSignalStoreSubscriptions,
  mockRefresh,
} = vi.hoisted(() => ({
  mockUseSignalStore: vi.fn(),
  mockTopSignals: vi.fn(),
  mockInitSignalStoreSubscriptions: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/store/signalStore', () => ({
  useSignalStore: mockUseSignalStore,
  topSignals: (...args: unknown[]) => mockTopSignals(...(args as [])),
  initSignalStoreSubscriptions: () => mockInitSignalStoreSubscriptions(),
}))

// useSignalStore.getState().refresh() 在 useEffect 内被调用，需提供 getState 桥接
mockUseSignalStore.mockImplementation(() => ({
  loading: false,
  error: null,
  signals: [],
  lastUpdated: 0,
  isRefreshing: false,
  refresh: mockRefresh,
}))
;(mockUseSignalStore as unknown as { getState: () => unknown }).getState = () => ({
  refresh: mockRefresh,
})

// 延迟导入被测组件，确保 vi.mock 先生效
const SignalMonitorWidget = (await import('./SignalMonitorWidget')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '信号监控'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'signal-monitor-1',
    widgetId: 'signalMonitor',
    title,
  })
}

/**
 * 在 0-100 置信度刻度上构建信号（源码 getConfidenceColor 使用 80/60/40 阈值）
 * @remarks tests/fixtures/buildSignal 默认 confidence=0.75（0-1 刻度），
 * 此处统一覆盖为 0-100 刻度以匹配源码逻辑。
 */
function buildSignalOn100Scale(overrides: Partial<Signal>): Signal {
  return buildSignal({ confidence: 75, ...overrides })
}

/** 配置 mock store 返回指定信号列表（默认 loading=false / error=null） */
function setupSignals(signals: Signal[], opts: { loading?: boolean; error?: string | null } = {}) {
  const { loading = false, error = null } = opts
  mockUseSignalStore.mockReturnValue({
    loading,
    error,
    signals,
    lastUpdated: 0,
    isRefreshing: false,
    refresh: mockRefresh,
  })
  ;(mockUseSignalStore as unknown as { getState: () => unknown }).getState = () => ({
    refresh: mockRefresh,
  })
  mockTopSignals.mockReturnValue(signals)
}

// ============================================================
// 测试套件
// ============================================================
describe('SignalMonitorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitSignalStoreSubscriptions.mockReturnValue(() => {})
    mockRefresh.mockResolvedValue(undefined)
    setupSignals([])
  })

  // ----------------------------------------------------------
  // 默认 / 空态 / 多信号
  // ----------------------------------------------------------
  it('renders widget title from config by default', () => {
    setupSignals([])
    render(<SignalMonitorWidget config={buildConfig('实时信号监控')} />)

    expect(screen.getByText('实时信号监控')).toBeInTheDocument()
  })

  it('renders empty state with hint text when signals list is empty', () => {
    setupSignals([])
    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('暂无交易信号')).toBeInTheDocument()
    expect(screen.getByText('添加股票到观察池后将自动生成信号')).toBeInTheDocument()
  })

  it('renders multiple signal items with symbol and rationale', () => {
    const signals = [
      buildSignalOn100Scale({ id: 's1', symbol: '600519.SH', rationale: '估值修复' }),
      buildSignalOn100Scale({ id: 's2', symbol: '000001.SZ', rationale: '技术面突破' }),
      buildSignalOn100Scale({ id: 's3', symbol: '300750.SZ', rationale: '资金流入' }),
    ]
    setupSignals(signals)

    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('600519.SH')).toBeInTheDocument()
    expect(screen.getByText('000001.SZ')).toBeInTheDocument()
    expect(screen.getByText('300750.SZ')).toBeInTheDocument()
    expect(screen.getByText('估值修复')).toBeInTheDocument()
    expect(screen.getByText('技术面突破')).toBeInTheDocument()
    expect(screen.getByText('资金流入')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 信号方向（buy/sell/hold/watch）的 Badge 文案
  // ----------------------------------------------------------
  it('renders buy signal with "买入" badge', () => {
    setupSignals([buildSignalOn100Scale({ id: 'b1', symbol: 'BUY.SH', direction: 'buy' })])
    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('BUY.SH')).toBeInTheDocument()
  })

  it('renders sell signal with "卖出" badge', () => {
    setupSignals([buildSignalOn100Scale({ id: 's1', symbol: 'SELL.SH', direction: 'sell' })])
    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('卖出')).toBeInTheDocument()
    expect(screen.getByText('SELL.SH')).toBeInTheDocument()
  })

  it('renders hold signal with "持有" badge', () => {
    setupSignals([buildSignalOn100Scale({ id: 'h1', symbol: 'HOLD.SH', direction: 'hold' })])
    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('持有')).toBeInTheDocument()
  })

  it('renders watch signal with "观望" badge', () => {
    setupSignals([buildSignalOn100Scale({ id: 'w1', symbol: 'WATCH.SH', direction: 'watch' })])
    render(<SignalMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('观望')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 置信度色阶（COLOR_TOKENS / twText 令牌断言）
  // ----------------------------------------------------------
  it('applies scoreHigh token for high confidence (>=80)', () => {
    setupSignals([buildSignalOn100Scale({ id: 'h', symbol: 'C80.SH', confidence: 85 })])
    const { container } = render(<SignalMonitorWidget config={buildConfig()} />)

    const confidenceSpan = container.querySelector('.text-xs.font-bold')
    expect(confidenceSpan).not.toBeNull()
    // 源码使用 COLOR_TOKENS.success.tailwind（text-green-700）
    expect(confidenceSpan?.className).toContain(COLOR_TOKENS.success.tailwind)
  })

  it('applies info token for mid confidence (60-79)', () => {
    setupSignals([buildSignalOn100Scale({ id: 'm', symbol: 'C65.SH', confidence: 65 })])
    const { container } = render(<SignalMonitorWidget config={buildConfig()} />)

    const confidenceSpan = container.querySelector('.text-xs.font-bold')
    expect(confidenceSpan).not.toBeNull()
    expect(confidenceSpan?.className).toContain(COLOR_TOKENS.info.tailwind)
  })

  it('applies yellow text token for low-mid confidence (40-59)', () => {
    setupSignals([buildSignalOn100Scale({ id: 'l', symbol: 'C45.SH', confidence: 45 })])
    const { container } = render(<SignalMonitorWidget config={buildConfig()} />)

    const confidenceSpan = container.querySelector('.text-xs.font-bold')
    expect(confidenceSpan).not.toBeNull()
    // 源码使用 COLOR_TOKENS.warning.tailwind（text-amber-500）
    expect(confidenceSpan?.className).toContain(COLOR_TOKENS.warning.tailwind)
  })

  it('applies neutral token for very low confidence (<40)', () => {
    setupSignals([buildSignalOn100Scale({ id: 'vl', symbol: 'C25.SH', confidence: 25 })])
    const { container } = render(<SignalMonitorWidget config={buildConfig()} />)

    const confidenceSpan = container.querySelector('.text-xs.font-bold')
    expect(confidenceSpan).not.toBeNull()
    // 源码硬编码 'text-gray-400'，等价于 COLOR_TOKENS.neutral.tailwind
    expect(confidenceSpan?.className).toContain(COLOR_TOKENS.neutral.tailwind)
  })

  it('handles extreme confidence values 0 and 100 without crashing', () => {
    setupSignals([
      buildSignalOn100Scale({ id: 'min', symbol: 'MIN.SH', confidence: 0 }),
      buildSignalOn100Scale({ id: 'max', symbol: 'MAX.SH', confidence: 100 }),
    ])

    const { container } = render(<SignalMonitorWidget config={buildConfig()} />)

    // 0 → text-gray-400（neutral），100 → text-green-700（success）
    const confidenceSpans = container.querySelectorAll('.text-xs.font-bold')
    expect(confidenceSpans.length).toBe(2)
    const classNames = Array.from(confidenceSpans).map((s) => s.className)
    expect(classNames.some((c) => c.includes(COLOR_TOKENS.neutral.tailwind))).toBe(true)
    expect(classNames.some((c) => c.includes(COLOR_TOKENS.success.tailwind))).toBe(true)
  })

  // ----------------------------------------------------------
  // 加载 / 错误状态
  // ----------------------------------------------------------
  it('renders loading skeleton when isLoading is true', () => {
    setupSignals([], { loading: true })
    const { container } = render(<SignalMonitorWidget config={buildConfig('加载中信号')} />)

    expect(screen.getByText('加载中信号')).toBeInTheDocument()
    // 源码渲染 5 个 h-12 骨架占位，带 animate-pulse 类
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(5)
  })

  it('renders error message with danger color token when error is set', () => {
    setupSignals([], { error: '数据源连接失败' })
    const { container } = render(<SignalMonitorWidget config={buildConfig('信号监控')} />)

    expect(screen.getByText('数据源连接失败')).toBeInTheDocument()
    // CardContent 使用 COLOR_TOKENS.danger.tailwind 作为文本色
    const cardContent = container.querySelector('.text-center')
    expect(cardContent).not.toBeNull()
    expect(cardContent?.className).toContain(COLOR_TOKENS.danger.tailwind)
  })

  // ----------------------------------------------------------
  // 信号统计颜色令牌（A 股惯例：买入=红、卖出=绿）
  // ----------------------------------------------------------
  it('uses UP_CLASS (text-red-500) token for buy count in statistics', () => {
    setupSignals([
      buildSignalOn100Scale({ id: 'b1', symbol: 'B1.SH', direction: 'buy' }),
      buildSignalOn100Scale({ id: 'b2', symbol: 'B2.SH', direction: 'buy' }),
    ])
    render(<SignalMonitorWidget config={buildConfig()} />)

    // 统计行：买入: <span class="font-medium text-red-500">2</span>
    const buyCountSpans = screen.getAllByText('2')
    const buyCountSpan = buyCountSpans.find((el) => el.tagName === 'SPAN' && el.className.includes('font-medium'))
    expect(buyCountSpan).toBeDefined()
    expect(buyCountSpan?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
    expect(buyCountSpan?.className).toContain(COLOR_TOKENS.up.tailwind)
  })

  it('uses DOWN_CLASS (text-green-500) token for sell count in statistics', () => {
    setupSignals([
      buildSignalOn100Scale({ id: 's1', symbol: 'S1.SH', direction: 'sell' }),
      buildSignalOn100Scale({ id: 's2', symbol: 'S2.SH', direction: 'sell' }),
      buildSignalOn100Scale({ id: 's3', symbol: 'S3.SH', direction: 'sell' }),
    ])
    render(<SignalMonitorWidget config={buildConfig()} />)

    const sellCountSpans = screen.getAllByText('3')
    const sellCountSpan = sellCountSpans.find((el) => el.tagName === 'SPAN' && el.className.includes('font-medium'))
    expect(sellCountSpan).toBeDefined()
    expect(sellCountSpan?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
    expect(sellCountSpan?.className).toContain(COLOR_TOKENS.down.tailwind)
  })

  it('renders hold/watch count combined in statistics', () => {
    setupSignals([
      buildSignalOn100Scale({ id: 'h1', symbol: 'H1.SH', direction: 'hold' }),
      buildSignalOn100Scale({ id: 'w1', symbol: 'W1.SH', direction: 'watch' }),
    ])
    render(<SignalMonitorWidget config={buildConfig()} />)

    // 持有/观望: 2
    expect(screen.getByText('持有/观望:')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // useEffect cleanup 验证（AGENTS.md §3 事件监听清理）
  // ----------------------------------------------------------
  it('calls cleanup returned by initSignalStoreSubscriptions on unmount', () => {
    const cleanup = vi.fn()
    mockInitSignalStoreSubscriptions.mockReturnValue(cleanup)
    setupSignals([])

    const { unmount } = render(<SignalMonitorWidget config={buildConfig()} />)
    // mount 阶段应调用 init
    expect(mockInitSignalStoreSubscriptions).toHaveBeenCalledTimes(1)

    unmount()
    // unmount 阶段应调用返回的 cleanup
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('invokes store refresh on mount via useEffect', async () => {
    setupSignals([])
    render(<SignalMonitorWidget config={buildConfig()} />)

    // useEffect 中 doRefresh 调用 useSignalStore.getState().refresh()
    // 等待微任务/宏任务执行
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // ----------------------------------------------------------
  // 颜色常量一致性锚点（防御令牌被意外修改）
  // ----------------------------------------------------------
  it('THEME_TOKENS.color.successRaw / destructiveRaw 应为源码 getSignalIcon 使用的色值锚点', () => {
    // 源码 getSignalIcon 使用 THEME_TOKENS.color.successRaw（买入图标）与 destructiveRaw（卖出图标）
    // 注意：图标采用国际惯例（买入=绿、卖出=红），与统计行的 A 股惯例（买入=红、卖出=绿）相反
    expect(THEME_TOKENS.color.successRaw).toBe('#22c55e')
    expect(THEME_TOKENS.color.destructiveRaw).toBe('#ef4444')
    // 同时验证与 COLOR_TOKENS 的等价关系
    expect(THEME_TOKENS.color.successRaw).toBe(COLOR_TOKENS.scoreHigh.hex)
    expect(THEME_TOKENS.color.destructiveRaw).toBe(COLOR_TOKENS.danger.hex)
  })
})
