/**
 * @test_id V9-TEST-UT-022
 * @covers_docs []
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useEngineStore } from '@/store/engineStore'

describe('engineStore', () => {
  beforeEach(() => {
    useEngineStore.getState().reset()
  })

  it('应该有 correct initial state', () => {
    const state = useEngineStore.getState()
    expect(state.started).toBe(false)
    expect(state.stats.dataflow.channels).toBe(0)
    expect(state.stats.dataflow.connected).toBe(false)
    expect(state.stats.agents.totalAgents).toBe(0)
    expect(state.config).toEqual({})
  })

  it('应该更新 started state', () => {
    useEngineStore.getState().setStarted(true)
    expect(useEngineStore.getState().started).toBe(true)

    useEngineStore.getState().setStarted(false)
    expect(useEngineStore.getState().started).toBe(false)
  })

  it('应该合并 config partially', () => {
    useEngineStore.getState().setConfig({ enableSSE: true, sseUrl: 'ws://test' })
    const config = useEngineStore.getState().config
    expect(config.enableSSE).toBe(true)
    expect(config.sseUrl).toBe('ws://test')
  })

  it('应该更新 stats partially', () => {
    useEngineStore.getState().updateStats({
      dataflow: { channels: 5, connected: true },
      agents: { totalAgents: 3, runningTasks: 2 },
    })

    const stats = useEngineStore.getState().stats
    expect(stats.dataflow.channels).toBe(5)
    expect(stats.dataflow.connected).toBe(true)
    expect(stats.dataflow.subscriberChannels).toBe(0)
    expect(stats.agents.totalAgents).toBe(3)
    expect(stats.agents.runningTasks).toBe(2)
    expect(stats.agents.completedTasks).toBe(0)
  })

  it('应该重置 to default state', () => {
    useEngineStore.getState().setStarted(true)
    useEngineStore.getState().setConfig({ enableSSE: true })
    useEngineStore.getState().updateStats({ dataflow: { channels: 10 } })

    useEngineStore.getState().reset()
    const state = useEngineStore.getState()
    expect(state.started).toBe(false)
    expect(state.config).toEqual({})
    expect(state.stats.dataflow.channels).toBe(0)
  })

  it('应该处理空值 stats update', () => {
    useEngineStore.getState().updateStats({})
    const stats = useEngineStore.getState().stats
    expect(stats.dataflow.channels).toBe(0)
    expect(stats.agents.totalAgents).toBe(0)
  })

  it('应该preserve unmodified stats fields during partial update', () => {
    useEngineStore.getState().updateStats({ agents: { failedTasks: 5 } })
    const stats = useEngineStore.getState().stats
    expect(stats.agents.failedTasks).toBe(5)
    expect(stats.dataflow.channels).toBe(0)
    expect(stats.dataflow.connected).toBe(false)
  })
})
