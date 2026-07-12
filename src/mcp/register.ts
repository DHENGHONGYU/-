/**
 * MCP Server 配置驱动注册与热更新
 *
 * @description
 * 从 `src/config/mcpServerRegistry.ts` 读取 Server 清单，
 * 通过 import.meta.glob (eager) 同步加载模块并按配置自动注册到 MCPRegistry。
 *
 * 核心能力：
 *   - 副作用导入 `import '@/mcp/register'` → 同步全量注册（向后兼容）
 *   - `syncWithConfig()` → 增量同步（配置变更后调用，添加/移除 Server）
 *
 * @module mcp/register
 */

import { mcpRegistry } from '@/mcp/core/registry'
import { MCP_SERVER_REGISTRY, type MCPServerModule } from '@/config/mcpServerRegistry'
import { getLogger } from '@/lib/logger'
import type { MCPServer } from '@/types/modules/mcp.types'

const logger = getLogger()

// ============================================================
// Vite 静态模块扫描（构建时确定所有 Server 模块，eager 同步加载）
// ============================================================

/**
 * 使用 import.meta.glob (eager) 同步加载所有 Server 模块
 *
 * Vite 在构建时静态分析 glob 模式，将匹配文件打包。
 * eager: true 确保导入时所有模块已同步加载，可直接访问导出。
 */
const serverModules = import.meta.glob<MCPServerModule>(
  './servers/**/*.ts',
  { eager: true },
)

/**
 * 将配置中的 modulePath（@/别名路径）映射为 glob key（相对路径）
 *
 * 例：`@/mcp/servers/fetcher/dataFetcherServer` → `./servers/fetcher/dataFetcherServer.ts`
 */
function configPathToGlobKey(modulePath: string): string {
  return modulePath.replace(/^@\/mcp\//, './').replace(/\.ts$/, '') + '.ts'
}

/**
 * 从预加载模块中实例化 Server
 *
 * @param modulePath - 配置中的模块路径（@/别名格式）
 * @param exportName - 导出类名
 * @returns MCPServer 实例，加载失败返回 null
 */
function instantiateServer(
  modulePath: string,
  exportName: string,
): MCPServer | null {
  const globKey = configPathToGlobKey(modulePath)
  const mod = serverModules[globKey]

  if (!mod) {
    logger.error(`[MCP:register] module not found in glob: ${globKey}`, {
      originalPath: modulePath,
      availableKeys: Object.keys(serverModules),
    })
    return null
  }

  try {
    const ServerCtor = mod[exportName]
    if (typeof ServerCtor !== 'function') {
      logger.error(`[MCP:register] export "${exportName}" not found in ${globKey}`)
      return null
    }

    const instance = new ServerCtor() as MCPServer

    if (!instance.info || !instance.listTools) {
      logger.error(`[MCP:register] "${exportName}" does not implement MCPServer interface`)
      return null
    }

    return instance
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[MCP:register] failed to instantiate ${globKey}`, { error: message })
    return null
  }
}

// ============================================================
// 全量注册（同步）
// ============================================================

/**
 * 从配置清单全量注册所有 MCP Server
 *
 * 按配置顺序依次实例化并注册，跳过 enabled: false 的条目。
 * 使用 eager glob 确保同步完成，适合副作用导入。
 */
export function registerAllServers(): void {
  logger.info('[MCP:register] starting config-driven registration...', {
    totalEntries: MCP_SERVER_REGISTRY.length,
    enabledEntries: MCP_SERVER_REGISTRY.filter((e) => e.enabled).length,
    availableModules: Object.keys(serverModules).length,
  })

  for (const entry of MCP_SERVER_REGISTRY) {
    if (!entry.enabled) {
      logger.info(`[MCP:register] skipped (disabled): ${entry.name}`)
      continue
    }

    const server = instantiateServer(entry.modulePath, entry.exportName)
    if (server) {
      mcpRegistry.register(server, { priority: entry.priority })
    }
  }

  const stats = mcpRegistry.getStats()
  logger.info('[MCP:register] registration complete', stats)
}

// ============================================================
// 增量同步（热更新）
// ============================================================

/**
 * 增量同步：对比配置清单与当前 Registry，执行最小变更
 *
 * 操作逻辑：
 *   1. 配置中存在但 Registry 中不存在 → 新增注册
 *   2. Registry 中存在但配置中不存在 → 注销
 *   3. 配置中 enabled: false 但 Registry 中存在 → 注销
 *   4. 其余情况 → 跳过（不重复注册）
 *
 * @returns 同步结果摘要
 */
export function syncWithConfig(): SyncResult {
  const result: SyncResult = { added: [], removed: [], skipped: [], failed: [] }

  const configNames = new Set<string>()
  const registeredNames = new Set(
    mcpRegistry.listServers().map((rs) => rs.server.info.name),
  )

  // Step 1: 处理配置中的条目
  for (const entry of MCP_SERVER_REGISTRY) {
    configNames.add(entry.name)
    const isRegistered = registeredNames.has(entry.name)

    if (!entry.enabled) {
      handleDisabledEntry(entry, isRegistered, result)
      continue
    }

    if (!isRegistered) {
      handleNewEntry(entry, result)
      continue
    }

    result.skipped.push(entry.name)
  }

  // Step 2: 注销 Registry 中存在但配置中不存在的 Server
  for (const name of registeredNames) {
    if (configNames.has(name)) continue
    mcpRegistry.unregister(name)
    result.removed.push(name)
    logger.info(`[MCP:sync] not in config & unregistered: ${name}`)
  }

  logger.info('[MCP:sync] complete', {
    added: result.added.length,
    removed: result.removed.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
  })

  return result
}

function handleDisabledEntry(
  entry: (typeof MCP_SERVER_REGISTRY)[number],
  isRegistered: boolean,
  result: SyncResult,
): void {
  if (!isRegistered) return
  mcpRegistry.unregister(entry.name)
  result.removed.push(entry.name)
  logger.info(`[MCP:sync] disabled & unregistered: ${entry.name}`)
}

function handleNewEntry(entry: (typeof MCP_SERVER_REGISTRY)[number], result: SyncResult): void {
  const server = instantiateServer(entry.modulePath, entry.exportName)
  if (server) {
    mcpRegistry.register(server, { priority: entry.priority })
    result.added.push(entry.name)
  } else {
    result.failed.push(entry.name)
  }
}

/** 增量同步结果 */
export interface SyncResult {
  /** 新增注册的 Server 名称 */
  added: string[]
  /** 注销的 Server 名称 */
  removed: string[]
  /** 已存在跳过的 Server 名称 */
  skipped: string[]
  /** 加载失败的 Server 名称 */
  failed: string[]
}

// ============================================================
// 自动注册（副作用导入兼容）
// ============================================================

/**
 * 副作用导入时自动触发全量注册
 * 保留与原 register.ts 的向后兼容：`import '@/mcp/register'`
 */
registerAllServers()
