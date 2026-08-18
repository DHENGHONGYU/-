/**
 * @test_id V9-TEST-ST-006
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-014, V9-DOC-QA-077]
 * 验证 P1 #4 取消语义统一：
 *  - cancelTask 将任务置为 'cancelled'（与 TaskQueue 一致），而非 'failed'
 *  - getStats 单列 cancelledTasks，取消不污染失败率（failedTasks 不增）
 *  - 取消运行中任务后，迟到返回的 MCP 结果（signal.aborted）被守卫拦截，
 *    status 保持 'cancelled'，execute 的 Promise 最终仍 resolve（不悬挂）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCallTool = vi.fn()
vi.mock('@/mcp/bridge', () => ({
  mcpBridge: {
    callTool: (...args: unknown[]) => mockCallTool(...args),
  },
}))

import { AgentRuntime } from '@/agents/agentRuntime'
import type { AgentConfig } from '@/agents/agentRuntime'

describe('AgentRuntime 取消语义 (P1 #4)', () => {
  let runtime: AgentRuntime
  const cfg: AgentConfig = {
    id: 'cancel-test-agent',
    name: 'Cancel Test Agent',
    description: 'probe',
    defaultTimeout: 5000,
    maxConcurrent: 1,
    mcpServerName: 'cancel-server',
    defaultToolName: 'cancel_tool',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    runtime = new AgentRuntime()
    runtime.register(cfg)
  })

  it('取消运行中任务 → status=cancelled、failedTasks 不增、迟到 settle 被守卫拦截', async () => {
    // 慢调用：让任务进入 running 后再取消
    mockCallTool.mockImplementation(() => new Promise((r) => setTimeout(r, 300)))

    const taskPromise = runtime.execute('cancel-test-agent', 'cancel_tool', {})

    // 等待任务进入 running（drain 在 microtask 中出队，30ms 足够）
    await new Promise((r) => setTimeout(r, 30))
    const running = runtime.listTasks('running')
    expect(running.length).toBe(1)
    const id = running[0]!.id

    const ok = runtime.cancelTask(id)
    expect(ok).toBe(true)
    expect(runtime.getTask(id)!.status).toBe('cancelled')
    expect(runtime.getStats().cancelledTasks).toBeGreaterThanOrEqual(1)

    // 取消不污染失败率
    expect(runtime.getStats().failedTasks).toBe(0)

    // 迟到 MCP 返回（signal.aborted）应被守卫拦截，status 保持 cancelled，
    // 且 execute 的 Promise 最终 resolve（不悬挂、不误报 completed）
    await expect(taskPromise).resolves.toBeDefined()
    const finalTask = runtime.getTask(id)!
    expect(finalTask.status).toBe('cancelled')
    expect(finalTask.result).toBeUndefined()
    expect(runtime.getStats().failedTasks).toBe(0)
  }, 10000)
})
