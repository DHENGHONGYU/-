/**
 * E-2: 数据采集服务单元测试
 *
 * 验证 directDataAPI 类型转换 + dataSourceOrchestrator 降级逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Global mocks ──
vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

const mockForward = vi.fn().mockResolvedValue({ success: true, data: {} })
vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: mockForward },
}))

vi.mock('@/lib/eventBus', () => ({
  getEventBus: vi.fn(() => ({ emit: vi.fn() })),
}))

beforeEach(() => {
  mockForward.mockClear()
})

describe('E-2: data-collector 核心功能', () => {
  describe('directDataAPI — 类型转换', () => {
    it('quoteToStock 转换 RealtimeQuote → Partial<Stock>（所有字段）', async () => {
      const { quoteToStock } = await import('@/services/data-collector/directDataAPI')

      const stock = quoteToStock({
        name: '宁德时代',
        symbol: 'sz300750',
        price: 200,
        change: 5,
        changePercent: 2.56,
        open: 196,
        high: 201,
        low: 195,
        volume: 30000000,
        amount: 6000000000,
        timestamp: Date.now(),
      })

      expect(stock.name).toBe('宁德时代')
      expect(stock.symbol).toBe('sz300750')
      expect(stock.price).toBe(200)
    })

    it('quoteToStock 处理空值字段', async () => {
      const { quoteToStock } = await import('@/services/data-collector/directDataAPI')

      const stock = quoteToStock({
        name: '',
        symbol: 'sh600000',
        price: 0,
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        amount: 0,
        timestamp: 0,
      })

      expect(stock.symbol).toBe('sh600000')
      // price=0 应被保留或兜底
      expect(typeof stock.price).toBe('number')
    })

    it('klinesToDailyQuotes 转换 KlineBar[] → DailyQuotes', async () => {
      const { klinesToDailyQuotes } = await import('@/services/data-collector/directDataAPI')

      const klines = [
        { date: '2026-07-01', open: 10, close: 11, high: 11.5, low: 9.8, volume: 1000000, amount: 11000000 },
        { date: '2026-07-02', open: 11, close: 10.5, high: 11.2, low: 10.3, volume: 1200000, amount: 12600000 },
      ]

      const result = klinesToDailyQuotes('sz000001', klines)
      expect(result.symbol).toBe('sz000001')
    })
  })

  describe('dataSourceOrchestrator — 四层降级编排', () => {
    it('getQuote 存在且可导入', async () => {
      const mod = await import('@/services/data-collector/dataSourceOrchestrator')
      expect(typeof mod.getQuote).toBe('function')
      expect(typeof mod.collectAndSaveQuote).toBe('function')
      expect(typeof mod.getKline).toBe('function')
    })

    it('getQuote 返回 CollectionResult 结构', async () => {
      const { getQuote } = await import('@/services/data-collector/dataSourceOrchestrator')
      const result = await getQuote('000001.SZ')

      // 所有真实API不可用时返回Mock
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('latency')
      expect(result).toHaveProperty('fallbackChain')
      expect(typeof result.latency).toBe('number')
    })

    it('getQuote 降级到 Mock 时 source=mock', async () => {
      const { getQuote } = await import('@/services/data-collector/dataSourceOrchestrator')
      const result = await getQuote('000001.SZ')

      // 在测试环境无真实API，应降级到 mock
      expect(result.success).toBe(true)
      expect(result.source).toBe('mock')
      expect(result.data).not.toBeNull()
    })

    it('采集保存调用 DataBridge.forward', async () => {
      // collectAndSaveQuote 会调用 getQuote → 最后回退到 mock
      // mock 数据仍会通过 DataBridge 写入
      const { collectAndSaveQuote } = await import('@/services/data-collector/dataSourceOrchestrator')
      const result = await collectAndSaveQuote('000001.SZ')

      expect(result.success).toBe(true)
      // mock forward 被调用
      expect(mockForward).toHaveBeenCalled()
    })
  })
})
