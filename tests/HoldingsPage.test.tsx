/**
 * HoldingsPage 组件测试
 *
 * 覆盖场景：
 * 1. 页面标题渲染："交易持仓管理"
 * 2. 面包屑导航：首页 → 交易舱 → 持仓管理
 * 3. 筛选区组件存在
 * 4. "共 0 条持仓记录"
 * 5. 导出按钮
 * 6. 加载状态：骨架屏
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import HoldingsPage from '@/pages/trading/HoldingsPage'

// Mock ErrorBoundary
vi.mock('@/components/ErrorBoundary', () => ({
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

// 默认 Store 状态
const defaultStoreState = {
  data: [] as any[],
  filter: {
    startDate: '2025-01-01',
    endDate: '2025-07-18',
    direction: 'ALL',
    keyword: '',
  },
  pagination: { page: 1, pageSize: 20, total: 0 },
  loading: { isListLoading: false, isActionLoading: false, isExporting: false },
  modal: { open: false, action: null, holding: null },
  setData: vi.fn(),
  setFilter: vi.fn(),
  setPage: vi.fn(),
  setPageSize: vi.fn(),
  setLoading: vi.fn(),
  openModal: vi.fn(),
  closeModal: vi.fn(),
  resetFilter: vi.fn(),
  fetchData: vi.fn().mockResolvedValue({ code: 200, message: 'ok' }),
  executeTrade: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  exportCSV: vi.fn().mockResolvedValue(undefined),
}

// 使用 vi.hoisted 避免 vi.mock 工厂中引用未初始化变量
const { mockUseHoldingsStore } = vi.hoisted(() => ({
  mockUseHoldingsStore: vi.fn(() => ({ ...defaultStoreState })),
}))

vi.mock('@/store/holdingsStore', () => ({
  useHoldingsStore: mockUseHoldingsStore,
  buildHoldingsParams: vi.fn(() => ({
    page: 1,
    pageSize: 20,
    startDate: '2025-01-01',
    endDate: '2025-07-18',
    direction: 'ALL',
    keyword: '',
  })),
  initHoldingsStoreSubscriptions: vi.fn(() => vi.fn()),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trading/holdings']}>
      <HoldingsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseHoldingsStore.mockReturnValue({ ...defaultStoreState })
})

describe('HoldingsPage - 页面渲染', () => {
  it('渲染标题 "交易持仓管理"', () => {
    renderPage()
    expect(screen.getByText('交易持仓管理')).toBeInTheDocument()
  })

  it('渲染面包屑（首页 → 交易舱 → 持仓管理）', () => {
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('交易舱')).toBeInTheDocument()
    expect(screen.getByText('持仓管理')).toBeInTheDocument()
  })

  it('渲染筛选区（HoldingsFilter 组件存在）', () => {
    renderPage()
    expect(screen.getByLabelText('开始日期')).toBeInTheDocument()
    expect(screen.getByLabelText('结束日期')).toBeInTheDocument()
    expect(screen.getByLabelText('交易方向')).toBeInTheDocument()
  })

  it('渲染 "共 0 条持仓记录"', () => {
    renderPage()
    expect(screen.getByText('共 0 条持仓记录')).toBeInTheDocument()
  })

  it('渲染导出按钮', () => {
    renderPage()
    expect(screen.getByText('导出 Excel')).toBeInTheDocument()
  })

  it('加载状态显示骨架屏（loading.isListLoading=true）', () => {
    mockUseHoldingsStore.mockReturnValue({
      ...defaultStoreState,
      loading: { ...defaultStoreState.loading, isListLoading: true },
    })
    renderPage()
    // 骨架屏应包含 animate-pulse 动画样式
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
