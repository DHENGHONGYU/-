import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSystemStats, resetAll, exportAll } from './systemService'

/* ------------------------------------------------------------------ */
/*  vi.hoisted: 在 vi.mock 之前声明所有 mock 函数                      */
/* ------------------------------------------------------------------ */
const { mockForward, mockStocksList, mockOrdersList, mockV6ScoresList, mockExport } =
  vi.hoisted(() => ({
    mockForward: vi.fn(),
    mockStocksList: vi.fn().mockResolvedValue([]),
    mockOrdersList: vi.fn().mockResolvedValue([]),
    mockV6ScoresList: vi.fn().mockResolvedValue([]),
    mockExport: vi.fn().mockResolvedValue({ stocks: [], orders: [] }),
  }))

/* ------------------------------------------------------------------ */
/*  Mock 模块                                                          */
/* ------------------------------------------------------------------ */
vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: { list: mockStocksList },
    orders: { list: mockOrdersList },
    v6Scores: { list: mockV6ScoresList },
    manager: { export: mockExport },
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: mockForward },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn().mockReturnValue({}) },
}))

vi.mock('@/config/dbConfig', () => ({
  MODULE_ID: { system: 'system' },
  ENVELOPE_TARGET: { system: 'system' },
  ENVELOPE_ACTION: { resetAll: 'RESET_ALL', exportAll: 'EXPORT_ALL' },
}))

/* ------------------------------------------------------------------ */
/*  loadSystemStats                                                    */
/* ------------------------------------------------------------------ */
describe('loadSystemStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStocksList.mockResolvedValue([{ id: '1' }, { id: '2' }])
    mockOrdersList.mockResolvedValue([{ id: '1' }])
    mockV6ScoresList.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }])
  })

  it('成功返回 stocks/orders/scores 计数', async () => {
    const result = await loadSystemStats()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ stocks: 2, orders: 1, scores: 3 })
    }
  })

  it('空 dataLayer 返回全零', async () => {
    mockStocksList.mockResolvedValue([])
    mockOrdersList.mockResolvedValue([])
    mockV6ScoresList.mockResolvedValue([])

    const result = await loadSystemStats()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ stocks: 0, orders: 0, scores: 0 })
    }
  })

  it('stocks.list 失败返回 error', async () => {
    mockStocksList.mockRejectedValue(new Error('stocks list failed'))

    const result = await loadSystemStats()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('stocks list failed')
    }
  })

  it('非 Error 异常也能正确捕获', async () => {
    mockOrdersList.mockRejectedValue('unexpected string error')

    const result = await loadSystemStats()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('unexpected string error')
    }
  })
})

/* ------------------------------------------------------------------ */
/*  resetAll                                                           */
/* ------------------------------------------------------------------ */
describe('resetAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功调用 dataBridge.forward 并返回 success', async () => {
    mockForward.mockResolvedValue(undefined)

    const result = await resetAll()
    expect(result.success).toBe(true)
    expect(mockForward).toHaveBeenCalledTimes(1)
  })

  it('dataBridge.forward 失败返回 error', async () => {
    mockForward.mockRejectedValue(new Error('forward failed'))

    const result = await resetAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('forward failed')
    }
  })

  it('非 Error 异常也能正确捕获', async () => {
    mockForward.mockRejectedValue({ code: 500 })

    const result = await resetAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('[object Object]')
    }
  })

  it('Envelope 参数正确：source/target/action', async () => {
    mockForward.mockResolvedValue(undefined)

    // 引入被 mock 的 EnvelopeFactory 来捕获调用参数
    const { EnvelopeFactory } = await import('@/core/envelope')
    await resetAll()

    expect(EnvelopeFactory.create).toHaveBeenCalledTimes(1)
    const callArgs = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(callArgs[0]).toMatchObject({
      source: 'system',
      target: 'system',
      action: 'RESET_ALL',
    })
    expect(callArgs[0].traceId).toMatch(/^system-reset-\d+$/)
  })
})

/* ------------------------------------------------------------------ */
/*  exportAll                                                          */
/* ------------------------------------------------------------------ */
describe('exportAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExport.mockResolvedValue({ stocks: [{ id: '1' }], orders: [] })
  })

  it('成功返回导出数据', async () => {
    mockForward.mockResolvedValue(undefined)

    const result = await exportAll()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ stocks: [{ id: '1' }], orders: [] })
    }
  })

  it('dataBridge.forward 失败返回 error', async () => {
    mockForward.mockRejectedValue(new Error('bridge error'))

    const result = await exportAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('bridge error')
    }
  })

  it('manager.export 失败返回 error', async () => {
    mockForward.mockResolvedValue(undefined)
    mockExport.mockRejectedValue(new Error('export failed'))

    const result = await exportAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('export failed')
    }
  })

  it('Envelope 参数正确：source/target/action', async () => {
    mockForward.mockResolvedValue(undefined)

    const { EnvelopeFactory } = await import('@/core/envelope')
    await exportAll()

    expect(EnvelopeFactory.create).toHaveBeenCalledTimes(1)
    const callArgs = (EnvelopeFactory.create as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(callArgs[0]).toMatchObject({
      source: 'system',
      target: 'system',
      action: 'EXPORT_ALL',
    })
    expect(callArgs[0].traceId).toMatch(/^system-export-\d+$/)
  })
})
