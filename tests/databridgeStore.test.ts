/**
 * @test_id V9-TEST-UT-012
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-BACK-027, V9-DOC-DATA-052, V9-DOC-DATA-042, V9-DOC-DATA-051]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useDataBridgeStore } from '@/store/databridgeStore'

describe('databridgeStore', () => {
  beforeEach(() => {
    useDataBridgeStore.getState().reset()
  })

  it('应该有 correct initial state', () => {
    const state = useDataBridgeStore.getState()
    expect(state.pendingCount).toBe(0)
    expect(state.stats.pendingQueries).toBe(0)
    expect(state.stats.enableFallbackQueue).toBe(true)
    expect(state.lastError).toBeNull()
    expect(state.lastTraceId).toBeNull()
  })

  it('应该更新 pending count', () => {
    useDataBridgeStore.getState().setPendingCount(5)
    expect(useDataBridgeStore.getState().pendingCount).toBe(5)

    useDataBridgeStore.getState().setPendingCount(0)
    expect(useDataBridgeStore.getState().pendingCount).toBe(0)
  })

  it('应该合并 stats partially', () => {
    useDataBridgeStore.getState().setStats({ enableFallbackQueue: false })
    const stats = useDataBridgeStore.getState().stats
    expect(stats.enableFallbackQueue).toBe(false)
    expect(stats.pendingQueries).toBe(0)
  })

  it('应该record successful query result', () => {
    useDataBridgeStore.getState().recordResult({
      success: true,
      data: { foo: 'bar' },
      traceId: 'trace-123',
    })

    const state = useDataBridgeStore.getState()
    expect(state.lastError).toBeNull()
    expect(state.lastTraceId).toBe('trace-123')
  })

  it('应该record failed query result', () => {
    useDataBridgeStore.getState().recordResult({
      success: false,
      error: 'Connection timeout',
      traceId: 'trace-456',
    })

    const state = useDataBridgeStore.getState()
    expect(state.lastError).toBe('Connection timeout')
    expect(state.lastTraceId).toBe('trace-456')
  })

  it('应该重置 to default state', () => {
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

  it('应该处理 zero pending count', () => {
    useDataBridgeStore.getState().setPendingCount(0)
    expect(useDataBridgeStore.getState().pendingCount).toBe(0)
  })

  it('应该处理 result without error field', () => {
    useDataBridgeStore.getState().recordResult({
      success: false,
      traceId: 'trace-789',
    })
    expect(useDataBridgeStore.getState().lastError).toBeNull()
  })
})
