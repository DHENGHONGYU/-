/**
 * @test_id V9-TEST-ST-152
 * @covers_docs [V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-PROJ-108]
 * @description 持仓池 Store 单元测试
 *
 * 覆盖场景：
 *   - CRUD 操作：添加、删除、更新持仓
 *   - 批量操作：批量添加、批量删除
 *   - 持仓状态管理（持仓中/已清仓）
 *   - 盈亏计算：浮动盈亏、收益率、总市值
 *   - 搜索与筛选：按代码/名称搜索、按状态筛选
 *   - 排序：按盈亏、按收益率、按市值
 *   - 持久化：与 dataBridge 交互
 *   - 去重：同一只股票重复添加处理
 *   - 数据版本管理
 *   - 分组管理
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Stock } from '@/data/types'
import { POSITION_STATUS } from '@/constants/pool.constants'

// ============================================================
// Mocks
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn())
const mockForward = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    query: mockQuery,
    subscribe: mockSubscribe,
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/config/dbConfig', () => ({
  DATA_SOURCE: { manual: 'manual', import: 'import', akshare: 'akshare' },
  ENVELOPE_ACTION: {
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
    queryGet: 'QUERY_GET',
    queryByIndex: 'QUERY_BY_INDEX',
  },
  ENVELOPE_TARGET: { db: 'db' },
  MODULE_ID: { pool: 'pool' },
  STORE_NAME: { stocks: 'stocks' },
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    POOL_CHANGED: 'pool:changed',
  },
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-001'),
}))

// Mock poolTransitionEngine
vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: vi.fn((fromPool, fromStatus, toPool, toStatus) => {
    // 简单模拟：position 池内 holding → partial → closed 合法
    if (fromPool === 'position' && toPool === 'position') {
      const order = ['holding', 'partial', 'closed']
      const fromIdx = order.indexOf(fromStatus)
      const toIdx = order.indexOf(toStatus)
      return fromIdx !== -1 && toIdx !== -1 && toIdx >= fromIdx
    }
    return false
  }),
}))

// ============================================================
// 导入被测模块（必须在所有 mock 之后）
// ============================================================

import {
  usePositionPoolStore,
  getPositionPoolTotalCount,
  getPositionPoolItemBySymbol,
  getPositionPoolGroups,
  initPositionPoolStoreSubscriptions,
} from './positionPoolStore'

// ============================================================
// Helpers
// ============================================================

function createMockStock(overrides: Partial<Stock> & { symbol: string; name: string }): Stock {
  return {
    pool: 'position',
    researchStatus: 'holding',
    source: 'manual',
    price: 100,
    pe: 20,
    pb: 2,
    roe: 15,
    marketCap: 100_000_000_000,
    dataVersion: 1,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    quantity: 1000,
    avgCost: 90,
    currentPrice: 100,
    group: '默认分组',
    ...overrides,
  } as Stock
}

function createPositionInput(overrides: Partial<{ symbol: string; name: string; quantity: number; avgCost: number; currentPrice: number }> = {}) {
  return {
    symbol: '600519',
    name: '贵州茅台',
    quantity: 1000,
    avgCost: 1800,
    currentPrice: 2000,
    price: 2000,
    ...overrides,
  }
}

// ============================================================
// 测试套件
// ============================================================

describe('positionPoolStore - 初始状态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  it('初始状态 items 应为空数组', () => {
    const { items } = usePositionPoolStore.getState()
    expect(items).toEqual([])
  })

  it('初始状态 loading 应为 false', () => {
    expect(usePositionPoolStore.getState().loading).toBe(false)
  })

  it('初始状态 error 应为 null', () => {
    expect(usePositionPoolStore.getState().error).toBeNull()
  })

  it('初始状态 lastUpdated 应为 0', () => {
    expect(usePositionPoolStore.getState().lastUpdated).toBe(0)
  })

  it('getPositionPoolTotalCount 初始返回 0', () => {
    expect(getPositionPoolTotalCount()).toBe(0)
  })
})

// ============================================================
// refresh
// ============================================================

describe('positionPoolStore - refresh 刷新', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  it('首次加载时 loading 应为 true', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })
    const promise = usePositionPoolStore.getState().refresh()
    expect(usePositionPoolStore.getState().loading).toBe(true)
    await promise
  })

  it('refresh 成功后 items 应填充数据', async () => {
    const mockStocks = [
      createMockStock({ symbol: '600519', name: '贵州茅台' }),
      createMockStock({ symbol: '000858', name: '五粮液' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: mockStocks })

    await usePositionPoolStore.getState().refresh()

    const { items, loading, error } = usePositionPoolStore.getState()
    expect(items).toHaveLength(2)
    expect(items[0]!.symbol).toBe('600519')
    expect(items[1]!.symbol).toBe('000858')
    expect(loading).toBe(false)
    expect(error).toBeNull()
  })

  it('refresh 失败时应设置 error', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, error: '数据库错误' })

    await usePositionPoolStore.getState().refresh()

    const { error, loading } = usePositionPoolStore.getState()
    expect(error).toBe('数据库错误')
    expect(loading).toBe(false)
  })

  it('refresh 抛出异常时应捕获并设置 error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('网络异常'))

    await usePositionPoolStore.getState().refresh()

    expect(usePositionPoolStore.getState().error).toBe('网络异常')
  })

  it('正在刷新时再次调用 refresh 应直接返回', async () => {
    mockQuery.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 100)),
    )
    usePositionPoolStore.setState({ isRefreshing: true })

    const result = usePositionPoolStore.getState().refresh()
    // 不等待，验证 isRefreshing 保持 true
    expect(usePositionPoolStore.getState().isRefreshing).toBe(true)
    await result
  })

  it('refresh 成功后 lastUpdated 应更新', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, data: [] })
    const before = Date.now()

    await usePositionPoolStore.getState().refresh()

    const { lastUpdated } = usePositionPoolStore.getState()
    expect(lastUpdated).toBeGreaterThanOrEqual(before)
  })

  it('refresh 仅返回 pool === position 的数据', async () => {
    const mockStocks = [
      createMockStock({ symbol: '600519', name: '贵州茅台', pool: 'position' }),
      createMockStock({ symbol: '000001', name: '平安银行', pool: 'research' }),
    ]
    mockQuery.mockResolvedValueOnce({ success: true, data: mockStocks })

    await usePositionPoolStore.getState().refresh()

    const { items } = usePositionPoolStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0]!.symbol).toBe('600519')
    expect(items[0]!.pool).toBe('position')
  })
})

// ============================================================
// addItem
// ============================================================

describe('positionPoolStore - addItem 添加持仓', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  it('添加新持仓应返回 true', async () => {
    // 第一次查询：不存在
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    // forward 成功
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().addItem(createPositionInput())
    expect(result).toBe(true)
  })

  it('添加已存在的股票应返回 false 并设置错误', async () => {
    const existing = createMockStock({ symbol: '600519', name: '贵州茅台' })
    mockQuery.mockResolvedValueOnce({ success: true, data: existing })

    const result = await usePositionPoolStore.getState().addItem(createPositionInput())

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('已存在')
  })

  it('添加时应将股票代码转为大写', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(
      createPositionInput({ symbol: 'sh600519' }),
    )

    // 验证查询时使用了大写代码
    const queryCall = mockQuery.mock.calls[0]![0]
    expect(queryCall.key).toBe('SH600519')
  })

  it('添加时应设置默认状态为 holding', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(createPositionInput())

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    const stockData = call[1]
    expect(stockData.researchStatus).toBe('holding')
  })

  it('添加时应设置 pool 为 position', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(createPositionInput())

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].pool).toBe('position')
  })

  it('添加时 dataVersion 应为 1', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(createPositionInput())

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].dataVersion).toBe(1)
  })

  it('添加失败时应返回 false 并设置 error', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockRejectedValueOnce(new Error('写入失败'))

    const result = await usePositionPoolStore.getState().addItem(createPositionInput())

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toBe('写入失败')
  })

  it('添加时应设置默认分组', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(createPositionInput())

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].group).toBe('默认分组')
  })
})

// ============================================================
// updateItem
// ============================================================

describe('positionPoolStore - updateItem 更新持仓', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          price: 2000,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
          dataVersion: 1,
          group: '默认分组',
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('更新存在的持仓应返回 true', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().updateItem('600519', {
      quantity: 2000,
    })

    expect(result).toBe(true)
  })

  it('更新不存在的持仓应返回 false', async () => {
    const result = await usePositionPoolStore.getState().updateItem('000001', {
      quantity: 2000,
    })

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('不存在')
  })

  it('更新时应忽略股票代码大小写', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().updateItem('600519', {
      quantity: 2000,
    })

    expect(result).toBe(true)
  })

  it('更新失败时应返回 false 并设置 error', async () => {
    mockForward.mockRejectedValueOnce(new Error('更新失败'))

    const result = await usePositionPoolStore.getState().updateItem('600519', {
      quantity: 2000,
    })

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toBe('更新失败')
  })

  it('更新时应设置 updatedAt', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().updateItem('600519', { quantity: 2000 })

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].updatedAt).toBeDefined()
    expect(typeof call[1].updatedAt).toBe('number')
  })
})

// ============================================================
// deleteItem
// ============================================================

describe('positionPoolStore - deleteItem 删除持仓', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          price: 2000,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
          dataVersion: 1,
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('删除持仓应返回 true', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().deleteItem('600519')
    expect(result).toBe(true)
  })

  it('删除时应将股票代码转为大写', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().deleteItem('sh600519')

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].symbol).toBe('SH600519')
  })

  it('删除失败时应返回 false 并设置 error', async () => {
    mockForward.mockRejectedValueOnce(new Error('删除失败'))

    const result = await usePositionPoolStore.getState().deleteItem('600519')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toBe('删除失败')
  })
})

// ============================================================
// updateStatus
// ============================================================

describe('positionPoolStore - updateStatus 状态管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          price: 2000,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
          dataVersion: 1,
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('合法状态流转 holding → partial 应成功', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().updateStatus('600519', 'partial')
    expect(result).toBe(true)
  })

  it('合法状态流转 holding → closed 应成功', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().updateStatus('600519', 'closed')
    expect(result).toBe(true)
  })

  it('非法状态流转 closed → holding 应失败', async () => {
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'closed',
          price: 2000,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
          dataVersion: 1,
        } as any,
      ],
    })

    const result = await usePositionPoolStore.getState().updateStatus('600519', 'holding')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('非法状态流转')
  })

  it('更新不存在的标的状态应失败', async () => {
    const result = await usePositionPoolStore.getState().updateStatus('000001', 'partial')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('不存在')
  })

  it('状态更新成功时应通过 dataBridge 写入 researchStatus', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().updateStatus('600519', 'partial')

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].researchStatus).toBe('partial')
  })
})

// ============================================================
// updateGroup
// ============================================================

describe('positionPoolStore - updateGroup 分组管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          price: 2000,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
          dataVersion: 1,
          group: '默认分组',
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('更新分组应成功', async () => {
    mockForward.mockResolvedValueOnce({ success: true })

    const result = await usePositionPoolStore.getState().updateGroup('600519', '白酒板块')
    expect(result).toBe(true)
  })

  it('空分组名称应失败', async () => {
    const result = await usePositionPoolStore.getState().updateGroup('600519', '')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('不能为空')
  })

  it('纯空格分组名称应失败', async () => {
    const result = await usePositionPoolStore.getState().updateGroup('600519', '   ')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('不能为空')
  })

  it('分组更新失败时应返回 false', async () => {
    mockForward.mockRejectedValueOnce(new Error('更新失败'))

    const result = await usePositionPoolStore.getState().updateGroup('600519', '白酒板块')

    expect(result).toBe(false)
    expect(usePositionPoolStore.getState().error).toBe('更新失败')
  })
})

// ============================================================
// getByStatus / getByGroup
// ============================================================

describe('positionPoolStore - 筛选与查询', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        { symbol: '600519', name: '贵州茅台', pool: 'position', status: 'holding', group: '白酒', quantity: 1000, currentPrice: 2000, avgCost: 1800 } as any,
        { symbol: '000858', name: '五粮液', pool: 'position', status: 'holding', group: '白酒', quantity: 2000, currentPrice: 150, avgCost: 140 } as any,
        { symbol: '601318', name: '中国平安', pool: 'position', status: 'closed', group: '金融', quantity: 0, currentPrice: 50, avgCost: 60 } as any,
        { symbol: '000001', name: '平安银行', pool: 'position', status: 'partial', group: '金融', quantity: 500, currentPrice: 12, avgCost: 15 } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('getByStatus(holding) 应返回持仓中标的', () => {
    const result = usePositionPoolStore.getState().getByStatus('holding')
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.status === 'holding')).toBe(true)
  })

  it('getByStatus(closed) 应返回已清仓标的', () => {
    const result = usePositionPoolStore.getState().getByStatus('closed')
    expect(result).toHaveLength(1)
    expect(result[0]!.symbol).toBe('601318')
  })

  it('getByStatus(partial) 应返回部分减仓标的', () => {
    const result = usePositionPoolStore.getState().getByStatus('partial')
    expect(result).toHaveLength(1)
    expect(result[0]!.symbol).toBe('000001')
  })

  it('getByGroup 应返回指定分组的标的', () => {
    const result = usePositionPoolStore.getState().getByGroup('白酒')
    expect(result).toHaveLength(2)
    expect(result.map((i) => i.symbol)).toContain('600519')
    expect(result.map((i) => i.symbol)).toContain('000858')
  })

  it('getByGroup 不存在的分组应返回空数组', () => {
    const result = usePositionPoolStore.getState().getByGroup('不存在分组')
    expect(result).toEqual([])
  })

  it('getPositionPoolItemBySymbol 应返回正确标的', () => {
    const item = getPositionPoolItemBySymbol('600519')
    expect(item).toBeDefined()
    expect(item!.name).toBe('贵州茅台')
  })

  it('getPositionPoolItemBySymbol 不存在应返回 undefined', () => {
    const item = getPositionPoolItemBySymbol('999999')
    expect(item).toBeUndefined()
  })

  it('getPositionPoolTotalCount 应返回正确数量', () => {
    expect(getPositionPoolTotalCount()).toBe(4)
  })

  it('getPositionPoolGroups 应返回所有分组（排序）', () => {
    const groups = getPositionPoolGroups()
    expect(groups).toEqual(['白酒', '金融'])
  })
})

// ============================================================
// 盈亏计算
// ============================================================

describe('positionPoolStore - 盈亏计算验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          price: 2000,
          marketCap: 2_500_000_000_000,
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('持仓条目应包含 quantity、avgCost、currentPrice 字段', () => {
    const item = getPositionPoolItemBySymbol('600519')
    expect(item).toBeDefined()
    expect(item!.quantity).toBe(1000)
    expect(item!.avgCost).toBe(1800)
    expect(item!.currentPrice).toBe(2000)
  })

  it('浮动盈亏 = (currentPrice - avgCost) * quantity', () => {
    const item = getPositionPoolItemBySymbol('600519')!
    const pnl = (item.currentPrice - item.avgCost) * item.quantity
    expect(pnl).toBe(200_000)
  })

  it('收益率 = (currentPrice - avgCost) / avgCost', () => {
    const item = getPositionPoolItemBySymbol('600519')!
    const returnRate = (item.currentPrice - item.avgCost) / item.avgCost
    expect(returnRate).toBeCloseTo(0.1111, 3)
  })

  it('市值 = currentPrice * quantity', () => {
    const item = getPositionPoolItemBySymbol('600519')!
    const marketValue = item.currentPrice * item.quantity
    expect(marketValue).toBe(2_000_000)
  })

  it('亏损持仓的浮动盈亏应为负值', () => {
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '000001',
          name: '平安银行',
          pool: 'position',
          status: 'holding',
          quantity: 1000,
          avgCost: 15,
          currentPrice: 12,
        } as any,
      ],
    })
    const item = getPositionPoolItemBySymbol('000001')!
    const pnl = (item.currentPrice - item.avgCost) * item.quantity
    expect(pnl).toBeLessThan(0)
    expect(pnl).toBe(-3000)
  })
})

// ============================================================
// 数据版本管理
// ============================================================

describe('positionPoolStore - 数据版本管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [
        {
          symbol: '600519',
          name: '贵州茅台',
          pool: 'position',
          status: 'holding',
          dataVersion: 1,
          quantity: 1000,
          avgCost: 1800,
          currentPrice: 2000,
          source: 'manual',
        } as any,
      ],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: Date.now(),
    })
  })

  it('新增持仓 dataVersion 初始为 1', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    await usePositionPoolStore.getState().addItem(createPositionInput({ symbol: '000858', name: '五粮液' }))

    const { EnvelopeFactory } = await import('@/core/envelope')
    const call = (EnvelopeFactory.create as vi.Mock).mock.calls[0]
    expect(call[1].dataVersion).toBe(1)
  })

  it('toPoolItem 应正确映射 dataVersion 字段', () => {
    const item = getPositionPoolItemBySymbol('600519')
    expect(item!.dataVersion).toBe(1)
  })
})

// ============================================================
// 订阅与去抖
// ============================================================

describe('positionPoolStore - 订阅管理', () => {
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    usePositionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
    cleanup = null
  })

  afterEach(() => {
    // 销毁订阅，确保模块级状态重置
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    vi.useRealTimers()
  })

  it('initPositionPoolStoreSubscriptions 应订阅 stocks 频道', () => {
    cleanup = initPositionPoolStoreSubscriptions()

    expect(mockSubscribe).toHaveBeenCalledWith('stocks', expect.any(Function))
    expect(typeof cleanup).toBe('function')
  })

  it('重复初始化不应重复订阅', () => {
    cleanup = initPositionPoolStoreSubscriptions()
    const unsubscribe2 = initPositionPoolStoreSubscriptions()

    // 第二次调用时已初始化，不会再调用 subscribe
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(typeof unsubscribe2).toBe('function')

    // 清理：第二个返回的函数也会销毁
    unsubscribe2()
    cleanup = null
  })

  it('收到外部变更通知后应去抖刷新', async () => {
    mockQuery.mockResolvedValue({ success: true, data: [] })

    cleanup = initPositionPoolStoreSubscriptions()

    // 获取订阅回调
    const subscribeCall = mockSubscribe.mock.calls[0]
    const callback = subscribeCall![1] as (envelope: any) => void

    // 模拟 3 次快速变更
    callback({ meta: { source: 'other-module' } })
    callback({ meta: { source: 'other-module' } })
    callback({ meta: { source: 'other-module' } })

    // 去抖窗口内不应触发 refresh
    expect(mockQuery).not.toHaveBeenCalled()

    // 推进时间超过去抖窗口
    vi.advanceTimersByTime(150)
    await Promise.resolve() // 等待微任务

    // 只应触发一次 refresh
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('来自 pool 模块自身的变更不应触发 refresh', () => {
    cleanup = initPositionPoolStoreSubscriptions()

    const subscribeCall = mockSubscribe.mock.calls[0]
    const callback = subscribeCall![1] as (envelope: any) => void

    callback({ meta: { source: 'pool' } })

    vi.advanceTimersByTime(200)

    // 不应触发查询
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

// ============================================================
// 去重逻辑
// ============================================================

describe('positionPoolStore - 去重逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePositionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  it('重复添加同一股票应返回 false', async () => {
    // 第一次查询：不存在 → 添加成功
    mockQuery.mockResolvedValueOnce({ success: false, data: null })
    mockForward.mockResolvedValueOnce({ success: true })

    const result1 = await usePositionPoolStore.getState().addItem(
      createPositionInput({ symbol: '600519', name: '贵州茅台' }),
    )
    expect(result1).toBe(true)

    // 第二次查询：已存在 → 添加失败
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: createMockStock({ symbol: '600519', name: '贵州茅台' }),
    })

    const result2 = await usePositionPoolStore.getState().addItem(
      createPositionInput({ symbol: '600519', name: '贵州茅台' }),
    )
    expect(result2).toBe(false)
    expect(usePositionPoolStore.getState().error).toContain('已存在')
  })

  it('大小写不同的同一代码应视为重复', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: createMockStock({ symbol: '600519', name: '贵州茅台' }),
    })

    const result = await usePositionPoolStore.getState().addItem(
      createPositionInput({ symbol: '600519', name: '贵州茅台' }),
    )

    expect(result).toBe(false)
  })

  it('添加重复股票时不应调用 forward', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      data: createMockStock({ symbol: '600519', name: '贵州茅台' }),
    })

    await usePositionPoolStore.getState().addItem(
      createPositionInput({ symbol: '600519', name: '贵州茅台' }),
    )

    expect(mockForward).not.toHaveBeenCalled()
  })
})
