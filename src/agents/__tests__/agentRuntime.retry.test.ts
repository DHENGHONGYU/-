/**
 * @test_id V9-TEST-ST-007
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-014, V9-DOC-QA-077]
 * 验证 P2 #10 瞬时失败有限重试（opt-in）：
 *  - 默认 VITE_AGENT_TASK_MAX_RETRIES=0（未配置）→ 不重试，维持历史失败语义
 *  - 配置 >0 后，对瞬时/网络类错误（MCP call failed）按指数退避重试，最终成功
 *  - 重试仅作用于单对象真相源任务，终态仍由 runWithRetry 统一上报
 *  - 不可重试错误（Task aborted / Agent not found）不触发重试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCallTool = vi.fn()
vi.mock('@/mcp/bridge', () => ({
  mcpBridge: {
    callTool: (...args: unknown[]) => mockCallTool(...args),
  },
}))

import { AgentRuntime } from '@/agents/agentRuntime'
import type { AgentConfig } from '@/agents/agentRuntime'

const cfg: AgentConfig = {
  id: 'retry-test-agent',
  name: 'Retry Test Agent',
  description: 'probe',
  defaultTimeout: 100000,
  maxConcurrent: 1,
  mcpServerName: 'retry-server',
  defaultToolName: 'retry_tool',
}

describe('AgentRuntime 有限重试 (P2 #10)', () => {
  let runtime: AgentRuntime

  beforeEach(() => {
    vi.clearAllMocks()
    runtime = new AgentRuntime()
    runtime.register(cfg)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('默认不重试：瞬时失败一次即终态 failed，callTool 仅调用 1 次', async () => {
    mockCallTool.mockRejectedValueOnce(new Error('MCP call failed: transient'))
    const task = await runtime.execute('retry-test-agent', 't', {})
    expect(task.status).toBe('failed')
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  it('配置 maxRetries>0：首次失败重试后成功，callTool 调用 2 次、status=completed', async () => {
    vi.stubEnv('VITE_AGENT_TASK_MAX_RETRIES', '2')
    vi.stubEnv('VITE_AGENT_TASK_RETRY_BASE_DELAY_MS', '10')
    vi.useFakeTimers()

    mockCallTool
      .mockRejectedValueOnce(new Error('MCP call failed: transient'))
      .mockResolvedValueOnce({ isError: false, content: [{ text: 'ok' }] })

    const p = runtime.execute('retry-test-agent', 't', {})
    await vi.advanceTimersByTimeAsync(100)
    const task = await p

    expect(task.status).toBe('completed')
    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  it('不可重试错误（Task aborted）不触发重试', async () => {
    vi.stubEnv('VITE_AGENT_TASK_MAX_RETRIES', '3')
    mockCallTool.mockRejectedValueOnce(new Error('Task aborted'))
    const task = await runtime.execute('retry-test-agent', 't', {})
    expect(task.status).toBe('failed')
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })
})
