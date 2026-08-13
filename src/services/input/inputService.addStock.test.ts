/**
 * @description addStock 数据流单元测试
 *
 * 验证移除自动流转逻辑后的完整数据流：
 *   1. addStock 写入后 stock.pool 保持为 'intention'
 *   2. addStock 广播 POOL_CHANGED 事件
 *   3. addStock 不触发自动流转（只有一次 forward 调用）
 *   4. addStock + refresh 后 store 的 items 包含新添加的股票
 *   5. store 订阅机制正确触发更新（items 引用变化）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Stock } from '@/data/types'

// ─── Mock 依赖 ──────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id-12345',
}))

const { mockForward, mockQuery } = vi.hoisted(() => ({
  mockForward: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    subscribe: vi.fn(() => vi.fn()),
    invalidateAll: vi.fn(),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, data: unknown) => ({ meta, data })),
  },
}))

vi.mock('@/config/dbConfig', () => ({
  DATA_SOURCE: { manual: 'manual', import: 'import', akshare: 'akshare' },
  ENVELOPE_ACTION: {
    queryByIndex: 'QUERY_BY_INDEX',
    queryGet: 'QUERY_GET',
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
  },
  ENVELOPE_TARGET: { db: 'db' },
  MODULE_ID: { pool: 'pool' },
  STORE_NAME: { stocks: 'stocks' },
}))

vi.mock('@/constants/pool.constants', () => ({
  DEFAULT_POOL_GROUP: '默认分组',
  DEFAULT_POOL_TYPE: 'intention',
  POOL_TYPE: { intention: 'intention', research: 'research', position: 'position' },
  INTENTION_STATUS: { screening: 'screening', watchlist: 'watchlist', archived: 'archived' },
  RESEARCH_STATUS: { candidate: 'candidate', screened: 'screened', deepDive: 'deepDive', watching: 'watching', archived: 'archived' },
  POSITION_STATUS: { holding: 'holding', partial: 'partial', closed: 'closed' },
  DEFAULT_POOL_STATUS: { intention: 'screening', research: 'candidate', position: 'holding' },
}))

vi.mock('@/config/inputConfig', () => ({
  INPUT_CONFIG: {
    symbolPattern: /^[0-9]{6}$/,
    maxBatchSize: 100,
  },
}))

vi.mock('@/services/useCase/fetcherOrchestrator.useCase', () => ({
  fetchBasicDataUseCase: vi.fn().mockResolvedValue({ success: true }),
  fetchKlineDataUseCase: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { POOL_CHANGED: 'pool:changed' },
}))

vi.mock('@/services/stock/FullMarketStockService', () => ({
  searchFullMarket: vi.fn().mockResolvedValue([]),
}))

// ─── 导入被测模块 ────────────────────────────────────────────

import { addStock } from './inputService'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { withBroadcast } from '@/lib/withBroadcast'
import { EnvelopeFactory } from '@/core/envelope'

// ─── 测试 ────────────────────────────────────────────────────

describe('addStock 数据流测试（自动流转已移除）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForward.mockResolvedValue(undefined)
    // 重置 store 状态
    useIntentionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  it('写入后 stock.pool 保持为 intention', async () => {
    const result = await addStock(
      { symbol: '300712', name: '永福股份' },
      { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
    )

    expect(result.success).toBe(true)
    expect(result.data?.pool).toBe('intention')
    expect(result.data?.symbol).toBe('300712')
  })

  it('广播 POOL_CHANGED 事件，action=add, pool=intention', async () => {
    await addStock(
      { symbol: '300712', name: '永福股份' },
      { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
    )

    expect(withBroadcast).toHaveBeenCalledWith(
      'pool:changed',
      expect.objectContaining({
        action: 'add',
        pool: 'intention',
        symbol: '300712',
      }),
    )
  })

  it('不触发自动流转：只有一次 forward 调用（insertStock）', async () => {
    await addStock(
      { symbol: '300712', name: '永福股份' },
      { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
    )

    // 只调用一次 forward（insertStock），不再有第二次 updateStock（自动流转）
    expect(mockForward).toHaveBeenCalledTimes(1)

    // 验证 forward 的数据中 pool 为 intention
    const forwardCall = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(forwardCall![1].pool).toBe('intention')
  })

  it('addStock + refresh 后 store items 包含新添加的股票', async () => {
    // 1. addStock 写入
    await addStock(
      { symbol: '300712', name: '永福股份' },
      { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
    )

    // 2. 模拟 refresh 查询返回新添加的股票
    const mockStock: Stock = {
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
    mockQuery.mockResolvedValue({ success: true, data: [mockStock] })

    // 3. 调用 refresh
    await useIntentionPoolStore.getState().refresh()

    // 4. 验证 store items 包含新股票
    const state = useIntentionPoolStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.symbol).toBe('300712')
    expect(state.items[0]!.name).toBe('永福股份')
  })

  it('store 订阅机制：items 引用变化触发更新', async () => {
    // 记录初始 items 引用
    const initialItems = useIntentionPoolStore.getState().items
    expect(initialItems).toEqual([])

    // 模拟 refresh 返回数据
    const mockStock: Stock = {
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
    mockQuery.mockResolvedValue({ success: true, data: [mockStock] })

    await useIntentionPoolStore.getState().refresh()

    // 验证 items 引用已变化（新数组），Zustand 会触发组件重渲染
    const updatedItems = useIntentionPoolStore.getState().items
    expect(updatedItems).not.toBe(initialItems) // 引用不同
    expect(updatedItems).toHaveLength(1)
    expect(updatedItems[0]!.symbol).toBe('300712')
  })
})
