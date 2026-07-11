/**
 * PortfolioOverviewWidget 组件单元测试
 *
 * 覆盖场景：
 * 1. 渲染不崩溃 + 标题显示
 * 2. 加载状态（loading=true）显示骨架屏
 * 3. portfolio 为 null 时显示骨架屏
 * 4. 错误状态显示错误消息 + danger 颜色令牌
 * 5. 汇总指标（总资产、可用资金、持仓数量、盈亏、回撤、夏普）
 * 6. 边界 - 持仓数量为 0 / totalAssets 为 "0"
 * 7. 持仓列表渲染（多持仓 + 空持仓状态）
 * 8. 持仓权重显示（当前 vs 目标 + 偏离高亮）
 * 9. 持仓盈亏颜色令牌（正涨负跌）
 * 10. 再平衡计划展示（有计划 + 空计划）
 * 11. 再平衡动作颜色令牌（buy=up/sell=down/hold=gray）
 *
 * 说明：
 * - 组件通过 useMarketData() 读取 PortfolioData（来自 widget.types.ts）
 * - PortfolioData.holdingsList 为 HoldingItem[]，rebalancePlan 为 RebalancePlanItem[]
 * - 组件无 useEffect 事件监听，无需验证 cleanup
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PortfolioOverviewWidget from '@/cockpit/widgets/PortfolioOverviewWidget'
import type { PortfolioData, MarketData, HoldingItem, RebalancePlanItem } from '@/types/modules/widget.types'
import { COLOR_TOKENS, twBg, twText } from '@/constants/theme.tokens'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock 1: logger（避免 Card 组件真实日志输出）
// ============================================================
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// Mock 2: lucide-react icons（渲染占位 SVG，减少 DOM 噪音）
// ============================================================
vi.mock('lucide-react', () => ({
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  Wallet: () => <svg data-testid="icon-wallet" />,
  Target: () => <svg data-testid="icon-target" />,
  AlertTriangle: () => <svg data-testid="icon-alert" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
}))

// ============================================================
// Mock 3: useMarketData（控制 data/loadingMap/errorMap 返回值）
// ============================================================
const mockUseMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

// ============================================================
// 测试辅助
// ============================================================
const WIDGET_INSTANCE_ID = 'widget-portfolio-1'

/** 构建 HoldingItem 实例（builder 模式 + override） */
function buildHolding(overrides: Partial<HoldingItem> = {}): HoldingItem {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    shares: 100,
    price: '1,800.00',
    marketValue: '180,000.00',
    weight: 40.0,
    targetWeight: 45.0,
    pnl: '+12,000.00',
    pnlPercent: 7.14,
    ...overrides,
  }
}

/** 构建 RebalancePlanItem 实例（builder 模式 + override） */
function buildRebalanceItem(overrides: Partial<RebalancePlanItem> = {}): RebalancePlanItem {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    action: 'buy',
    shares: 25,
    reason: '增持至目标权重',
    ...overrides,
  }
}

/** 构建 PortfolioData 实例（builder 模式 + override） */
function buildPortfolioData(overrides: Partial<PortfolioData> = {}): PortfolioData {
  return {
    totalAssets: '540,000.00',
    availableFunds: '60,000.00',
    todayPnL: '+12,345.00',
    todayPnLPercent: 2.34,
    totalPnL: '+85,000.00',
    totalPnLPercent: 18.75,
    holdings: 5,
    holdingsList: [],
    rebalancePlan: [],
    ...overrides,
  }
}

/** 配置 useMarketData mock 返回值 */
function setupMarketData(options: {
  portfolio?: PortfolioData | null
  loading?: boolean
  error?: string | null
} = {}): void {
  const { portfolio = null, loading = false, error = null } = options
  const data = (portfolio ? { portfolio } : {}) as unknown as MarketData
  mockUseMarketData.mockReturnValue({
    data,
    loadingMap: { [WIDGET_INSTANCE_ID]: loading },
    errorMap: { [WIDGET_INSTANCE_ID]: error },
    refreshWidget: vi.fn(),
    getTaskStats: vi.fn(),
    sendChatMessage: vi.fn(),
  })
}

