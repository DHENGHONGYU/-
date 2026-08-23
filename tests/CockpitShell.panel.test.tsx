/**
 * @fileoverview CockpitShell 交叉布局渲染测试
 * @description 验证驾驶舱布局（三页决策模式 + 技术钻取矩阵）的核心渲染行为：
 *  1. 展开「技术钻取」后 4 个域（智能研判/市场总览/AI 辅助/持仓与风控）正确渲染
 *  2. 域导航按钮显示 Widget 计数、激活态正确（默认市场总览域）
 *  3. 域切换交互正常工作（aria-pressed 翻转）
 *  4. 空实例列表处理 + 三页决策模式页面标题渲染
 *
 * @since v2.8.0 - 2026-08-09
 * @doc cockpit-cross-layout
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ============================================================
// Mock: 依赖模块（在 import CockpitShell 之前完成）
// ============================================================

// MarketDataProvider — 返回最小可用数据
const mockUseMarketData = vi.fn()
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  MarketDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMarketData: () => mockUseMarketData(),
}))

// widgetRegistry — 返回受控的实例列表
const mockGetAllInstances = vi.fn()
const mockSubscribe = vi.fn(() => () => {})
// 使用真实的 WIDGET_CROSS_LAYOUT 映射，确保 domain/perspective 分组正确
import { WIDGET_CROSS_LAYOUT } from '@/constants/cockpit.constants'
const mockGetTemplate = vi.fn((widgetId: string) => {
  const layout = WIDGET_CROSS_LAYOUT[widgetId]
  if (!layout) return undefined
  return {
    widgetId,
    meta: { id: widgetId, name: widgetId, domain: layout.domain, perspective: layout.perspective },
  }
})
vi.mock('@/cockpit/core/widgetRegistry', () => ({
  widgetRegistry: {
    getAllInstances: () => mockGetAllInstances(),
    subscribe: (_cb: () => void) => mockSubscribe(),
    getTemplate: (widgetId: string) => mockGetTemplate(widgetId),
  },
}))

// widgetEngine — 懒加载 mock（2026-08-23 补齐 mountInstance/unmountInstance，
// 此前缺失导致 WidgetWrapper 挂载链路 TypeError）
vi.mock('@/cockpit/core/widgetEngine', () => ({
  widgetEngine: {
    loadComponent: vi.fn().mockResolvedValue(() => null),
    mountInstance: vi.fn().mockResolvedValue(true),
    unmountInstance: vi.fn(),
    refreshInstance: vi.fn().mockResolvedValue(true),
  },
}))

// Store mocks
vi.mock('@/store/intentionPoolStore', () => ({
  useIntentionPoolStore: () => 0,
}))
vi.mock('@/store/tradingStore', () => ({
  useTradingStore: () => ({ signals: [] }),
}))

// React Router Link mock
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

// ============================================================
// 导入被测组件（在所有 mock 之后）
// ============================================================
const CockpitShellModule = await import('@/cockpit/CockpitShell')
const CockpitShell = CockpitShellModule.default
// CockpitShell 内置 DensityToggle 依赖 DensityContext，测试须用 DensityProvider 包裹（与应用真实挂载一致）
const { DensityProvider } = await import('@/components/cockpit/DensityContext')

/** 统一渲染入口：包裹 DensityProvider，对齐应用真实挂载链路 */
function renderShell() {
  return render(
    <DensityProvider>
      <CockpitShell />
    </DensityProvider>,
  )
}

/**
 * 展开「技术钻取」折叠区，使域×视角导航按钮可见。
 * 2026-08-23 better-harness F-003：驾驶舱已演进为三页决策模式，
 * 域导航按钮仅在技术钻取区展开后渲染（CockpitCrossLayout drillMatrixOpen 默认 false）。
 */
function expandTechnicalDrilldown(): void {
  fireEvent.click(screen.getByRole('button', { name: /技术钻取/ }))
}

/**
 * 定位域导航按钮（按 aria-pressed 属性区分：矩阵单元格按钮的 aria-label 也含域名）。
 */
function getDomainButton(label: RegExp): HTMLButtonElement {
  const buttons = screen.getAllByRole('button', { name: label })
  const nav = buttons.find((b) => b.hasAttribute('aria-pressed'))
  if (!nav) throw new Error(`未找到域导航按钮: ${label}`)
  return nav
}

// ============================================================
// 测试数据构建
// ============================================================
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

function buildInstance(
  widgetId: string,
  title: string,
  category: string,
  cols = 4,
): WidgetConfig {
  return {
    instanceId: `${widgetId}-1`,
    widgetId,
    title,
    category,
    size: { cols, rows: 2 },
    settings: {},
    visible: true,
    collapsed: false,
    position: { x: 0, y: 0 },
  }
}

function buildMarketData(): MarketData {
  return {
    indices: [],
    sectors: [],
    fundFlows: [],
    sentiment: null,
    watchlist: [],
    portfolio: null,
    signals: [],
  } as unknown as MarketData
}

