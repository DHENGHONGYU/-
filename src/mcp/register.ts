/**
 * MCP Server 配置驱动注册与热更新
 *
 * @description
 * 从 `src/config/mcpServerRegistry.ts` 读取 Server 清单，
 * 通过 import.meta.glob (lazy) 按需加载模块并按配置自动注册到 MCPRegistry。
 *
 * 核心能力：
 *   - `mcpReadyPromise` → 核心 Server 注册完成后 resolve，供 Agent 系统 await
 *   - `registerLazyServers()` → 后台加载非核心 Server，不阻塞首屏
 *   - `syncWithConfig()` → 增量同步（配置变更后调用，添加/移除 Server）
 *
 * @module mcp/register
 * @doc [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-021, V9-DOC-AI-022]
*/

import { mcpRegistry } from '@/mcp/core/registry'
import { MCP_SERVER_REGISTRY, type MCPServerConfigEntry, type MCPServerModule } from '@/config/mcpServerRegistry'
import type { RegisteredServer } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import type { MCPServer } from '@/types/modules/mcp.types'

const logger = getLogger()
const _mcpImportTs = Date.now()

// ============================================================
// Vite 静态模块扫描（lazy 模式，避免首屏加载所有 Server 模块）
// ============================================================

/**
 * 使用 import.meta.glob (lazy) 动态加载 Server 模块
 *
 * Vite 在构建时静态分析 glob 模式，将匹配文件打包为动态 import。
 * eager: false 确保模块不被首屏加载，仅在调用 loader 时才加载。
 */
const serverModuleLoaders = import.meta.glob<MCPServerModule>(
  './servers/**/*.ts',
  { eager: false },
)
logger.info(`[MCP:register] ▶ import.meta.glob(lazy) prepared ${Object.keys(serverModuleLoaders).length} module loaders`)

/** 缓存已加载的模块，避免重复 import */
const loadedModuleCache = new Map<string, MCPServerModule>()

/**
 * 将配置中的 modulePath（@/别名路径）映射为 glob key（相对路径）
 *
 * 例：`@/mcp/servers/fetcher/dataFetcherServer` → `./servers/fetcher/dataFetcherServer.ts`
 */
function configPathToGlobKey(modulePath: string): string {
  return modulePath.replace(/^@\/mcp\//, './').replace(/\.ts$/, '') + '.ts'
}

/**
 * 懒加载指定模块并缓存
 *
 * @param globKey - glob 匹配的相对路径
 * @returns 模块导出对象，加载失败返回 null
 */
async function loadModule(globKey: string): Promise<MCPServerModule | null> {
  if (loadedModuleCache.has(globKey)) {
    return loadedModuleCache.get(globKey)!
  }

  const loader = serverModuleLoaders[globKey]
  if (!loader) {
    logger.error(`[MCP:register] no loader for glob key: ${globKey}`, {
      availableKeys: Object.keys(serverModuleLoaders),
    })
    return null
  }

  try {
    const mod = (await loader())
    loadedModuleCache.set(globKey, mod)
    return mod
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[MCP:register] failed to load module ${globKey}`, { error: message })
    return null
  }
}

/**
 * 从已加载模块中实例化 Server（同步版本，用于已缓存模块）
 *
 * @param modulePath - 配置中的模块路径（@/别名格式）
 * @param exportName - 导出类名
 * @param mod - 已加载的模块对象
 * @returns MCPServer 实例，加载失败返回 null
 */
function instantiateFromModule(
  modulePath: string,
  exportName: string,
  mod: MCPServerModule,
): MCPServer | null {
  try {
    const ServerCtor = mod[exportName]
    if (typeof ServerCtor !== 'function') {
      logger.error(`[MCP:register] export "${exportName}" not found in ${modulePath}`)
      return null
    }

    const instance = new ServerCtor() as MCPServer

     
    if ((instance.info ?? null) === null || (instance.listTools ?? null) === null) {
      logger.error(`[MCP:register] "${exportName}" does not implement MCPServer interface`)
      return null
    }

    return instance
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[MCP:register] failed to instantiate ${modulePath}`, { error: message })
    return null
  }
}

