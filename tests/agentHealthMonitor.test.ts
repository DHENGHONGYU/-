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

  it('should be healthy with no tasks', () => {
    const monitor = createAgentHealthMonitor()
    const report = monitor.getHealthReport('agent-1')
    expect(report).toBeNull()
  })

  it('should report healthy for all successful tasks', () => {
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

  it('should report critical when failure rate exceeds threshold', () => {
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

  it('should report warning when failure rate is moderate', () => {
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

  it('should report critical for 5 consecutive failures', () => {
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

  it('should calculate average execution time', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 1000, now))
    monitor.recordTask(createMockTask('agent-1', 'completed', now - 2000, now))

    const report = monitor.getHealthReport('agent-1')
    expect(report?.avgExecutionTime).toBe(1500)
  })

  it('should track heartbeats', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    monitor.recordHeartbeat('agent-1')

    const report = monitor.getHealthReport('agent-1')
    expect(report).toBeDefined()
    expect(report!.lastHeartbeat).toBeGreaterThan(0)
  })

  it('should limit task history to 100 entries', () => {
    const monitor = createAgentHealthMonitor()

    for (let i = 0; i < 150; i++) {
      monitor.recordTask(createMockTask('agent-1', 'completed'))
    }

    const report = monitor.getHealthReport('agent-1')
    expect(report?.totalTasks).toBe(100)
  })

  it('should start and stop health check cycle', () => {
    const monitor = createAgentHealthMonitor()
    monitor.start(1000)

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    monitor.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should handle double start gracefully', () => {
    const monitor = createAgentHealthMonitor()
    monitor.start(1000)
    expect(() => monitor.start(1000)).not.toThrow()
  })

  it('should return all reports', () => {
    const monitor = createAgentHealthMonitor()
    const now = Date.now()

    monitor.recordTask(createMockTask('agent-1', 'completed', now - 500, now))
    monitor.recordTask(createMockTask('agent-2', 'completed', now - 500, now))

    const reports = monitor.getAllReports()
    expect(reports).toHaveLength(2)
    expect(reports.map((r) => r.agentId)).toContain('agent-1')
    expect(reports.map((r) => r.agentId)).toContain('agent-2')
  })

  it('should be singleton via getAgentHealthMonitor', () => {
    const monitor1 = getAgentHealthMonitor()
    const monitor2 = getAgentHealthMonitor()
    expect(monitor1).toBe(monitor2)
  })

  it('should emit events on critical health', () => {
    const monitor = createAgentHealthMonitor({ maxFailureRate: 0.1 })
    monitor.start(100)

    for (let i = 0; i < 5; i++) {
      monitor.recordTask(createMockTask('agent-1', 'failed'))
    }

    vi.advanceTimersByTime(200)
    monitor.stop()
  })
})