function buildAllInstances(): WidgetConfig[] {
  // 只包含 WIDGET_CROSS_LAYOUT 中存在的 widgetId，确保 domain/perspective 分组正确
  // market (6): overview(2) + analysis(3) + signal(1)
  // research (4): overview(2) + analysis(1) + signal(1)
  // ai (5): overview(2) + analysis(2) + signal(1)
  // portfolio (6): overview(2) + analysis(1) + signal(1) + risk(2)
  return [
    // 市场背景域 (6)
    buildInstance('marketIndices', '大盘指数', 'market'),
    buildInstance('sectorHeatmap', '板块热力图', 'market'),
    buildInstance('fundFlow', '资金流向', 'market'),
    buildInstance('marketSentiment', '市场情绪', 'market'),
    buildInstance('industryChain', '产业链图谱', 'market'),
    buildInstance('hotSector', '热门板块策略', 'market'),
    // 研究全景域 (4)
    buildInstance('kaiScore', 'KAI 选股综合评分', 'research'),
    buildInstance('investmentProfile', '投资画像/分析中心', 'research'),
    buildInstance('poolBoard', '股票池看板', 'research'),
    buildInstance('valuePit', '价值洼地策略', 'research'),
    // AI 决策域 (5)
    buildInstance('aiTradeReview', 'AI交易复盘', 'ai'),
    buildInstance('agentPerformance', '智能体性能追踪', 'ai'),
    buildInstance('modelCompare', 'AI 大模型智能对比', 'ai'),
    buildInstance('stockChat', '个股深度分析助手', 'ai'),
    buildInstance('signalQuality', '信号质量复盘', 'ai'),
    // 持仓观察域 (6)
    buildInstance('portfolioOverview', '持仓概览', 'portfolio'),
    buildInstance('watchlist', '自选股', 'portfolio'),
    buildInstance('pnlAnalysis', '盈亏分析', 'portfolio'),
    buildInstance('signalMonitor', '信号监控', 'portfolio'),
    buildInstance('positionControl', '仓位控制', 'portfolio'),
    buildInstance('riskMonitor', '风险监控', 'portfolio'),
  ]
}

// ============================================================
// 测试套件
// ============================================================
describe('CockpitShell 交叉布局', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockUseMarketData.mockReturnValue({
      data: buildMarketData(),
      getTaskStats: () => ({ running: 0, total: 0 }),
    })
    mockGetAllInstances.mockReturnValue(buildAllInstances())
    mockSubscribe.mockReturnValue(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  // ----------------------------------------------------------
  // 域标题渲染
  // ----------------------------------------------------------
  it('展开技术钻取后渲染全部 4 个域导航按钮', () => {
    renderShell()
    expandTechnicalDrilldown()

    expect(getDomainButton(/智能研判/)).toBeDefined()
    expect(getDomainButton(/市场总览/)).toBeDefined()
    expect(getDomainButton(/AI 辅助/)).toBeDefined()
    expect(getDomainButton(/持仓与风控/)).toBeDefined()
  })

  it('域导航按钮显示 Widget 计数', () => {
    renderShell()
    expandTechnicalDrilldown()

    // 市场背景域 6 个实例 — 按钮文本含域标题 + 计数徽标（"6"）
    expect(getDomainButton(/市场总览/).textContent).toMatch(/6/)
    // 智能研判域 4 个实例 — 计数徽标为 "4"
    expect(getDomainButton(/智能研判/).textContent).toMatch(/4/)
  })

  // ----------------------------------------------------------
  // 默认激活域
  // ----------------------------------------------------------
  it('默认激活市场总览域', () => {
    renderShell()
    expandTechnicalDrilldown()

    // CockpitCrossLayout 默认 activeDomain='market'，域按钮以 aria-pressed 标记激活态
    expect(getDomainButton(/市场总览/).getAttribute('aria-pressed')).toBe('true')
    expect(getDomainButton(/智能研判/).getAttribute('aria-pressed')).toBe('false')
  })

  it('非激活域的 Widget 不渲染', () => {
    renderShell()

    // research domain 的 Widget 不在默认视图中
    expect(screen.queryByText('KAI 选股综合评分')).toBeNull()
    // portfolio domain 的 Widget 不在默认视图中
    expect(screen.queryByText('持仓概览')).toBeNull()
  })

  // ----------------------------------------------------------
  // 域切换交互
  // ----------------------------------------------------------
  it('点击域标题切换激活域', () => {
    renderShell()
    expandTechnicalDrilldown()

    // 智能研判默认不激活，点击后 aria-pressed 翻转，市场总览失去激活态
    const researchButton = getDomainButton(/智能研判/)
    expect(researchButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(researchButton)

    expect(researchButton.getAttribute('aria-pressed')).toBe('true')
    expect(getDomainButton(/市场总览/).getAttribute('aria-pressed')).toBe('false')
  })

  // ----------------------------------------------------------
  // 空 Widget 处理
  // ----------------------------------------------------------
  it('空实例列表不渲染域 Widget', () => {
    mockGetAllInstances.mockReturnValue([])

    renderShell()

    // 域标题仍渲染（来自常量），但无 Widget 标题
    expect(screen.queryByText('大盘指数')).toBeNull()
  })

  // ----------------------------------------------------------
  // 三页决策模式（主视图）
  // ----------------------------------------------------------
  it('三页决策模式默认渲染三个决策页标题', () => {
    renderShell()

    // DecisionPagesOverview 为主视图，无需展开钻取区即可见页标题/Tab
    expect(screen.getAllByText(/今日决策/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/我的组合/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/市场与机会/).length).toBeGreaterThan(0)
    // 技术钻取区默认折叠（域导航按钮不可见）
    expect(screen.queryAllByRole('button', { name: /智能研判/ })).toHaveLength(0)
  })

  // ----------------------------------------------------------
  // 顶部导航
  // ----------------------------------------------------------
  it('顶部导航显示驾驶舱标题', () => {
    renderShell()

    expect(screen.getByText('驾驶舱')).toBeDefined()
  })

  it('顶部导航显示添加 Widget 和重置布局按钮', () => {
    renderShell()

    expect(screen.getByText('添加组件')).toBeDefined()
    expect(screen.getByText('重置布局')).toBeDefined()
  })
})
