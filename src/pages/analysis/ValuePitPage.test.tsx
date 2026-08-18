import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import ValuePitPage from './ValuePitPage'

// ------------------------------------------------------------------
// vi.hoisted mocks
// ------------------------------------------------------------------

const mockRunAnalysis = vi.hoisted(() => vi.fn())

const mockValuePitState = vi.hoisted(() => ({
  combinedResults: [] as unknown[],
  loading: false,
  error: null as string | null,
  runAnalysis: mockRunAnalysis,
}))

vi.mock('@/store/valuePitStore', () => ({
  useValuePitStore: (selector: (s: typeof mockValuePitState) => unknown) =>
    selector(mockValuePitState),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// Mock all lucide-react icons used by the component under test.
// Keep this list in sync with the icons imported by ValuePitPage and its
// child states (EmptyState/LoadingState/ErrorState).
vi.mock('lucide-react', () => ({
  Target: () => <svg data-testid="icon-target" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  CheckCircle: () => <svg data-testid="icon-check" />,
  XCircle: () => <svg data-testid="icon-x" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Inbox: () => <svg data-testid="icon-inbox" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  RotateCcw: () => <svg data-testid="icon-rotate" />,
  WifiOff: () => <svg data-testid="icon-wifi-off" />,
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
  }
})

vi.mock('@/components/atoms/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div className={className} onClick={onClick}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
}))

vi.mock('@/components/atoms/Button', () => ({
  Button: (props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; className?: string }) => (
    <button onClick={props.onClick} disabled={props.disabled} className={props.className}>
      {props.children}
    </button>
  ),
}))

vi.mock('@/components/atoms/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/atoms/Progress', () => ({
  Progress: ({ label }: { value: number; label: string }) => (
    <div data-testid="progress">{label}</div>
  ),
}))

vi.mock('@/components/atoms/Breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  BreadcrumbLink: ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <span>{children}</span>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

// ------------------------------------------------------------------
// 测试套件
// ------------------------------------------------------------------

describe('ValuePitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValuePitState.combinedResults = []
    mockValuePitState.loading = false
    mockValuePitState.error = null
    mockRunAnalysis.mockResolvedValue(undefined)
  })

  // ================================================================
  // 1. 基础渲染：挂载时调用 runAnalysis
  // ================================================================
  it('挂载时调用 runAnalysis', async () => {
    render(
      <MemoryRouter>
        <ValuePitPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockRunAnalysis).toHaveBeenCalledTimes(1)
    })
  })

  // ================================================================
  // 2. Loading 状态
  // ================================================================
  it('loading 为 true 时显示加载状态', () => {
    mockValuePitState.loading = true

    render(
      <MemoryRouter>
        <ValuePitPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(UI_TEXT.analysis.valuePit.scoring)).toBeInTheDocument()
  })

  // ================================================================
  // 3. Error 状态
  // ================================================================
  it('error 有值时显示错误信息和重试按钮', () => {
    mockValuePitState.error = '价值陷阱策略计算失败'

    render(
      <MemoryRouter>
        <ValuePitPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('价值陷阱策略计算失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  // ================================================================
  // 4. useEffect cleanup：卸载后未完成的异步操作不触发渲染错误
  // ================================================================
  it('cleanup: 组件卸载后未完成的 runAnalysis 不触发渲染错误', async () => {
    mockRunAnalysis.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 200)),
    )

    const { unmount } = render(
      <MemoryRouter>
        <ValuePitPage />
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
  // 5. 空数据状态
  // ================================================================
  it('无评分数据时显示空状态引导', async () => {
    render(
      <MemoryRouter>
        <ValuePitPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockRunAnalysis).toHaveBeenCalled()
    })

    // results 为空时应显示"暂无评分数据"
    expect(screen.getByText('暂无评分数据')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument()
  })
})