/**
 * 异步实例化 Server（懒加载 + 实例化）
 *
 * @param entry - Server 配置条目
 * @returns MCPServer 实例，加载失败返回 null
 */
async function instantiateServerAsync(
  entry: MCPServerConfigEntry,
): Promise<MCPServer | null> {
  const globKey = configPathToGlobKey(entry.modulePath)
  const mod = await loadModule(globKey)
  if (!mod) return null
  return instantiateFromModule(entry.modulePath, entry.exportName, mod)
}

// ============================================================
// 分阶段注册：核心 Server 先注册，非核心 Server 懒加载
// ============================================================

/** 已注册的非核心 Server 条目（用于 lazy 加载） */
let lazyEntries: MCPServerConfigEntry[] | null = null

/** 懒加载注册互斥锁，防止重复调用 */
let lazyRegistrationStarted = false

/**
 * 注册核心 Server（enabled + !lazy）
 *
 * 核心 Server 阻塞后续 Agent 初始化，必须先完成。
 * 通过 mcpReadyPromise 对外暴露完成信号。
 */
async function registerCoreServers(): Promise<void> {
  const _regStart = performance.now()

  // 分离核心和非核心条目
  const coreEntries: MCPServerConfigEntry[] = []
  const lazyList: MCPServerConfigEntry[] = []
  let _skipped = 0

  for (const entry of MCP_SERVER_REGISTRY) {
    if (!entry.enabled) {
      _skipped++
      logger.info(`[MCP:register] ⏭ SKIP disabled server: ${entry.name} (module=${entry.modulePath})`)
      continue
    }
    if (entry.lazy) {
      lazyList.push(entry)
      logger.info(`[MCP:register] 📦 QUEUE lazy server: ${entry.name} (module=${entry.modulePath}, priority=${entry.priority})`)
    } else {
      coreEntries.push(entry)
      logger.info(`[MCP:register] 🔧 QUEUE core server: ${entry.name} (module=${entry.modulePath}, priority=${entry.priority})`)
    }
  }

  // 缓存 lazy 条目供后续 registerLazyServers() 使用
  lazyEntries = lazyList.length > 0 ? lazyList : null

  logger.info(`[MCP:register] ▶ core registration starting: ${coreEntries.length} core + ${lazyList.length} lazy (skipped=${_skipped})`, {
    coreCount: coreEntries.length,
    lazyCount: lazyList.length,
    skippedCount: _skipped,
  })

  // 逐个加载并注册核心 Server（含单条耗时）
  let _registered = 0
  let _failed = 0
  for (const entry of coreEntries) {
    const _srvStart = performance.now()
    logger.info(`[MCP:register]   loading core server: ${entry.name} ← ${entry.modulePath}`)
    try {
      const server = await instantiateServerAsync(entry)
      if (server) {
        mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
        _registered++
        const _srvElapsed = (performance.now() - _srvStart).toFixed(1)
        logger.info(`[MCP:register]   ✅ registered: ${entry.name} (${_srvElapsed}ms, tools=${server.listTools().length})`)
      } else {
        _failed++
        logger.error(`[MCP:register]   ❌ instantiation failed (null): ${entry.name}`)
      }
    } catch (err) {
      _failed++
      logger.error(`[MCP:register]   ❌ exception loading ${entry.name}: ${String(err)}`)
    }
  }

  const stats = mcpRegistry.getStats()
  const _regElapsed = (performance.now() - _regStart).toFixed(1)
  logger.info(`[MCP:register] ▶ CORE REGISTRATION COMPLETE: ${_registered}/${coreEntries.length} servers in ${_regElapsed}ms (failed=${_failed})`, stats)
}

/**
 * 后台注册非核心 Server
 *
 * 非核心 Server 不阻塞首屏和 Agent 初始化，
 * 在核心注册完成后异步加载。
 *
 * @returns 已注册的非核心 Server 数量
 */
