/**
 * MCP 全局注册中心
 *
 * @description
 * 管理所有 MCP Server 的注册、查找、启停。
 * 支持按优先级排序，按名称查找，支持启用/禁用。
 *
 * @module mcp/core/registry
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import { getLogger } from '@/lib/logger'
import type { MCPServer, ServerRegistrationOptions, RegisteredServer } from '@/types/modules/mcp.types'

const logger = getLogger()

/** 优先级排序权重 */
const PRIORITY_ORDER: Record<ServerRegistrationOptions['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/** MCP 全局注册中心 —— 单例模式 */
export class MCPRegistry {
  /** 已注册的 Server 映射 */
  private servers: Map<string, RegisteredServer> = new Map()

  /** 注册 Server */
  register(server: MCPServer, options: ServerRegistrationOptions): void {
    const name = server.info.name

    if (this.servers.has(name)) {
      logger.warn(`[MCPRegistry] server already registered: ${name}, replacing`)
    }

    this.servers.set(name, {
      server,
      options: { ...options, enabled: options.enabled ?? true },
      registeredAt: Date.now(),
    })

    logger.info(`[MCPRegistry] register() server: ${name}`, {
      priority: options.priority,
      version: server.info.version,
      tools: server.listTools().length,
      resources: server.listResources().length,
      prompts: server.listPrompts().length,
    })

    // 发送工具列表变更通知
    import('./notification').then(({ notificationManager: nm }) => {
      nm.emit('notifications/tools/list_changed', { serverName: server.info.name })
    })
  }

  /** 注销 Server */
  unregister(serverName: string): boolean {
    const existed = this.servers.has(serverName)
    if (existed) {
      this.servers.delete(serverName)
      logger.info(`[MCPRegistry] unregister() server: ${serverName}`)

      // 发送工具列表变更通知
      import('./notification').then(({ notificationManager: nm }) => {
        nm.emit('notifications/tools/list_changed', { serverName })
      })
    }
    return existed
  }

  /** 获取指定 Server */
  getServer(serverName: string): RegisteredServer | undefined {
    return this.servers.get(serverName)
  }

  /** 列出所有已注册的 Server（按优先级排序） */
  listServers(): RegisteredServer[] {
    const entries = Array.from(this.servers.values())
    entries.sort((a, b) => PRIORITY_ORDER[a.options.priority] - PRIORITY_ORDER[b.options.priority])
    return entries
  }

  /** 启用/禁用 Server */
  setEnabled(serverName: string, enabled: boolean): boolean {
    const entry = this.servers.get(serverName)
    if (!entry) {
      logger.error(`[MCPRegistry] setEnabled() server not found: ${serverName}`)
      return false
    }
    entry.options.enabled = enabled
    logger.info(`[MCPRegistry] setEnabled() server: ${serverName}, enabled=${enabled}`)
    return true
  }

  /** 获取注册统计信息 */
  getStats(): { totalServers: number; enabledServers: number; totalTools: number; totalResources: number; totalPrompts: number } {
    const entries = Array.from(this.servers.values())
    const enabled = entries.filter((e) => e.options.enabled !== false)

    let totalTools = 0
    let totalResources = 0
    let totalPrompts = 0

    for (const entry of enabled) {
      totalTools += entry.server.listTools().length
      totalResources += entry.server.listResources().length
      totalPrompts += entry.server.listPrompts().length
    }

    return {
      totalServers: entries.length,
      enabledServers: enabled.length,
      totalTools,
      totalResources,
      totalPrompts,
    }
  }
}

/** 全局单例注册中心 */
export const mcpRegistry = new MCPRegistry()