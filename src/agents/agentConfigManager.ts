/**
 * @module AgentConfigManager
 * @lifecycle @Global
 * @description Agent 配置管理中心，负责默认配置、运行时覆盖、配置校验与变更广播
  * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-FRONT-020]
*/

import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { AgentConfig } from './agentRuntime'

const logger = getLogger()

export interface AgentConfigOverride {
  defaultTimeout?: number
  maxConcurrent?: number
  enabled?: boolean
  customMeta?: Record<string, unknown>
}

export interface AgentConfigSnapshot {
  agentId: string
  base: AgentConfig
  override: AgentConfigOverride
  merged: AgentConfig & { enabled: boolean; customMeta: Record<string, unknown> }
  updatedAt: number
}

export class AgentConfigManager {
  private defaults = new Map<string, AgentConfig>()
  private overrides = new Map<string, AgentConfigOverride>()

  setDefault(agentId: string, config: AgentConfig): void {
    logger.debug(`[AgentConfigManager] setDefault() agentId="${agentId}"`)
    this.defaults.set(agentId, config)
    eventBus.emit('AGENT_CONFIG_DEFAULT_SET', { agentId })
    logger.info(`[AgentConfigManager] Default config set for agent "${agentId}"`)
  }

  getDefault(agentId: string): AgentConfig | undefined {
    return this.defaults.get(agentId)
  }

  setOverride(agentId: string, override: AgentConfigOverride): void {
    logger.debug(`[AgentConfigManager] setOverride() agentId="${agentId}"`)
    const existing = this.overrides.get(agentId) ?? {}
    this.overrides.set(agentId, { ...existing, ...override, customMeta: { ...existing.customMeta, ...override.customMeta } })
    eventBus.emit('AGENT_CONFIG_OVERRIDE_UPDATED', { agentId, override })
    logger.info(`[AgentConfigManager] Override updated for agent "${agentId}"`)
  }

  getOverride(agentId: string): AgentConfigOverride | undefined {
    return this.overrides.get(agentId)
  }

  removeOverride(agentId: string): boolean {
    logger.debug(`[AgentConfigManager] removeOverride() agentId="${agentId}"`)
    const removed = this.overrides.delete(agentId)
    if (removed) {
      eventBus.emit('AGENT_CONFIG_OVERRIDE_REMOVED', { agentId })
      logger.info(`[AgentConfigManager] Override removed for agent "${agentId}"`)
    }
    return removed
  }

  getMergedConfig(agentId: string): AgentConfigSnapshot | null {
    const base = this.defaults.get(agentId)
    if (!base) {
      logger.warn(`[AgentConfigManager] getMergedConfig() failed: no default for "${agentId}"`)
      return null
    }

    const override = this.overrides.get(agentId) ?? {}
    const merged: AgentConfigSnapshot['merged'] = {
      ...base,
      defaultTimeout: override.defaultTimeout ?? base.defaultTimeout,
      maxConcurrent: override.maxConcurrent ?? base.maxConcurrent,
      enabled: override.enabled ?? true,
      customMeta: override.customMeta ?? {},
    }

    return {
      agentId,
      base,
      override,
      merged,
      updatedAt: Date.now(),
    }
  }

  validateConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.id || config.id.trim().length === 0) {
      errors.push('agentId is required')
    }
    if (!config.name || config.name.trim().length === 0) {
      errors.push('name is required')
    }
    if (config.defaultTimeout <= 0) {
      errors.push('defaultTimeout must be greater than 0')
    }
    if (config.maxConcurrent <= 0) {
      errors.push('maxConcurrent must be greater than 0')
    }

    const valid = errors.length === 0
    if (!valid) {
      logger.warn(`[AgentConfigManager] Validation failed for "${config.id}":`, { errors })
    }

    return { valid, errors }
  }

  getAllSnapshot(): AgentConfigSnapshot[] {
    const snapshots: AgentConfigSnapshot[] = []
    for (const agentId of this.defaults.keys()) {
      const snapshot = this.getMergedConfig(agentId)
      if (snapshot) snapshots.push(snapshot)
    }
    return snapshots
  }

  getStats() {
    return {
      defaults: this.defaults.size,
      overrides: this.overrides.size,
    }
  }
}

// Singleton
let configManagerInstance: AgentConfigManager | null = null

export function createAgentConfigManager(): AgentConfigManager {
  if (configManagerInstance) return configManagerInstance
  configManagerInstance = new AgentConfigManager()
  return configManagerInstance
}

export function getAgentConfigManager(): AgentConfigManager {
  configManagerInstance ??= new AgentConfigManager()
  return configManagerInstance
}

export function destroyAgentConfigManager(): void {
  configManagerInstance = null
  logger.info('[AgentConfigManager] Instance destroyed')
}
