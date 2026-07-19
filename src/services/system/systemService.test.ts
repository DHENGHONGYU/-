import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSystemStats, resetAll, exportAll } from './systemService'

/* ------------------------------------------------------------------ */
/*  vi.hoisted: 在 vi.mock 之前声明所有 mock 函数                      */
/* ------------------------------------------------------------------ */
const { mockForward, mockStocksList, mockOrdersList, mockV6ScoresList, mockExport, mockImport, mockReset } =
  vi.hoisted(() => ({
    mockForward: vi.fn(),
    mockStocksList: vi.fn().mockResolvedValue([]),
    mockOrdersList: vi.fn().mockResolvedValue([]),
    mockV6ScoresList: vi.fn().mockResolvedValue([]),
    mockExport: vi.fn().mockResolvedValue({ stocks: [], orders: [] }),
    mockImport: vi.fn().mockResolvedValue(undefined),
    mockReset: vi.fn().mockResolvedValue(undefined),
  }))

/* ------------------------------------------------------------------ */
/*  Mock 模块                                                          */
/* ------------------------------------------------------------------ */
// P4 后 manager.export 仍直接访问 dataLayer，保留该 mock；其余数据查询已迁移到 DataBridge。
vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    manager: { export: mockExport },
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    exportAllData: mockExport,
    importAllData: mockImport,
    resetAllData: mockReset,
    query: vi.fn(({ store }) => {
      if (store === 'stocks') return mockStocksList().then((data: unknown[]) => ({ success: true, data }))
      if (store === 'orders') return mockOrdersList().then((data: unknown[]) => ({ success: true, data }))
      if (store === 'v6Scores') return mockV6ScoresList().then((data: unknown[]) => ({ success: true, data }))
      return Promise.resolve({ success: true, data: [] })
    }),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn().mockReturnValue({}) },
}))

vi.mock('@/config/dbConfig', () => ({
  MODULE_ID: { system: 'system' },
  ENVELOPE_TARGET: { system: 'system' },
  ENVELOPE_ACTION: { resetAll: 'RESET_ALL', exportAll: 'EXPORT_ALL' },
  STORE_NAME: { stocks: 'stocks', orders: 'orders', v6Scores: 'v6Scores' },
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

  it('成功调用 dataBridge.resetAllData 并返回 success', async () => {
    mockReset.mockResolvedValue(undefined)

    const result = await resetAll()
    expect(result.success).toBe(true)
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('dataBridge.resetAllData 失败返回 error', async () => {
    mockReset.mockRejectedValue(new Error('reset failed'))

    const result = await resetAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('reset failed')
    }
  })

  it('非 Error 异常也能正确捕获', async () => {
    mockReset.mockRejectedValue({ code: 500 })

    const result = await resetAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('[object Object]')
    }
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
    const result = await exportAll()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ stocks: [{ id: '1' }], orders: [] })
    }
  })

  it('dataBridge.exportAllData 失败返回 error', async () => {
    mockExport.mockRejectedValue(new Error('export failed'))

    const result = await exportAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('export failed')
    }
  })

  it('非 Error 异常也能正确捕获', async () => {
    mockExport.mockRejectedValue({ code: 500 })

    const result = await exportAll()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('[object Object]')
    }
  })
})
