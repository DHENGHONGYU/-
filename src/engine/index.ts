/**
 * @module Engine
 * @lifecycle @Global
 * @description V9 引擎入口模块，统一调度 DataFlowEngine、AgentRuntime、PoolTransitionEngine
 */

import { DataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { AgentRuntime } from '@/agents/agentRuntime'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { EngineConfig, EngineStats } from '@/types/modules/engine.types'

const logger = getLogger()

export type { EngineConfig, EngineStats } from '@/types/modules/engine.types'

class Engine {
  private dataflowEngine: DataFlowEngine
  private agentRuntime: AgentRuntime
  private config: EngineConfig
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private started = false

  constructor(config: EngineConfig = {}) {
    this.config = {
      enableSSE: false,
      enableAgentHealthCheck: true,
      agentHealthCheckInterval: 30000,
      ...config,
    }

    this.dataflowEngine = new DataFlowEngine()
    this.agentRuntime = new AgentRuntime()

    logger.info('[Engine] Initialized', { config: this.config })
  }

  start(): void {
    if (this.started) {
      logger.warn('[Engine] Already started, skipping')
      return
    }

    logger.info('[Engine] Starting...')

    if (this.config.enableSSE && this.config.sseUrl) {
      this.dataflowEngine.connect(this.config.sseUrl)
      logger.info(`[Engine] DataFlow SSE connected: ${this.config.sseUrl}`)
    } else {
      this.dataflowEngine.connect()
      logger.info('[Engine] DataFlow polling mode activated')
    }

    if (this.config.enableAgentHealthCheck) {
      this._startAgentHealthCheck()
    }

    this.started = true
    eventBus.emit('ENGINE_STARTED', { timestamp: Date.now() })
    logger.info('[Engine] Started successfully')
  }

  stop(): void {
    if (!this.started) {
      logger.warn('[Engine] Not started, skipping stop')
      return
    }

    logger.info('[Engine] Stopping...')

    this.dataflowEngine.disconnect()

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    this.started = false
    eventBus.emit('ENGINE_STOPPED', { timestamp: Date.now() })
    logger.info('[Engine] Stopped')
  }

  getStats(): EngineStats {
    const agentStats = this.agentRuntime.getStats()
    const dfStats = this.dataflowEngine.getStats()
    return {
      dataflow: {
        channels: dfStats.channels,
        subscriberChannels: dfStats.subscribers.length,
        connected: dfStats.connected,
      },
      agents: {
        totalAgents: agentStats.totalAgents,
        runningTasks: agentStats.runningTasks,
        completedTasks: agentStats.completedTasks,
        failedTasks: agentStats.failedTasks,
      },
    }
  }

  getDataFlowEngine(): DataFlowEngine {
    return this.dataflowEngine
  }

  getAgentRuntime(): AgentRuntime {
    return this.agentRuntime
  }

  private _startAgentHealthCheck(): void {
    const interval = this.config.agentHealthCheckInterval ?? 30000
    this.healthCheckTimer = setInterval(() => {
      const stats = this.agentRuntime.getStats()
      logger.debug('[Engine] Agent health check', stats)

      if (stats.failedTasks > stats.completedTasks * 0.5) {
        logger.warn('[Engine] Agent failure rate exceeds 50%, emitting alert')
        eventBus.emit('ENGINE_AGENT_HEALTH_ALERT', { stats })
      }
    }, interval)
    logger.info(`[Engine] Agent health check started (interval=${interval}ms)`)
  }
}

// Singleton instance
let engineInstance: Engine | null = null

export function createEngine(config?: EngineConfig): Engine {
  if (engineInstance) {
    logger.warn('[Engine] createEngine() called but instance already exists, returning existing')
    return engineInstance
  }
  engineInstance = new Engine(config)
  return engineInstance
}

export function getEngine(): Engine {
  if (!engineInstance) {
    throw new Error('Engine not initialized. Call createEngine() first.')
  }
  return engineInstance
}

export function destroyEngine(): void {
  if (engineInstance) {
    engineInstance.stop()
    engineInstance = null
    logger.info('[Engine] Instance destroyed')
  }
}

export { Engine }
