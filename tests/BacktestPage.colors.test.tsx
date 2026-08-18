/**
 * @fileoverview 颜色整改验证测试 - BacktestPage
 * @description 验证 src/pages/analysis/BacktestPage.tsx 在批次 F 中的颜色修正：
 * 1. 交易方向标签色：买入=红涨、卖出=绿跌（A 股惯例）
 * 2. 涨跌指标色：总收益率/年化收益率用 STOCK_COLOR_MAPPING.UP/DOWN_CLASS
 * 3. PNL 曲线 stroke 引用 COLOR_TOKENS.success.hex
 * 4. 网格线 stroke 引用 CHART_PALETTE.grid
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BacktestConfig, BacktestResult, BacktestTrade } from '@/store/backtestStore'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { COLOR_TOKENS, CHART_PALETTE, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { UI_TEXT } from '@/constants/uiText'

// ============================================================
// Mock: useBacktestStore
// ============================================================
const mockUseBacktestStore = vi.fn()
vi.mock('@/store/backtestStore', () => ({
  useBacktestStore: () => mockUseBacktestStore(),
}))

// Mock: SelectContent/SelectTrigger/SelectValue（这些组件在测试环境可能未导出）
vi.mock('@/components/atoms/Select', () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: (_props: { placeholder?: string }) => null,
}))

// 延迟导入被测组件
const BacktestPage = (await import('@/pages/analysis/BacktestPage')).default

// ============================================================
// 辅助函数：构建测试数据
// ============================================================
function buildConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    strategy: 'hot_sector',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    initialCapital: 100000,
    ...overrides,
  }
}

function buildTrade(overrides: Partial<BacktestTrade> = {}): BacktestTrade {
  return {
    symbol: 'TEST.SZ',
    direction: 'buy',
    price: 10.5,
    quantity: 100,
    date: '2024-01-15',
    pnl: 100,
    pnlPct: 1.5,
    reason: '测试交易',
    ...overrides,
  }
}

function buildResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    totalReturn: 10.5,
    annualizedReturn: 22.0,
    maxDrawdown: 5.2,
    sharpeRatio: 1.5,
    winRate: 60.0,
    tradeCount: 5,
    profitTrades: 3,
    lossTrades: 2,
    avgProfit: 200,
    avgLoss: 100,
    pnlCurve: [1.0, 1.05, 1.1, 1.08, 1.12, 1.15],
    trades: [buildTrade()],
    ...overrides,
  }
}

function setupStore(overrides: Partial<{
  config: BacktestConfig
  results: BacktestResult | null
  loading: boolean
  error: string | null
}> = {}) {
  mockUseBacktestStore.mockReturnValue({
    config: buildConfig(),
    results: null,
    history: [],
    loading: false,
    error: null,
    setConfig: vi.fn(),
    runBacktest: vi.fn(),
    clearResults: vi.fn(),
    exportReport: vi.fn(),
    exportReportById: vi.fn(),
    ...overrides,
  })
}

/**
 * 切换到「交易记录」tab。
 * BacktestPage 使用 Tabs 组件懒渲染：默认 'results' tab 不渲染 'trades' tab 内容，
 * 必须先点击 TabsTrigger 切换 tab，才能查询交易表格元素。
 */
function switchToTradesTab(): void {
  const tradesTab = screen.getByRole('tab', { name: /交易记录/ })
  fireEvent.click(tradesTab)
}

