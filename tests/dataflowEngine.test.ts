import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DataFlowEngine } from '@/core/dataflow/dataflowEngine'

describe('DataFlowEngine SSE reconnect (DF-006)', () => {
  let engine: DataFlowEngine
  const mockInstances: MockEventSource[] = []

  class MockEventSource {
    url: string
    onopen?: () => void
    onmessage?: (event: MessageEvent) => void
    onerror?: () => void
    close = vi.fn()

    constructor(url: string) {
      this.url = url
      mockInstances.push(this)
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
    engine = new DataFlowEngine()
  })

  afterEach(() => {
    engine.destroy()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    mockInstances.length = 0
  })

  it('should schedule a reconnect with exponential backoff on SSE error', () => {
    engine.connect('http://localhost/sse')
    const es = mockInstances[0]!
    expect(es).toBeDefined()

    es.onerror?.()

    expect(engine.getStats().connected).toBe(false)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })
})
