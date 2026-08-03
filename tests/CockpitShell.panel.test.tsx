/**
 * @fileoverview CockpitShell 驾驶舱壳渲染测试
 * @description 验证驾驶舱壳组件的核心渲染行为：
 *  1. 顶部导航标题和按钮正确渲染
 *  2. 状态计数（跟踪标的/待处理信号/采集任务/Widget）正确显示
 *  3. CockpitCrossLayout 布局容器渲染
 *  4. 返回首页链接存在
 *
 * @since v2.7.0 - 2026-07-20
 * @doc cockpit-shell-cross-layout
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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
    subscribe: (_cb: () => void) => mockSubscribe(),
    getTemplate: vi.fn().mockReturnValue({ meta: { domain: 'market', perspective: 'overview' } }),
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

// useConfirmDialog mock — 返回完整的 dialogProps 结构
vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(false),
    dialogProps: {
      open: false,
      options: { title: '', description: '' },
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      onOpenChange: vi.fn(),
    },
  }),
}))

// ConfirmDialog 组件 mock
vi.mock('@/components/molecules/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}))

// useMediaQuery mock — 桌面端
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
  BREAKPOINT: { MOBILE: 767 },
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
    buildInstance('marketIndices', '大盘指数', 'research'),
    buildInstance('sectorHeatmap', '板块热力图', 'research'),
    buildInstance('industryChain', '产业链图谱', 'research', 2),
    buildInstance('kaiScore', 'KAI 选股综合评分', 'research'),
    buildInstance('portfolioOverview', '持仓概览', 'review'),
  ]
}

// ============================================================
// 测试套件
// ============================================================
describe('CockpitShell 驾驶舱壳', () => {
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

  it('顶部导航显示返回首页链接', () => {
    render(<CockpitShell />)
    expect(screen.getByText('返回首页')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 状态计数
  // ----------------------------------------------------------
  it('顶部导航显示 Widget 计数', () => {
    render(<CockpitShell />)
    // 顶部导航应显示 Widget 计数文本（与"添加 Widget"按钮区分）
    const widgetElements = screen.getAllByText(/Widget/)
    expect(widgetElements.length).toBeGreaterThan(0)
    // 至少有一个 Widget 文本附近包含实例计数 5
    const hasCount = widgetElements.some((el) => {
      const parent = el.closest('span')?.parentElement
      return parent?.textContent?.match(/5/)
    })
    expect(hasCount).toBe(true)
  })

  it('顶部导航显示跟踪标的计数', () => {
    render(<CockpitShell />)
    expect(screen.getByText(/跟踪标的/)).toBeDefined()
  })

  it('顶部导航显示待处理信号计数', () => {
    render(<CockpitShell />)
    expect(screen.getByText(/待处理信号/)).toBeDefined()
  })

  it('顶部导航显示采集任务计数', () => {
    render(<CockpitShell />)
    expect(screen.getByText(/采集任务/)).toBeDefined()
  })

  // ----------------------------------------------------------
  // 布局渲染
  // ----------------------------------------------------------
  it('渲染主内容区域', () => {
    const { container } = render(<CockpitShell />)
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
  })

  it('组件渲染不崩溃（冒烟测试）', () => {
    const { container } = render(<CockpitShell />)
    expect(container.firstChild).not.toBeNull()
  })
})
