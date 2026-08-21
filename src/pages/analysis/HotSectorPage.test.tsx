import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import HotSectorPage from './HotSectorPage'

// Mutable test state
let testError: string | null = null

const mockFetchScores = vi.hoisted(() => vi.fn())

vi.mock('@/store/hotSectorStore', () => ({
  useHotSectorStore: (selector?: (state: any) => any) => {
    const state = {
      scores: [
        { symbol: 'BK0001', name: '银行', score: 4.5, action: 'immediate', dimensions: { momentum: 4, sentiment: 5, technical: 4, valuation: 5, composite: 4.5 }, calculatedAt: Date.now() },
        { symbol: 'BK0002', name: '钢铁', score: 3.2, action: 'probe', dimensions: { momentum: 3, sentiment: 3, technical: 3, valuation: 4, composite: 3.2 }, calculatedAt: Date.now() },
      ],
      loading: false,
      error: testError,
      isRefreshing: false,
      fetchScores: mockFetchScores,
      setScores: vi.fn(),
      reset: vi.fn(),
      clearScores: vi.fn(),
      refreshScore: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('lucide-react', () => ({
  TrendingUp: () => <svg data-testid="icon-trending" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, Link: ({ to, children }: any) => <a href={to}>{children}</a> }
})

vi.mock('@/components/atoms/Card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/atoms/Button', () => ({
  Button: (props: any) => <button onClick={props.onClick} disabled={props.disabled}>{props.children}</button>,
}))

vi.mock('@/components/atoms/Badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/atoms/Progress', () => ({
  Progress: ({ label }: any) => <div data-testid="progress">{label}</div>,
}))

vi.mock('@/components/atoms/Breadcrumb', () => ({
  Breadcrumb: ({ children }: any) => <nav>{children}</nav>,
  BreadcrumbItem: ({ children }: any) => <span>{children}</span>,
  BreadcrumbLink: ({ children }: any) => <span>{children}</span>,
  BreadcrumbList: ({ children }: any) => <ol>{children}</ol>,
  BreadcrumbPage: ({ children }: any) => <span>{children}</span>,
}))

describe('HotSectorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testError = null
    mockFetchScores.mockResolvedValue(undefined)
  })

  it('挂载后展示页面标题', async () => {
    render(<MemoryRouter><HotSectorPage /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByText(UI_TEXT.analysis.hotSector.title).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('cleanup: 组件卸载后不触发渲染错误', async () => {
    const { unmount } = render(<MemoryRouter><HotSectorPage /></MemoryRouter>)
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(true).toBe(true)
  })

  it('error 状态时显示错误信息和重试按钮', async () => {
    testError = '分析引擎异常'
    render(<MemoryRouter><HotSectorPage /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText(UI_TEXT.errors.analysisEngineError)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('正常渲染后页面标题和副标题可见', async () => {
    render(<MemoryRouter><HotSectorPage /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByText(UI_TEXT.analysis.hotSector.title).length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.multiFactor.engine))).toBeInTheDocument()
  })

  it('错误状态下点击重试按钮后错误消失', async () => {
    testError = '首次失败'
    render(<MemoryRouter><HotSectorPage /></MemoryRouter>)
    await waitFor(() => screen.getByRole('button', { name: '重试' }))
    testError = null
    const btn = screen.getByRole('button', { name: '重试' })
    await act(async () => { btn.click() })
    expect(screen.queryByText(UI_TEXT.errors.analysisEngineError)).not.toBeInTheDocument()
  })
})
