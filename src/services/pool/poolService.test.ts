/**
 * @test_id V9-TEST-UT-POOL-001
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-DATA-024, V9-DOC-PROJ-108]
 * @description poolService 股票池服务单元测试。
 *
 * 覆盖场景：
 *   1. 池项查询：单池/跨池
 *   2. 池项流转：研究→意向→持仓
 *   3. 按状态获取池项
 *   4. 获取所有泳道（lanes）
 *   5. 分组管理：获取分组列表
 *   6. 按分组获取池项
 *   7. 更新标的分组
 *   8. 默认分组判断
 *   9. 非法流转校验
 *   10. 错误处理：dataBridge 异常
 *   11. mapStockToPoolItem 映射
 *   12. 幂等性：空代码校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Stock } from '@/data/types'

// ─── Mock 依赖 ───────────────────────────────────────────

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

// mock poolTransitionEngine
// 使用 vi.hoisted 包裹，避免 vi.mock 工厂被提升导致的 "Cannot access before initialization"
const { mockIsValidTransition, mockGetPoolTransitionOptions, mockGetPoolLabel } = vi.hoisted(() => ({
  mockIsValidTransition: vi.fn(() => true),
  mockGetPoolTransitionOptions: vi.fn((): any[] => []),
  mockGetPoolLabel: vi.fn((_pool: string, status: string) => status),
}))

vi.mock('@/core/poolTransitionEngine', () => ({
  isValidTransition: mockIsValidTransition as any,
  getPoolTransitionOptions: mockGetPoolTransitionOptions as any,
  getPoolLabel: mockGetPoolLabel as any,
}))

// mock dataBridge
const { mockQuery, mockForward } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: (...args: unknown[]) => mockQuery(...args),
    forward: (...args: unknown[]) => mockForward(...args),
    subscribe: vi.fn(() => vi.fn()),
    invalidateAll: vi.fn(),
    invalidateCache: vi.fn(),
  },
  ENVELOPE_ACTION: {
    queryByIndex: 'QUERY_BY_INDEX',
    queryGet: 'QUERY_GET',
    queryList: 'QUERY_LIST',
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
  },
  STORE_NAME: {
    stocks: 'stocks',
    traceRecords: 'traceRecords',
  },
  MODULE_ID: {
    pool: 'pool',
    news: 'news',
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, data: unknown) => ({ meta, data })),
  },
  ENVELOPE_TARGET: { db: 'db' },
}))

vi.mock('@/config/dbConfig', () => ({
  DATA_SOURCE: { manual: 'manual', import: 'import', akshare: 'akshare' },
  ENVELOPE_ACTION: {
    queryByIndex: 'QUERY_BY_INDEX',
    queryGet: 'QUERY_GET',
    queryList: 'QUERY_LIST',
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
  },
  ENVELOPE_TARGET: { db: 'db' },
  STORE_NAME: { stocks: 'stocks', traceRecords: 'traceRecords' },
  MODULE_ID: { pool: 'pool', news: 'news' },
}))

import {
  listPoolItems,
  transitionPoolItem,
  getPoolItemsByStatus,
  getAllPoolLanes,
  getPoolGroups,
  getPoolItemsByGroup,
  updatePoolItemGroup,
  isDefaultGroup,
  mapStockToPoolItem,
} from './poolService'
import { RESEARCH_STATUS, INTENTION_STATUS, DEFAULT_POOL_GROUP } from '@/constants/pool.constants'

describe('poolService - 股票池服务', () => {
  // ─── 测试数据 ───────────────────────────────────────

  const mockStocks: Stock[] = [
    {
      symbol: '000001.SZ',
      name: '平安银行',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.candidate,
      source: 'manual',
      group: '银行股',
      price: 12.5,
      pe: 8.5,
      pb: 0.6,
      roe: 12.0,
      marketCap: 250000000000,
      dataVersion: 1,
      ingestedAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      symbol: '000002.SZ',
      name: '万科A',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.screened,
      source: 'manual',
      group: '地产股',
      price: 8.0,
      pe: 6.0,
      pb: 0.5,
      roe: 8.0,
      marketCap: 100000000000,
      dataVersion: 1,
      ingestedAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      symbol: '600519.SH',
      name: '贵州茅台',
      pool: 'research',
      researchStatus: RESEARCH_STATUS.deepDive,
      source: 'manual',
      group: '白酒股',
      price: 1680.0,
      pe: 30.0,
      pb: 10.0,
      roe: 30.0,
      marketCap: 2000000000000,
      dataVersion: 1,
      ingestedAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      symbol: '601318.SH',
      name: '中国平安',
      pool: 'intention',
      researchStatus: INTENTION_STATUS.screening,
      source: 'import',
      group: DEFAULT_POOL_GROUP,
      price: 45.0,
      pe: 7.0,
      pb: 0.8,
      roe: 15.0,
      marketCap: 800000000000,
      dataVersion: 1,
      ingestedAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      symbol: '000858.SZ',
      name: '五粮液',
      pool: 'position',
      researchStatus: 'holding',
      source: 'manual',
      group: '白酒股',
      price: 150.0,
      pe: 20.0,
      pb: 5.0,
      roe: 25.0,
      marketCap: 500000000000,
      quantity: 100,
      avgCost: 140.0,
      currentPrice: 150.0,
      dataVersion: 1,
      ingestedAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidTransition.mockReturnValue(true)
    mockGetPoolTransitionOptions.mockReturnValue([
      { pool: 'research', status: RESEARCH_STATUS.screened, label: '已筛选' },
    ])
    mockGetPoolLabel.mockImplementation((_pool, status) => status as string)
  })

  describe('mapStockToPoolItem - Stock 映射到 PoolItem', () => {
    it('研究池股票应正确映射', () => {
      const stock = mockStocks[0]! // 平安银行，research pool
      const item = mapStockToPoolItem(stock)

      expect(item.symbol).toBe('000001.SZ')
      expect(item.name).toBe('平安银行')
      expect(item.pool).toBe('research')
      expect(item.status).toBe(RESEARCH_STATUS.candidate)
      expect(item.price).toBe(12.5)
      expect(item.group).toBe('银行股')
    })

    it('意向池股票应正确映射', () => {
      const stock = mockStocks[3]! // 中国平安，intention pool
      const item = mapStockToPoolItem(stock)

      expect(item.pool).toBe('intention')
      expect(item.status).toBe(INTENTION_STATUS.screening)
    })

    it('持仓池股票应包含持仓信息', () => {
      const stock = mockStocks[4]! // 五粮液，position pool
      const item = mapStockToPoolItem(stock)

      expect(item.pool).toBe('position')
      expect((item as { quantity: number }).quantity).toBe(100)
      expect((item as { avgCost: number }).avgCost).toBe(140.0)
      expect((item as { currentPrice: number }).currentPrice).toBe(150.0)
    })

    it('未设置 pool 时默认为研究池', () => {
      const stock = { ...mockStocks[0], pool: undefined }
      const item = mapStockToPoolItem(stock as Stock)

      expect(item.pool).toBe('research')
    })
  })

  describe('listPoolItems - 池项查询', () => {
    it('不传 pool 参数时返回所有池项', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await listPoolItems()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(5)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'QUERY_LIST' }),
      )
    })

    it('指定 pool 时按池类型过滤', async () => {
      const researchStocks = mockStocks.filter(s => s.pool === 'research')
      mockQuery.mockResolvedValue({ success: true, data: researchStocks })

      const result = await listPoolItems('research')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_BY_INDEX',
          indexName: 'by-pool',
          indexValue: 'research',
        }),
      )
    })

    it('查询失败时返回错误信息', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '数据库错误' })

      const result = await listPoolItems('research')

      expect(result.success).toBe(false)
      expect(result.error).toBe('数据库错误')
    })

    it('dataBridge 抛出异常时返回错误', async () => {
      mockQuery.mockRejectedValue(new Error('连接失败'))

      const result = await listPoolItems('research')

      expect(result.success).toBe(false)
      expect(result.error).toContain('连接失败')
    })
  })

  describe('transitionPoolItem - 池项流转', () => {
    it('合法流转应成功更新池状态', async () => {
      const stock = mockStocks[0]
      mockQuery
        .mockResolvedValueOnce({ success: true, data: stock }) // 首次查询
        .mockResolvedValueOnce({ success: true, data: { ...stock, researchStatus: RESEARCH_STATUS.screened } }) // 更新后查询
      mockForward.mockResolvedValue(undefined)

      const result = await transitionPoolItem('000001.SZ', {
        pool: 'research',
        status: RESEARCH_STATUS.screened,
        label: '已筛选',
      })

      expect(result.success).toBe(true)
      expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.screened)
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('空股票代码应返回错误', async () => {
      const result = await transitionPoolItem('  ', {
        pool: 'research',
        status: RESEARCH_STATUS.screened,
        label: '已筛选',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('不能为空')
    })

    it('标的不存在时返回错误', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })

      const result = await transitionPoolItem('999999.SZ', {
        pool: 'research',
        status: RESEARCH_STATUS.screened,
        label: '已筛选',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('不存在')
    })

    it('非法流转时返回错误', async () => {
      const stock = mockStocks[0]
      mockQuery.mockResolvedValue({ success: true, data: stock })
      mockIsValidTransition.mockReturnValue(false)

      const result = await transitionPoolItem('000001.SZ', {
        pool: 'position',
        status: 'holding',
        label: '持仓',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('非法流转')
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('流转后查询失败时返回错误', async () => {
      const stock = mockStocks[0]
      mockQuery
        .mockResolvedValueOnce({ success: true, data: stock }) // 首次查询
        .mockResolvedValueOnce({ success: false, error: '读取失败' }) // 更新后查询
      mockForward.mockResolvedValue(undefined)

      const result = await transitionPoolItem('000001.SZ', {
        pool: 'research',
        status: RESEARCH_STATUS.screened,
        label: '已筛选',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('未找到标的')
    })

    it('股票代码自动转大写并去空格', async () => {
      const stock = mockStocks[0]
      mockQuery
        .mockResolvedValueOnce({ success: true, data: stock })
        .mockResolvedValueOnce({ success: true, data: stock })
      mockForward.mockResolvedValue(undefined)

      await transitionPoolItem('  000001.sz  ', {
        pool: 'research',
        status: RESEARCH_STATUS.screened,
        label: '已筛选',
      })

      // 验证查询时使用的是大写代码
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ key: '000001.SZ' }),
      )
    })
  })

  describe('getPoolItemsByStatus - 按状态获取池项', () => {
    it('应返回指定池和状态的标的', async () => {
      const candidateStocks = mockStocks.filter(
        s => s.pool === 'research' && s.researchStatus === RESEARCH_STATUS.candidate,
      )
      mockQuery.mockResolvedValue({ success: true, data: candidateStocks })

      const result = await getPoolItemsByStatus('research', RESEARCH_STATUS.candidate)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data![0]!.symbol).toBe('000001.SZ')
    })

    it('无匹配状态时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      const result = await getPoolItemsByStatus('research', RESEARCH_STATUS.archived)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('查询失败时返回错误', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '查询失败' })

      const result = await getPoolItemsByStatus('research', RESEARCH_STATUS.candidate)

      expect(result.success).toBe(false)
      expect(result.error).toBe('查询失败')
    })
  })

  describe('getAllPoolLanes - 获取所有泳道', () => {
    it('应按状态分组生成泳道', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await getAllPoolLanes()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      // 5 个标的，有 5 种不同状态
      const statuses = new Set(result.data!.map(l => l.status))
      expect(statuses.size).toBe(5)
    })

    it('每个泳道应包含 items 数组和 options', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await getAllPoolLanes()

      expect(result.success).toBe(true)
      for (const lane of result.data!) {
        expect(lane).toHaveProperty('status')
        expect(lane).toHaveProperty('label')
        expect(lane).toHaveProperty('items')
        expect(lane).toHaveProperty('options')
        expect(Array.isArray(lane.items)).toBe(true)
      }
    })

    it('空数据时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      const result = await getAllPoolLanes()

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('getPoolGroups - 获取分组列表', () => {
    it('应返回所有去重后的分组名称', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await getPoolGroups()

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toContain('银行股')
      expect(result.data).toContain('地产股')
      expect(result.data).toContain('白酒股')
      expect(result.data).toContain(DEFAULT_POOL_GROUP)
    })

    it('应始终包含默认分组', async () => {
      const stocksWithoutDefault = mockStocks.filter(s => s.group !== DEFAULT_POOL_GROUP)
      mockQuery.mockResolvedValue({ success: true, data: stocksWithoutDefault })

      const result = await getPoolGroups()

      expect(result.success).toBe(true)
      expect(result.data).toContain(DEFAULT_POOL_GROUP)
    })

    it('无数据时仅返回默认分组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      const result = await getPoolGroups()

      expect(result.success).toBe(true)
      expect(result.data).toEqual([DEFAULT_POOL_GROUP])
    })
  })

  describe('getPoolItemsByGroup - 按分组获取池项', () => {
    it('应返回指定分组的所有标的', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await getPoolItemsByGroup('白酒股')

      expect(result.success).toBe(true)
      expect(result.data!.length).toBe(2) // 贵州茅台 + 五粮液
      expect(result.data!.every(i => i.group === '白酒股')).toBe(true)
    })

    it('不存在的分组返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks })

      const result = await getPoolItemsByGroup('不存在的分组')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('updatePoolItemGroup - 更新标的分组', () => {
    it('合法分组更新应成功', async () => {
      const stock = mockStocks[0]
      mockQuery.mockResolvedValue({ success: true, data: { ...stock, group: '新分组' } })
      mockForward.mockResolvedValue(undefined)

      const result = await updatePoolItemGroup('000001.SZ', '新分组')

      expect(result.success).toBe(true)
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('空股票代码返回错误', async () => {
      const result = await updatePoolItemGroup('', '新分组')

      expect(result.success).toBe(false)
      expect(result.error).toContain('不能为空')
    })

    it('空分组名称返回错误', async () => {
      const result = await updatePoolItemGroup('000001.SZ', '  ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('分组名称不能为空')
    })

    it('更新后查询失败返回错误', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '读取失败' })
      mockForward.mockResolvedValue(undefined)

      const result = await updatePoolItemGroup('000001.SZ', '新分组')

      expect(result.success).toBe(false)
      expect(result.error).toContain('未找到标的')
    })

    it('股票代码自动标准化', async () => {
      mockQuery.mockResolvedValue({ success: true, data: mockStocks[0] })
      mockForward.mockResolvedValue(undefined)

      await updatePoolItemGroup('  000001.sz  ', '新分组')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ key: '000001.SZ' }),
      )
    })
  })

  describe('isDefaultGroup - 默认分组判断', () => {
    it('undefined 应判定为默认分组', () => {
      expect(isDefaultGroup(undefined)).toBe(true)
    })

    it('默认分组名称应判定为 true', () => {
      expect(isDefaultGroup(DEFAULT_POOL_GROUP)).toBe(true)
    })

    it('其他分组名称应判定为 false', () => {
      expect(isDefaultGroup('自定义分组')).toBe(false)
      expect(isDefaultGroup('')).toBe(false)
    })
  })
})
