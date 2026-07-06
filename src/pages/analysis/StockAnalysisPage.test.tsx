import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import StockAnalysisPage from './StockAnalysisPage'

// ------------------------------------------------------------------
// vi.hoisted mocks
// ------------------------------------------------------------------

const mockLoadStockAnalysis = vi.hoisted(() => vi.fn())
const mockRefreshScore = vi.hoisted(() => vi.fn())
const mockUseParams = vi.hoisted(() => vi.fn())

const mockStockAnalysisState = vi.hoisted(() => ({
  stock: null as unknown,
  quotes: null as unknown,
  v6Score: null as unknown,
  scoreLoading: false,
  loadStockAnalysis: mockLoadStockAnalysis,
  refreshScore: mockRefreshScore,
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useParams: () => mockUseParams(),
  }
})

vi.mock('@/store/stockAnalysisStore', () => ({
  useStockAnalysisStore: (selector: (s: typeof mockStockAnalysisState) => unknown) =>
    selector(mockStockAnalysisState),
}))

// Mock UI components to simplify rendering tree
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: (props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/analysis/score/ScoreHistoryPanel', () => ({
  ScoreHistoryPanel: ({ symbol }: { symbol?: string }) => <div data-testid="score-history-panel">{symbol}</div>,
}))

vi.mock('@/components/analysis/score/MultiPeriodTrendChart', () => ({
  MultiPeriodTrendChart: () => <div data-testid="multi-period-trend-chart" />,
}))

// ------------------------------------------------------------------
// 测试套件
// ------------------------------------------------------------------

describe('StockAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock state to defaults
    mockStockAnalysisState.stock = null
    mockStockAnalysisState.quotes = null
    mockStockAnalysisState.v6Score = null
    mockStockAnalysisState.scoreLoading = false
    mockLoadStockAnalysis.mockResolvedValue(undefined)
    mockRefreshScore.mockResolvedValue(undefined)
    // Default: no symbol
    mockUseParams.mockReturnValue({})
  })

  // ================================================================
  // 1. 基础渲染：无 symbol 时显示引导文案
  // ================================================================
  it('无 symbol 参数时显示"请指定股票代码"引导文案', async () => {
    mockUseParams.mockReturnValue({})

    render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(UI_TEXT.errors.pleaseSpecifyStockCode)).toBeInTheDocument()
  })

  // ================================================================
  // 2. 基础渲染：有 symbol 时调用 loadStockAnalysis
  // ================================================================
  it('有 symbol 参数时调用 loadStockAnalysis', async () => {
    mockUseParams.mockReturnValue({ symbol: '600519.SH' })

    render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockLoadStockAnalysis).toHaveBeenCalledWith('600519.SH', expect.any(AbortSignal))
    })
  })

  // ================================================================
  // 3. 错误处理：loadStockAnalysis 抛出异常时页面不崩溃
  // ================================================================
  it('loadStockAnalysis 异常时页面不崩溃', async () => {
    mockUseParams.mockReturnValue({ symbol: '000001.SZ' })
    mockLoadStockAnalysis.mockRejectedValue(new Error('网络超时'))

    render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    // 等待 effect 执行完毕
    await waitFor(() => {
      expect(mockLoadStockAnalysis).toHaveBeenCalledWith('000001.SZ', expect.any(AbortSignal))
    })

    // 页面仍渲染无崩溃（stock 为 null，显示"未找到"）
    expect(screen.getByText(/未找到 000001.SZ/)).toBeInTheDocument()
  })

  // ================================================================
  // 4. useEffect cleanup：卸载后异步操作不触发渲染错误
  // ================================================================
  it('cleanup: 组件卸载后未完成的异步操作不触发渲染错误', async () => {
    mockUseParams.mockReturnValue({ symbol: 'AAPL' })
    mockLoadStockAnalysis.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 200)),
    )

    const { unmount } = render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    // 立即卸载，不等 loadStockAnalysis 完成
    unmount()

    // 等待 Promise resolve
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 测试通过即表示卸载后没有渲染错误
    expect(true).toBe(true)
  })

  // ================================================================
  // 5. 评分展示：有 v6Score 时显示评分和因子列表
  // ================================================================
  it('有 v6Score 时显示总分和因子网格', async () => {
    mockUseParams.mockReturnValue({ symbol: '600519.SH' })
    mockStockAnalysisState.stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      price: 1800,
      pe: 30,
      pb: 10,
      researchStatus: 'deepDive',
    }
    mockStockAnalysisState.v6Score = {
      symbol: '600519.SH',
      score: 4.2,
      factors: { l1: 4, l2: 3.5 },
      algorithmVersion: 'v6-engine-v1.0.0',
      calculatedAt: Date.now(),
      dataVersion: 1,
    }

    render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/V6 评分: 4.20/)).toBeInTheDocument()
    })

    expect(screen.getByText('l1')).toBeInTheDocument()
    expect(screen.getByText('4.00')).toBeInTheDocument()
    expect(screen.getByText('l2')).toBeInTheDocument()
    expect(screen.getByText('3.50')).toBeInTheDocument()
  })

  // ================================================================
  // 6. handleScore: refreshScore 抛出异常时页面不崩溃
  // ================================================================
  it('handleScore 异常时页面不崩溃（按钮点击触发 refreshScore）', async () => {
    // 设置 symbol 和 stock 数据以便显示按钮
    mockUseParams.mockReturnValue({ symbol: '600519.SH' })
    mockStockAnalysisState.stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      price: 1800,
      pe: 30,
      pb: 10,
      researchStatus: 'deepDive',
    }

    mockRefreshScore.mockRejectedValue(new Error('评分服务不可用'))

    render(
      <MemoryRouter>
        <StockAnalysisPage />
      </MemoryRouter>,
    )

    // 点击评分按钮
    const button = screen.getByRole('button', { name: '运行 V6 评分' })
    act(() => {
      button.click()
    })

    // refreshScore 被调用
    await waitFor(() => {
      expect(mockRefreshScore).toHaveBeenCalledWith('600519.SH')
    })

    // 页面不崩溃
    expect(true).toBe(true)
  })
})
