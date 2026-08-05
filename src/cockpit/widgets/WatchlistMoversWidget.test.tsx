import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import WatchlistMoversWidget from './WatchlistMoversWidget'
import type { WatchlistData, WidgetConfig } from '@/types/modules/widget.types'

// ============================================================
// Mock: useMarketDataStore（细粒度 selector 模式）
// 组件通过 useMarketDataStore(selector) 直接读取数据。
// 使用 vi.hoisted 确保 mockStoreState 在 vi.mock hoisting 之前定义。
// ============================================================
const mockStoreState = vi.hoisted(() => ({
  mergedData: {} as Record<string, unknown>,
  loadingMap: {} as Record<string, boolean>,
  errorMap: {} as Record<string, string | null>,
  refreshWidget: vi.fn() as unknown,
}))
vi.mock('@/store/marketDataStore', () => ({
  useMarketDataStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}))

const baseConfig: WidgetConfig = {
  instanceId: 'wm-1',
  widgetId: 'watchlistMovers',
  title: '自选股异动',
  size: { cols: 1, rows: 1 },
  settings: {},
  visible: true,
  collapsed: false,
}

/** 配置 mockStoreState（直接以属性赋值方式控制各字段） */
function setupMarketData(options: {
  watchlist?: WatchlistData[]
  loading?: boolean
  error?: string | null
} = {}): void {
  const { watchlist = [], loading = false, error = null } = options
  mockStoreState.mergedData = { watchlist }
  mockStoreState.loadingMap = { [baseConfig.instanceId]: loading }
  mockStoreState.errorMap = { [baseConfig.instanceId]: error }
  mockStoreState.refreshWidget = vi.fn()
}

describe('WatchlistMoversWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState.mergedData = {}
    mockStoreState.loadingMap = {}
    mockStoreState.errorMap = {}
    mockStoreState.refreshWidget = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading skeleton when loading', () => {
    setupMarketData({ loading: true })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('自选股异动')).toBeInTheDocument()
  })

  it('renders error state', () => {
    setupMarketData({ loading: false, error: '行情加载失败' })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('行情加载失败')).toBeInTheDocument()
  })

  it('renders top gainers and losers', () => {
    setupMarketData({
      watchlist: [
        { code: '600519.SH', name: '贵州茅台', price: 1700, changePercent: 2.5 },
        { code: '000001.SZ', name: '平安银行', price: 12.5, changePercent: -1.8 },
        { code: '000333.SZ', name: '美的集团', price: 58.2, changePercent: 0.5 },
      ],
    })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('涨幅榜')).toBeInTheDocument()
    expect(screen.getByText('跌幅榜')).toBeInTheDocument()
    expect(screen.getByText('振幅榜')).toBeInTheDocument()
    expect(screen.getAllByText('贵州茅台').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('平安银行').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty text when no movers', () => {
    setupMarketData({ watchlist: [] })
    render(<WatchlistMoversWidget config={baseConfig} />)
    expect(screen.getByText('暂无上涨标的')).toBeInTheDocument()
    expect(screen.getByText('暂无下跌标的')).toBeInTheDocument()
    expect(screen.getByText('暂无活跃标的')).toBeInTheDocument()
  })
})
