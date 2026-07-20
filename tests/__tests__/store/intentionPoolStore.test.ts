/**
 * @test_id V9-TEST-UT-C3
 * @covers_docs [V9-DOC-PROJ-108, V9-DOC-DATA-024, V9-DOC-DATA-032]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Stock } from '@/data/types'

/**
 * intentionPoolStore.ts 单元测试
 *
 * 测试覆盖：
 *   1. Store 初始化状态（items 为空数组，loading 为 false）
 *   2. refresh() 方法调用后 items 被正确填充
 *   3. 过滤逻辑：只返回 pool === 'intention' 的股票
 */

// ─── Mock 依赖模块 ───────────────────────────────────────────

// mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id-12345',
}))

// mock withBroadcast
vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

// mock poolTransitionEngine
vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: vi.fn(() => true),
  getPoolTransitionOptions: vi.fn(() => []),
  getPoolLabel: vi.fn((_pool: string, status: string) => status),
}))

// mock dataBridge
const mockQuery = vi.fn()
const mockForward = vi.fn()
const mockSubscribe = vi.fn(() => vi.fn())

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: (...args: unknown[]) => mockQuery(...args),
    forward: (...args: unknown[]) => mockForward(...args),
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    invalidateAll: vi.fn(),
  },
  ENVELOPE_ACTION: {
    queryByIndex: 'queryByIndex',
    queryGet: 'queryGet',
    insertStock: 'insertStock',
    updateStock: 'updateStock',
    deleteStock: 'deleteStock',
  },
  STORE_NAME: { stocks: 'stocks' },
  MODULE_ID: { pool: 'pool' },
}))

// mock EnvelopeFactory
vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((_meta: unknown, data: unknown) => ({ meta: _meta, data })),
  },
  ENVELOPE_TARGET: { db: 'db' },
}))

// ─── 导入被测模块 ────────────────────────────────────────────

import { useIntentionPoolStore } from '@/store/intentionPoolStore'

// ─── 测试数据工厂 ────────────────────────────────────────────

/** 构造 mock Stock 数据 */
function makeStock(overrides: Partial<Stock> & { symbol: string }): Stock {
  return {
    symbol: overrides.symbol,
    name: overrides.name ?? `股票${overrides.symbol}`,
    pool: overrides.pool ?? 'intention',
    researchStatus: overrides.researchStatus ?? 'screening',
    source: overrides.source ?? 'manual',
    dataVersion: overrides.dataVersion ?? 1,
    ingestedAt: overrides.ingestedAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    ...overrides,
  } as Stock
}

/** 模拟 dataBridge.query 返回成功 */
function mockQuerySuccess(data: unknown) {
  mockQuery.mockResolvedValue({ success: true, data })
}

