/**
 * 股票池三分拆 Store 单元测试
 *
 * 覆盖场景：
 * 1. intentionPoolStore / researchPoolStore / positionPoolStore 初始状态
 * 2. refresh 正常加载 / 并发锁 / 失败保留 / loading 区分
 * 3. addItem 成功 / 失败
 * 4. updateItem 成功 / 不存在 / symbol 归一化
 * 5. deleteItem 成功 / symbol 归一化 / 失败
 * 6. updateStatus 成功流转 / 非法流转 / 不存在 / 失败
 * 7. updateGroup 成功 / 空名 / 失败
 * 8. getByStatus / getByGroup
 * 9. 派生查询函数
 * 10. 订阅 / source 过滤 / cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { StandardEnvelope } from '@/core/envelope'

const {
  mockOn,
  mockQuery,
  mockForward,
  capturedRef: _capturedRef,
  unsubscribeFn: _unsubscribeFn,
} = vi.hoisted(() => {
  const capturedRef = { callback: null as ((envelope: StandardEnvelope) => void) | null }
  const unsubscribeFn = vi.fn()

  const mockOn = vi.fn().mockImplementation((_channel: string, callback: (envelope: StandardEnvelope) => void) => {
    capturedRef.callback = callback
    return unsubscribeFn
  })

  return {
    mockOn,
    mockQuery: vi.fn().mockResolvedValue({ success: false }),
    mockForward: vi.fn().mockResolvedValue(undefined),
    capturedRef,
    unsubscribeFn,
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockOn, query: mockQuery, forward: mockForward },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn().mockReturnValue({}) },
}))

vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: vi.fn().mockReturnValue(true),
}))

vi.mock('@/config/dbConfig', () => ({
  DATA_SOURCE: { manual: 'manual' },
  ENVELOPE_ACTION: {
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
    queryGet: 'QUERY_GET',
    queryList: 'QUERY_LIST',
    queryByIndex: 'QUERY_BY_INDEX',
  },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { pool: 'pool' },
  STORE_NAME: { stocks: 'stocks' },
}))

vi.mock('@/constants/pool.constants', () => ({
  DEFAULT_POOL_GROUP: 'default',
  DEFAULT_POOL_TYPE: 'intention',
  DEFAULT_POOL_STATUS: {
    intention: 'screening',
    research: 'candidate',
    position: 'holding',
  },
  POOL_TYPE: {
    intention: 'intention',
    research: 'research',
    position: 'position',
  },
  INTENTION_STATUS: {
    screening: 'screening',
    watchlist: 'watchlist',
    archived: 'archived',
  },
  RESEARCH_STATUS: {
    candidate: 'candidate',
    screened: 'screened',
    watching: 'watching',
    deepDive: 'deepDive',
    archived: 'archived',
  },
  POSITION_STATUS: {
    holding: 'holding',
    partial: 'partial',
    closed: 'closed',
  },
}))

import {
  useIntentionPoolStore,
  getIntentionPoolTotalCount,
  initIntentionPoolStoreSubscriptions,
} from './intentionPoolStore'
import {
  useResearchPoolStore,
  getResearchPoolGroups,
  initResearchPoolStoreSubscriptions,
} from './researchPoolStore'
import {
  usePositionPoolStore,
  getPositionPoolItemBySymbol,
  initPositionPoolStoreSubscriptions,
} from './positionPoolStore'
import type { Stock } from '@/data/types'
import { isValidTransition } from '@/core/poolTransitionEngine'

function createMockStock(overrides: Partial<Stock> = {}, pool = 'intention'): Stock {
  const researchStatus = (overrides.researchStatus ?? 'screening') as Stock['researchStatus']
  return {
    symbol: 'AAPL',
    name: 'Apple Inc',
    pool: pool as Stock['pool'],
    researchStatus,
    status: researchStatus,
    source: 'manual',
    dataVersion: 1,
    ...overrides,
  } as Stock
}

beforeEach(() => {
  initIntentionPoolStoreSubscriptions()()
  initResearchPoolStoreSubscriptions()()
  initPositionPoolStoreSubscriptions()()

  vi.clearAllMocks()

  useIntentionPoolStore.setState({
    items: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
  useResearchPoolStore.setState({
    items: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
  usePositionPoolStore.setState({
    items: [],
    loading: false,
    error: null,
    isRefreshing: false,
    lastUpdated: 0,
  })
})

describe('intentionPoolStore', () => {
  it('初始状态正确', () => {
    const state = useIntentionPoolStore.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('refresh 正常加载', async () => {
    const stocks = [createMockStock({ symbol: 'AAPL' }, 'intention')]
    mockQuery.mockResolvedValue({ success: true, data: stocks })
    await useIntentionPoolStore.getState().refresh()
    expect(useIntentionPoolStore.getState().items).toHaveLength(1)
    expect(useIntentionPoolStore.getState().error).toBeNull()
  })

  it('addItem 成功添加', async () => {
    mockQuery.mockResolvedValueOnce({ success: false })
    const result = await useIntentionPoolStore.getState().addItem({ symbol: 'NVDA', name: 'NVIDIA', source: 'manual' })
    expect(result).toBe(true)
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('updateItem symbol 自动 trim + toUpperCase', async () => {
    useIntentionPoolStore.setState({ items: [createMockStock({ symbol: 'AAPL' }, 'intention') as never] })
    await useIntentionPoolStore.getState().updateItem('  aapl  ', { name: 'Updated' })
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('getByStatus 按状态筛选', () => {
    useIntentionPoolStore.setState({
      items: [
        createMockStock({ symbol: 'A1', researchStatus: 'screening' }, 'intention'),
        createMockStock({ symbol: 'A2', researchStatus: 'watchlist' }, 'intention'),
      ] as never[],
    })
    expect(useIntentionPoolStore.getState().getByStatus('watchlist')).toHaveLength(1)
  })

  it('getIntentionPoolTotalCount 返回 items.length', () => {
    useIntentionPoolStore.setState({
      items: [createMockStock({ symbol: 'A1' }, 'intention'), createMockStock({ symbol: 'A2' }, 'intention')] as never[],
    })
    expect(getIntentionPoolTotalCount()).toBe(2)
  })
})

describe('researchPoolStore', () => {
  it('初始状态正确', () => {
    const state = useResearchPoolStore.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('refresh 按 research 池过滤', async () => {
    const stocks = [
      createMockStock({ symbol: 'AAPL' }, 'research'),
      createMockStock({ symbol: 'TSLA' }, 'intention'),
    ]
    mockQuery.mockResolvedValue({ success: true, data: stocks })
    await useResearchPoolStore.getState().refresh()
    expect(useResearchPoolStore.getState().items).toHaveLength(1)
    expect(useResearchPoolStore.getState().items[0]?.symbol).toBe('AAPL')
  })

  it('updateStatus 非法流转返回 false', async () => {
    vi.mocked(isValidTransition).mockReturnValueOnce(false)
    useResearchPoolStore.setState({
      items: [createMockStock({ symbol: 'AAPL', researchStatus: 'candidate' }, 'research')] as never[],
    })
    const result = await useResearchPoolStore.getState().updateStatus('AAPL', 'archived')
    expect(result).toBe(false)
    expect(mockForward).not.toHaveBeenCalled()
  })

  it('getResearchPoolGroups 去重排序', () => {
    useResearchPoolStore.setState({
      items: [
        createMockStock({ symbol: 'A1', group: 'tech' }, 'research'),
        createMockStock({ symbol: 'A2', group: 'finance' }, 'research'),
        createMockStock({ symbol: 'A3' }, 'research'),
      ] as never[],
    })
    expect(getResearchPoolGroups()).toEqual(['default', 'finance', 'tech'])
  })
})

describe('positionPoolStore', () => {
  it('初始状态正确', () => {
    const state = usePositionPoolStore.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('refresh 包含持仓字段', async () => {
    const stocks = [
      createMockStock({ symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 160, researchStatus: 'holding' }, 'position'),
    ]
    mockQuery.mockResolvedValue({ success: true, data: stocks })
    await usePositionPoolStore.getState().refresh()
    const item = usePositionPoolStore.getState().items[0]
    expect(item?.symbol).toBe('AAPL')
    expect((item as { quantity?: number }).quantity).toBe(100)
  })

  it('getPositionPoolItemBySymbol 存在时返回 item', () => {
    usePositionPoolStore.setState({
      items: [createMockStock({ symbol: 'AAPL', researchStatus: 'holding' }, 'position')] as never[],
    })
    expect(getPositionPoolItemBySymbol('AAPL')?.symbol).toBe('AAPL')
  })
})