// ============================================================
// 测试套件
// ============================================================
describe('BacktestPage 颜色整改 - 批次 F', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStore()
  })

  // ----------------------------------------------------------
  // 涨跌指标色（A 股惯例：红涨绿跌）
  // ----------------------------------------------------------
  describe('涨跌指标色 - STOCK_COLOR_MAPPING 引用', () => {
    it('正收益率应渲染为红色（A 股惯例：红涨）', () => {
      setupStore({
        results: buildResult({ totalReturn: 10.5, annualizedReturn: 22.0 }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const totalReturn = screen.getByText(UI_TEXT.errors.totalReturn)
      const metricCard = totalReturn.closest('div')?.parentElement
      const valueEl = metricCard?.querySelector('.font-bold')

      expect(valueEl?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
      expect(valueEl?.className).toContain('text-red-500')
    })

    it('负收益率应渲染为绿色（A 股惯例：绿跌）', () => {
      setupStore({
        results: buildResult({ totalReturn: -8.3, annualizedReturn: -16.0 }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const totalReturn = screen.getByText(UI_TEXT.errors.totalReturn)
      const metricCard = totalReturn.closest('div')?.parentElement
      const valueEl = metricCard?.querySelector('.font-bold')

      expect(valueEl?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
      expect(valueEl?.className).toContain('text-green-500')
    })

    it('正年化收益率应渲染为红色（A 股惯例）', () => {
      setupStore({
        results: buildResult({ totalReturn: 5.0, annualizedReturn: 15.0 }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const annualizedReturn = screen.getByText(UI_TEXT.errors.annualizedReturn)
      const metricCard = annualizedReturn.closest('div')?.parentElement
      const valueEl = metricCard?.querySelector('.font-bold')

      expect(valueEl?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
    })

    it('负年化收益率应渲染为绿色（A 股惯例）', () => {
      setupStore({
        results: buildResult({ totalReturn: -3.0, annualizedReturn: -12.0 }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const annualizedReturn = screen.getByText(UI_TEXT.errors.annualizedReturn)
      const metricCard = annualizedReturn.closest('div')?.parentElement
      const valueEl = metricCard?.querySelector('.font-bold')

      expect(valueEl?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
    })

    it('收益率 = 0 时应渲染为红色（边界值 value >= 0 走 UP 分支）', () => {
      setupStore({
        results: buildResult({ totalReturn: 0, annualizedReturn: 0 }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const totalReturn = screen.getByText(UI_TEXT.errors.totalReturn)
      const metricCard = totalReturn.closest('div')?.parentElement
      const valueEl = metricCard?.querySelector('.font-bold')

      // value >= 0 ? UP_CLASS : DOWN_CLASS → 边界值 0 走 UP
      expect(valueEl?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
    })
  })

  // ----------------------------------------------------------
  // 交易方向标签色（A 股惯例）
  // 注意：交易记录在 'trades' tab 中，需先切换 tab
  // ----------------------------------------------------------
  describe('交易方向标签色 - 买入/卖出 A 股惯例', () => {
    it('买入方向应渲染为红色标签（A 股惯例：买入=红涨）', () => {
      const buyTrade = buildTrade({ direction: 'buy' })
      setupStore({
        results: buildResult({ trades: [buyTrade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const buyBadge = screen.getByText(UI_TEXT.errors.buy)
      expect(buyBadge.className).toContain('bg-destructive/10')
      expect(buyBadge.className).toContain('text-destructive')
    })

    it('卖出方向应渲染为绿色标签（A 股惯例：卖出=绿跌）', () => {
      const sellTrade = buildTrade({ direction: 'sell' })
      setupStore({
        results: buildResult({ trades: [sellTrade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const sellBadge = screen.getByText(UI_TEXT.errors.sell)
      expect(sellBadge.className).toContain('bg-success/10')
      expect(sellBadge.className).toContain('text-success')
    })

    it('买入方向不应使用绿色背景（国际惯例已被替换）', () => {
      const buyTrade = buildTrade({ direction: 'buy' })
      setupStore({
        results: buildResult({ trades: [buyTrade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const buyBadge = screen.getByText(UI_TEXT.errors.buy)
      expect(buyBadge.className).not.toContain('bg-success/10')
      expect(buyBadge.className).not.toContain('text-success')
    })

    it('卖出方向不应使用红色背景（国际惯例已被替换）', () => {
      const sellTrade = buildTrade({ direction: 'sell' })
      setupStore({
        results: buildResult({ trades: [sellTrade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const sellBadge = screen.getByText(UI_TEXT.errors.sell)
      expect(sellBadge.className).not.toContain('bg-destructive/10')
      expect(sellBadge.className).not.toContain('text-destructive')
    })

    it('混合买入/卖出交易应分别使用对应颜色', () => {
      const trades = [
        buildTrade({ direction: 'buy', symbol: 'BUY.TEST' }),
        buildTrade({ direction: 'sell', symbol: 'SELL.TEST' }),
      ]
      setupStore({
        results: buildResult({ trades }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const buyBadge = screen.getByText(UI_TEXT.errors.buy)
      const sellBadge = screen.getByText(UI_TEXT.errors.sell)

      expect(buyBadge.className).toContain('bg-destructive/10')
      expect(sellBadge.className).toContain('bg-success/10')
    })
  })

  // ----------------------------------------------------------
  // 盈亏数值色（A 股惯例）
  // 注意：交易记录在 'trades' tab 中，需先切换 tab
  // ----------------------------------------------------------
  describe('盈亏数值色 - A 股惯例', () => {
    it('盈利交易（pnl >= 0）应渲染为红色', () => {
      const trade = buildTrade({ pnl: 200, pnlPct: 3.5 })
      setupStore({
        results: buildResult({ trades: [trade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      // 盈亏表格单元格应使用 STOCK_COLOR_MAPPING.UP_CLASS
      const cells = screen.getAllByText(/200/)
      const pnlCell = cells.find((el) => el.closest('td'))
      expect(pnlCell?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
    })

    it('亏损交易（pnl < 0）应渲染为绿色', () => {
      const trade = buildTrade({ pnl: -150, pnlPct: -2.5 })
      setupStore({
        results: buildResult({ trades: [trade] }),
      })

      render(<MemoryRouter><BacktestPage /></MemoryRouter>)
      switchToTradesTab()

      const cells = screen.getAllByText(/150/)
      const pnlCell = cells.find((el) => el.closest('td'))
      expect(pnlCell?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
    })
  })

  // ----------------------------------------------------------
  // SVG 元素 stroke 引用 COLOR_TOKENS/CHART_PALETTE
  // 注意：页面内存在多个 SVG（BarChart3 图标 + PNL 曲线），
  // 必须通过 PNL 曲线 SVG 的 className="w-full h-full" 特征定位，
  // 否则会误匹配到 lucide 图标 SVG 的 path（图标 path 无 stroke 属性）。
  // ----------------------------------------------------------
  describe('净值曲线 SVG - 颜色常量引用', () => {
    it('COLOR_TOKENS.success.hex 应为 #21c45d（PNL 曲线 stroke 值，与语义成功色一致）', () => {
      expect(COLOR_TOKENS.success.hex).toBe('#21c45d')
    })

    it('CHART_PALETTE.grid 应为 #e2e8f0（网格线 stroke 值，slate.200 中性收敛）', () => {
      expect(CHART_PALETTE.grid).toBe('#e2e8f0')
    })

    it('净值曲线存在时应渲染 SVG path 元素', () => {
      setupStore({
        results: buildResult({ pnlCurve: [1.0, 1.05, 1.1, 1.08] }),
      })

      const { container } = render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      // 通过 className="w-full h-full" 精确定位 PNL 曲线 SVG
      const pnlSvg = container.querySelector('svg.h-full')
      expect(pnlSvg).not.toBeNull()
      const svgPath = pnlSvg?.querySelector('path')
      expect(svgPath).not.toBeNull()
    })

    it('净值曲线 stroke 应引用 COLOR_TOKENS.success.hex（非硬编码 #22c55e）', () => {
      setupStore({
        results: buildResult({ pnlCurve: [1.0, 1.05, 1.1, 1.08] }),
      })

      const { container } = render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const pnlSvg = container.querySelector('svg.h-full')
      expect(pnlSvg).not.toBeNull()
      // PNL 曲线的主路径（折线）使用 fill="none"，而填充路径使用 fill="url(#pnlGradient)"
      const svgPath = pnlSvg?.querySelector('path[fill="none"]')
      expect(svgPath).not.toBeNull()
      expect(svgPath?.getAttribute('stroke')).toBe(COLOR_TOKENS.success.hex)
    })

    it('网格线 stroke 应引用 CHART_PALETTE.grid（非硬编码 #e2e8f0）', () => {
      setupStore({
        results: buildResult({ pnlCurve: [1.0, 1.05, 1.1, 1.08] }),
      })

      const { container } = render(<MemoryRouter><BacktestPage /></MemoryRouter>)

      const pnlSvg = container.querySelector('svg.h-full')
      expect(pnlSvg).not.toBeNull()
      const gridLine = pnlSvg?.querySelector('line')
      expect(gridLine).not.toBeNull()
      expect(gridLine?.getAttribute('stroke')).toBe(CHART_PALETTE.grid)
    })
  })

  // ----------------------------------------------------------
  // 回归：防止硬编码 HEX 出现
  // ----------------------------------------------------------
  describe('回归 - 禁止硬编码 HEX', () => {
    it('COLOR_TOKENS.success.hex 与 CHART_PALETTE.grid 应不相等', () => {
      // 防止意外写反：success=#22c55e（绿），grid=#e2e8f0（slate 中性）
      expect(COLOR_TOKENS.success.hex).not.toBe(CHART_PALETTE.grid)
    })

    it('STOCK_COLOR_MAPPING UP/DOWN 应与 STOCK_COLOR_TOKENS up/down 一致', () => {
      expect(STOCK_COLOR_MAPPING.UP_CLASS).toBe(STOCK_COLOR_TOKENS.up.tailwind)
      expect(STOCK_COLOR_MAPPING.DOWN_CLASS).toBe(STOCK_COLOR_TOKENS.down.tailwind)
    })
  })
})