/** 模拟 dataBridge.query 返回失败 */
function mockQueryFail(error: string) {
  mockQuery.mockResolvedValue({ success: false, error })
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('intentionPoolStore.ts 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 store 到初始状态
    useIntentionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：Store 初始化状态
  // ═══════════════════════════════════════════════════════════

  describe('Store 初始化状态', () => {
    it('items 应为空数组', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.items).toEqual([])
      expect(Array.isArray(state.items)).toBe(true)
    })

    it('loading 应为 false', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.loading).toBe(false)
    })

    it('error 应为 null', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.error).toBeNull()
    })

    it('isRefreshing 应为 false', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.isRefreshing).toBe(false)
    })

    it('lastUpdated 应为 0', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.lastUpdated).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：refresh() 方法
  // ═══════════════════════════════════════════════════════════

  describe('refresh() 方法', () => {
    it('成功查询后 items 应被正确填充', async () => {
      const stocks = [
        makeStock({ symbol: '000001', name: '平安银行', pool: 'intention' }),
        makeStock({ symbol: '600519', name: '贵州茅台', pool: 'intention' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.items).toHaveLength(2)
      expect(state.items[0]!.symbol).toBe('000001')
      expect(state.items[1]!.symbol).toBe('600519')
    })

    it('成功查询后 loading 应为 false，lastUpdated 应大于 0', async () => {
      mockQuerySuccess([])

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.lastUpdated).toBeGreaterThan(0)
    })

    it('查询失败后 error 应被设置', async () => {
      mockQueryFail('网络错误')

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.error).toBe('网络错误')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
    })

    it('正在刷新时不应重复触发', async () => {
      // 设置 isRefreshing 为 true
      useIntentionPoolStore.setState({ isRefreshing: true })
      mockQuerySuccess([])

      await useIntentionPoolStore.getState().refresh()

      // dataBridge.query 不应被调用，因为 isRefreshing 为 true
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('查询返回 null data 时 items 应为空数组', async () => {
      mockQuerySuccess(null)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.items).toEqual([])
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：过滤逻辑
  // ═══════════════════════════════════════════════════════════

  describe('过滤逻辑：只返回 pool === "intention" 的股票', () => {
    it('应过滤掉非 intention 池的股票', async () => {
      const stocks = [
        makeStock({ symbol: '000001', name: '平安银行', pool: 'intention' }),
        makeStock({ symbol: '600519', name: '贵州茅台', pool: 'research' }),
        makeStock({ symbol: '000002', name: '万科A', pool: 'intention' }),
        makeStock({ symbol: '601318', name: '中国平安', pool: 'position' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      // 只应保留 pool === 'intention' 的股票
      expect(state.items).toHaveLength(2)
      expect(state.items.map((i) => i.symbol)).toEqual(['000001', '000002'])
    })

    it('所有股票都不是 intention 池时 items 应为空', async () => {
      const stocks = [
        makeStock({ symbol: '600519', name: '贵州茅台', pool: 'research' }),
        makeStock({ symbol: '601318', name: '中国平安', pool: 'position' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.items).toHaveLength(0)
    })

    it('getByStatus 应只返回指定状态的标的', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'intention', researchStatus: 'screening' }),
        makeStock({ symbol: '600519', pool: 'intention', researchStatus: 'watchlist' }),
        makeStock({ symbol: '000002', pool: 'intention', researchStatus: 'screening' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const screening = useIntentionPoolStore.getState().getByStatus('screening' as never)
      expect(screening).toHaveLength(2)
      expect(screening.map((i) => i.symbol)).toEqual(['000001', '000002'])

      const watchlist = useIntentionPoolStore.getState().getByStatus('watchlist' as never)
      expect(watchlist).toHaveLength(1)
      expect(watchlist[0]!.symbol).toBe('600519')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件4：辅助导出函数
  // ═══════════════════════════════════════════════════════════

  describe('辅助导出函数', () => {
    it('getIntentionPoolTotalCount 应返回 items 总数', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'intention' }),
        makeStock({ symbol: '600519', pool: 'intention' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const { getIntentionPoolTotalCount } = await import('@/store/intentionPoolStore')
      expect(getIntentionPoolTotalCount()).toBe(2)
    })

    it('getIntentionPoolItemBySymbol 应按 symbol 查找', async () => {
      const stocks = [
        makeStock({ symbol: '000001', name: '平安银行', pool: 'intention' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const { getIntentionPoolItemBySymbol } = await import('@/store/intentionPoolStore')
      expect(getIntentionPoolItemBySymbol('000001')?.symbol).toBe('000001')
      expect(getIntentionPoolItemBySymbol('NOTFOUND')).toBeUndefined()
    })

    it('getIntentionPoolGroups 应返回去重后的分组列表', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'intention', group: 'A组' }),
        makeStock({ symbol: '600519', pool: 'intention', group: 'B组' }),
        makeStock({ symbol: '000002', pool: 'intention', group: 'A组' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const { getIntentionPoolGroups } = await import('@/store/intentionPoolStore')
      const groups = getIntentionPoolGroups()
      expect(groups).toEqual(['A组', 'B组'])
    })
  })
})
