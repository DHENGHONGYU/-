/**
 * @description InputDashboard + addStock 联动单元测试
 *
 * 验证：
 *   1. 点击"仅录入"按钮触发 addStock 调用
 *   2. addStock 成功后调用 refresh，store items 更新为包含新股票
 *   3. React 组件检测到 items 引用变化，重渲染表格
 *   4. 新添加的股票名称/代码出现在 DOM 中
 *   5. 添加完成后输入框被清空
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InputDashboard from './InputDashboard'
import type { Stock } from '@/data/types'

// ─── Mock 依赖 ──────────────────────────────────────────────

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock fetcherService
vi.mock('@/services/fetcher/fetcherService', () => ({
  checkFetcherHealth: vi.fn().mockResolvedValue({ ok: false, latencyMs: 0 }),
}))

// Mock fetchBasicDataUseCase
vi.mock('@/services/useCase/fetcherOrchestrator.useCase', () => ({
  fetchBasicDataUseCase: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock stockDictionary
vi.mock('@/services/stock/stockDictionary', () => ({
  findStockBySymbol: vi.fn().mockReturnValue(null),
}))

// Mock StockSearch 组件（避免渲染复杂子组件）
vi.mock('@/components/organisms/input/StockSearch', () => ({
  StockSearch: vi.fn(() => null),
}))

// Mock useToast（部分子组件依赖）
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Mock theme tokens / cn（tailwind 辅助函数）
// 用 importOriginal 保留真实的 COLOR_TOKENS / THEME_TOKENS（Card、Skeleton、Badge 等子组件依赖）
vi.mock('@/constants/theme.tokens', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@/constants/theme.tokens')
  return {
    ...actual,
    twText: actual.twText ?? (() => 'text-gray-500'),
    twBg: actual.twBg ?? (() => 'bg-gray-100'),
  }
})

vi.mock('@/lib/precision', () => ({
  formatPrice: (v: unknown) => (v != null ? `${v}` : '-'),
  formatMarketCap: (v: unknown) => (v != null ? `${v}亿` : '-'),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: vi.fn(() => () => {}),
    emit: vi.fn(),
  },
}))

// ─── Mock addStock + refresh 核心联动 ──────────────────────
// 注意：vi.mock factory 被 hoisted，其中使用的变量必须也用 vi.hoisted 包装

const { mockStoreItemsRef, mockRefresh, mockDeleteItem, mockUpdateItem, mockAddStock } = vi.hoisted(() => {
  // 用对象包装以便在 vi.mock factory 中读写
  const storeItemsRef: { value: Stock[] } = { value: [] }
  return {
    mockStoreItemsRef: storeItemsRef,
    mockRefresh: vi.fn(async () => {}),
    mockDeleteItem: vi.fn().mockResolvedValue(true),
    mockUpdateItem: vi.fn().mockResolvedValue(true),
    mockAddStock: vi.fn(),
  }
})

vi.mock('@/store/intentionPoolStore', () => {
  const { create } = require('zustand') as typeof import('zustand')
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
        // 关键：用 mockStoreItemsRef.value 的当前引用触发 set
        // 如果引用相同，Zustand 不会触发重渲染
        set({ items: mockStoreItemsRef.value, lastUpdated: Date.now() })
      },
      deleteItem: mockDeleteItem,
      updateItem: mockUpdateItem,
    })),
    getIntentionPoolGroups: (): string[] => {
      const groups = new Set<string>()
      for (const item of mockStoreItemsRef.value) {
        groups.add(item.group ?? '默认分组')
      }
      return Array.from(groups).sort()
    },
  }
})

// ─── Mock addStock ──────────────────────────────────────────

vi.mock('@/services/input/inputService', async () => {
  const actual = await vi.importActual('@/services/input/inputService')
  return {
    ...actual,
    addStock: (...args: unknown[]) => mockAddStock(...args),
  }
})

// ─── 辅助函数 ───────────────────────────────────────────────

const TEST_STOCK: Stock = {
  symbol: '300712',
  name: '永福股份',
  pool: 'intention',
  researchStatus: 'screening',
  source: 'manual',
  group: '默认分组',
  dataVersion: 1,
  ingestedAt: Date.now(),
  updatedAt: Date.now(),
} as Stock

function fillAddForm(symbolValue: string, nameValue: string): void {
  const codeInput = screen.getByRole('textbox', { name: '股票代码' })
  const nameInput = screen.getByRole('textbox', { name: '股票名称' })
  fireEvent.change(codeInput, { target: { value: symbolValue } })
  fireEvent.change(nameInput, { target: { value: nameValue } })
}

// ─── 测试主体 ───────────────────────────────────────────────

describe('InputDashboard + addStock 联动测试', () => {
  beforeEach(() => {
    // 重置所有 mock
    mockStoreItemsRef.value = []
    mockAddStock.mockReset()
    mockRefresh.mockReset()
    mockDeleteItem.mockReset()

    // 默认 addStock 成功：返回新股票数据
    mockAddStock.mockImplementation(async ({ symbol, name }: { symbol: string; name: string }) => {
      const newStock = {
        symbol,
        name,
        pool: 'intention',
        group: '默认分组',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      } as Stock

      return {
        success: true,
        data: newStock,
        error: null,
      }
    })

    // mockRefresh 被调用时，更新 mockStoreItemsRef.value 引用（保证新旧不同）
    mockRefresh.mockImplementation(async () => {
      mockStoreItemsRef.value = [...mockStoreItemsRef.value]
    })
  })

  it('点击"仅录入"按钮触发 addStock 调用', async () => {
    render(<InputDashboard />)

    // 填写表单
    fillAddForm('300712', '永福股份')

    // 点击"仅录入"按钮
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )
    expect(onlyAddBtn).toBeDefined()
    fireEvent.click(onlyAddBtn!)

    // 断言 addStock 被调用
    await waitFor(() => {
      expect(mockAddStock).toHaveBeenCalledWith(
        { symbol: '300712', name: '永福股份' },
        expect.objectContaining({ fetchBasicAfterAdd: false, fetchKlineAfterAdd: false }),
      )
    })
  })

  it('addStock 成功后调用 store.refresh（UI 状态更新触发点）', async () => {
    render(<InputDashboard />)

    fillAddForm('300712', '永福股份')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    // 等待 handleAdd 内部的 addStock → refresh 调用链完成
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('addStock 成功后输入框被清空', async () => {
    render(<InputDashboard />)

    fillAddForm('300712', '永福股份')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    // 输入框应被清空
    await waitFor(() => {
      const codeInput = screen.getByRole('textbox', { name: '股票代码' }) as HTMLInputElement
      const nameInput = screen.getByRole('textbox', { name: '股票名称' }) as HTMLInputElement
      expect(codeInput.value).toBe('')
      expect(nameInput.value).toBe('')
    })
  })

  it('添加成功后显示成功消息', async () => {
    render(<InputDashboard />)

    fillAddForm('300712', '永福股份')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    await waitFor(() => {
      expect(screen.queryByText(/已添加 300712/)).toBeInTheDocument()
    })
  })

  it('核心：refresh 后 items 引用变化，UI 重渲染并显示新股票在表格中', async () => {
    // 这个测试验证最重要的数据流闭环：
    // addStock → refresh → Zustand set({ items: newArr }) → React 重渲染 → DOM 出现新股票

    // 区分第 N 次 refresh 调用：第一次（useEffect 初始化）返回空，第二次（addStock 后）追加新股票
    let refreshCallCount = 0
    mockRefresh.mockImplementation(async () => {
      refreshCallCount++
      if (refreshCallCount >= 2) {
        // handleAdd 内的 refresh：追加新股票
        mockStoreItemsRef.value = [...mockStoreItemsRef.value, TEST_STOCK]
      } else {
        // 初始化 refresh：保持空（空态）
        mockStoreItemsRef.value = [...mockStoreItemsRef.value]
      }
    })

    render(<InputDashboard />)

    // 初始状态：表格应显示"暂无候选股票"
    await waitFor(() => {
      expect(screen.queryByText(/暂无候选股票/)).toBeTruthy()
    })

    // 填写表单并点击"仅录入"
    fillAddForm('300712', '永福股份')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    // 关键断言：refresh 调用完成后，新股票出现在 DOM 中
    await waitFor(
      () => {
        // 表格中应出现 300712 代码和"永福股份"名称
        expect(screen.queryByText('300712')).toBeTruthy()
        expect(screen.queryByText('永福股份')).toBeTruthy()
        // "暂无候选股票"文本应消失
        expect(screen.queryByText(/暂无候选股票/)).toBeNull()
      },
      { timeout: 5000 },
    )
  })

  it('addStock 返回 failure 时不额外触发 refresh，UI 显示错误消息', async () => {
    // useEffect 初始化会调用 1 次 refresh，failure 时不应再增加
    mockAddStock.mockResolvedValue({
      success: false,
      data: null,
      error: '股票代码格式错误',
    })

    render(<InputDashboard />)

    // 等待初始化 refresh 完成
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })

    fillAddForm('INVALID', '未知股票')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    await waitFor(() => {
      // 显示错误消息
      expect(screen.queryByText('股票代码格式错误')).toBeInTheDocument()
    })
    // 关键断言：refresh 调用次数仍为 1（没有额外的 handleAdd 内 refresh）
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('空代码名称时不调用 addStock，直接显示验证提示', async () => {
    render(<InputDashboard />)

    // 空值直接点击
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    await waitFor(() => {
      expect(screen.queryByText('请输入代码和名称')).toBeInTheDocument()
    })
    // addStock 不应被调用
    expect(mockAddStock).not.toHaveBeenCalled()
  })

  it('添加后表格"已选 0 / 共 1 项"计数正确更新', async () => {
    // 只在第二次 refresh（handleAdd 内）追加新股票，避免 useEffect 初始化 refresh 时就加入
    let calls = 0
    mockRefresh.mockImplementation(async () => {
      calls++
      if (calls >= 2) {
        mockStoreItemsRef.value = [...mockStoreItemsRef.value, TEST_STOCK]
      } else {
        mockStoreItemsRef.value = [...mockStoreItemsRef.value]
      }
    })

    render(<InputDashboard />)

    fillAddForm('300712', '永福股份')
    const onlyAddBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.trim() === '仅录入',
    )!
    fireEvent.click(onlyAddBtn)

    await waitFor(() => {
      // 工具条显示"已选 0 / 共 1 项"
      expect(screen.queryByText(/共 1 项/)).toBeInTheDocument()
    })
  })
})
