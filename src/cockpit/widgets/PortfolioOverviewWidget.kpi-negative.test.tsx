/**
 * PortfolioOverviewWidget 回撤/夏普 - 数据驱动回归测试
 *
 * 背景：P0 缺陷已修复 —— PortfolioOverviewWidget 曾将「最大回撤」硬编码 "0%"、
 * 「夏普比率」硬编码 "0.0"（无视真实组合数据），且旧测试将其固化为"预期行为"。
 * 修复后两指标读取 portfolio.maxDrawdown / portfolio.sharpeRatio 真实字段，
 * 由 MarketDataAdapter.adaptPortfolio 从采集源（Mock/Live）透传。
 *
 * 本测试作为回归护栏，验证：
 *  1. 组件渲染的是注入的 portfolio 真实值（而非恒 0 占位）
 *  2. 指标随数据变化（不同 maxDrawdown / sharpeRatio 渲染不同结果 → 数据驱动）
 *
 * 运行：npx vitest run src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx --no-coverage
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PortfolioOverviewWidget from '@/cockpit/widgets/PortfolioOverviewWidget'
import type { PortfolioData } from '@/types/modules/widget.types'
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

  it('正向：注入 maxDrawdown=12.3 / sharpe=1.45，渲染真实值而非占位 0', () => {
    setup({ maxDrawdown: 12.3, sharpeRatio: 1.45 })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    // 回撤单元格渲染注入值
    const drawdownLabel = screen.getByText('最大回撤')
    const drawdownCell = drawdownLabel.parentElement!.parentElement!
    expect(within(drawdownCell).getByText('12.3%')).toBeInTheDocument()
    // 夏普单元格渲染注入值
    const sharpeLabel = screen.getByText('夏普比率')
    const sharpeCell = sharpeLabel.parentElement!.parentElement!
    expect(within(sharpeCell).getByText('1.45')).toBeInTheDocument()
    // 不再输出硬编码的 "0%" / "0.0"
    expect(within(drawdownCell).queryByText('0%')).not.toBeInTheDocument()
    expect(within(sharpeCell).queryByText('0.0')).not.toBeInTheDocument()
  })

  it('正向：指标随数据变化（不同值渲染不同结果，证明非硬编码）', () => {
    setup({ maxDrawdown: 25.4, sharpeRatio: -0.25 })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const drawdownLabel = screen.getByText('最大回撤')
    const drawdownCell = drawdownLabel.parentElement!.parentElement!
    expect(within(drawdownCell).getByText('25.4%')).toBeInTheDocument()

    const sharpeLabel = screen.getByText('夏普比率')
    const sharpeCell = sharpeLabel.parentElement!.parentElement!
    expect(within(sharpeCell).getByText('-0.25')).toBeInTheDocument()
  })
})
