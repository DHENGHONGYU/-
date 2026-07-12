/**
 * @fileoverview RiskMonitorWidget 单元测试
 * @description 验证风险监控 Widget 的渲染逻辑、风险等级（varLevel）三档 Badge 与颜色令牌、
 * 核心/次要指标的条件着色、风险告警分支、以及加载/错误/空态。
 *
 * 覆盖关键点：
 * - 默认 props 渲染 / 标题来自 config
 * - 错误态（COLOR_TOKENS.danger 内联色）
 * - 加载骨架（animate-pulse 占位数量）
 * - 空态（orders.length === 0 → 暂无风险数据）
 * - 核心指标渲染：VaR(95%) / 最大回撤 / 波动率
 * - varLevel 三档：high→高风险(红) / medium→中风险(黄) / low→低风险(绿)
 * - VaR 数值着色：high→danger / 其他→warningRaw
 * - 次要指标条件着色：夏普比率(>=0 绿 / <0 红)、集中度(>50 红 / <=50 绿)
 * - 风险告警分支：alerts 非空渲染列表 / 空渲染「当前无风险告警」
 * - useEffect 清理：initOrderStoreSubscriptions 返回的 cleanup 在卸载时被调用
 * - 挂载即触发 store.refresh()
 *
 * 颜色断言遵循 AGENTS.md §3.5.5：使用 COLOR_TOKENS / THEME_TOKENS 令牌引用，
 * 内联色做 hex→rgb 容错比较（jsdom 可能归一化）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig } from '@/types/modules/widget.types'
import type { RiskMetrics } from '@/services/trading/riskComputer'
import { COLOR_TOKENS, THEME_TOKENS } from '@/constants/theme.tokens'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: orderStore（RiskMonitorWidget 依赖）
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
  riskMetrics: {},
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
const RiskMonitorWidget = (await import('./RiskMonitorWidget')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '风险监控'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'risk-monitor-1',
    widgetId: 'riskMonitor',
    title,
  })
}

/** 构建一组合理的默认 RiskMetrics（低风险基线） */
function buildRiskMetrics(overrides: Partial<RiskMetrics> = {}): RiskMetrics {
  return {
    var95: -3.5,
    varLevel: 'low',
    maxDrawdown: 8.2,
    volatility: 12.4,
    sharpeRatio: 1.25,
    betaEstimate: 1,
    concentration: 35,
    alerts: [],
    ...overrides,
  }
}

