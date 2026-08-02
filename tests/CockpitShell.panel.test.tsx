/**
 * @fileoverview CockpitShell 分栏面板布局渲染测试
 * @description 验证 v5 分栏面板布局的核心交互行为：
 *  1. 5 个面板（市场全景/研究筛选/持仓复盘/信号监控/系统状态）正确渲染
 *  2. 面板标题、描述、Widget 计数正确显示
 *  3. 折叠/展开交互正常工作
 *  4. 空面板不渲染
 *
 * @since v2.7.0 - 2026-07-20
 * @doc cockpit-shell-refactor-v5
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
vi.mock('@/cockpit/core/widgetRegistry', () => ({
  widgetRegistry: {
    getAllInstances: () => mockGetAllInstances(),
    subscribe: (cb: () => void) => mockSubscribe(cb as never),
  },
}))

// widgetEngine — 懒加载 mock
vi.mock('@/cockpit/core/widgetEngine', () => ({
  widgetEngine: {
    loadComponent: vi.fn().mockResolvedValue(() => null),
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
  return [
    // 市场全景 (5)
    buildInstance('marketIndices', '大盘指数', 'research'),
    buildInstance('sectorHeatmap', '板块热力图', 'research'),
    buildInstance('fundFlow', '资金流向', 'research', 2),
    buildInstance('marketSentiment', '市场情绪', 'research', 2),
    buildInstance('industryChain', '产业链图谱', 'research', 2),
    // 研究筛选 (8)
    buildInstance('kaiScore', 'KAI 选股综合评分', 'research'),
    buildInstance('hotSector', '热门板块策略', 'research'),
    buildInstance('valuePit', '价值洼地策略', 'research'),
    buildInstance('poolBoard', '股票池看板', 'research'),
    buildInstance('researchPoolBoard', '研究池管理', 'research'),
    buildInstance('investmentProfile', '投资画像/分析中心', 'research'),
    buildInstance('modelCompare', 'AI 大模型智能对比', 'research'),
    buildInstance('stockChat', '个股深度分析助手', 'research'),
    // 持仓复盘 (8)
    buildInstance('portfolioOverview', '持仓概览', 'review'),
    buildInstance('pnlAnalysis', '盈亏分析', 'review', 2),
    buildInstance('watchlist', '自选股', 'review'),
    buildInstance('watchlistMovers', '自选股异动', 'review'),
    buildInstance('aiTradeReview', 'AI交易复盘', 'review'),
    buildInstance('signalQuality', '信号质量复盘', 'review'),
    buildInstance('positionControl', '仓位控制', 'review', 2),
    buildInstance('riskMonitor', '风险监控', 'review', 2),
    // 信号监控 (1)
    buildInstance('signalMonitor', '信号监控', 'monitor', 1),
    // 系统状态 (4)
    buildInstance('engineStatus', '引擎状态监控', 'system', 1),
    buildInstance('agentPerformance', '智能体性能追踪', 'system', 2),
    buildInstance('mechanismHealth', '机制健康监控', 'system', 2),
    buildInstance('systemArchitecture', '系统架构视图', 'system', 2),
  ]
}

// ============================================================
// 测试套件
// ============================================================
describe('CockpitShell 分栏面板布局', () => {
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
  // 面板渲染
  // ----------------------------------------------------------
  it('渲染全部 5 个面板标题', () => {
    render(<CockpitShell />)

    expect(screen.getByText('市场全景')).toBeDefined()
    expect(screen.getByText('研究筛选')).toBeDefined()
    expect(screen.getByText('持仓复盘')).toBeDefined()
    expect(screen.getByText('信号监控')).toBeDefined()
    expect(screen.getByText('系统状态')).toBeDefined()
  })

  it('面板标题显示 Widget 计数', () => {
    render(<CockpitShell />)

    // 市场全景 5 个 — 精确匹配
    const marketPanel = screen.getByText('市场全景').closest('button')
    expect(marketPanel?.textContent).toMatch(/5 个/)
    // 研究筛选 8 个 — 精确匹配
    const researchPanel = screen.getByText('研究筛选').closest('button')
    expect(researchPanel?.textContent).toMatch(/8 个/)
  })

  it('面板显示描述文字', () => {
    render(<CockpitShell />)

    expect(screen.getByText('大盘走势 · 板块轮动 · 资金动向')).toBeDefined()
    expect(screen.getByText('智能评分 · 热门策略 · 股票池')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 默认展开/折叠状态
  // ----------------------------------------------------------
  it('市场全景和研究筛选默认展开', () => {
    render(<CockpitShell />)

    // 展开的面板会渲染其中的 Widget 标题
    expect(screen.getByText('大盘指数')).toBeDefined()
    expect(screen.getByText('KAI 选股综合评分')).toBeDefined()
  })

  it('持仓复盘、信号监控、系统状态默认折叠', () => {
    render(<CockpitShell />)

    // 折叠的面板不渲染其中的 Widget 标题
    expect(screen.queryByText('持仓概览')).toBeNull()
    expect(screen.queryByText('引擎状态监控')).toBeNull()
  })

  // ----------------------------------------------------------
  // 折叠/展开交互
  // ----------------------------------------------------------
  it('点击面板标题切换展开状态', () => {
    render(<CockpitShell />)

    // 持仓复盘默认折叠，点击后应展开
    const reviewButton = screen.getByText('持仓复盘').closest('button')
    expect(reviewButton).not.toBeNull()

    fireEvent.click(reviewButton!)

    // 展开后应显示持仓概览
    expect(screen.getByText('持仓概览')).toBeDefined()
  })

  it('折叠状态持久化到 localStorage', () => {
    render(<CockpitShell />)

    const reviewButton = screen.getByText('持仓复盘').closest('button')
    fireEvent.click(reviewButton!)

    // localStorage 应记录展开状态
    expect(localStorage.getItem('v9_panel_review')).toBe('true')
  })

  // ----------------------------------------------------------
  // 空面板处理
  // ----------------------------------------------------------
  it('无 Widget 的面板不渲染', () => {
    // 只返回市场全景的 Widget
    mockGetAllInstances.mockReturnValue([
      buildInstance('marketIndices', '大盘指数', 'research'),
      buildInstance('sectorHeatmap', '板块热力图', 'research'),
    ])

    render(<CockpitShell />)

    expect(screen.getByText('市场全景')).toBeDefined()
    expect(screen.queryByText('研究筛选')).toBeNull()
    expect(screen.queryByText('持仓复盘')).toBeNull()
  })

  // ----------------------------------------------------------
  // 顶部导航
  // ----------------------------------------------------------
  it('顶部导航显示驾驶舱标题', () => {
    render(<CockpitShell />)

    expect(screen.getByText('驾驶舱')).toBeDefined()
    expect(screen.getByText('股票智能研究与复盘工作台')).toBeDefined()
  })

  it('顶部导航显示添加 Widget 和重置布局按钮', () => {
    render(<CockpitShell />)

    expect(screen.getByText('添加 Widget')).toBeDefined()
    expect(screen.getByText('重置布局')).toBeDefined()
  })
})
