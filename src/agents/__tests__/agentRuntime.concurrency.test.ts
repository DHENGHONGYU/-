/**
 * @test_id V9-TEST-ST-003
 * AgentRuntime 并发控制专项测试（F1 整改验证）
 *
 * 验证：execute() 经由 taskQueue 入队，按 agent.maxConcurrent 限制同时运行任务数，
 * 未达上限立即出队执行，达上限进入队列等待空槽（背压）。
  * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-007, V9-DOC-AI-002, V9-DOC-AI-005]
*/
import { describe, it, expect, vi, afterEach } from 'vitest'
import { AgentRuntime } from '@/agents/agentRuntime'
import { mcpBridge } from '@/mcp/bridge'

const AGENT_ID = 'f1-concurrency-agent'

function registerAgent(runtime: AgentRuntime, maxConcurrent: number): void {
  runtime.register({
    id: AGENT_ID,
    name: 'F1 Concurrency',
    description: 'test',
    defaultTimeout: 2000,
    maxConcurrent,
    mcpServerName: 'fetcher',
    defaultToolName: 'fetch_stock_basic',
  })
}

describe('AgentRuntime concurrency via TaskQueue (F1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maxConcurrent=1 时并发调用被串行化', async () => {
    const runtime = new AgentRuntime()
    registerAgent(runtime, 1)

    let inFlight = 0
    let peak = 0
    vi.spyOn(mcpBridge, 'callTool').mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
      return { content: [{ type: 'text', text: 'ok' }], isError: false }
    })

    const results = await Promise.all([
      runtime.execute(AGENT_ID, 't', {}),
      runtime.execute(AGENT_ID, 't', {}),
      runtime.execute(AGENT_ID, 't', {}),
    ])

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.status === 'completed')).toBe(true)
    expect(peak).toBe(1)
  })

  it('maxConcurrent=2 时允许 2 个并发', async () => {
    const runtime = new AgentRuntime()
    registerAgent(runtime, 2)

    let inFlight = 0
    let peak = 0
    vi.spyOn(mcpBridge, 'callTool').mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
      return { content: [{ type: 'text', text: 'ok' }], isError: false }
    })

    const results = await Promise.all([
      runtime.execute(AGENT_ID, 't', {}),
      runtime.execute(AGENT_ID, 't', {}),
      runtime.execute(AGENT_ID, 't', {}),
    ])

    expect(results.every((r) => r.status === 'completed')).toBe(true)
    expect(peak).toBe(2)
  })
})