/** 配置 mock store 返回指定 riskMetrics（默认 orders 非空、loading=false、error=null） */
function setupMetrics(
  riskMetrics: RiskMetrics,
  opts: { orders?: unknown[]; loading?: boolean; error?: string | null } = {},
): void {
  const { orders = [{ id: 'o1' }], loading = false, error = null } = opts
  mockUseOrderStore.mockReturnValue({
    orders,
    riskMetrics,
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
  // 提供可读失败信息
  expect(actual).toBe(hex)
}

// ============================================================
// 测试套件
// ============================================================
describe('RiskMonitorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitOrderStoreSubscriptions.mockReturnValue(() => {})
    mockRefresh.mockResolvedValue(undefined)
    setupMetrics(buildRiskMetrics())
  })

  // ----------------------------------------------------------
  // 默认 / 标题
  // ----------------------------------------------------------
  it('renders widget title from config by default', () => {
    setupMetrics(buildRiskMetrics(), { orders: [{ id: 'o1' }] })
    render(<RiskMonitorWidget config={buildConfig('实时风险监控')} />)

    expect(screen.getByText('实时风险监控')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 错误态
  // ----------------------------------------------------------
  it('renders error message with danger color token when error is set', () => {
    setupMetrics(buildRiskMetrics(), { error: '风险数据加载失败' })
    const { container } = render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('风险数据加载失败')).toBeInTheDocument()
    // WidgetStateShell 的 error 状态将 COLOR_TOKENS.danger.tailwind 注入 ErrorState 外层容器
    const cardContent = container.querySelector('.text-center')
    expect(cardContent).not.toBeNull()
    expect((cardContent as HTMLElement).className).toContain(COLOR_TOKENS.danger.tailwind)
  })

  // ----------------------------------------------------------
  // 加载骨架
  // ----------------------------------------------------------
  it('renders 4 loading skeletons (animate-pulse) when loading is true', () => {
    setupMetrics(buildRiskMetrics(), { loading: true })
    const { container } = render(<RiskMonitorWidget config={buildConfig('加载中风险')} />)

    expect(screen.getByText('加载中风险')).toBeInTheDocument()
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  // ----------------------------------------------------------
  // 空态（orders.length === 0）
  // ----------------------------------------------------------
  it('renders empty state with hint when orders list is empty', () => {
    setupMetrics(buildRiskMetrics(), { orders: [] })
    render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('暂无风险数据')).toBeInTheDocument()
    expect(
      screen.getByText('完成交易后将自动计算VaR、回撤、波动率等风险指标'),
    ).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 核心指标渲染
  // ----------------------------------------------------------
  it('renders core risk metrics with correct values', () => {
    setupMetrics(
      buildRiskMetrics({
        var95: -3.5,
        maxDrawdown: 8.2,
        volatility: 12.4,
      }),
    )
    render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('VaR(95%)')).toBeInTheDocument()
    expect(screen.getByText('-3.5%')).toBeInTheDocument()
    expect(screen.getByText('最大回撤')).toBeInTheDocument()
    expect(screen.getByText('8.2%')).toBeInTheDocument()
    expect(screen.getByText('波动率')).toBeInTheDocument()
    expect(screen.getByText('12.4%')).toBeInTheDocument()
  })

  it('renders secondary metrics: sharpe ratio, beta, concentration', () => {
    setupMetrics(
      buildRiskMetrics({
        sharpeRatio: 1.25,
        betaEstimate: 1,
        concentration: 35,
      }),
    )
    render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('夏普比率')).toBeInTheDocument()
    expect(screen.getByText('1.25')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('集中度')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // varLevel 三档 Badge 文案 + 颜色令牌
  // ----------------------------------------------------------
  it('renders "高风险" badge with danger token when varLevel is high', () => {
    setupMetrics(buildRiskMetrics({ varLevel: 'high' }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const badge = screen.getByText('高风险')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain(COLOR_TOKENS.danger.tailwind) // text-red-500
    expect(badge.className).toContain('border-red-300') // twBorder('red', 300)
  })

  it('renders "中风险" badge with yellow token when varLevel is medium', () => {
    setupMetrics(buildRiskMetrics({ varLevel: 'medium' }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const badge = screen.getByText('中风险')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-yellow-500') // twText('yellow', 500)
    expect(badge.className).toContain('border-yellow-300') // twBorder('yellow', 300)
  })

  it('renders "低风险" badge with success token when varLevel is low', () => {
    setupMetrics(buildRiskMetrics({ varLevel: 'low' }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const badge = screen.getByText('低风险')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain(COLOR_TOKENS.success.tailwind) // text-green-700
    expect(badge.className).toContain('border-green-300') // twBorder('green', 300)
  })

  // ----------------------------------------------------------
  // VaR 数值着色：high → danger / 其他 → warningRaw
  // ----------------------------------------------------------
  it('colors VaR value with danger hex when varLevel is high', () => {
    setupMetrics(buildRiskMetrics({ var95: -6.5, varLevel: 'high' }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const varValue = screen.getByText('-6.5%')
    expectInlineColor(varValue, COLOR_TOKENS.danger.hex)
  })

  it('colors VaR value with warningRaw when varLevel is not high', () => {
    setupMetrics(buildRiskMetrics({ var95: -3.5, varLevel: 'low' }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const varValue = screen.getByText('-3.5%')
    expectInlineColor(varValue, THEME_TOKENS.color.warningRaw)
  })

  // ----------------------------------------------------------
  // 次要指标条件着色
  // 夏普比率 >=0 → success / <0 → danger
  // ----------------------------------------------------------
  it('colors sharpe ratio green when >= 0', () => {
    setupMetrics(buildRiskMetrics({ sharpeRatio: 1.25 }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const sharpe = screen.getByText('1.25')
    expectInlineColor(sharpe, COLOR_TOKENS.success.hex)
  })

  it('colors sharpe ratio red when < 0', () => {
    setupMetrics(buildRiskMetrics({ sharpeRatio: -0.5 }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const sharpe = screen.getByText('-0.5')
    expectInlineColor(sharpe, COLOR_TOKENS.danger.hex)
  })

  // 集中度 >50 → danger / <=50 → success
  it('colors concentration red when > 50', () => {
    setupMetrics(buildRiskMetrics({ concentration: 75 }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const concentration = screen.getByText('75%')
    expectInlineColor(concentration, COLOR_TOKENS.danger.hex)
  })

  it('colors concentration green when <= 50', () => {
    setupMetrics(buildRiskMetrics({ concentration: 30 }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    const concentration = screen.getByText('30%')
    expectInlineColor(concentration, COLOR_TOKENS.success.hex)
  })

  // ----------------------------------------------------------
  // 风险告警分支
  // ----------------------------------------------------------
  it('renders risk alerts list when alerts is non-empty', () => {
    setupMetrics(
      buildRiskMetrics({
        alerts: [
          '持仓集中度超过 50%，建议分散风险',
          'VaR(95%) 处于高风险区间',
        ],
      }),
    )
    render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('风险告警')).toBeInTheDocument()
    expect(screen.getByText('持仓集中度超过 50%，建议分散风险')).toBeInTheDocument()
    expect(screen.getByText('VaR(95%) 处于高风险区间')).toBeInTheDocument()
  })

  it('renders "当前无风险告警" when alerts is empty', () => {
    setupMetrics(buildRiskMetrics({ alerts: [] }))
    render(<RiskMonitorWidget config={buildConfig()} />)

    expect(screen.getByText('当前无风险告警，组合风险可控')).toBeInTheDocument()
    expect(screen.queryByText('风险告警')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // useEffect 清理（AGENTS.md §3 事件监听清理）
  // ----------------------------------------------------------
  it('calls cleanup returned by initOrderStoreSubscriptions on unmount', () => {
    const cleanup = vi.fn()
    mockInitOrderStoreSubscriptions.mockReturnValue(cleanup)
    setupMetrics(buildRiskMetrics())

    const { unmount } = render(<RiskMonitorWidget config={buildConfig()} />)
    // mount 阶段应调用 init
    expect(mockInitOrderStoreSubscriptions).toHaveBeenCalledTimes(1)

    unmount()
    // unmount 阶段应调用返回的 cleanup
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('invokes store refresh on mount via useEffect', async () => {
    setupMetrics(buildRiskMetrics())
    render(<RiskMonitorWidget config={buildConfig()} />)

    // useEffect 中 void useOrderStore.getState().refresh()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  // ----------------------------------------------------------
  // 颜色常量一致性锚点（防御令牌被意外修改）
  // ----------------------------------------------------------
  it('COLOR_TOKENS / THEME_TOKENS 锚点值应与 RiskMonitorWidget 源码引用一致', () => {
    // 源码 VaR 高风险 / 集中度高风险 使用 COLOR_TOKENS.danger.hex (#ef4444)
    expect(COLOR_TOKENS.danger.hex).toBe('#ef4444')
    // 源码 夏普>=0 / 集中度<=50 使用 COLOR_TOKENS.success.hex（与 text-green-700 一致）
    expect(COLOR_TOKENS.success.hex).toBe('#15803d')
    expect(COLOR_TOKENS.success.tailwind).toBe('text-green-700')
    // 源码 波动率 使用 COLOR_TOKENS.info.hex (#3b82f6)
    expect(COLOR_TOKENS.info.hex).toBe('#3b82f6')
    // 源码 VaR 非高风险 使用 THEME_TOKENS.color.warningRaw (#f59e0b)
    expect(THEME_TOKENS.color.warningRaw).toBe('#f59e0b')
    // 三档 Badge 边界 token
    expect(COLOR_TOKENS.danger.tailwind).toBe('text-red-500')
    expect(COLOR_TOKENS.success.tailwind).toBe('text-green-700')
  })
})
