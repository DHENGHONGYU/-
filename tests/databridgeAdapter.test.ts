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

  it('should create adapter instance', () => {
    const adapter = createDataBridgeAdapter()
    expect(adapter).toBeDefined()
    expect(getDataBridgeAdapter()).toBe(adapter)
  })

  it('should return existing instance when create called twice', () => {
    const adapter1 = createDataBridgeAdapter()
    const adapter2 = createDataBridgeAdapter()
    expect(adapter1).toBe(adapter2)
  })

  it('should throw when getAdapter called before create', () => {
    destroyDataBridgeAdapter()
    expect(() => getDataBridgeAdapter()).toThrow('DataBridgeAdapter not initialized')
  })

  it('should return stats with pendingQueries field', () => {
    const adapter = createDataBridgeAdapter()
    const stats = adapter.getStats()
    expect(stats).toHaveProperty('pendingQueries')
    expect(typeof stats.pendingQueries).toBe('number')
    expect(stats).toHaveProperty('enableFallbackQueue')
    expect(typeof stats.enableFallbackQueue).toBe('boolean')
  })

  it('should instantiate with custom config', () => {
    const adapter = new DataBridgeAdapter({
      enableFallbackQueue: false,
      defaultTimeout: 5000,
    })
    const stats = adapter.getStats()
    expect(stats.enableFallbackQueue).toBe(false)
  })

  it('should handle query with timeout', async () => {
    const adapter = createDataBridgeAdapter()
    const result = await adapter.query('FETCH_NEWS', {}, { timeout: 100 })
    expect(result).toHaveProperty('traceId')
    expect(typeof result.traceId).toBe('string')
  })

  it('should generate unique traceIds for each query', async () => {
    const adapter = createDataBridgeAdapter()
    const result1 = await adapter.query('FETCH_STOCKS', {}, { timeout: 100 })
    const result2 = await adapter.query('FETCH_STOCKS', {}, { timeout: 100 })
    expect(result1.traceId).not.toBe(result2.traceId)
  })

  it('should provide subscribe method', () => {
    const adapter = createDataBridgeAdapter()
    const callback = vi.fn()
    const unsubscribe = adapter.subscribe('test-channel', callback)
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})
