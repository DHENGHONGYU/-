/**
 * @module mcpServerStore
 * @description MCP Server 管理 Store — Server 列表、启用/禁用、统计数据
 * @created 2026-07-04
  * @doc [V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-DATA-031, V9-DOC-AI-013, V9-DOC-DATA-032]
*/

import { create } from 'zustand'
import { mcpRegistry } from '@/mcp/core/registry'
import { getLogger } from '@/lib/logger'
import type { MCPServerDashboardEntry } from '@/types/modules/mcp.types'

const logger = getLogger()

interface MCPServerState {
  servers: MCPServerDashboardEntry[]
  isLoading: boolean
  error: string | null

  refreshServers: () => void
  toggleServer: (name: string, enabled: boolean) => void
}

/**
 * useMCPServerStore
 */
export const useMCPServerStore = create<MCPServerState>((set, get) => ({
  servers: [],
  isLoading: false,
  error: null,

  refreshServers: () => {
    set({ isLoading: true, error: null })
    try {
      const allServers = mcpRegistry.listServers()
      const entries: MCPServerDashboardEntry[] = allServers.map((s) => ({
        serverName: s.server.info.name,
        version: s.server.info.version,
        description: s.server.info.description,
        priority: s.options.priority,
        enabled: s.options.enabled !== false,
        toolCount: s.server.listTools().length,
        resourceCount: s.server.listResources().length,
        promptCount: s.server.listPrompts().length,
        registeredAt: s.registeredAt,
        dependencies: s.server.info.dependencies ?? [],
      }))
      set({ servers: entries, isLoading: false })
      logger.info('[MCPServerStore] Servers refreshed', { count: entries.length })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      logger.error('[MCPServerStore] Failed to refresh', { error: String(error) })
    }
  },

  toggleServer: (name, enabled) => {
    try {
      mcpRegistry.setEnabled(name, enabled)
      get().refreshServers()
      logger.info('[MCPServerStore] Server toggled', { name, enabled })
    } catch (error) {
      logger.error('[MCPServerStore] Toggle failed', { name, error: String(error) })
    }
  },
}))