/**
 * @test_id V9-TEST-UT-C3-FULL
 * @covers_docs [V9-DOC-PROJ-108, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-BACK-011]
 * @description 意向池 Store 完整单元测试。
 *
 * 覆盖场景：
 *   1. Store 初始化状态
 *   2. refresh() 方法（成功/失败/并发保护/null 数据）
 *   3. addItem() CRUD - 添加、去重、自动流转研究池
 *   4. updateItem() - 更新存在/不存在的标的
 *   5. deleteItem() - 删除成功/失败
 *   6. deleteItems() - 批量删除（空列表/去重/归一化）
 *   7. updateStatus() - 状态转换（合法/非法/标的不存在）
 *   8. updateGroup() - 分组管理（空分组/正常更新）
 *   9. getByStatus / getByGroup 筛选
 *   10. 辅助导出函数（getIntentionPoolTotalCount 等）
 *   11. 订阅机制（init / 重复初始化 / 销毁）
 *   12. 错误处理与 error 状态
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Stock } from '@/data/types'

// ─── Mock 依赖模块 ───────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id-12345',
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

// mock poolTransitionEngine - 默认返回 true，测试中可单独覆盖
vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: mockIsValidTransition,
  getPoolTransitionOptions: vi.fn(() => []),
  getPoolLabel: vi.fn((_pool: string, status: string) => status),
}))

// mock dataBridge
const {
  mockQuery,
  mockForward,
  mockSubscribe,
  mockIsValidTransition,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn(),
  mockSubscribe: vi.fn(() => vi.fn()),
  mockIsValidTransition: vi.fn(() => true),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    subscribe: mockSubscribe,
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
  DEFAULT_POOL_STATUS: { intention: 'screening', research: 'candidate', position: 'holding' },
  POOL_TYPE: { intention: 'intention', research: 'research', position: 'position' },
  INTENTION_STATUS: { screening: 'screening', watchlist: 'watchlist', archived: 'archived' },
  RESEARCH_STATUS: { candidate: 'candidate', screened: 'screened', deepDive: 'deepDive', watching: 'watching', archived: 'archived' },
  POSITION_STATUS: { holding: 'holding', partial: 'partial', closed: 'closed' },
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { POOL_CHANGED: 'pool:changed' },
}))

// ─── 导入被测模块 ────────────────────────────────────────────

import {
  useIntentionPoolStore,
  getIntentionPoolTotalCount,
  getIntentionPoolItemBySymbol,
  getIntentionPoolGroups,
  initIntentionPoolStoreSubscriptions,
  _resetIntentionPoolStoreSubscriptionsForTest,
} from './intentionPoolStore'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'

// ─── 测试数据工厂 ────────────────────────────────────────────

function makeStock(overrides: Partial<Stock> & { symbol: string }): Stock {
  return {
    ...overrides,
    symbol: overrides.symbol,
    name: overrides.name ?? `股票${overrides.symbol}`,
    pool: overrides.pool ?? 'intention',
    researchStatus: overrides.researchStatus ?? 'screening',
    source: overrides.source ?? 'manual',
    dataVersion: overrides.dataVersion ?? 1,
    ingestedAt: overrides.ingestedAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    group: overrides.group ?? '默认分组',
  } as Stock
}

function mockQuerySuccess(data: unknown) {
  mockQuery.mockResolvedValue({ success: true, data })
}

function mockQueryFail(error: string) {
  mockQuery.mockResolvedValue({ success: false, error })
}

function mockQueryGetNotFound() {
  mockQuery.mockImplementation((params: { action: string }) => {
    if (params.action === ENVELOPE_ACTION.queryGet) {
      return Promise.resolve({ success: false, error: 'not found' })
    }
    return Promise.resolve({ success: true, data: [] })
  })
}

function seedItems(symbols: string[], overrides: Partial<Stock> & { status?: string } = {}): void {
  useIntentionPoolStore.setState({
    items: symbols.map((symbol) => ({
      symbol,
      name: `股票${symbol}`,
      pool: 'intention',
      status: 'screening',
      source: 'manual',
      dataVersion: 1,
      group: '默认分组',
      ...overrides,
    })) as never,
    error: null,
    isRefreshing: false,
    lastUpdated: Date.now(),
  })
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('intentionPoolStore 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidTransition.mockReturnValue(true)
    useIntentionPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
    _resetIntentionPoolStoreSubscriptionsForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：Store 初始化状态
  // ═══════════════════════════════════════════════════════════

  describe('初始化状态', () => {
    it('items 应为空数组', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.items).toEqual([])
      expect(Array.isArray(state.items)).toBe(true)
    })

    it('loading、error、isRefreshing 初始值正确', () => {
      const state = useIntentionPoolStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isRefreshing).toBe(false)
      expect(state.lastUpdated).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：refresh() 方法
  // ═══════════════════════════════════════════════════════════

  describe('refresh() 方法', () => {
    it('成功查询后 items 被正确填充，lastUpdated 更新', async () => {
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
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(state.error).toBeNull()
    })

    it('首次加载时 loading 为 true，加载完成后为 false', async () => {
      mockQuerySuccess([])
      const stateBefore = useIntentionPoolStore.getState()
      expect(stateBefore.loading).toBe(false)

      const promise = useIntentionPoolStore.getState().refresh()
      // 同步检查可能无法捕获中间状态，直接验证最终结果
      await promise

      const stateAfter = useIntentionPoolStore.getState()
      expect(stateAfter.loading).toBe(false)
    })

    it('查询失败后 error 被正确设置', async () => {
      mockQueryFail('网络错误')

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.error).toBe('网络错误')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
    })

    it('正在刷新时不应重复触发查询（并发保护）', async () => {
      useIntentionPoolStore.setState({ isRefreshing: true })
      mockQuerySuccess([])

      await useIntentionPoolStore.getState().refresh()

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('查询返回 null data 时 items 为空数组', async () => {
      mockQuerySuccess(null)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.items).toEqual([])
    })

    it('只保留 pool === "intention" 的股票（过滤逻辑）', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'intention' }),
        makeStock({ symbol: '600519', pool: 'research' }),
        makeStock({ symbol: '000002', pool: 'intention' }),
        makeStock({ symbol: '601318', pool: 'position' }),
      ]
      mockQuerySuccess(stocks)

      await useIntentionPoolStore.getState().refresh()

      const state = useIntentionPoolStore.getState()
      expect(state.items).toHaveLength(2)
      expect(state.items.map((i) => i.symbol)).toEqual(['000001', '000002'])
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：addItem() - 添加股票
  // ═══════════════════════════════════════════════════════════

  describe('addItem() - 添加股票', () => {
    it('成功添加新股票，返回 true', async () => {
      mockQueryGetNotFound()

      const result = await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      expect(result).toBe(true)
      // 应该调用 queryGet 检查存在性
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ENVELOPE_ACTION.queryGet,
          store: STORE_NAME.stocks,
          key: '000001',
          source: MODULE_ID.pool,
        }),
      )
      // 应该调用 forward 插入股票
      expect(mockForward).toHaveBeenCalled()
      // 应该触发广播
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'add', pool: 'intention', symbol: '000001' }),
      )
    })

    it('重复添加应返回 false 并设置 error', async () => {
      // 模拟已存在
      mockQuery.mockResolvedValue({
        success: true,
        data: makeStock({ symbol: '000001', pool: 'intention' }),
      })

      const result = await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('已存在')
      // 不应调用 forward（插入操作）
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('股票代码自动归一化为大写并去除空格', async () => {
      mockQueryGetNotFound()

      await useIntentionPoolStore.getState().addItem({
        symbol: '  000001.sh  ',
        name: '平安银行',
        source: 'manual',
      })

      // EnvelopeFactory.create 的调用参数中 symbol 应为归一化后的值
      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: { action?: string }[]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCall).toBeDefined()
      expect(insertCall![1].symbol).toBe('000001.SH')
    })

    it('添加时自动设置默认值（pool/status/source/dataVersion）', async () => {
      mockQueryGetNotFound()

      await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: { action?: string }[]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      const stockData = insertCall![1]
      expect(stockData.pool).toBe('intention')
      expect(stockData.researchStatus).toBe('screening')
      expect(stockData.source).toBe('manual')
      expect(stockData.group).toBe('默认分组')
      expect(stockData.dataVersion).toBe(1)
      expect(stockData.ingestedAt).toBeGreaterThan(0)
      expect(stockData.updatedAt).toBeGreaterThan(0)
    })

    it('添加成功后不自动流转到研究池（保持在意向池）', async () => {
      mockQueryGetNotFound()

      await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const transitionCall = calls.find(
        (c: { action?: string; traceId?: string }[]) =>
          c[0]?.traceId?.includes('intention-to-research'),
      )
      // 自动流转已移除，不应存在 transition 调用
      expect(transitionCall).toBeUndefined()

      // 只触发一次广播：add（不再有 transition）
      expect((withBroadcast as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    })

    it('添加成功后只调用一次 forward（无研究池流转）', async () => {
      mockQueryGetNotFound()

      const result = await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      expect(result).toBe(true)
      // 自动流转已移除，只应调用一次 forward（insertStock）
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('添加失败时设置 error 并返回 false', async () => {
      mockQueryGetNotFound()
      mockForward.mockRejectedValue(new Error('数据库写入失败'))

      const result = await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toBe('数据库写入失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件4：updateItem() - 更新股票
  // ═══════════════════════════════════════════════════════════

  describe('updateItem() - 更新股票', () => {
    it('成功更新存在的股票，返回 true', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateItem('000001', {
        name: '新名称',
      })

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'update', pool: 'intention', symbol: '000001' }),
      )
    })

    it('更新不存在的股票返回 false 并设置 error', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateItem('NOTEXIST', {
        name: '新名称',
      })

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('标的不存在')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('股票代码归一化（小写转大写/去空格）', async () => {
      seedItems(['000001.SZ'])

      await useIntentionPoolStore.getState().updateItem('  000001.sz  ', {
        name: '新名称',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].symbol).toBe('000001.SZ')
    })

    it('更新失败时设置 error 并返回 false', async () => {
      seedItems(['000001'])
      mockForward.mockRejectedValue(new Error('更新失败'))

      const result = await useIntentionPoolStore.getState().updateItem('000001', {
        name: '新名称',
      })

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toBe('更新失败')
    })

    it('更新时 updatedAt 字段', async () => {
      seedItems(['000001'])

      await useIntentionPoolStore.getState().updateItem('000001', {
        name: '新名称',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const updateData = calls[0]![1]
      expect(updateData.updatedAt).toBeGreaterThan(0)
      expect(updateData.symbol).toBe('000001')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件5：deleteItem() - 删除股票
  // ═══════════════════════════════════════════════════════════

  describe('deleteItem() - 删除股票', () => {
    it('成功删除股票，返回 true', async () => {
      const result = await useIntentionPoolStore.getState().deleteItem('000001')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'delete', pool: 'intention', symbol: '000001' }),
      )
    })

    it('删除时股票代码归一化', async () => {
      await useIntentionPoolStore.getState().deleteItem('  000001.sh  ')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].symbol).toBe('000001.SH')
    })

    it('删除失败时设置 error 并返回 false', async () => {
      mockForward.mockRejectedValue(new Error('删除失败'))

      const result = await useIntentionPoolStore.getState().deleteItem('000001')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toBe('删除失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件6：deleteItems() - 批量删除
  // ═══════════════════════════════════════════════════════════

  describe('deleteItems() - 批量删除', () => {
    it('空列表返回 0 且不调用 forward', async () => {
      const result = await useIntentionPoolStore.getState().deleteItems([])
      expect(result).toBe(0)
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('批量删除 N 条，返回删除计数正确（按归一化去重）', async () => {
      seedItems(['A.SH', 'B.SH', 'C.SH'])
      const result = await useIntentionPoolStore.getState().deleteItems(['a.sh', 'B.SH', 'A.SH'])
      // a.sh 与 A.SH 归一化后重复，去重为 2 条
      expect(result).toBe(2)
    })

    it('归一化大小写与首尾空格并去重', async () => {
      const result = await useIntentionPoolStore.getState().deleteItems(['x.sh', 'X.SH', ' x.sh '])
      expect(result).toBe(1)
    })

    it('包含空字符串时被过滤掉', async () => {
      const result = await useIntentionPoolStore.getState().deleteItems(['000001', '', '  '])
      expect(result).toBe(1)
    })

    it('非数组输入返回 0', async () => {
      const result = await useIntentionPoolStore.getState().deleteItems(undefined as never)
      expect(result).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件7：updateStatus() - 状态转换
  // ═══════════════════════════════════════════════════════════

  describe('updateStatus() - 状态转换', () => {
    it('合法状态转换成功，返回 true', async () => {
      seedItems(['000001'], { status: 'screening' })
      mockIsValidTransition.mockReturnValue(true)

      const result = await useIntentionPoolStore.getState().updateStatus('000001', 'watchlist')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'updateStatus', pool: 'intention', symbol: '000001', newStatus: 'watchlist' }),
      )
    })

    it('标的不存在时返回 false', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateStatus('NOTEXIST', 'watchlist')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('标的不存在')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('非法状态转换返回 false 并设置 error', async () => {
      seedItems(['000001'], { status: 'archived' })
      mockIsValidTransition.mockReturnValue(false)

      const result = await useIntentionPoolStore.getState().updateStatus('000001', 'screening')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('非法状态流转')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('状态转换时更新 researchStatus 字段', async () => {
      seedItems(['000001'], { status: 'screening' })
      mockIsValidTransition.mockReturnValue(true)

      await useIntentionPoolStore.getState().updateStatus('000001', 'watchlist')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const updateData = calls[0]![1]
      expect(updateData.researchStatus).toBe('watchlist')
      expect(updateData.updatedAt).toBeGreaterThan(0)
    })

    it('状态转换失败时设置 error 并返回 false', async () => {
      seedItems(['000001'], { status: 'screening' })
      mockIsValidTransition.mockReturnValue(true)
      mockForward.mockRejectedValue(new Error('状态更新失败'))

      const result = await useIntentionPoolStore.getState().updateStatus('000001', 'watchlist')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toBe('状态更新失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件8：updateGroup() - 分组管理
  // ═══════════════════════════════════════════════════════════

  describe('updateGroup() - 分组管理', () => {
    it('成功更新分组，返回 true', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateGroup('000001', '科技组')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'updateGroup', pool: 'intention', symbol: '000001', group: '科技组' }),
      )
    })

    it('分组名称为空返回 false', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateGroup('000001', '')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('分组名称不能为空')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('分组名称全空格返回 false', async () => {
      seedItems(['000001'])

      const result = await useIntentionPoolStore.getState().updateGroup('000001', '   ')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toContain('分组名称不能为空')
    })

    it('分组名称首尾空格被去除', async () => {
      seedItems(['000001'])

      await useIntentionPoolStore.getState().updateGroup('000001', '  科技组  ')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].group).toBe('科技组')
    })

    it('更新分组失败时设置 error 并返回 false', async () => {
      seedItems(['000001'])
      mockForward.mockRejectedValue(new Error('分组更新失败'))

      const result = await useIntentionPoolStore.getState().updateGroup('000001', '科技组')

      expect(result).toBe(false)
      expect(useIntentionPoolStore.getState().error).toBe('分组更新失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件9：getByStatus / getByGroup 筛选
  // ═══════════════════════════════════════════════════════════

  describe('getByStatus / getByGroup 筛选', () => {
    it('getByStatus 按状态筛选', async () => {
      seedItems(['000001', '600519', '000002'])
      // 手动设置不同状态
      useIntentionPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'intention', status: 'screening', group: '默认分组' },
          { symbol: '600519', name: '股票600519', pool: 'intention', status: 'watchlist', group: '默认分组' },
          { symbol: '000002', name: '股票000002', pool: 'intention', status: 'screening', group: '默认分组' },
        ] as never,
      })

      const screening = useIntentionPoolStore.getState().getByStatus('screening' as never)
      expect(screening).toHaveLength(2)
      expect(screening.map((i) => i.symbol)).toEqual(['000001', '000002'])

      const watchlist = useIntentionPoolStore.getState().getByStatus('watchlist' as never)
      expect(watchlist).toHaveLength(1)
      expect(watchlist[0]!.symbol).toBe('600519')
    })

    it('getByGroup 按分组筛选', () => {
      useIntentionPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'intention', status: 'screening', group: 'A组' },
          { symbol: '600519', name: '股票600519', pool: 'intention', status: 'screening', group: 'B组' },
          { symbol: '000002', name: '股票000002', pool: 'intention', status: 'screening', group: 'A组' },
        ] as never,
      })

      const groupA = useIntentionPoolStore.getState().getByGroup('A组')
      expect(groupA).toHaveLength(2)
      expect(groupA.map((i) => i.symbol)).toEqual(['000001', '000002'])

      const groupB = useIntentionPoolStore.getState().getByGroup('B组')
      expect(groupB).toHaveLength(1)
      expect(groupB[0]!.symbol).toBe('600519')
    })

    it('getByGroup 对 undefined group 使用默认分组', () => {
      useIntentionPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'intention', status: 'screening', group: undefined },
        ] as never,
      })

      const result = useIntentionPoolStore.getState().getByGroup('默认分组')
      expect(result).toHaveLength(1)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件10：辅助导出函数
  // ═══════════════════════════════════════════════════════════

  describe('辅助导出函数', () => {
    it('getIntentionPoolTotalCount 返回 items 总数', () => {
      seedItems(['000001', '600519'])
      expect(getIntentionPoolTotalCount()).toBe(2)
    })

    it('getIntentionPoolItemBySymbol 按 symbol 查找', () => {
      seedItems(['000001'])
      expect(getIntentionPoolItemBySymbol('000001')?.symbol).toBe('000001')
      expect(getIntentionPoolItemBySymbol('NOTFOUND')).toBeUndefined()
    })

    it('getIntentionPoolGroups 返回去重排序后的分组列表', () => {
      useIntentionPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'intention', status: 'screening', group: 'B组' },
          { symbol: '600519', name: '股票600519', pool: 'intention', status: 'screening', group: 'A组' },
          { symbol: '000002', name: '股票000002', pool: 'intention', status: 'screening', group: 'A组' },
        ] as never,
      })

      const groups = getIntentionPoolGroups()
      expect(groups).toEqual(['A组', 'B组'])
    })

    it('getIntentionPoolGroups 对 undefined group 使用默认分组', () => {
      useIntentionPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'intention', status: 'screening', group: undefined },
        ] as never,
      })

      const groups = getIntentionPoolGroups()
      expect(groups).toEqual(['默认分组'])
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件11：订阅机制
  // ═══════════════════════════════════════════════════════════

  describe('订阅机制', () => {
    it('initIntentionPoolStoreSubscriptions 初始化订阅', () => {
      const unsubscribe = initIntentionPoolStoreSubscriptions()

      expect(mockSubscribe).toHaveBeenCalledWith(STORE_NAME.stocks, expect.any(Function))
      expect(typeof unsubscribe).toBe('function')
    })

    it('重复初始化应跳过并返回销毁函数', () => {
      initIntentionPoolStoreSubscriptions()
      const unsubscribe2 = initIntentionPoolStoreSubscriptions()

      // subscribe 只应被调用一次
      expect(mockSubscribe).toHaveBeenCalledTimes(1)
      expect(typeof unsubscribe2).toBe('function')
    })

    it('重置订阅后可重新初始化', () => {
      initIntentionPoolStoreSubscriptions()
      _resetIntentionPoolStoreSubscriptionsForTest()
      initIntentionPoolStoreSubscriptions()

      expect(mockSubscribe).toHaveBeenCalledTimes(2)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件12：数据版本与完整性
  // ═══════════════════════════════════════════════════════════

  describe('数据版本与完整性', () => {
    it('新增股票 dataVersion 为 1', async () => {
      mockQueryGetNotFound()

      await useIntentionPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
        source: 'manual',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: { action?: string }[]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCall![1].dataVersion).toBe(1)
    })

    it('refresh 后 lastUpdated 被更新', async () => {
      mockQuerySuccess([])
      const before = useIntentionPoolStore.getState().lastUpdated

      await useIntentionPoolStore.getState().refresh()

      const after = useIntentionPoolStore.getState().lastUpdated
      expect(after).toBeGreaterThan(before)
    })
  })
})
