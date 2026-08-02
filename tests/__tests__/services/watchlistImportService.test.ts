/**
 * @test_id V9-TEST-UT-C4
 * @covers_docs [V9-DOC-PROJ-192, V9-DOC-BACK-012, V9-DOC-PROJ-108, V9-DOC-DATA-024]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Stock } from '@/data/types'

/**
 * watchlistImportService.ts 单元测试
 *
 * 测试覆盖：
 *   1. importWatchlistStocks() 导入成功场景
 *   2. importWatchlistStocks() 导入已存在股票时跳过
 *   3. getResearchWatchlist() 返回观察状态股票
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

// mock dataBridge
const mockQuery = vi.fn()
const mockForward = vi.fn()

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: (...args: unknown[]) => mockQuery(...args),
    forward: (...args: unknown[]) => mockForward(...args),
    subscribe: vi.fn(() => vi.fn()),
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

// mock EnvelopeFactory（importActual + 局部覆盖：保留真实导出防假阳性，仅替换 create 控制返回值）
vi.mock('@/core/envelope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/envelope')>()
  return {
    ...actual,
    EnvelopeFactory: {
      ...actual.EnvelopeFactory,
      create: vi.fn((_meta: unknown, data: unknown) => ({ meta: _meta, data })),
    },
  }
})

// ─── 导入被测模块 ────────────────────────────────────────────

import {
  importWatchlistStocks,
  getResearchWatchlist,
} from '@/services/pool/watchlistImportService'

// ─── 测试数据工厂 ────────────────────────────────────────────

/** 构造 mock Stock 数据 */
function makeStock(overrides: Partial<Stock> & { symbol: string }): Stock {
  return {
    symbol: overrides.symbol,
    name: overrides.name ?? `股票${overrides.symbol}`,
    pool: overrides.pool ?? 'research',
    researchStatus: overrides.researchStatus ?? 'watching',
    source: overrides.source ?? 'manual',
    dataVersion: overrides.dataVersion ?? 1,
    ingestedAt: overrides.ingestedAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    ...overrides,
  } as Stock
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('watchlistImportService.ts 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mockForward 成功
    mockForward.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：importWatchlistStocks() 导入成功场景
  // ═══════════════════════════════════════════════════════════

  describe('importWatchlistStocks() 导入成功场景', () => {
    it('导入新股成功：股票不存在时插入新记录', async () => {
      // queryGet 返回不存在（success: true, data: null）
      mockQuery.mockResolvedValue({ success: true, data: null })
      // forward 成功
      mockForward.mockResolvedValue({ success: true })

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
        { symbol: '600519', name: '贵州茅台' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.added).toHaveLength(2)
        expect(result.data.skipped).toHaveLength(0)
        expect(result.data.failed).toHaveLength(0)
        // 验证插入的股票池类型为 intention
        expect(result.data.added[0]!.pool).toBe('intention')
        expect(result.data.added[1]!.pool).toBe('intention')
      }
    })

    it('导入单只股票成功', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })
      mockForward.mockResolvedValue({ success: true })

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.added).toHaveLength(1)
        expect(result.data.added[0]!.symbol).toBe('000001')
        expect(result.data.added[0]!.name).toBe('平安银行')
      }
    })

    it('导入时 symbol 应被归一化为大写', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })
      mockForward.mockResolvedValue({ success: true })

      await importWatchlistStocks([
        { symbol: 'abc123', name: '测试股票' },
      ])

      // 验证 queryGet 使用了归一化后的 symbol
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'ABC123',
        }),
      )
    })

    it('导入失败时 forward 抛出异常', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })
      mockForward.mockRejectedValue(new Error('数据库写入失败'))

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
      ])

      expect(result.success).toBe(true) // 外层仍返回 success
      if (result.success) {
        expect(result.data.failed).toHaveLength(1)
        expect(result.data.failed[0]!.symbol).toBe('000001')
        expect(result.data.failed[0]!.error).toBe('数据库写入失败')
        expect(result.data.added).toHaveLength(0)
      }
    })

    it('空列表导入应返回空结果', async () => {
      const result = await importWatchlistStocks([])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.added).toHaveLength(0)
        expect(result.data.skipped).toHaveLength(0)
        expect(result.data.failed).toHaveLength(0)
      }
      // 不应调用 dataBridge
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：importWatchlistStocks() 导入已存在股票时跳过
  // ═══════════════════════════════════════════════════════════

  describe('importWatchlistStocks() 导入已存在股票时跳过', () => {
    it('已在意向池中的股票应被跳过', async () => {
      // queryGet 返回已存在于意向池的股票
      const existingStock = makeStock({
        symbol: '000001',
        name: '平安银行',
        pool: 'intention',
      })
      mockQuery.mockResolvedValue({ success: true, data: existingStock })

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.skipped).toHaveLength(1)
        expect(result.data.skipped[0]!.symbol).toBe('000001')
        expect(result.data.added).toHaveLength(0)
        expect(result.data.failed).toHaveLength(0)
      }
      // 不应调用 forward（因为是跳过，不是插入）
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('混合场景：新股导入 + 已有股票跳过', async () => {
      const intentionStock = makeStock({
        symbol: '000001',
        pool: 'intention',
      })

      // 第一次 queryGet（000001）返回已存在
      // 第二次 queryGet（600519）返回不存在
      mockQuery
        .mockResolvedValueOnce({ success: true, data: intentionStock })
        .mockResolvedValueOnce({ success: true, data: null })

      mockForward.mockResolvedValue({ success: true })

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
        { symbol: '600519', name: '贵州茅台' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.added).toHaveLength(1)
        expect(result.data.added[0]!.symbol).toBe('600519')
        expect(result.data.skipped).toHaveLength(1)
        expect(result.data.skipped[0]!.symbol).toBe('000001')
      }
    })

    it('存在于其他池的股票应被更新为意向池', async () => {
      // queryGet 返回存在于 research 池的股票
      const researchStock = makeStock({
        symbol: '000001',
        name: '平安银行',
        pool: 'research',
      })
      // 第一次 queryGet 返回 research 池股票
      // 第二次 queryGet（更新后读取）返回更新后的股票
      const updatedStock = makeStock({
        symbol: '000001',
        name: '平安银行',
        pool: 'intention',
      })
      mockQuery
        .mockResolvedValueOnce({ success: true, data: researchStock })
        .mockResolvedValueOnce({ success: true, data: updatedStock })

      mockForward.mockResolvedValue({ success: true })

      const result = await importWatchlistStocks([
        { symbol: '000001', name: '平安银行' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        // 应被添加到 added（通过更新方式迁移）
        expect(result.data.added).toHaveLength(1)
        expect(result.data.skipped).toHaveLength(0)
      }
      // 应调用 forward 进行更新
      expect(mockForward).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：getResearchWatchlist() 返回观察状态股票
  // ═══════════════════════════════════════════════════════════

  describe('getResearchWatchlist() 返回观察状态股票', () => {
    it('应只返回 researchStatus === "watching" 的股票', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'research', researchStatus: 'watching' }),
        makeStock({ symbol: '600519', pool: 'research', researchStatus: 'candidate' }),
        makeStock({ symbol: '000002', pool: 'research', researchStatus: 'watching' }),
        makeStock({ symbol: '601318', pool: 'research', researchStatus: 'deepDive' }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: stocks })

      const result = await getResearchWatchlist()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
        expect(result.data!.map((s) => s.symbol)).toEqual(['000001', '000002'])
        // 验证返回的都是 watching 状态
        result.data!.forEach((s) => {
          expect(s.researchStatus).toBe('watching')
        })
      }
    })

    it('无观察状态股票时应返回空数组', async () => {
      const stocks = [
        makeStock({ symbol: '000001', pool: 'research', researchStatus: 'candidate' }),
        makeStock({ symbol: '600519', pool: 'research', researchStatus: 'screened' }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: stocks })

      const result = await getResearchWatchlist()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(0)
      }
    })

    it('查询失败时应返回错误', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '数据库连接失败' })

      const result = await getResearchWatchlist()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('数据库连接失败')
      }
    })

    it('查询返回 null data 时应返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })

      const result = await getResearchWatchlist()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
    })

    it('查询抛出异常时应返回错误', async () => {
      mockQuery.mockRejectedValue(new Error('网络超时'))

      const result = await getResearchWatchlist()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('网络超时')
      }
    })
  })
})
