/**
 * @fileoverview dataLayer — Signal & ResearchLog 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：signalStore(4) / researchLogStore(2) 共 6 个用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQueryListSuccess,
  mockQueryFail,
  mockForwardSuccess,
  mockForwardFail,
  makeSignal,
  makeResearchLog,
} from './dataLayer.test-utils'
import { signalStore, researchLogStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signalStore', () => {
  it('save: 成功保存信号', async () => {
    mockForwardSuccess()
    const result = await signalStore.save(makeSignal())
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('sig-001')
  })

  it('save: forward 失败', async () => {
    mockForwardFail('err')
    const result = await signalStore.save(makeSignal())
    expect(result.success).toBe(false)
  })

  it('list: 返回全部信号', async () => {
    mockQueryListSuccess([makeSignal()])
    const result = await signalStore.list()
    expect(result).toHaveLength(1)
  })

  it('listBySymbol: 按股票代码过滤', async () => {
    mockQueryListSuccess([makeSignal(), makeSignal({ id: 'sig-002', symbol: '000001' })])
    const result = await signalStore.listBySymbol('600519')
    expect(result).toHaveLength(1)
    expect(result[0]?.symbol).toBe('600519')
  })
})

describe('researchLogStore', () => {
  it('list: 返回全部日志', async () => {
    mockQueryListSuccess([makeResearchLog()])
    const result = await researchLogStore.list()
    expect(result).toHaveLength(1)
  })

  it('list: 查询失败返回空数组', async () => {
    mockQueryFail('err')
    const result = await researchLogStore.list()
    expect(result).toEqual([])
  })
})