export async function registerLazyServers(): Promise<number> {
  if (lazyRegistrationStarted) {
    logger.info('[MCP:register] ⏭ lazy registration already started, skip (mutex guard)')
    return 0
  }
  if (!lazyEntries || lazyEntries.length === 0) {
    logger.info('[MCP:register] ⏭ no lazy entries to register (all core or disabled)')
    return 0
  }
  lazyRegistrationStarted = true

  const _lazyStart = performance.now()
  const entries = lazyEntries
  logger.info(`[MCP:register] ▶ lazy registration starting: ${entries.length} non-core servers...`)

  let registered = 0
  let _failed = 0
  for (const entry of entries) {
    const _srvStart = performance.now()
    logger.info(`[MCP:register]   loading lazy server: ${entry.name} ← ${entry.modulePath}`)
    try {
      const server = await instantiateServerAsync(entry)
      if (server) {
        mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
        registered++
        const _srvElapsed = (performance.now() - _srvStart).toFixed(1)
        logger.info(`[MCP:register]   ✅ registered: ${entry.name} (${_srvElapsed}ms, tools=${server.listTools().length})`)
      } else {
        _failed++
        logger.error(`[MCP:register]   ❌ instantiation failed (null): ${entry.name}`)
      }
    } catch (err) {
      _failed++
      logger.error(`[MCP:register]   ❌ exception loading ${entry.name}: ${String(err)}`)
    }
  }

  const totalLazy = entries.length
  lazyEntries = null
  const _lazyElapsed = (performance.now() - _lazyStart).toFixed(1)
  logger.info(`[MCP:register] ▶ lazy registration complete: ${registered}/${totalLazy} servers in ${_lazyElapsed}ms (failed=${_failed})`,
    mcpRegistry.getStats())

  if (fullyReadyResolver) {
    fullyReadyResolver()
    fullyReadyResolver = null
  }
  logger.info(`[MCP:register] ▶ FULL REGISTRATION COMPLETE (total=${Date.now() - _mcpImportTs}ms from import)`)

  return registered
}

// ============================================================
// 对外信号：mcpReadyPromise
// ============================================================

let mcpReadyResolver: (() => void) | null = null

/**
 * 核心 Server 就绪信号
 *
 * Agent 系统初始化通过 `await mcpReadyPromise` 等待核心 MCP Server 注册完成。
 * 非核心 Server 的加载不影响此 Promise。
 */
export const mcpReadyPromise: Promise<void> = new Promise<void>((resolve) => {
  mcpReadyResolver = resolve
})

/**
 * 全量 Server 就绪信号（含 lazy 加载）
 *
 * 供需要所有 Server 都就绪的场景使用（如全量工具列表导出）。
 */
let fullyReadyResolver: (() => void) | null = null
export const mcpFullyReadyPromise: Promise<void> = new Promise<void>((resolve) => {
  fullyReadyResolver = resolve
})

// ============================================================
// 兼容同步调用场景
// ============================================================

/**
 * 从配置清单全量注册所有 MCP Server（同步版本，兼容旧调用方）
 *
 * 注意：此函数会阻塞直到所有 Server（包括 lazy）都注册完成。
 * 新代码建议使用 `ensureMCPRegistered()` + `mcpReadyPromise` 组合。
 */
