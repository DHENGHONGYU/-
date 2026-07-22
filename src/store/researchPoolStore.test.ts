/**
 * @test_id V9-TEST-UT-C4-FULL
 * @covers_docs [V9-DOC-PROJ-108, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-BACK-011]
 * @description 研究池 Store 完整单元测试。
 *
 * 覆盖场景：
 *   1. Store 初始化状态
 *   2. refresh() 方法（成功/失败/并发保护/null 数据/过滤）
 *   3. addItem() CRUD - 添加、去重、默认状态 candidate
 *   4. updateItem() - 更新存在/不存在的标的
 *   5. deleteItem() - 删除成功/失败
 *   6. updateStatus() - 研究状态管理（candidate/screened/deepDive/watching/archived）
 *   7. updateGroup() - 分组管理
 *   8. getByStatus / getByGroup 筛选
 *   9. 辅助导出函数（getResearchPoolTotalCount 等）
 *   10. 订阅机制（init / 重复初始化 / 销毁）
 *   11. 数据完整性校验（dataVersion / updatedAt）
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
const mockIsValidTransition = vi.fn(() => true)
vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: (...args: unknown[]) => mockIsValidTransition(...args),
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
  useResearchPoolStore,
  getResearchPoolTotalCount,
  getResearchPoolItemBySymbol,
  getResearchPoolGroups,
  initResearchPoolStoreSubscriptions,
  _resetResearchPoolStoreSubscriptionsForTest,
} from './researchPoolStore'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'

// ─── 测试数据工厂 ────────────────────────────────────────────

function makeStock(overrides: Partial<Stock> & { symbol: string }): Stock {
  return {
    symbol: overrides.symbol,
    name: overrides.name ?? `股票${overrides.symbol}`,
    pool: overrides.pool ?? 'research',
    researchStatus: overrides.researchStatus ?? 'candidate',
    source: overrides.source ?? 'manual',
    dataVersion: overrides.dataVersion ?? 1,
    ingestedAt: overrides.ingestedAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    group: overrides.group ?? '默认分组',
    ...overrides,
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

function seedItems(symbols: string[], overrides: Partial<Stock> = {}): void {
  useResearchPoolStore.setState({
    items: symbols.map((symbol) => ({
      symbol,
      name: `股票${symbol}`,
      pool: 'research',
      status: 'candidate',
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

describe('researchPoolStore 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidTransition.mockReturnValue(true)
    useResearchPoolStore.setState({
      items: [],
      loading: false,
      error: null,
      isRefreshing: false,
      lastUpdated: 0,
    })
    _resetResearchPoolStoreSubscriptionsForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：Store 初始化状态
  // ═══════════════════════════════════════════════════════════

  describe('初始化状态', () => {
    it('items 应为空数组', () => {
      const state = useResearchPoolStore.getState()
      expect(state.items).toEqual([])
      expect(Array.isArray(state.items)).toBe(true)
    })

    it('loading、error、isRefreshing、lastUpdated 初始值正确', () => {
      const state = useResearchPoolStore.getState()
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
        makeStock({ symbol: '000001', name: '平安银行', pool: 'research' }),
        makeStock({ symbol: '600519', name: '贵州茅台', pool: 'research' }),
      ]
      mockQuerySuccess(stocks)

      await useResearchPoolStore.getState().refresh()

      const state = useResearchPoolStore.getState()
      expect(state.items).toHaveLength(2)
      expect(state.items[0]!.symbol).toBe('000001')
      expect(state.items[1]!.symbol).toBe('600519')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.lastUpdated).toBeGreaterThan(0)
      expect(state.error).toBeNull()
    })

    it('查询失败后 error 被正确设置', async () => {
      mockQueryFail('网络错误')

      await useResearchPoolStore.getState().refresh()

      const state = useResearchPoolStore.getState()
      expect(state.error).toBe('网络错误')
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
    })

    it('正在刷新时不应重复触发查询（并发保护）', async () => {
      useResearchPoolStore.setState({ isRefreshing: true })
      mockQuerySuccess([])

      await useResearchPoolStore.getState().refresh()

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('查询返回 null data 时 items 为空数组', async () => {
      mockQuerySuccess(null)

      await useResearchPoolStore.getState().refresh()

      const state = useResearchPoolStore.getState()
      expect(state.items).toEqual([])
    })

    it('只保留 pool === "research" 的股票（过滤逻辑）', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'research' }),
        makeStock({ symbol: '600519', pool: 'intention' }),
        makeStock({ symbol: '000002', pool: 'research' }),
        makeStock({ symbol: '601318', pool: 'position' }),
      ]
      mockQuerySuccess(stocks)

      await useResearchPoolStore.getState().refresh()

      const state = useResearchPoolStore.getState()
      expect(state.items).toHaveLength(2)
      expect(state.items.map((i) => i.symbol)).toEqual(['000001', '000002'])
    })

    it('首次加载时 loading 状态变化', async () => {
      mockQuerySuccess([])
      await useResearchPoolStore.getState().refresh()

      const stateAfter = useResearchPoolStore.getState()
      expect(stateAfter.loading).toBe(false)
      expect(stateAfter.isRefreshing).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：addItem() - 添加股票
  // ═══════════════════════════════════════════════════════════

  describe('addItem() - 添加股票', () => {
    it('成功添加新股票，返回 true', async () => {
      mockQueryGetNotFound()

      const result = await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
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
        expect.objectContaining({ action: 'add', pool: 'research', symbol: '000001' }),
      )
    })

    it('重复添加应返回 false 并设置 error', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: makeStock({ symbol: '000001', pool: 'research' }),
      })

      const result = await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('已存在')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('股票代码自动归一化为大写并去除空格', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '  000001.sh  ',
        name: '平安银行',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCall).toBeDefined()
      expect(insertCall![1].symbol).toBe('000001.SH')
    })

    it('添加时默认状态为 candidate', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      const stockData = insertCall![1]
      expect(stockData.pool).toBe('research')
      expect(stockData.researchStatus).toBe('candidate')
    })

    it('添加时自动设置默认值（source/group/dataVersion）', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      const stockData = insertCall![1]
      expect(stockData.source).toBe('manual')
      expect(stockData.group).toBe('默认分组')
      expect(stockData.dataVersion).toBe(1)
      expect(stockData.ingestedAt).toBeGreaterThan(0)
      expect(stockData.updatedAt).toBeGreaterThan(0)
    })

    it('研究池添加时不会自动流转到其他池（只触发一次 forward）', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      // 研究池 addItem 只应该有一次 forward 调用（插入）
      // 不像意向池有自动流转
      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCalls = calls.filter(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCalls.length).toBe(1)
    })

    it('添加失败时设置 error 并返回 false', async () => {
      mockQueryGetNotFound()
      mockForward.mockRejectedValue(new Error('数据库写入失败'))

      const result = await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toBe('数据库写入失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件4：updateItem() - 更新股票
  // ═══════════════════════════════════════════════════════════

  describe('updateItem() - 更新股票', () => {
    it('成功更新存在的股票，返回 true', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateItem('000001', {
        name: '新名称',
      })

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'update', pool: 'research', symbol: '000001' }),
      )
    })

    it('更新不存在的股票返回 false 并设置 error', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateItem('NOTEXIST', {
        name: '新名称',
      })

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('标的不存在')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('股票代码归一化（小写转大写/去空格）', async () => {
      seedItems(['000001.SZ'])

      await useResearchPoolStore.getState().updateItem('  000001.sz  ', {
        name: '新名称',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].symbol).toBe('000001.SZ')
    })

    it('更新失败时设置 error 并返回 false', async () => {
      seedItems(['000001'])
      mockForward.mockRejectedValue(new Error('更新失败'))

      const result = await useResearchPoolStore.getState().updateItem('000001', {
        name: '新名称',
      })

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toBe('更新失败')
    })

    it('更新时 updatedAt 字段被刷新', async () => {
      seedItems(['000001'])

      await useResearchPoolStore.getState().updateItem('000001', {
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
      const result = await useResearchPoolStore.getState().deleteItem('000001')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'delete', pool: 'research', symbol: '000001' }),
      )
    })

    it('删除时股票代码归一化', async () => {
      await useResearchPoolStore.getState().deleteItem('  000001.sh  ')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].symbol).toBe('000001.SH')
    })

    it('删除失败时设置 error 并返回 false', async () => {
      mockForward.mockRejectedValue(new Error('删除失败'))

      const result = await useResearchPoolStore.getState().deleteItem('000001')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toBe('删除失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件6：updateStatus() - 研究状态管理
  // ═══════════════════════════════════════════════════════════

  describe('updateStatus() - 研究状态管理', () => {
    it('合法状态转换成功（candidate → screened），返回 true', async () => {
      seedItems(['000001'], { status: 'candidate' })
      mockIsValidTransition.mockReturnValue(true)

      const result = await useResearchPoolStore.getState().updateStatus('000001', 'screened')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'updateStatus', pool: 'research', symbol: '000001', newStatus: 'screened' }),
      )
    })

    it('状态转换：screened → deepDive（深度研究）', async () => {
      seedItems(['000001'], { status: 'screened' })
      mockIsValidTransition.mockReturnValue(true)

      const result = await useResearchPoolStore.getState().updateStatus('000001', 'deepDive')

      expect(result).toBe(true)
      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].researchStatus).toBe('deepDive')
    })

    it('状态转换：deepDive → watching（加入观察）', async () => {
      seedItems(['000001'], { status: 'deepDive' })
      mockIsValidTransition.mockReturnValue(true)

      const result = await useResearchPoolStore.getState().updateStatus('000001', 'watching')

      expect(result).toBe(true)
      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].researchStatus).toBe('watching')
    })

    it('标的不存在时返回 false', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateStatus('NOTEXIST', 'screened')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('标的不存在')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('非法状态转换返回 false 并设置 error', async () => {
      seedItems(['000001'], { status: 'archived' })
      mockIsValidTransition.mockReturnValue(false)

      const result = await useResearchPoolStore.getState().updateStatus('000001', 'watching')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('非法状态流转')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('状态转换时更新 researchStatus 和 updatedAt 字段', async () => {
      seedItems(['000001'], { status: 'candidate' })
      mockIsValidTransition.mockReturnValue(true)

      await useResearchPoolStore.getState().updateStatus('000001', 'screened')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const updateData = calls[0]![1]
      expect(updateData.researchStatus).toBe('screened')
      expect(updateData.updatedAt).toBeGreaterThan(0)
    })

    it('状态转换失败时设置 error 并返回 false', async () => {
      seedItems(['000001'], { status: 'candidate' })
      mockIsValidTransition.mockReturnValue(true)
      mockForward.mockRejectedValue(new Error('状态更新失败'))

      const result = await useResearchPoolStore.getState().updateStatus('000001', 'screened')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toBe('状态更新失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件7：updateGroup() - 分组管理
  // ═══════════════════════════════════════════════════════════

  describe('updateGroup() - 分组管理', () => {
    it('成功更新分组，返回 true', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateGroup('000001', '科技组')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalled()
      expect(withBroadcast).toHaveBeenCalledWith(
        'pool:changed',
        expect.objectContaining({ action: 'updateGroup', pool: 'research', symbol: '000001', group: '科技组' }),
      )
    })

    it('分组名称为空返回 false', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateGroup('000001', '')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('分组名称不能为空')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('分组名称全空格返回 false', async () => {
      seedItems(['000001'])

      const result = await useResearchPoolStore.getState().updateGroup('000001', '   ')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toContain('分组名称不能为空')
    })

    it('分组名称首尾空格被去除', async () => {
      seedItems(['000001'])

      await useResearchPoolStore.getState().updateGroup('000001', '  科技组  ')

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0]![1].group).toBe('科技组')
    })

    it('更新分组失败时设置 error 并返回 false', async () => {
      seedItems(['000001'])
      mockForward.mockRejectedValue(new Error('分组更新失败'))

      const result = await useResearchPoolStore.getState().updateGroup('000001', '科技组')

      expect(result).toBe(false)
      expect(useResearchPoolStore.getState().error).toBe('分组更新失败')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件8：getByStatus / getByGroup 筛选
  // ═══════════════════════════════════════════════════════════

  describe('getByStatus / getByGroup 筛选', () => {
    it('getByStatus 按研究状态筛选', () => {
      useResearchPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'research', status: 'candidate', group: '默认分组' },
          { symbol: '600519', name: '股票600519', pool: 'research', status: 'deepDive', group: '默认分组' },
          { symbol: '000002', name: '股票000002', pool: 'research', status: 'candidate', group: '默认分组' },
          { symbol: '601318', name: '股票601318', pool: 'research', status: 'watching', group: '默认分组' },
        ] as never,
      })

      const candidates = useResearchPoolStore.getState().getByStatus('candidate' as never)
      expect(candidates).toHaveLength(2)
      expect(candidates.map((i) => i.symbol)).toEqual(['000001', '000002'])

      const deepDive = useResearchPoolStore.getState().getByStatus('deepDive' as never)
      expect(deepDive).toHaveLength(1)
      expect(deepDive[0]!.symbol).toBe('600519')

      const watching = useResearchPoolStore.getState().getByStatus('watching' as never)
      expect(watching).toHaveLength(1)
      expect(watching[0]!.symbol).toBe('601318')
    })

    it('getByGroup 按分组筛选', () => {
      useResearchPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'research', status: 'candidate', group: '科技组' },
          { symbol: '600519', name: '股票600519', pool: 'research', status: 'candidate', group: '消费组' },
          { symbol: '000002', name: '股票000002', pool: 'research', status: 'candidate', group: '科技组' },
        ] as never,
      })

      const techGroup = useResearchPoolStore.getState().getByGroup('科技组')
      expect(techGroup).toHaveLength(2)
      expect(techGroup.map((i) => i.symbol)).toEqual(['000001', '000002'])

      const consumerGroup = useResearchPoolStore.getState().getByGroup('消费组')
      expect(consumerGroup).toHaveLength(1)
      expect(consumerGroup[0]!.symbol).toBe('600519')
    })

    it('getByGroup 对 undefined group 使用默认分组', () => {
      useResearchPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'research', status: 'candidate', group: undefined },
        ] as never,
      })

      const result = useResearchPoolStore.getState().getByGroup('默认分组')
      expect(result).toHaveLength(1)
    })

    it('getByStatus 无匹配状态返回空数组', () => {
      seedItems(['000001'], { status: 'candidate' })

      const result = useResearchPoolStore.getState().getByStatus('archived' as never)
      expect(result).toEqual([])
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件9：辅助导出函数
  // ═══════════════════════════════════════════════════════════

  describe('辅助导出函数', () => {
    it('getResearchPoolTotalCount 返回 items 总数', () => {
      seedItems(['000001', '600519', '000002'])
      expect(getResearchPoolTotalCount()).toBe(3)
    })

    it('getResearchPoolItemBySymbol 按 symbol 查找', () => {
      seedItems(['000001'])
      expect(getResearchPoolItemBySymbol('000001')?.symbol).toBe('000001')
      expect(getResearchPoolItemBySymbol('NOTFOUND')).toBeUndefined()
    })

    it('getResearchPoolGroups 返回去重排序后的分组列表', () => {
      useResearchPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'research', status: 'candidate', group: 'A组' },
          { symbol: '600519', name: '股票600519', pool: 'research', status: 'candidate', group: 'B组' },
          { symbol: '000002', name: '股票000002', pool: 'research', status: 'candidate', group: 'A组' },
        ] as never,
      })

      const groups = getResearchPoolGroups()
      expect(groups).toEqual(['A组', 'B组'])
    })

    it('getResearchPoolGroups 对 undefined group 使用默认分组', () => {
      useResearchPoolStore.setState({
        items: [
          { symbol: '000001', name: '股票000001', pool: 'research', status: 'candidate', group: undefined },
        ] as never,
      })

      const groups = getResearchPoolGroups()
      expect(groups).toEqual(['默认分组'])
    })

    it('getResearchPoolTotalCount 空池返回 0', () => {
      expect(getResearchPoolTotalCount()).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件10：订阅机制
  // ═══════════════════════════════════════════════════════════

  describe('订阅机制', () => {
    it('initResearchPoolStoreSubscriptions 初始化订阅', () => {
      const unsubscribe = initResearchPoolStoreSubscriptions()

      expect(mockSubscribe).toHaveBeenCalledWith(STORE_NAME.stocks, expect.any(Function))
      expect(typeof unsubscribe).toBe('function')
    })

    it('重复初始化应跳过并返回销毁函数', () => {
      initResearchPoolStoreSubscriptions()
      const unsubscribe2 = initResearchPoolStoreSubscriptions()

      expect(mockSubscribe).toHaveBeenCalledTimes(1)
      expect(typeof unsubscribe2).toBe('function')
    })

    it('重置订阅后可重新初始化', () => {
      initResearchPoolStoreSubscriptions()
      _resetResearchPoolStoreSubscriptionsForTest()
      initResearchPoolStoreSubscriptions()

      expect(mockSubscribe).toHaveBeenCalledTimes(2)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件11：数据版本与完整性
  // ═══════════════════════════════════════════════════════════

  describe('数据版本与完整性', () => {
    it('新增股票 dataVersion 为 1', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCall![1].dataVersion).toBe(1)
    })

    it('refresh 后 lastUpdated 被更新', async () => {
      mockQuerySuccess([])
      const before = useResearchPoolStore.getState().lastUpdated

      await useResearchPoolStore.getState().refresh()

      const after = useResearchPoolStore.getState().lastUpdated
      expect(after).toBeGreaterThan(before)
    })

    it('新增股票 pool 字段固定为 research', async () => {
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const insertCall = calls.find(
        (c: [{ action?: string }]) => c[0]?.action === ENVELOPE_ACTION.insertStock,
      )
      expect(insertCall![1].pool).toBe('research')
    })

    it('每次更新都刷新 updatedAt 时间戳', async () => {
      seedItems(['000001'])
      mockForward.mockResolvedValue({})

      await useResearchPoolStore.getState().updateItem('000001', { name: '新名称' })

      const calls = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls
      const updateData = calls[0]![1]
      expect(typeof updateData.updatedAt).toBe('number')
      expect(updateData.updatedAt).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件12：错误处理
  // ═══════════════════════════════════════════════════════════

  describe('错误处理', () => {
    it('操作成功后 error 被清除', async () => {
      seedItems(['000001'])
      // 先设置一个错误
      useResearchPoolStore.setState({ error: '之前的错误' })

      await useResearchPoolStore.getState().updateItem('000001', { name: '新名称' })

      expect(useResearchPoolStore.getState().error).toBeNull()
    })

    it('refresh 成功后清除之前的 error', async () => {
      useResearchPoolStore.setState({ error: '之前的错误' })
      mockQuerySuccess([])

      await useResearchPoolStore.getState().refresh()

      expect(useResearchPoolStore.getState().error).toBeNull()
    })

    it('addItem 开始时清除之前的 error', async () => {
      useResearchPoolStore.setState({ error: '之前的错误' })
      mockQueryGetNotFound()

      await useResearchPoolStore.getState().addItem({
        symbol: '000001',
        name: '平安银行',
      })

      // 如果成功，error 应该是 null
      expect(useResearchPoolStore.getState().error).toBeNull()
    })
  })
})
