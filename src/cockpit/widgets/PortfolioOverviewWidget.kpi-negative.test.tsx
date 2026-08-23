/**
 * PortfolioOverviewWidget 回撤/夏普 - 数据驱动回归测试
 *
 * 背景：P0 缺陷已修复 —— PortfolioOverviewWidget 曾将「最大回撤」硬编码 "0%"、
 * 「夏普比率」硬编码 "0.0"（无视真实组合数据），且旧测试将其固化为"预期行为"。
 * B1 升级后两指标改由真实权益曲线（portfolio.equityCurve）经
 * computeMaxDrawdown / computeSharpeRatio 纯函数实时计算，曲线缺失时显式展示「数据不足」。
 *
 * 本测试作为回归护栏，验证：
 *  1. 组件渲染的是由注入权益曲线计算出的真实值（而非恒 0 占位）
 *  2. 指标随曲线变化（不同曲线渲染不同结果 → 数据驱动）
 *  3. 曲线不足时显式标注「数据不足」
 *
 * 2026-08-23 Token Plan 处理事项：同步 B1 升级（旧版注入 maxDrawdown/sharpeRatio
 * 字段的断言已失效），改为注入 equityCurve 并用同一纯函数推导期望值。
 *
 * 运行：npx vitest run src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx --no-coverage
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PortfolioOverviewWidget from '@/cockpit/widgets/PortfolioOverviewWidget'
import type { PortfolioData } from '@/types/modules/widget.types'
import { computeMaxDrawdown, computeSharpeRatio } from '@/lib/utils/portfolioMetrics'
import { buildWidgetConfig } from '../../../tests/fixtures'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('lucide-react', () => ({
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  Wallet: () => <svg data-testid="icon-wallet" />,
  Target: () => <svg data-testid="icon-target" />,
  AlertTriangle: () => <svg data-testid="icon-alert" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
}))

const mockUseMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

const WIDGET_INSTANCE_ID = 'widget-portfolio-neg'

function setup(overrides: Partial<PortfolioData> = {}): void {
  const portfolio: PortfolioData = {
    totalAssets: '100,000.00',
    availableFunds: '0.00',
    todayPnL: '-5,000.00',
    todayPnLPercent: -5,
    totalPnL: '-5,000.00',
    totalPnLPercent: -5,
    holdings: 3,
    holdingsList: [],
    rebalancePlan: [],
    maxDrawdown: 0,
    sharpeRatio: 0,
    ...overrides,
  }
  mockUseMarketData.mockReturnValue({
    data: { portfolio } as unknown as Parameters<typeof mockUseMarketData>[0],
    loadingMap: { [WIDGET_INSTANCE_ID]: false },
    errorMap: { [WIDGET_INSTANCE_ID]: null },
    refreshWidget: vi.fn(),
    getTaskStats: vi.fn(),
    sendChatMessage: vi.fn(),
  })
}

function buildConfig() {
  return buildWidgetConfig({ instanceId: WIDGET_INSTANCE_ID, widgetId: 'portfolioOverview', title: '持仓概览' })
}

describe('PortfolioOverviewWidget 回撤/夏普 - 数据驱动（防回归）', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('正向：注入权益曲线，渲染由曲线计算的真实值而非占位 0', () => {
    const curve = [100, 87.7, 95]
    setup({ equityCurve: curve })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    // 回撤单元格渲染由曲线计算的值（与组件同源纯函数口径一致）
    const drawdownLabel = screen.getByText('最大回撤')
    const drawdownCell = drawdownLabel.parentElement!.parentElement!
    expect(within(drawdownCell).getByText(`${computeMaxDrawdown(curve).toFixed(1)}%`)).toBeInTheDocument()
    // 夏普单元格渲染由曲线计算的值
    const sharpeLabel = screen.getByText('夏普比率')
    const sharpeCell = sharpeLabel.parentElement!.parentElement!
    expect(within(sharpeCell).getByText(computeSharpeRatio(curve).toFixed(2))).toBeInTheDocument()
    // 不再输出硬编码的 "0%" / "0.0" 占位（也非「数据不足」）
    expect(within(drawdownCell).queryByText('0%')).not.toBeInTheDocument()
    expect(within(sharpeCell).queryByText('0.0')).not.toBeInTheDocument()
    expect(within(drawdownCell).queryByText('数据不足')).not.toBeInTheDocument()
  })

  it('正向：指标随曲线变化（不同曲线渲染不同结果，证明非硬编码）', () => {
    const curve = [100, 74.6, 90]
    setup({ equityCurve: curve })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const drawdownLabel = screen.getByText('最大回撤')
    const drawdownCell = drawdownLabel.parentElement!.parentElement!
    expect(within(drawdownCell).getByText(`${computeMaxDrawdown(curve).toFixed(1)}%`)).toBeInTheDocument()

    const sharpeLabel = screen.getByText('夏普比率')
    const sharpeCell = sharpeLabel.parentElement!.parentElement!
    expect(within(sharpeCell).getByText(computeSharpeRatio(curve).toFixed(2))).toBeInTheDocument()
  })

  it('边界：权益曲线不足时显式标注「数据不足」而非静默显示 0', () => {
    setup({ equityCurve: [100] })
    render(<PortfolioOverviewWidget config={buildConfig()} />)
    expect(screen.getAllByText('数据不足')).toHaveLength(2)
  })
})
