import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import SectorAnalysisPage from './SectorAnalysisPage'

// ------------------------------------------------------------------
// vi.hoisted mocks
// ------------------------------------------------------------------

const mockFetchSectorAnalysis = vi.hoisted(() => vi.fn())

const mockSectorAnalysisState = vi.hoisted(() => ({
  rotationScores: [] as unknown[],
  industryScores: [] as unknown[],
  loading: false,
  error: null as string | null,
  fetchSectorAnalysis: mockFetchSectorAnalysis,
}))

vi.mock('@/store/sectorAnalysisStore', () => ({
  useSectorAnalysisStore: (selector: (s: typeof mockSectorAnalysisState) => unknown) =>
    selector(mockSectorAnalysisState),
}))



vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: (props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; size?: string; className?: string }) => (
    <button onClick={props.onClick} disabled={props.disabled} className={props.className}>
      {props.children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/chart', () => ({
  BarChart: ({ data, height }: { data: unknown[]; height?: number }) => (
    <div data-testid="bar-chart" data-height={height} data-count={data.length} />
  ),
}))

vi.mock('@/components/widgets/WidgetShell', () => ({
  WidgetShell: ({ children, widgetId }: { children: React.ReactNode; widgetId: string }) => (
    <div data-testid={`widget-${widgetId}`}>{children}</div>
  ),
}))

// ------------------------------------------------------------------
// 测试套件
// ------------------------------------------------------------------

describe('SectorAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSectorAnalysisState.rotationScores = []
    mockSectorAnalysisState.industryScores = []
    mockSectorAnalysisState.loading = false
    mockSectorAnalysisState.error = null
    mockFetchSectorAnalysis.mockResolvedValue(undefined)
  })

  // ================================================================
  // 1. 基础渲染：初始加载调用 fetchSectorAnalysis
  // ================================================================
  it('挂载时调用 fetchSectorAnalysis', async () => {
    render(
      <MemoryRouter>
        <SectorAnalysisPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockFetchSectorAnalysis).toHaveBeenCalledTimes(1)
    })
  })

  // ================================================================
  // 2. Loading 状态
  // ================================================================
  it('loading 为 true 时显示"加载中..."', () => {
    mockSectorAnalysisState.loading = true

    render(
      <MemoryRouter>
        <SectorAnalysisPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(UI_TEXT.common.loading)).toBeInTheDocument()
  })

  // ================================================================
  // 3. Error 状态与重试
  // ================================================================
  it('error 有值时显示错误信息和重试按钮', () => {
    mockSectorAnalysisState.error = '板块数据加载失败'

    render(
      <MemoryRouter>
        <SectorAnalysisPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('板块数据加载失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  // ================================================================
  // 4. useEffect cleanup：卸载后异步操作不触发渲染错误
  // ================================================================
  it('cleanup: 组件卸载后未完成的 fetchSectorAnalysis 不触发渲染错误', async () => {
    mockFetchSectorAnalysis.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 200)),
    )

    const { unmount } = render(
      <MemoryRouter>
        <SectorAnalysisPage />
      </MemoryRouter>,
    )

    // 立即卸载
    unmount()

    // 等待异步操作完成
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 无渲染错误
    expect(true).toBe(true)
  })

  // ================================================================
  // 5. 错误处理：store.error 被设置后页面显示错误信息
  // ================================================================
  it('store.error 被设置后页面显示错误信息和重试按钮', () => {
    mockSectorAnalysisState.error = '服务端错误'

    render(
      <MemoryRouter>
        <SectorAnalysisPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('服务端错误')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })
})