/** 构建 WidgetConfig（复用 fixture，固定 instanceId/title） */
function buildConfig(): ReturnType<typeof buildWidgetConfig> {
  return buildWidgetConfig({
    instanceId: WIDGET_INSTANCE_ID,
    widgetId: 'portfolioOverview',
    title: '持仓概览',
  })
}

// ============================================================
// 测试套件
// ============================================================
describe('PortfolioOverviewWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ----------------------------------------------------------
  // 基础渲染与状态
  // ----------------------------------------------------------

  it('渲染不崩溃，且显示配置的标题', () => {
    setupMarketData({ portfolio: buildPortfolioData() })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('持仓概览')).toBeInTheDocument()
  })

  it('加载状态（loading=true）显示骨架屏，不渲染业务数据', () => {
    setupMarketData({ portfolio: buildPortfolioData(), loading: true })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const skeletons = document.querySelectorAll('.bg-gray-200')
    expect(skeletons.length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByText('总资产')).not.toBeInTheDocument()
  })

  it('portfolio 为 null 时显示骨架屏（即使 loading=false）', () => {
    setupMarketData({ portfolio: null, loading: false })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.queryByText('总资产')).not.toBeInTheDocument()
    const skeletons = document.querySelectorAll('.bg-gray-200')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('错误状态显示错误消息文本', () => {
    setupMarketData({ portfolio: null, loading: false, error: '网络连接失败' })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('网络连接失败')).toBeInTheDocument()
  })

  it('错误状态使用 danger 颜色令牌（AGENTS.md §3.5.5）', () => {
    setupMarketData({ portfolio: null, loading: false, error: '加载失败' })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const errorText = screen.getAllByText('加载失败')[0]!
    const errorContainer = errorText.parentElement
    expect(errorContainer).not.toBeNull()
    expect(errorContainer).toHaveClass(COLOR_TOKENS.danger.tailwind)
  })

  // ----------------------------------------------------------
  // 汇总指标
  // ----------------------------------------------------------

  it('渲染总资产数值', () => {
    setupMarketData({
      portfolio: buildPortfolioData({ totalAssets: '1,234,567.89' }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('总资产')).toBeInTheDocument()
    expect(screen.getByText('1,234,567.89')).toBeInTheDocument()
  })

  it('渲染可用资金数值', () => {
    setupMarketData({
      portfolio: buildPortfolioData({ availableFunds: '88,888.00' }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('可用资金')).toBeInTheDocument()
    expect(screen.getByText('88,888.00')).toBeInTheDocument()
  })

  it('渲染持仓数量（多持仓 holdings=5 显示 "5只"）', () => {
    setupMarketData({ portfolio: buildPortfolioData({ holdings: 5 }) })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('持仓')).toBeInTheDocument()
    expect(screen.getByText('5只')).toBeInTheDocument()
  })

  it('边界 - 持仓数量为 0 时显示 "0只"', () => {
    setupMarketData({ portfolio: buildPortfolioData({ holdings: 0 }) })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('0只')).toBeInTheDocument()
  })

  it('渲染当日盈亏金额和百分比，且卡片使用 green-50 背景令牌', () => {
    setupMarketData({
      portfolio: buildPortfolioData({
        todayPnL: '+12,345.00',
        todayPnLPercent: 2.34,
      }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('当日盈亏')).toBeInTheDocument()
    expect(screen.getByText('+12,345.00')).toBeInTheDocument()
    expect(screen.getByText('+2.34%')).toBeInTheDocument()

    const pnlLabel = screen.getByText('当日盈亏')
    const pnlCard = pnlLabel.parentElement
    expect(pnlCard).not.toBeNull()
    expect(pnlCard).toHaveClass(twBg('green', 50))
  })

  it('渲染累计盈亏并使用 info 颜色令牌', () => {
    setupMarketData({
      portfolio: buildPortfolioData({
        totalPnL: '+85,000.00',
        totalPnLPercent: 18.75,
      }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('累计盈亏')).toBeInTheDocument()
    expect(screen.getByText('+85,000.00')).toBeInTheDocument()
    expect(screen.getByText('+18.75%')).toBeInTheDocument()

    const totalPnLText = screen.getByText('+85,000.00')
    expect(totalPnLText).toHaveClass(COLOR_TOKENS.info.tailwind)
  })

  it('渲染最大回撤和夏普比率（当前固定占位 0% / 0.0）', () => {
    setupMarketData({ portfolio: buildPortfolioData() })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('最大回撤')).toBeInTheDocument()
    expect(screen.getByText('夏普比率')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('边界 - totalAssets 为 "0" 且 holdings 为 0 时正常渲染', () => {
    setupMarketData({
      portfolio: buildPortfolioData({ totalAssets: '0', holdings: 0 }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('持仓概览')).toBeInTheDocument()
    expect(screen.getByText('总资产')).toBeInTheDocument()
    expect(screen.getByText('0只')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 持仓列表渲染
  // ----------------------------------------------------------

  it('持仓列表 - 多持仓时渲染所有持仓项（股票名称+代码）', () => {
    const holdings = [
      buildHolding({ symbol: '600519.SH', name: '贵州茅台' }),
      buildHolding({ symbol: '00700.HK', name: '腾讯控股' }),
      buildHolding({ symbol: '000001.SZ', name: '平安银行' }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 3, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('持仓明细')).toBeInTheDocument()
    expect(screen.getByTestId('holdings-list')).toBeInTheDocument()
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.getByText('600519.SH')).toBeInTheDocument()
    expect(screen.getByText('腾讯控股')).toBeInTheDocument()
    expect(screen.getByText('00700.HK')).toBeInTheDocument()
    expect(screen.getByText('平安银行')).toBeInTheDocument()
  })

  it('持仓列表 - 空持仓时显示 "暂无持仓" 提示', () => {
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 0, holdingsList: [] }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('持仓明细')).toBeInTheDocument()
    expect(screen.queryByTestId('holdings-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('holdings-empty')).toBeInTheDocument()
    expect(screen.getByText('暂无持仓')).toBeInTheDocument()
  })

  it('持仓列表 - 渲染股数、价格、市值信息', () => {
    const holdings = [
      buildHolding({
        symbol: '600519.SH',
        name: '贵州茅台',
        shares: 100,
        price: '1,800.00',
        marketValue: '180,000.00',
      }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText(/100股/)).toBeInTheDocument()
    expect(screen.getByText(/1,800.00/)).toBeInTheDocument()
    expect(screen.getByText(/180,000.00/)).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 持仓权重显示
  // ----------------------------------------------------------

  it('持仓权重 - 显示当前权重和目标权重（"40.0% → 45.0%"）', () => {
    const holdings = [
      buildHolding({ weight: 40.0, targetWeight: 45.0 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('40.0%')).toBeInTheDocument()
    expect(screen.getByText('45.0%')).toBeInTheDocument()
  })

  it('持仓权重 - 超配（weight - targetWeight > 5%）使用 red-500 颜色令牌', () => {
    const holdings = [
      buildHolding({ weight: 50.0, targetWeight: 40.0 }), // 偏离 +10%
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    // 权重显示容器应使用 twText('red', 500)
    const weightElement = screen.getByText('50.0%')
    expect(weightElement).toHaveClass(twText('red', 500))
  })

  it('持仓权重 - 低配（targetWeight - weight > 5%）使用 amber-500 颜色令牌', () => {
    const holdings = [
      buildHolding({ weight: 30.0, targetWeight: 40.0 }), // 偏离 -10%
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const weightElement = screen.getByText('30.0%')
    expect(weightElement).toHaveClass(twText('amber', 500))
  })

  it('持仓权重 - 平衡状态（偏离 ≤ 5%）使用 gray-500 颜色令牌', () => {
    const holdings = [
      buildHolding({ weight: 42.0, targetWeight: 40.0 }), // 偏离 +2%
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const weightElement = screen.getByText('42.0%')
    expect(weightElement).toHaveClass('text-gray-500')
  })

  it('持仓盈亏 - 正盈亏使用 up 颜色令牌（红）', () => {
    const holdings = [
      buildHolding({ pnl: '+12,000.00', pnlPercent: 7.14 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const pnlElement = screen.getByText(/\+12,000.00/)
    expect(pnlElement).toHaveClass(COLOR_TOKENS.up.tailwind)
  })

  it('持仓盈亏 - 负盈亏使用 down 颜色令牌（绿）', () => {
    const holdings = [
      buildHolding({ pnl: '-5,000.00', pnlPercent: -3.5 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ holdings: 1, holdingsList: holdings }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const pnlElement = screen.getByText(/-5,000.00/)
    expect(pnlElement).toHaveClass(COLOR_TOKENS.down.tailwind)
  })

  // ----------------------------------------------------------
  // 再平衡计划展示
  // ----------------------------------------------------------

  it('再平衡计划 - 有计划时渲染所有动作项', () => {
    const plan = [
      buildRebalanceItem({ symbol: '600519.SH', name: '贵州茅台', action: 'buy', shares: 25 }),
      buildRebalanceItem({ symbol: '00700.HK', name: '腾讯控股', action: 'sell', shares: 60 }),
      buildRebalanceItem({ symbol: '000001.SZ', name: '平安银行', action: 'hold', shares: 0 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: plan }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('再平衡计划')).toBeInTheDocument()
    expect(screen.getByTestId('rebalance-plan')).toBeInTheDocument()
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.getByText('腾讯控股')).toBeInTheDocument()
    expect(screen.getByText('平安银行')).toBeInTheDocument()
  })

  it('再平衡计划 - 空计划时显示 "组合已平衡" 提示', () => {
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: [] }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText('再平衡计划')).toBeInTheDocument()
    expect(screen.queryByTestId('rebalance-plan')).not.toBeInTheDocument()
    expect(screen.getByTestId('rebalance-empty')).toBeInTheDocument()
    expect(screen.getByText('组合已平衡')).toBeInTheDocument()
  })

  it('再平衡动作 - buy 使用 up 颜色令牌（红，A 股惯例）', () => {
    const plan = [
      buildRebalanceItem({ name: '贵州茅台', action: 'buy', shares: 25 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: plan }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const buyLabel = screen.getByText('买入')
    expect(buyLabel).toHaveClass(COLOR_TOKENS.up.tailwind)
  })

  it('再平衡动作 - sell 使用 down 颜色令牌（绿，A 股惯例）', () => {
    const plan = [
      buildRebalanceItem({ name: '腾讯控股', action: 'sell', shares: 60 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: plan }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const sellLabel = screen.getByText('卖出')
    expect(sellLabel).toHaveClass(COLOR_TOKENS.down.tailwind)
  })

  it('再平衡动作 - hold 使用 gray-500 颜色令牌', () => {
    const plan = [
      buildRebalanceItem({ name: '平安银行', action: 'hold', shares: 0 }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: plan }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    const holdLabel = screen.getByText('持有')
    expect(holdLabel).toHaveClass('text-gray-500')
  })

  it('再平衡计划 - 渲染调整股数和理由', () => {
    const plan = [
      buildRebalanceItem({
        name: '贵州茅台',
        action: 'buy',
        shares: 25,
        reason: '增持至目标权重',
      }),
    ]
    setupMarketData({
      portfolio: buildPortfolioData({ rebalancePlan: plan }),
    })
    render(<PortfolioOverviewWidget config={buildConfig()} />)

    expect(screen.getByText(/25股/)).toBeInTheDocument()
    expect(screen.getByText('增持至目标权重')).toBeInTheDocument()
  })
})
