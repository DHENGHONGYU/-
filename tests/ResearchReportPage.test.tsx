/**
 * ResearchReportPage 组件测试
 *
 * 覆盖场景：
 * 1. 页面标题渲染："研究报告"
 * 2. 面包屑导航：首页 → 输出舱 → 研究报告
 * 3. 基础 UI 元素：股票选择器、生成按钮、返回链接
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ResearchReportPage from '@/pages/output/ResearchReportPage'

// Mock ErrorBoundary（页面使用 @/components/organisms/shared/ErrorBoundary）
vi.mock('@/components/organisms/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// Mock useToast
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Mock usePageGuard
vi.mock('@/hooks/usePageGuard', () => ({
  usePageGuard: () => ({ guardProps: { disabled: false } }),
}))

// Mock scoreDocStore - 使用 vi.hoisted 避免工厂中引用未初始化变量
const { mockUseScoreDocStore } = vi.hoisted(() => {
  const state = {
    versions: [] as any[],
    symbol: '',
    loading: false,
    error: null as string | null,
    setSymbol: vi.fn(),
    loadStockSymbols: vi.fn().mockResolvedValue([] as string[]),
    generateReport: vi.fn().mockResolvedValue({ version: 1 }),
    loadVersions: vi.fn().mockResolvedValue(undefined),
  }
  return {
    storeState: state,
    mockUseScoreDocStore: vi.fn((selector?: (s: typeof state) => any) =>
      selector ? selector(state) : state,
    ),
  }
})

vi.mock('@/store/scoreDocStore', () => ({
  useScoreDocStore: mockUseScoreDocStore,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/output/research-report']}>
      <ResearchReportPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResearchReportPage - 页面渲染', () => {
  it('渲染页面标题 "研究报告"', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('研究报告')
  })

  it('渲染面包屑（首页 → 输出舱 → 研究报告）', () => {
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('输出舱')).toBeInTheDocument()
    // "研究报告" 同时出现在标题和面包屑中，使用 getAllByText
    const matches = screen.getAllByText('研究报告')
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('渲染股票选择器', () => {
    renderPage()
    expect(screen.getByText('选择股票')).toBeInTheDocument()
    expect(screen.getByText('请选择股票')).toBeInTheDocument()
  })

  it('渲染生成报告按钮', () => {
    renderPage()
    // "生成报告" 出现在卡片标题和按钮中，使用 getAllByText
    const matches = screen.getAllByText('生成报告')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('渲染返回链接', () => {
    renderPage()
    expect(screen.getByText('返回')).toBeInTheDocument()
  })
})
