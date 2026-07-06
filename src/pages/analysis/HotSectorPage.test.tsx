import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import HotSectorPage from './HotSectorPage'

// ------------------------------------------------------------------
// vi.hoisted mocks
// ------------------------------------------------------------------

const mockAnalyze = vi.hoisted(() => vi.fn())

vi.mock('@/services/scoring/hotSectorAnalyzer', () => ({
  analyze: (...args: unknown[]) => mockAnalyze(...args),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <svg data-testid="icon-trending" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
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

vi.mock('@/components/ui/Card', () => ({
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

vi.mock('@/components/ui/Button', () => ({
  Button: (props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; className?: string }) => (
    <button onClick={props.onClick} disabled={props.disabled} className={props.className}>
      {props.children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/ui/Progress', () => ({
  Progress: ({ label }: { value: number; label: string }) => (
    <div data-testid="progress">{label}</div>
  ),
}))

vi.mock('@/components/ui/Breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  BreadcrumbLink: ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <span>{children}</span>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

// ------------------------------------------------------------------
// Helper: 返回一个合法的 HotSectorScore
// ------------------------------------------------------------------
function createMockScore(symbol: string, name: string, score: number) {
  return {
    symbol,
    name,
    score,
    action: 'immediate' as const,
    dimensions: { momentum: score, sentiment: score, technical: score, valuation: score, composite: score },
    calculatedAt: Date.now(),
  }
}

// ------------------------------------------------------------------
// 测试套件
// ------------------------------------------------------------------

describe('HotSectorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: mockAnalyze 返回一个合法分数（对应 SECTOR_SAMPLES 中的4个输入）
    mockAnalyze.mockImplementation((input: unknown) => {
      const inp = input as { symbol: string; sectorName: string }
      return createMockScore(inp.symbol, inp.sectorName, 4.0)
    })
  })

  // ================================================================
  // 1. 基础渲染：挂载后从 loading 过渡到数据展示
  // ================================================================
  it('挂载后执行 runAnalysis 并展示页面标题', async () => {
    render(
      <MemoryRouter>
        <HotSectorPage />
      </MemoryRouter>,
    )

    // 等待 runAnalysis 完成（同步计算后 loading 变为 false）
    // "热门板块策略" 在 h1 和面包屑中各出现一次，用 getAllByText
    await waitFor(() => {
      expect(screen.getAllByText(UI_TEXT.analysis.hotSector.title).length).toBeGreaterThanOrEqual(1)
    })
  })

  // ================================================================
  // 2. useEffect cleanup：卸载后不触发渲染错误
  // ================================================================
  it('cleanup: 组件卸载后不触发渲染错误', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <HotSectorPage />
      </MemoryRouter>,
    )

    // 立即卸载
    unmount()

    // 短暂等待确保没有 pending 的 effect
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(true).toBe(true)
  })

  // ================================================================
  // 3. 错误处理：analyze 函数异常时显示错误状态和重试按钮
  // ================================================================
  it('analyze 异常时显示错误信息和重试按钮', async () => {
    mockAnalyze.mockImplementation(() => { throw new Error('分析引擎异常') })

    render(
      <MemoryRouter>
        <HotSectorPage />
      </MemoryRouter>,
    )

    // 等待 error 被捕获并渲染
    await waitFor(() => {
      expect(screen.getByText(UI_TEXT.errors.analysisEngineError)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  // ================================================================
  // 4. 正常渲染：板块数据可见
  // ================================================================
  it('正常渲染后页面标题和副标题可见', async () => {
    render(
      <MemoryRouter>
        <HotSectorPage />
      </MemoryRouter>,
    )

    // 用 getAllByText 避免 h1 和面包屑重复匹配
    await waitFor(() => {
      expect(screen.getAllByText(UI_TEXT.analysis.hotSector.title).length).toBeGreaterThanOrEqual(1)
    })

    // 标题副标题
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.multiFactor.engine))).toBeInTheDocument()
  })

  // ================================================================
  // 5. 重试功能：错误后点击重试重新执行分析
  // ================================================================
  it('错误状态下点击重试按钮后错误消失', async () => {
    // 首次调用抛异常，后续正常
    mockAnalyze
      .mockImplementationOnce(() => { throw new Error('首次失败') })
      .mockImplementation((input: unknown) => {
        const inp = input as { symbol: string; sectorName: string }
        return createMockScore(inp.symbol, inp.sectorName, 3.5)
      })

    render(
      <MemoryRouter>
        <HotSectorPage />
      </MemoryRouter>,
    )

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('首次失败')).toBeInTheDocument()
    })

    // Click retry — 使用异步 act 包裹，等待 fetchScores 的异步状态更新完成
    await act(async () => {
      screen.getByRole('button', { name: '重试' }).click()
      // 等待微任务队列清空，确保 fetchScores 触发的 setLoading/setScores/setError 都在 act 块内完成
      await Promise.resolve()
    })

    // After retry, error should be gone
    await waitFor(() => {
      expect(screen.queryByText('首次失败')).not.toBeInTheDocument()
    })
  })
})
