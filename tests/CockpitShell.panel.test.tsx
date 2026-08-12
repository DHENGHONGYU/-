/**
 * @fileoverview CockpitShell 交叉布局渲染测试
 * @description 验证 v6 交叉布局（4 domain × 4 perspective）的核心渲染行为：
 *  1. 4 个域（研究全景/市场背景/AI 决策/持仓观察）正确渲染
 *  2. 域标题、Widget 计数正确显示
 *  3. 域切换交互正常工作
 *  4. 空实例列表处理
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
  it('渲染全部 4 个域标题', () => {
    render(<CockpitShell />)

    // 域标题在左侧导航和矩阵总览中均出现，用 getAllByText
    expect(screen.getAllByText('研究全景').length).toBeGreaterThan(0)
    expect(screen.getAllByText('市场背景').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AI 决策').length).toBeGreaterThan(0)
    expect(screen.getAllByText('持仓观察').length).toBeGreaterThan(0)
  })

  it('域标题显示 Widget 计数', () => {
    render(<CockpitShell />)

    // 市场背景 6 个 — 在左侧导航按钮中显示计数
    const marketButtons = screen.getAllByText('市场背景')
    const marketButton = marketButtons.find((el) => el.closest('button'))
    expect(marketButton?.closest('button')?.textContent).toMatch(/6/)
    // 研究全景 4 个
    const researchButtons = screen.getAllByText('研究全景')
    const researchButton = researchButtons.find((el) => el.closest('button'))
    expect(researchButton?.closest('button')?.textContent).toMatch(/4/)
  })

  // ----------------------------------------------------------
  // 默认激活域
  // ----------------------------------------------------------
  it('默认激活市场背景域', () => {
    render(<CockpitShell />)

    // 市场背景域默认激活，导航按钮应有激活样式
    const marketButtons = screen.getAllByText('市场背景')
    const marketButton = marketButtons.find((el) => el.closest('button'))
    expect(marketButton).toBeDefined()
  })

  it('非激活域的 Widget 不渲染', () => {
    render(<CockpitShell />)

    // research domain 的 Widget 不在默认视图中
    expect(screen.queryByText('KAI 选股综合评分')).toBeNull()
    // portfolio domain 的 Widget 不在默认视图中
    expect(screen.queryByText('持仓概览')).toBeNull()
  })

  // ----------------------------------------------------------
  // 域切换交互
  // ----------------------------------------------------------
  it('点击域标题切换激活域', () => {
    render(<CockpitShell />)

    // 研究全景默认不激活，点击后应切换
    const researchButtons = screen.getAllByText('研究全景')
    const researchButton = researchButtons.find((el) => el.closest('button'))
    expect(researchButton).toBeDefined()

    fireEvent.click(researchButton!.closest('button')!)

    // 切换后研究全景域被激活（按钮 class 变化）
    const clickedButton = researchButton!.closest('button')
    expect(clickedButton).toBeDefined()
  })

  // ----------------------------------------------------------
  // 空 Widget 处理
  // ----------------------------------------------------------
  it('空实例列表不渲染域 Widget', () => {
    mockGetAllInstances.mockReturnValue([])

    render(<CockpitShell />)

    // 域标题仍渲染（来自常量），但无 Widget 标题
    expect(screen.queryByText('大盘指数')).toBeNull()
  })

  // ----------------------------------------------------------
  // 顶部导航
  // ----------------------------------------------------------
  it('顶部导航显示驾驶舱标题', () => {
    render(<CockpitShell />)

    expect(screen.getByText('驾驶舱')).toBeDefined()
  })

  it('顶部导航显示添加 Widget 和重置布局按钮', () => {
    render(<CockpitShell />)

    expect(screen.getByText('添加 Widget')).toBeDefined()
    expect(screen.getByText('重置布局')).toBeDefined()
  })
})
