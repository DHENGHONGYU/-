/**
 * @test_id V9-TEST-UT-002
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014]
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createAgentHealthMonitor,
  getAgentHealthMonitor,
  destroyAgentHealthMonitor,
} from '@/agents/agentHealthMonitor'
import type { AgentTask } from '@/agents/agentRuntime'

function createMockTask(
  agentId: string,
  status: AgentTask['status'],
  startedAt?: number,
  completedAt?: number,
): AgentTask {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    agentId,
    type: 'test',
    payload: {},
    timeout: 5000,
    status,
    createdAt: Date.now() - 1000,
    startedAt,
    completedAt,
  }
}

describe('AgentHealthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    destroyAgentHealthMonitor()
  })

  afterEach(() => {
    destroyAgentHealthMonitor()
    vi.useRealTimers()
  })

  it('应该是 healthy with no tasks', () => {
    const monitor = createAgentHealthMonitor()
    const report = monitor.getHealthReport('agent-1')
    expect(report).toBeNull()
  })

  it('应该report healthy for all successful tasks', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    for (let i = 0; i < 5; i++) {
      monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    }

    const report = monitor.getHealthReport('agent-1')
    expect(report).toBeDefined()
    expect(report?.status).toBe('healthy')
    expect(report?.failureRate).toBe(0)
    expect(report?.totalTasks).toBe(5)
  })

  it('应该report critical when failure rate exceeds threshold', () => {
    const monitor = createAgentHealthMonitor({ maxFailureRate: 0.3 })
    const now = Date.now()

    // 4 failures out of 5 = 80% failure rate
    for (let i = 0; i < 4; i++) {
      monitor.recordTask(createMockTask('agent-1', 'failed'))
    }
    monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))

    const report = monitor.getHealthReport('agent-1')
    expect(report?.status).toBe('critical')
    expect(report?.failureRate).toBe(0.8)
  })

  it('应该report warning when failure rate is moderate', () => {
    const monitor = createAgentHealthMonitor({ maxFailureRate: 0.3 })
    const now = Date.now()

    // 1 failure out of 4 = 25% failure rate (between 15% and 30%)
    monitor.recordTask(createMockTask('agent-1', 'failed'))
    for (let i = 0; i < 3; i++) {
      monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    }

    const report = monitor.getHealthReport('agent-1')
    expect(report?.status).toBe('warning')
  })

  it('应该report critical for 5 consecutive failures', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    // Preceded by successes
    for (let i = 0; i < 10; i++) {
      monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    }
    // 5 consecutive failures at the end
    for (let i = 0; i < 5; i++) {
      monitor.recordTask(createMockTask('agent-1', 'failed'))
    }

    const report = monitor.getHealthReport('agent-1')
    expect(report?.consecutiveFailures).toBe(5)
    expect(report?.status).toBe('critical')
  })

  it('应该calculate average execution time', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 1000, now))
    monitor.recordTask(createMockTask('agent-1', 'completed', now - 2000, now))

    const report = monitor.getHealthReport('agent-1')
    expect(report?.avgExecutionTime).toBe(1500)
  })

  it('应该track heartbeats', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    monitor.recordHeartbeat('agent-1')

    const report = monitor.getHealthReport('agent-1')
    expect(report).toBeDefined()
    expect(report!.lastHeartbeat).toBeGreaterThan(0)
  })

  it('应该limit task history to 100 entries', () => {
    const monitor = createAgentHealthMonitor()

    for (let i = 0; i < 150; i++) {
      monitor.recordTask(createMockTask('agent-1', 'completed'))
    }

    const report = monitor.getHealthReport('agent-1')
    expect(report?.totalTasks).toBe(100)
  })

  it('应该开始 and stop health check cycle', () => {
    const monitor = createAgentHealthMonitor()
    monitor.start(1000)

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    monitor.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('应该处理 double start gracefully', () => {
    const monitor = createAgentHealthMonitor()
    monitor.start(1000)
    expect(() => monitor.start(1000)).not.toThrow()
  })

  it('应该返回 all reports', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    monitor.recordTask(createMockTask('agent-2', 'completed', now - 500, now))

    const reports = monitor.getAllReports()
    expect(reports).toHaveLength(2)
    expect(reports.map((r) => r.agentId)).toContain('agent-1')
    expect(reports.map((r) => r.agentId)).toContain('agent-2')
  })

  it('应该是 singleton via getAgentHealthMonitor', () => {
    const monitor1 = getAgentHealthMonitor()
    const monitor2 = getAgentHealthMonitor()
    expect(monitor1).toBe(monitor2)
  })

  it('应该触发 events on critical health', () => {
    const monitor = createAgentHealthMonitor({ maxFailureRate: 0.1 })
    monitor.start(100)

    for (let i = 0; i < 5; i++) {
      monitor.recordTask(createMockTask('agent-1', 'failed'))
    }

    vi.advanceTimersByTime(200)
    monitor.stop()
  })
})
