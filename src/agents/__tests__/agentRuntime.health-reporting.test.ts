/**
 * @test_id V9-TEST-ST-005
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-014, V9-DOC-QA-077]
 * 验证 P0 修复落地：
 *  - P0-1：execute() 终态均上报 recordTask → 健康监控不再恒空
 *  - P0-2：settled 守卫阻止超时后被迟到完成/失败覆盖
 *  - P0-3：resolveHealthCheckIntervalMs 环境变量可转换逻辑（非法/缺失回退、上限钳制）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock mcpBridge：与 agentRuntime.mcp.test.ts 同范式，隔离真实 MCP 调用
const mockCallTool = vi.fn()
vi.mock('@/mcp/bridge', () => ({
  mcpBridge: {
    callTool: (...args: unknown[]) => mockCallTool(...args),
  },
}))

import { AgentRuntime } from '@/agents/agentRuntime'
import type { AgentConfig } from '@/agents/agentRuntime'
import { getAgentHealthMonitor, resolveHealthCheckIntervalMs } from '@/agents/agentHealthMonitor'

describe('AgentRuntime 健康上报与竞态守卫 (P0)', () => {
  let runtime: AgentRuntime
  const cfg: AgentConfig = {
    id: 'health-test-agent',
    name: 'Health Test Agent',
    description: 'probe',
    defaultTimeout: 5000,
    maxConcurrent: 1,
    mcpServerName: 'health-server',
    defaultToolName: 'health_tool',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    runtime = new AgentRuntime()
    runtime.register(cfg)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('P0-1：成功执行后健康监控应记录该 Agent', async () => {
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], isError: false })
    const task = await runtime.execute('health-test-agent', 'health_tool', {})
    expect(task.status).toBe('completed')

    const report = getAgentHealthMonitor().getHealthReport('health-test-agent')
    expect(report).not.toBeNull()
    expect(report!.totalTasks).toBeGreaterThanOrEqual(1)
    expect(report!.status).toBe('healthy')
  })

  it('P0-1：失败后健康监控应记录失败任务（failureRate > 0）', async () => {
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'boom' }], isError: true })
    const task = await runtime.execute('health-test-agent', 'health_tool', {})
    expect(task.status).toBe('failed')

    const report = getAgentHealthMonitor().getHealthReport('health-test-agent')
    expect(report).not.toBeNull()
    expect(report!.failureRate).toBeGreaterThan(0)
  })

  it('P0-2：超时后迟到完成/失败不得覆盖 status 为 timeout', async () => {
    // callTool 在 150ms 才 resolve，但超时设为 100ms
    mockCallTool.mockImplementation(() => new Promise((r) => setTimeout(r, 150)))
    const task = await runtime.execute('health-test-agent', 'health_tool', {}, 100)
    expect(task.status).toBe('timeout')

    // 等待迟到 resolve 触发 .then/.catch：settled 守卫应拦截，status 保持 timeout
    await new Promise((r) => setTimeout(r, 120))
    expect(task.status).toBe('timeout')
  }, 5000)

  describe('P0-3：resolveHealthCheckIntervalMs 环境可转换逻辑', () => {
    it('缺失环境变量 → 回退默认（30000）', () => {
      expect(resolveHealthCheckIntervalMs()).toBe(30_000)
    })
    it('合法字符串 → 解析为数字', () => {
      vi.stubEnv('VITE_AGENT_HEALTH_CHECK_INTERVAL_MS', '5000')
      expect(resolveHealthCheckIntervalMs()).toBe(5000)
    })
    it('非法字符串 → 回退默认', () => {
      vi.stubEnv('VITE_AGENT_HEALTH_CHECK_INTERVAL_MS', 'not-a-number')
      expect(resolveHealthCheckIntervalMs()).toBe(30_000)
    })
    it('非正数值(0) → 回退默认', () => {
      vi.stubEnv('VITE_AGENT_HEALTH_CHECK_INTERVAL_MS', '0')
      expect(resolveHealthCheckIntervalMs()).toBe(30_000)
    })
    it('超出上限(300s) → 钳制为上限', () => {
      vi.stubEnv('VITE_AGENT_HEALTH_CHECK_INTERVAL_MS', '999999999')
      expect(resolveHealthCheckIntervalMs()).toBe(300_000)
    })
    it('自定义回退值生效', () => {
      vi.stubEnv('VITE_AGENT_HEALTH_CHECK_INTERVAL_MS', 'bad')
      expect(resolveHealthCheckIntervalMs(12_000)).toBe(12_000)
    })
  })
})
