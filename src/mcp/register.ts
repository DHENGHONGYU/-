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
import type { RegisteredServer } from '@/types/modules/mcp.types'
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
      mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
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
 * 比对键采用 `modulePath`（配置条目的稳定身份），而非 Server 的 `info.name`，
 * 因为配置 `name` 字段（如 `llm:main`）与 Server 实例 `info.name`（如 `llm`）
 * 可能不一致。若按 `info.name` 比对，热更新时会误将全部 Server 注销（F2 根因）。
 *
 * 操作逻辑：
 *   1. 配置中存在且 enabled 但 Registry 中不存在（按 modulePath）→ 新增注册
 *   2. Registry 中存在但配置中不存在 → 注销
 *   3. 配置中 enabled: false 且 Registry 中存在 → 注销
 *   4. 其余情况 → 跳过（不重复注册）
 *
 * @returns 同步结果摘要（含 mismatched 防御性告警）
 */
export function syncWithConfig(): SyncResult {
  const result: SyncResult = {
    added: [],
    removed: [],
    skipped: [],
    failed: [],
    mismatched: [],
  }

  // 以 modulePath 作为配置 ↔ 运行时注册表的稳定身份标识。
  // 避免依赖 Server.info.name 与配置 name 不一致（如 llm vs llm:main）
  // 导致 syncWithConfig 误将全部 Server 注销（F2 根因）。
  const registeredByModulePath = new Map<string, RegisteredServer>()
  for (const rs of mcpRegistry.listServers()) {
    const mp = rs.options.modulePath
    if (mp) registeredByModulePath.set(mp, rs)
  }

  const configByModulePath = new Map<string, (typeof MCP_SERVER_REGISTRY)[number]>()
  for (const e of MCP_SERVER_REGISTRY) configByModulePath.set(e.modulePath, e)

  // Step 1: 处理配置中的条目
  for (const entry of MCP_SERVER_REGISTRY) {
    const registered = registeredByModulePath.get(entry.modulePath)

    if (!entry.enabled) {
      if (registered) {
        mcpRegistry.unregister(registered.server.info.name)
        result.removed.push(entry.modulePath)
        logger.info(`[MCP:sync] disabled & unregistered: ${entry.modulePath}`)
      }
      continue
    }

    if (!registered) {
      const server = instantiateServer(entry.modulePath, entry.exportName)
      if (server) {
        mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
        result.added.push(entry.modulePath)
        logger.info(`[MCP:sync] added: ${entry.modulePath}`)
      } else {
        result.failed.push(entry.modulePath)
      }
      continue
    }

    result.skipped.push(entry.modulePath)
  }

  // Step 2: 注销配置中已不存在的 Server（按 modulePath 比对）
  for (const [mp, rs] of registeredByModulePath) {
    if (configByModulePath.has(mp)) continue
    mcpRegistry.unregister(rs.server.info.name)
    result.removed.push(mp)
    logger.info(`[MCP:sync] not in config & unregistered: ${mp}`)
  }

  // Step 3: 防御性不变量 —— 若注册表仍存在配置外无法归类的 Server，记录告警
  for (const mp of registeredByModulePath.keys()) {
    if (!configByModulePath.has(mp)) {
      result.mismatched.push(mp)
    }
  }

  logger.info('[MCP:sync] complete', {
    added: result.added.length,
    removed: result.removed.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    mismatched: result.mismatched.length,
  })

  return result
}

/** 增量同步结果 */
export interface SyncResult {
  /** 新增注册的 Server（modulePath） */
  added: string[]
  /** 注销的 Server（modulePath） */
  removed: string[]
  /** 已存在跳过的 Server（modulePath） */
  skipped: string[]
  /** 加载失败的 Server（modulePath） */
  failed: string[]
  /** 注册表与配置出现无法解释偏差的 Server（modulePath，防御性告警） */
  mismatched: string[]
}

// ============================================================
// 自动注册（副作用导入兼容）
// ============================================================

/**
 * 副作用导入时自动触发全量注册
 * 保留与原 register.ts 的向后兼容：`import '@/mcp/register'`
 */
registerAllServers()