export function registerAllServers(): void {
  const _regStart = performance.now()

  for (const entry of MCP_SERVER_REGISTRY) {
    if (!entry.enabled) continue

    const globKey = configPathToGlobKey(entry.modulePath)
    const mod = loadedModuleCache.get(globKey)
    if (!mod) {
      logger.warn(`[MCP:register] module not cached, skipping sync register: ${globKey}`)
      continue
    }

    const server = instantiateFromModule(entry.modulePath, entry.exportName, mod)
    if (server) {
      mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
    }
  }

  const stats = mcpRegistry.getStats()
  const _regElapsed = (performance.now() - _regStart).toFixed(1)
  logger.info(`[MCP:register] sync registration complete (${_regElapsed}ms)`, stats)
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
 *   1. 配置中存在且enabled但Registry中不存在（按modulePath）→ 新增注册
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
  const registeredByModulePath = new Map<string, RegisteredServer>()
  for (const rs of mcpRegistry.listServers()) {
    const mp = rs.options.modulePath
    if ((mp ?? '') !== '') registeredByModulePath.set(mp!, rs)
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
      // 尝试从缓存加载模块进行同步注册
      const globKey = configPathToGlobKey(entry.modulePath)
      const mod = loadedModuleCache.get(globKey)
      if (mod) {
        const server = instantiateFromModule(entry.modulePath, entry.exportName, mod)
        if (server) {
          mcpRegistry.register(server, { priority: entry.priority, modulePath: entry.modulePath })
          result.added.push(entry.modulePath)
          logger.info(`[MCP:sync] added: ${entry.modulePath}`)
        } else {
          result.failed.push(entry.modulePath)
        }
      } else {
        result.skipped.push(entry.modulePath)
      }
      continue
    }

    result.skipped.push(entry.modulePath)
  }

  // Step 2: 注销配置中已不存在的 Server
  for (const [mp, rs] of registeredByModulePath) {
    if (configByModulePath.has(mp)) continue
    mcpRegistry.unregister(rs.server.info.name)
    result.removed.push(mp)
    logger.info(`[MCP:sync] not in config & unregistered: ${mp}`)
  }

  // Step 3: 防御性不变量
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
  added: string[]
  removed: string[]
  skipped: string[]
  failed: string[]
  mismatched: string[]
}

// ============================================================
// 延迟触发注册（由 Agent 系统首次交互时调用）
// ============================================================

let autoRegistered = false

/**
 * 触发 MCP Server 注册（核心 + 后台非核心）
 *
 * 调用后：
 * 1. 核心 Server 立即加载并注册 → `mcpReadyPromise` resolve
 * 2. 非核心 Server 在后台异步加载 → `mcpFullyReadyPromise` resolve
 *
 * 幂等：多次调用仅执行一次。
 */
export function ensureMCPRegistered(): void {
  if (autoRegistered) {
    logger.info('[MCP:register] ⏭ already registered, skip (idempotent guard)')
    return
  }
  autoRegistered = true
  const elapsed = Date.now() - _mcpImportTs
  logger.info(`[MCP:register] ▶ TRIGGER REGISTER (import→elapsed=${elapsed}ms)`)

  // 1. 注册核心 Server（阻塞 Promise 链）
  const _coreStart = performance.now()
  logger.info('[MCP:register]   starting core server registration (blocking)...')
  registerCoreServers()
    .then(() => {
      const _coreElapsed = (performance.now() - _coreStart).toFixed(1)
      logger.info(`[MCP:register]   ✅ core registration promise resolved in ${_coreElapsed}ms`)
      if (mcpReadyResolver) {
        mcpReadyResolver()
        mcpReadyResolver = null
      }
      logger.info(`[MCP:register] ▶ CORE REGISTRATION COMPLETE (total=${Date.now() - _mcpImportTs}ms from import)`)
    })
    .catch((err) => {
      logger.error('[MCP:register]   ❌ core registration failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined })
      if (mcpReadyResolver) {
        mcpReadyResolver()
        mcpReadyResolver = null
      }
    })

  // 2. 后台注册非核心 Server（不阻塞）
  logger.info('[MCP:register]   starting lazy server registration (background)...')
  const _lazyStart = performance.now()
  registerLazyServers()
    .then((count) => {
      const _lazyElapsed = (performance.now() - _lazyStart).toFixed(1)
      logger.info(`[MCP:register]   ✅ lazy registration resolved: ${count} servers in ${_lazyElapsed}ms`)
    })
    .catch((err) => {
      logger.error('[MCP:register]   ❌ lazy registration failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined })
      if (fullyReadyResolver) {
        fullyReadyResolver()
        fullyReadyResolver = null
      }
    })
}

// 模块加载日志
logger.info(`[MCP:register] ⧉ MODULE LOADED at ${new Date(_mcpImportTs).toISOString()} (dev=${import.meta.env.DEV})`)
logger.info('[MCP:register] ⧉ Waiting for trigger...')