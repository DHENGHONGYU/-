/**
 * @module AgentRegistry
 * @lifecycle @Global
 * @description Agent 注册表模块，集中管理 Agent 定义、实例化与生命周期
 */

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { AgentConfig } from './agentRuntime'

const logger = getLogger()

export interface AgentRegistryEntry {
  config: AgentConfig
  registeredAt: number
  instanceCount: number
  tags: string[]
}

export class AgentRegistry {
  private agents = new Map<string, AgentRegistryEntry>()
  private tags = new Map<string, Set<string>>()

  register(config: AgentConfig, tags: string[] = []): void {
    logger.debug(`[AgentRegistry] register() agentId="${config.id}"`)

    if (this.agents.has(config.id)) {
      logger.warn(`[AgentRegistry] Agent "${config.id}" already registered, updating config`)
    }

    this.agents.set(config.id, {
      config,
      registeredAt: Date.now(),
      instanceCount: 0,
      tags,
    })

    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set())
      }
      this.tags.get(tag)!.add(config.id)
    }

    eventBus.emit('AGENT_REGISTERED', { agentId: config.id, tags })
    logger.info(`[AgentRegistry] Agent "${config.id}" registered with tags: [${tags.join(', ')}]`)
  }

  unregister(agentId: string): boolean {
    logger.debug(`[AgentRegistry] unregister() agentId="${agentId}"`)

    const entry = this.agents.get(agentId)
    if (!entry) {
      logger.warn(`[AgentRegistry] Unregister failed: Agent "${agentId}" not found`)
      return false
    }

    for (const tag of entry.tags) {
      this.tags.get(tag)?.delete(agentId)
      if (this.tags.get(tag)?.size === 0) {
        this.tags.delete(tag)
      }
    }

    this.agents.delete(agentId)
    eventBus.emit('AGENT_UNREGISTERED', { agentId })
    logger.info(`[AgentRegistry] Agent "${agentId}" unregistered`)
    return true
  }

  get(agentId: string): AgentRegistryEntry | undefined {
    return this.agents.get(agentId)
  }

  getAll(): AgentRegistryEntry[] {
    return Array.from(this.agents.values())
  }

  getByTag(tag: string): AgentRegistryEntry[] {
    const ids = this.tags.get(tag)
    if (!ids) return []
    return Array.from(ids).map((id) => this.agents.get(id)!).filter(Boolean)
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId)
  }

  getStats() {
    return {
      total: this.agents.size,
      tags: this.tags.size,
      agentIds: Array.from(this.agents.keys()),
    }
  }

  incrementInstance(agentId: string): void {
    const entry = this.agents.get(agentId)
    if (entry) {
      entry.instanceCount++
    }
  }

  decrementInstance(agentId: string): void {
    const entry = this.agents.get(agentId)
    if (entry && entry.instanceCount > 0) {
      entry.instanceCount--
    }
  }
}

// Singleton
let registryInstance: AgentRegistry | null = null

export function createAgentRegistry(): AgentRegistry {
  if (registryInstance) return registryInstance
  registryInstance = new AgentRegistry()
  return registryInstance
}

export function getAgentRegistry(): AgentRegistry {
  registryInstance ??= new AgentRegistry()
  return registryInstance
}

export function destroyAgentRegistry(): void {
  registryInstance = null
  logger.info('[AgentRegistry] Instance destroyed')
}
