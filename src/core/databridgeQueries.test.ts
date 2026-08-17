import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQuery, mockForward, mockExportAllData, mockImportAllData, mockResetAllData, mockLogger } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn(),
  mockExportAllData: vi.fn(),
  mockImportAllData: vi.fn(),
  mockResetAllData: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    exportAllData: mockExportAllData,
    importAllData: mockImportAllData,
    resetAllData: mockResetAllData,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import {
  queryGet,
  queryList,
  queryByIndex,
  sendWriteEnvelope,
  exportAll,
  importAll,
  resetAll,
} from './databridgeQueries'

describe('databridgeQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('queryGet', () => {
    it('成功时返回数据', async () => {
      mockQuery.mockResolvedValue({ success: true, data: { id: '1', name: 'test' } })

      const result = await queryGet<{ id: string; name: string }>('stocks', '1')

      expect(result).toEqual({ id: '1', name: 'test' })
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_GET',
          store: 'stocks',
          key: '1',
        }),
      )
    })

    it('失败时返回 undefined', async () => {
      mockQuery.mockResolvedValue({ success: false, error: 'not found' })

      const result = await queryGet('stocks', 'nonexistent')

      expect(result).toBeUndefined()
    })

    it('source 为 datalayer', async () => {
      mockQuery.mockResolvedValue({ success: true, data: null })

      await queryGet('stocks', '1')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'datalayer' }),
      )
    })
  })

  describe('queryList', () => {
    it('成功时返回数据数组', async () => {
      const mockData = [{ id: '1' }, { id: '2' }]
      mockQuery.mockResolvedValue({ success: true, data: mockData })

      const result = await queryList<{ id: string }>('stocks')

      expect(result).toEqual(mockData)
      expect(result).toHaveLength(2)
    })

    it('失败时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: false, error: 'store not found' })

      const result = await queryList('stocks')

      expect(result).toEqual([])
    })

    it('data 为 undefined 时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: undefined })

      const result = await queryList('stocks')

      expect(result).toEqual([])
    })

    it('action 为 QUERY_LIST', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      await queryList('daily_quotes')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'QUERY_LIST', store: 'daily_quotes' }),
      )
    })
  })

  describe('queryByIndex', () => {
    it('成功时返回索引匹配的数据', async () => {
      const mockData = [{ symbol: '600519.SH', score: 90 }]
      mockQuery.mockResolvedValue({ success: true, data: mockData })

      const result = await queryByIndex('v6_scores', 'by-symbol', '600519.SH')

      expect(result).toEqual(mockData)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_BY_INDEX',
          store: 'v6_scores',
          indexName: 'by-symbol',
          indexValue: '600519.SH',
        }),
      )
    })

    it('失败时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: false, error: 'index error' })

      const result = await queryByIndex('stocks', 'bad-index', 'value')

      expect(result).toEqual([])
    })

    it('data 为 undefined 时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: undefined })

      const result = await queryByIndex('stocks', 'idx', 'val')

      expect(result).toEqual([])
    })

    it('支持不同类型的 indexValue', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      await queryByIndex('news', 'by-date', 1234567890)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ indexValue: 1234567890 }),
      )
    })
  })

  describe('sendWriteEnvelope', () => {
    it('成功时返回 success: true', async () => {
      mockForward.mockResolvedValue(undefined)

      const result = await sendWriteEnvelope('insertStock', { symbol: 'TEST' })

      expect(result.success).toBe(true)
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('失败时返回 success: false 及错误消息', async () => {
      mockForward.mockRejectedValue(new Error('write failed'))

      const result = await sendWriteEnvelope('insertStock', { symbol: 'TEST' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('write failed')
    })

    it('非 Error 异常也能正确捕获', async () => {
      mockForward.mockRejectedValue('string error')

      const result = await sendWriteEnvelope('insertStock', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
    })

    it('默认 source 为 system', async () => {
      mockForward.mockResolvedValue(undefined)

      await sendWriteEnvelope('insertStock', {})

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.meta.source).toBe('system')
    })

    it('支持自定义 source', async () => {
      mockForward.mockResolvedValue(undefined)

      await sendWriteEnvelope('insertStock', {}, 'trading')

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.meta.source).toBe('trading')
    })

    it('payload 正确透传', async () => {
      mockForward.mockResolvedValue(undefined)
      const payload = { symbol: '600519.SH', name: '贵州茅台' }

      await sendWriteEnvelope('insertStock', payload)

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.payload).toEqual(payload)
    })

    it('envelope 包含 traceId', async () => {
      mockForward.mockResolvedValue(undefined)

      await sendWriteEnvelope('insertStock', {})

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.meta.traceId).toBeDefined()
      expect(typeof callArg.meta.traceId).toBe('string')
    })

    it('envelope target 为 db', async () => {
      mockForward.mockResolvedValue(undefined)

      await sendWriteEnvelope('insertStock', {})

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.meta.target).toBe('db')
    })

    it('envelope action 正确映射', async () => {
      mockForward.mockResolvedValue(undefined)

      await sendWriteEnvelope('deleteStock', { id: '1' })

      const callArg = mockForward.mock.calls[0]![0]
      expect(callArg.meta.action).toBe('DELETE_STOCK')
    })
  })

  describe('exportAll', () => {
    it('成功时返回数据和 success: true', async () => {
      const mockData = { stocks: [{ id: '1' }], daily_quotes: [] }
      mockExportAllData.mockResolvedValue(mockData)

      const result = await exportAll()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
    })

    it('失败时返回 success: false', async () => {
      mockExportAllData.mockRejectedValue(new Error('export failed'))

      const result = await exportAll()

      expect(result.success).toBe(false)
      expect(result.error).toBe('export failed')
    })

    it('调用 dataBridge.exportAllData 并传入 system 模块', async () => {
      mockExportAllData.mockResolvedValue({})

      await exportAll()

      expect(mockExportAllData).toHaveBeenCalledWith('system')
    })
  })

  describe('importAll', () => {
    it('成功时返回 success: true', async () => {
      mockImportAllData.mockResolvedValue(undefined)

      const result = await importAll({ stocks: [] })

      expect(result.success).toBe(true)
    })

    it('失败时返回 success: false', async () => {
      mockImportAllData.mockRejectedValue(new Error('import failed'))

      const result = await importAll({ stocks: [] })

      expect(result.success).toBe(false)
      expect(result.error).toBe('import failed')
    })

    it('数据正确传递给 dataBridge.importAllData', async () => {
      mockImportAllData.mockResolvedValue(undefined)
      const data = { stocks: [{ id: '1' }], signals: [{ id: 's1' }] }

      await importAll(data)

      expect(mockImportAllData).toHaveBeenCalledWith(data, 'system')
    })
  })

  describe('resetAll', () => {
    it('成功时返回 success: true', async () => {
      mockResetAllData.mockResolvedValue(undefined)

      const result = await resetAll()

      expect(result.success).toBe(true)
    })

    it('失败时返回 success: false', async () => {
      mockResetAllData.mockRejectedValue(new Error('reset failed'))

      const result = await resetAll()

      expect(result.success).toBe(false)
      expect(result.error).toBe('reset failed')
    })

    it('调用 dataBridge.resetAllData 并传入 system 模块', async () => {
      mockResetAllData.mockResolvedValue(undefined)

      await resetAll()

      expect(mockResetAllData).toHaveBeenCalledWith('system')
    })
  })
})
