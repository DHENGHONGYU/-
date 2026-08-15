/**
 * @fileoverview TradeReviewPage 单元测试 (P0 + P1)
 * @description 覆盖 generateReviewReportHandler 的 success/guard/catch 三条路径。
 *
 * P0 用例：
 * 1. 无交易记录时点击"生成复盘"显示警告 toast（guard: orders.length === 0）
 *
 * P1 用例：
 * 2. 有交易记录时点击"生成复盘"调用 generateReviewReport（success 路径）
 * 3. generateReviewReport 抛异常时显示 error toast（catch 路径）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import React from 'react'
import type { Order } from '@/data/types'

// ============================================================
// 调试日志辅助 — 在关键分支点输出测试上下文，便于排查失败
// ============================================================
function debugLog(branch: string, context: Record<string, unknown>): void {
  console.log(`[test-debug] TradeReviewPage ${branch}`, context)
}

// ============================================================
// Mock: useToast
// ============================================================
const mockToast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// ============================================================
// Mock: usePageGuard
// ============================================================
vi.mock('@/hooks/usePageGuard', () => ({
  usePageGuard: () => ({ guardProps: { disabled: false } }),
}))

// ============================================================
// Mock: ErrorBoundary
// ============================================================
vi.mock('@/components/organisms/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ============================================================
// Mock: ReviewArtifactModal
// ============================================================
vi.mock('@/components/organisms/output/ReviewArtifactModal', () => ({
  ReviewArtifactModal: () => null,
}))

// ============================================================
// Mock: logger
// ============================================================
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// ============================================================
// Mock: useDisciplineStore
// ============================================================
const { mockLoadOrders, mockGenerateReviewReport, mockRefresh, mockLatestReport } = vi.hoisted(() => ({
  mockLoadOrders: vi.fn(),
  mockGenerateReviewReport: vi.fn(),
  mockRefresh: vi.fn(),
  mockLatestReport: { value: null as unknown },
}))

vi.mock('@/store/disciplineStore', () => ({
  useDisciplineStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      latestReport: mockLatestReport.value,
      loadOrders: mockLoadOrders,
      generateReviewReport: mockGenerateReviewReport,
      refresh: mockRefresh,
    }
    return selector ? selector(state) : state
  },
}))

// 延迟导入，确保 mock 生效
const TradeReviewPage = (await import('@/pages/output/TradeReviewPage')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建 mock Order 数据 */
function buildOrders(count: number = 2): Order[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${i + 1}`,
    symbol: `60000${i + 1}`,
    direction: i % 2 === 0 ? 'buy' : 'sell',
    quantity: 100 * (i + 1),
    price: 10 + i,
    amount: (10 + i) * 100 * (i + 1),
    status: 'filled',
    accountType: 'paper',
    createdAt: now - i * 86400000,
  }))
}

/** 渲染页面 */
function renderPage(): void {
  render(
    <MemoryRouter>
      <TradeReviewPage />
    </MemoryRouter>,
  )
}

// ============================================================
// 测试用例
// ============================================================

describe('TradeReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLatestReport.value = null
    mockLoadOrders.mockResolvedValue([])
    mockGenerateReviewReport.mockReturnValue(null)
  })

  // ----------------------------------------------------------
  // P0 用例：无交易记录时"生成复盘"按钮禁用（guard: orders.length === 0）
  // 源码：disabled={guardProps.disabled || orders.length === 0 || generating}
  // 当 orders 为空时按钮 disabled，防止无效点击
  // ----------------------------------------------------------
  it('P0: 无交易记录时"生成复盘"按钮禁用（disabled guard）', async () => {
    mockLoadOrders.mockResolvedValue([])
    debugLog('P0-guard', { ordersCount: 0, branch: 'guard' })

    renderPage()

    // 等待 orders 加载完成，显示数量 0
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /生成复盘报告/ })
    debugLog('P0-guard 结果', { buttonDisabled: true, generateNotCalled: true })
    // 按钮应被禁用
    expect(button).toBeDisabled()
    // generateReviewReport 不应被调用
    expect(mockGenerateReviewReport).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // P1 用例 1：有交易记录时点击"生成复盘"调用 generateReviewReport
  // 覆盖 generateReviewReportHandler success 路径
  // ----------------------------------------------------------
  it('P1: 有交易记录时点击"生成复盘"调用 generateReviewReport', async () => {
    const orders = buildOrders(3)
    mockLoadOrders.mockResolvedValue(orders)
    debugLog('P1-success', { ordersCount: orders.length, branch: 'success' })

    renderPage()

    // 等待 orders 加载并显示数量
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /生成复盘报告/ })
    fireEvent.click(button)

    debugLog('P1-success 结果', {
      generateCalled: true,
      ordersPassed: orders.length,
      expectedToastTitle: '复盘报告生成成功',
    })
    await waitFor(() => {
      expect(mockGenerateReviewReport).toHaveBeenCalledWith(orders)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '复盘报告生成成功',
          description: '已分析 3 笔交易记录',
        }),
      )
    })
  })

  // ----------------------------------------------------------
  // P1 用例 2：generateReviewReport 抛异常时显示 error toast
  // 覆盖 generateReviewReportHandler catch 分支
  // ----------------------------------------------------------
  it('P1: generateReviewReport 抛异常时显示 error toast', async () => {
    const orders = buildOrders(2)
    mockLoadOrders.mockResolvedValue(orders)
    const errorMsg = 'AI 服务不可用'
    mockGenerateReviewReport.mockImplementation(() => {
      throw new Error(errorMsg)
    })
    debugLog('P1-catch', { ordersCount: orders.length, branch: 'catch', errorMsg })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /生成复盘报告/ })
    fireEvent.click(button)

    debugLog('P1-catch 结果', {
      errorToastCalled: true,
      expectedTitle: '生成复盘报告失败',
      expectedDescription: errorMsg,
    })
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: '生成复盘报告失败',
          description: errorMsg,
        }),
      )
    })
  })
})
