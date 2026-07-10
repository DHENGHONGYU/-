import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createDataBridgeAdapter,
  getDataBridgeAdapter,
  destroyDataBridgeAdapter,
  DataBridgeAdapter,
} from '@/databridge'

describe('DataBridgeAdapter', () => {
  beforeEach(() => {
    destroyDataBridgeAdapter()
  })

  afterEach(() => {
    destroyDataBridgeAdapter()
  })

  it('应该创建 adapter instance', () => {
    const adapter = createDataBridgeAdapter()
    expect(adapter).toBeDefined()
    expect(getDataBridgeAdapter()).toBe(adapter)
  })

  it('应该返回 existing instance when create called twice', () => {
    const adapter1 = createDataBridgeAdapter()
    const adapter2 = createDataBridgeAdapter()
    expect(adapter1).toBe(adapter2)
  })

  it('应该抛出 when getAdapter called before create', () => {
    destroyDataBridgeAdapter()
    expect(() => getDataBridgeAdapter()).toThrow('DataBridgeAdapter not initialized')
  })

  it('应该返回 stats with pendingQueries field', () => {
    const adapter = createDataBridgeAdapter()
    const stats = adapter.getStats()
    expect(stats).toHaveProperty('pendingQueries')
    expect(typeof stats.pendingQueries).toBe('number')
    expect(stats).toHaveProperty('enableFallbackQueue')
    expect(typeof stats.enableFallbackQueue).toBe('boolean')
  })

  it('应该instantiate with custom config', () => {
    const adapter = new DataBridgeAdapter({
      enableFallbackQueue: false,
      defaultTimeout: 5000,
    })
    const stats = adapter.getStats()
    expect(stats.enableFallbackQueue).toBe(false)
  })

  it('应该处理查询 with timeout', async () => {
    const adapter = createDataBridgeAdapter()
    const result = await adapter.query('FETCH_NEWS', {}, { timeout: 100 })
    expect(result).toHaveProperty('traceId')
    expect(typeof result.traceId).toBe('string')
  })

  it('应该生成 unique traceIds for each query', async () => {
    const adapter = createDataBridgeAdapter()
    const result1 = await adapter.query('FETCH_STOCKS', {}, { timeout: 100 })
    const result2 = await adapter.query('FETCH_STOCKS', {}, { timeout: 100 })
    expect(result1.traceId).not.toBe(result2.traceId)
  })

  it('应该provide subscribe method', () => {
    const adapter = createDataBridgeAdapter()
    const callback = vi.fn()
    const unsubscribe = adapter.subscribe('test-channel', callback)
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})
