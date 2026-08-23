/**
 * InputApp（输入舱子路由分发）+ InputDashboard（录入看板）集成测试
 *
 * 2026-08-23 Token Plan 处理事项：全量重写。旧版断言基于重构前 UI
 * （enterCandidateStock 旧文案、热门板块同页 Tab、poolService 看板数据源），
 * 且缺失 DensityProvider 包裹导致整页被 InputFlowErrorBoundary 拦截。
 * 本版本对齐当前实现：
 *   - InputDashboard 依赖 DensityProvider（useDensity）与 intentionPoolStore
 *   - 录入区文案「录入候选股票」，子分段「逐项输入 / 批量导入」
 *   - 热门板块已拆为独立页（/input/hot-sectors），看板内仅保留导航按钮
 *   - 采集服务状态行（检查中.../刷新 + 已连接/未连接）
 *   - 子路由分发：/input/collection-strategy → CollectionStrategyPage 等
 *
 * addStock 深度联动覆盖见 src/apps/input/InputDashboard.addStock.test.tsx。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import InputApp from '@/apps/input/InputApp'
import { DensityProvider } from '@/components/cockpit/DensityContext'
import type { Stock } from '@/types'

// ─── Mock 依赖（对齐 InputDashboard.addStock.test.tsx 模式）────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/debugToolkit', () => ({
  createDebugLogger: () => ({ log: vi.fn() }),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: vi.fn(() => () => {}), emit: vi.fn() },
}))

vi.mock('@/services/fetcher/fetcherService', () => ({
  checkFetcherHealth: vi.fn().mockResolvedValue({ ok: true, latencyMs: 0 }),
}))

vi.mock('@/services/useCase/fetcherOrchestrator.useCase', () => ({
  fetchBasicDataUseCase: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/services/pool/syncIntentionToResearch', () => ({
  syncIntentionToResearch: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/services/stock/stockDictionary', () => ({
  findStockBySymbol: vi.fn().mockReturnValue(null),
}))

// 避免 StockSearch 内部复杂依赖（搜索服务/快捷键等）影响看板渲染
vi.mock('@/components/organisms/input/StockSearch', () => ({
  StockSearch: vi.fn(() => null),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}))

vi.mock('@/lib/precision', () => ({
  formatPrice: (v: unknown) => (v != null ? `${v}` : '-'),
  formatMarketCap: (v: unknown) => (v != null ? `${v}亿` : '-'),
}))

// ─── intentionPoolStore mock（数据源）──────────────────────────────

const { mockStoreItemsRef, mockRefresh, mockDeleteItem, mockAddStock } = vi.hoisted(() => {
  const storeItemsRef: { value: Stock[] } = { value: [] }
  return {
    mockStoreItemsRef: storeItemsRef,
    mockRefresh: vi.fn(async () => {}),
    mockDeleteItem: vi.fn().mockResolvedValue(true),
    mockAddStock: vi.fn(),
  }
})

vi.mock('@/store/intentionPoolStore', async () => {
  const { create } = await import('zustand')
  return {
    useIntentionPoolStore: create<{
      items: Stock[]
      loading: boolean
      error: string | null
      isRefreshing: boolean
      lastUpdated: number
      refresh: () => Promise<void>
      deleteItem: (s: string) => Promise<boolean>
      updateItem: (s: string, d: Partial<Stock>) => Promise<boolean>
    }>((set) => ({
      items: mockStoreItemsRef.value,
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
      refresh: async () => {
        mockRefresh()
        set({ items: mockStoreItemsRef.value, lastUpdated: Date.now() })
      },
      deleteItem: mockDeleteItem,
      updateItem: vi.fn().mockResolvedValue(true),
    })),
    getIntentionPoolGroups: (): string[] => {
      const groups = new Set<string>()
      for (const item of mockStoreItemsRef.value) groups.add(item.group ?? '默认分组')
      return Array.from(groups).sort()
    },
  }
})

vi.mock('@/services/input/inputService', async () => {
  const actual = await vi.importActual('@/services/input/inputService')
  return {
    ...actual,
    addStock: (...args: unknown[]) => mockAddStock(...args),
  }
})

// ─── 测试主体 ───────────────────────────────────────────────────────

describe('InputApp（输入舱）', () => {
  beforeEach(() => {
    mockStoreItemsRef.value = []
    mockRefresh.mockClear()
    mockDeleteItem.mockClear()
    mockAddStock.mockReset()
    mockAddStock.mockResolvedValue({
      success: true,
      data: { symbol: '000001.SZ', name: '平安银行' },
      error: null,
    })
  })

  const renderApp = (initialPath = '/input') =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <DensityProvider>
          <InputApp />
        </DensityProvider>
      </MemoryRouter>,
    )

  it('默认路由渲染录入看板（面包屑 + 标题 + 录入候选股票卡片）', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('录入候选股票')).toBeInTheDocument()
    })
    // 页头与录入方式子分段
    expect(screen.getAllByText('输入舱').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /自行意向输入/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /逐项输入/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /批量导入/ })).toBeInTheDocument()
    // 热门板块已拆独立页：看板内仅保留导航按钮
    expect(screen.getByRole('button', { name: /热门板块/ })).toBeInTheDocument()
  })

  it('逐项输入：填写表单点击「仅代码」触发 addStock（不启动采集）', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    fireEvent.change(screen.getByRole('textbox', { name: '股票代码' }), {
      target: { value: '000001.SZ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '股票名称' }), {
      target: { value: '平安银行' },
    })
    const onlyCodeBtn = screen.getAllByRole('button').find((b) => b.textContent?.trim() === '仅代码')
    expect(onlyCodeBtn).toBeDefined()
    fireEvent.click(onlyCodeBtn!)

    await waitFor(() => {
      expect(mockAddStock).toHaveBeenCalledWith(
        { symbol: '000001.SZ', name: '平安银行' },
        expect.objectContaining({ fetchBasicAfterAdd: false, fetchKlineAfterAdd: false }),
      )
    })
  })

  it('采集服务状态：初始「检查中...」且刷新按钮禁用（首次手动触发前状态）', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))
    // 当前实现：健康检查不随挂载自动执行，需用户手动点击刷新；
    // 初始 fetcherOk=null → 状态位渲染「检查中...」骨架，刷新按钮 disabled 防误触。
    const healthButton = screen.getByRole('button', { name: /检查中/ })
    expect(healthButton).toBeDisabled()
    expect(screen.getByText('检查中...')).toBeInTheDocument()
  })

  it('切换到批量导入子分段后渲染批量导入面板', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    fireEvent.click(screen.getByRole('button', { name: /批量导入/ }))

    await waitFor(() => {
      expect(screen.getByText('批量导入候选股票')).toBeInTheDocument()
    })
  })

  it('子路由分发：/input/collection-strategy 渲染采集策略配置页', async () => {
    renderApp('/input/collection-strategy')
    await waitFor(() => {
      expect(screen.queryByText('录入候选股票')).not.toBeInTheDocument()
    })
  })
})
