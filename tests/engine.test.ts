import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createEngine, getEngine, destroyEngine, type EngineConfig } from '@/engine'
import { DataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { AgentRuntime } from '@/agents/agentRuntime'

describe('Engine', () => {
  beforeEach(() => {
    destroyEngine()
  })

  afterEach(() => {
    destroyEngine()
  })

  it('应该创建 engine instance with default config', () => {
    const engine = createEngine()
    expect(engine).toBeDefined()
    expect(getEngine()).toBe(engine)
  })

  it('应该创建 engine with custom config', () => {
    const config: EngineConfig = {
      enableSSE: true,
      sseUrl: 'http://localhost/sse',
      enableAgentHealthCheck: true,
      agentHealthCheckInterval: 15000,
    }
    const engine = createEngine(config)
    expect(engine).toBeDefined()
  })

  it('应该返回 existing instance when createEngine called twice', () => {
    const engine1 = createEngine()
    const engine2 = createEngine()
    expect(engine1).toBe(engine2)
  })

  it('应该抛出 when getEngine called before createEngine', () => {
    destroyEngine()
    expect(() => getEngine()).toThrow('Engine not initialized')
  })

  it('应该expose DataFlowEngine', () => {
    const engine = createEngine()
    const dataflow = engine.getDataFlowEngine()
    expect(dataflow).toBeInstanceOf(DataFlowEngine)
  })

  it('应该expose AgentRuntime', () => {
    const engine = createEngine()
    const agentRuntime = engine.getAgentRuntime()
    expect(agentRuntime).toBeInstanceOf(AgentRuntime)
  })

  it('应该返回 stats object with required fields', () => {
    const engine = createEngine()
    const stats = engine.getStats()
    expect(stats).toHaveProperty('dataflow')
    expect(stats).toHaveProperty('agents')
    expect(stats.dataflow).toHaveProperty('channels')
    expect(stats.dataflow).toHaveProperty('subscriberChannels')
    expect(stats.dataflow).toHaveProperty('connected')
    expect(stats.agents).toHaveProperty('totalAgents')
    expect(stats.agents).toHaveProperty('runningTasks')
    expect(stats.agents).toHaveProperty('completedTasks')
    expect(stats.agents).toHaveProperty('failedTasks')
  })

  it('应该开始 and stop without errors', () => {
    const engine = createEngine()
    expect(() => engine.start()).not.toThrow()
    expect(() => engine.stop()).not.toThrow()
  })

  it('应该处理 double start gracefully', () => {
    const engine = createEngine()
    engine.start()
    expect(() => engine.start()).not.toThrow()
  })

  it('应该处理 stop before start gracefully', () => {
    const engine = createEngine()
    expect(() => engine.stop()).not.toThrow()
  })

  it('应该destroy instance and allow recreation', () => {
    const engine1 = createEngine()
    destroyEngine()
    const engine2 = createEngine()
    expect(engine1).not.toBe(engine2)
  })
})
