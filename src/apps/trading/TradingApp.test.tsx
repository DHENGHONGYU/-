/**
 * @module apps/trading/TradingApp.test
 * @description 交易舱应用路由分发测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// 隔离测试依赖：阻止真实 store 与 dataLayer 副作用
vi.mock('@/store/tradingStore', () => ({
  useTradingStore: vi.fn((selector) => {
    const state = {
      stocks: [],
      orders: [],
      signals: [],
      adviceMap: {},
      portfolio: null,
      strategyResult: null,
      portfolioLoading: false,
      processingSymbols: new Set<string>(),
      message: null,
      loadStocks: vi.fn(),
      loadOrders: vi.fn(),
      scanSignals: vi.fn(),
      loadPortfolio: vi.fn(),
      handleBuy: vi.fn(),
      handleSell: vi.fn(),
    }
    return selector(state)
  }),
}))

vi.mock('@/store/executionStore', () => ({
  useExecutionStore: vi.fn((selector) => {
    const state = {
      plans: [],
      activePlans: [],
      loading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      confirmPlan: vi.fn(),
      executePlan: vi.fn(),
      cancelPlan: vi.fn(),
      markReviewed: vi.fn(),
    }
    return selector(state)
  }),
  initExecutionStoreSubscriptions: vi.fn(() => vi.fn()),
}))

// 标记 ExecutionPlanPanel 是否被渲染，避免测试其内部实现细节
const executionPlanPanelRendered = vi.fn()
vi.mock('./panels/ExecutionPlanPanel', () => ({
  ExecutionPlanPanel: function MockExecutionPlanPanel() {
    executionPlanPanelRendered()
    return <div data-testid="execution-plan-panel">ExecutionPlanPanel</div>
  },
}))

import TradingApp from './TradingApp'

describe('TradingApp 路由分发', () => {
  beforeEach(() => {
    executionPlanPanelRendered.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('访问 /trading/execution-plans 时应渲染 ExecutionPlanPanel', async () => {
    render(
      <MemoryRouter initialEntries={['/trading/execution-plans']}>
        <TradingApp />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(executionPlanPanelRendered).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('execution-plan-panel')).toBeInTheDocument()
      expect(screen.getByText('ExecutionPlanPanel')).toBeInTheDocument()
    })
  })

  it('访问 /trading 默认路径时不应渲染 ExecutionPlanPanel', async () => {
    render(
      <MemoryRouter initialEntries={['/trading']}>
        <TradingApp />
      </MemoryRouter>,
    )

    expect(executionPlanPanelRendered).not.toHaveBeenCalled()
    expect(screen.getByText('交易舱 · 模拟盘')).toBeInTheDocument()
  })
})
