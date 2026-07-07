/**
 * repository.ts 单元测试 — D-02 统一数据访问层
 *
 * 通过 mock dataBridge / envelope / logger 隔离测试 createRepository 工厂，
 * 验证统一契约的读取（query）与写入（forward）路径及失败处理。
 *
 * @vitest
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockQuery,
  mockForward,
  mockEnvelopeCreate,
  mockLogger,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockForward: vi.fn().mockResolvedValue(undefined),
  mockEnvelopeCreate: vi.fn().mockReturnValue({ _mock: 'envelope' }),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: mockEnvelopeCreate,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { createRepository } from './repository'
import { STORE_NAME, ENVELOPE_ACTION } from '@/config/dbConfig'
import type { Stock } from './types'

const sampleStock: Stock = {
  symbol: '600000',
  name: '浦发银行',
  industryCode: 'J66',
} as unknown as Stock

const repo = createRepository<Stock, string>({
  store: STORE_NAME.stocks,
  writeAction: 'insertStock',
  deleteAction: 'deleteStock',
  keyOf: (s) => s.symbol,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockForward.mockResolvedValue(undefined)
  mockEnvelopeCreate.mockReturnValue({ _mock: 'envelope' })
})

describe('createRepository — 读取路径', () => {
  it('get 成功时返回实体', async () => {
    mockQuery.mockResolvedValue({ success: true, data: sampleStock })
    const result = await repo.get('600000')
    expect(result).toEqual(sampleStock)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '600000',
      }),
    )
  })

  it('get 失败时返回 undefined 并记录错误', async () => {
    mockQuery.mockResolvedValue({ success: false, error: 'boom' })
    const result = await repo.get('600000')
    expect(result).toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('get 失败'),
      expect.objectContaining({ error: 'boom' }),
    )
  })

  it('getAll 成功时返回数组', async () => {
    mockQuery.mockResolvedValue({ success: true, data: [sampleStock] })
    const result = await repo.getAll()
    expect(result).toEqual([sampleStock])
  })

  it('getAll 失败时返回空数组', async () => {
    mockQuery.mockResolvedValue({ success: false, error: 'x' })
    const result = await repo.getAll()
    expect(result).toEqual([])
  })

  it('queryByIndex 透传索引参数', async () => {
    mockQuery.mockResolvedValue({ success: true, data: [sampleStock] })
    const result = await repo.queryByIndex('by-status', 'candidate')
    expect(result).toEqual([sampleStock])
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ENVELOPE_ACTION.queryByIndex,
        indexName: 'by-status',
        indexValue: 'candidate',
      }),
    )
  })
})

describe('createRepository — 写入路径', () => {
  it('put 成功时复用 writeAction 并返回 success', async () => {
    mockForward.mockResolvedValue(undefined)
    const result = await repo.put(sampleStock, '600000')
    expect(result).toEqual({ success: true })
    expect(mockEnvelopeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: ENVELOPE_ACTION.insertStock }),
      sampleStock,
    )
    expect(mockForward).toHaveBeenCalledWith({ _mock: 'envelope' })
  })

  it('put 抛错时收敛为失败结果', async () => {
    mockForward.mockRejectedValue(new Error('db down'))
    const result = await repo.put(sampleStock, '600000')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('db down')
    }
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('写入失败'),
      expect.objectContaining({ error: 'db down' }),
    )
  })

  it('delete 成功时复用 deleteAction', async () => {
    mockForward.mockResolvedValue(undefined)
    const result = await repo.delete('600000')
    expect(result).toEqual({ success: true })
    expect(mockEnvelopeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: ENVELOPE_ACTION.deleteStock }),
      { key: '600000' },
    )
  })

  it('delete 抛错时收敛为失败结果', async () => {
    mockForward.mockRejectedValue(new Error('lock'))
    const result = await repo.delete('600000')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('lock')
    }
  })
})
