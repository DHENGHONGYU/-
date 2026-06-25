import { describe, expect, it, beforeEach } from 'vitest'
import { useDataBridgeStore } from '@/store/databridgeStore'

describe('databridgeStore', () => {
  beforeEach(() => {
    useDataBridgeStore.getState().reset()
  })

  it('should have correct initial state', () => {
    const state = useDataBridgeStore.getState()
    expect(state.pendingCount).toBe(0)
    expect(state.stats.pendingQueries).toBe(0)
    expect(state.stats.enableFallbackQueue).toBe(true)
    expect(state.lastError).toBeNull()
    expect(state.lastTraceId).toBeNull()
  })

  it('should update pending count', () => {
    useDataBridgeStore.getState().setPendingCount(5)
    expect(useDataBridgeStore.getState().pendingCount).toBe(5)

    useDataBridgeStore.getState().setPendingCount(0)
    expect(useDataBridgeStore.getState().pendingCount).toBe(0)
  })

  it('should merge stats partially', () => {
    useDataBridgeStore.getState().setStats({ enableFallbackQueue: false })
    const stats = useDataBridgeStore.getState().stats
    expect(stats.enableFallbackQueue).toBe(false)
    expect(stats.pendingQueries).toBe(0)
  })

  it('should record successful query result', () => {
    useDataBridgeStore.getState().recordResult({
      success: true,
      data: { foo: 'bar' },
      traceId: 'trace-123',
    })

    const state = useDataBridgeStore.getState()
    expect(state.lastError).toBeNull()
    expect(state.lastTraceId).toBe('trace-123')
  })

  it('should record failed query result', () => {
    useDataBridgeStore.getState().recordResult({
      success: false,
      error: 'Connection timeout',
      traceId: 'trace-456',
    })

    const state = useDataBridgeStore.getState()
    expect(state.lastError).toBe('Connection timeout')
    expect(state.lastTraceId).toBe('trace-456')
  })

  it('should reset to default state', () => {
    useDataBridgeStore.getState().setPendingCount(10)
    useDataBridgeStore.getState().setStats({ enableFallbackQueue: false })
    useDataBridgeStore.getState().recordResult({ success: false, error: 'err', traceId: 't1' })

    useDataBridgeStore.getState().reset()
    const state = useDataBridgeStore.getState()
    expect(state.pendingCount).toBe(0)
    expect(state.stats.enableFallbackQueue).toBe(true)
    expect(state.lastError).toBeNull()
    expect(state.lastTraceId).toBeNull()
  })

  it('should handle zero pending count', () => {
    useDataBridgeStore.getState().setPendingCount(0)
    expect(useDataBridgeStore.getState().pendingCount).toBe(0)
  })

  it('should handle result without error field', () => {
    useDataBridgeStore.getState().recordResult({
      success: false,
      traceId: 'trace-789',
    })
    expect(useDataBridgeStore.getState().lastError).toBeNull()
  })
})
