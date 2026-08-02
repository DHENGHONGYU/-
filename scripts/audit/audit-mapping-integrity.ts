#!/usr/bin/env tsx
/**
 * 映射完整性审计脚本 (v2.2 VERBOSE + 可测试版)
 *
 * v2.2 增强内容：
 *   V1. VERBOSE 模式：设置环境变量 AUDIT_VERBOSE=1 或 VERBOSE=1 时输出关键检测节点日志
 *       - N1 collectStoreMetas：列出所有发现的 Store 文件
 *       - N2 buildStoreDependencyGraph：输出 Store 间依赖图的每条边
 *       - N3 markFacadeStores：输出 Facade Store 识别结果及聚合的子Store
 *       - N4 findStoreConsumers：每个 Store 的直接消费者明细（含文件/行号/导入类型/testOnly）
 *       - N5 computeTransitiveReachability：BFS 起点、遍历路径、可达 Store 列表
 *       - N6 最终状态判定：每个 Store 的 used/unused 判定依据
 *   V2. export 关键函数：collectStoreMetas/buildStoreDependencyGraph/markFacadeStores/
 *       computeTransitiveReachability/findStoreConsumers/auditUnusedStores 全部 export，
 *       支持单元测试调用，无需解析 console.log 字符串。
 *
 * v2.0/v2.1 重构内容（保持）：
 * 1. 扩展搜索目录：新增 portal/store/services/core/lib/agents/mcp，修复 workflowStore 误报
 * 2. 多模式导入检测：支持绝对路径、相对路径(./ ../)、hook名引用，修复 Facade 子Store 误报
 * 3. Store间依赖图：构建有向图识别 Facade/委托模式，支持传递可达性分析
 * 4. 注释过滤：逐行解析排除 // 和 * 开头的注释行，避免注释引用造成反向假阳性
 * 5. 测试文件识别：.test.ts/.test.tsx 引用标记为 testOnly，不计入 used 判定
 * 6. 退出码分级：冗余Store仅警告，不阻断CI
 *
 * @created 2026-07-06
 * @refactored 2026-07-06 v2.0 修复Store依赖检测误报
 * @enhanced 2026-07-06 v2.1 BFS 算法修复
 * @enhanced 2026-07-06 v2.2 添加 VERBOSE 日志 + export 关键函数支持单测
 * @compliance AGENTS.md §一 分层规则
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

// ═══════════════════════════════════════════════════════════════════════════════
// VERBOSE 模式开关
// 启用方式（任一即可）：
//   1. 环境变量：AUDIT_VERBOSE=1 或 VERBOSE=1
//   2. 命令行参数：--verbose 或 -v
// ═══════════════════════════════════════════════════════════════════════════════

const VERBOSE =
  process.env.AUDIT_VERBOSE === '1' ||
  process.env.VERBOSE === '1' ||
  process.argv.includes('--verbose') ||
  process.argv.includes('-v')

// ═══════════════════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

// 颜色输出
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const BLUE = '\x1b[34m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function logError(msg: string): void {
  console.error(`${RED}✗${RESET} ${msg}`)
}

function logWarn(msg: string): void {
  console.warn(`${YELLOW}⚠${RESET} ${msg}`)
}

function logSuccess(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

function logInfo(msg: string): void {
  console.log(`${BLUE}ℹ${RESET} ${msg}`)
}

function logDetail(msg: string): void {
  console.log(`${CYAN}  →${RESET} ${msg}`)
}

/**
 * VERBOSE 模式下的详细日志输出
 * 启用方式：AUDIT_VERBOSE=1 或 VERBOSE=1
 * 输出前缀：[V] 标识，便于在大量日志中过滤
 */
function logVerbose(msg: string): void {
  if (VERBOSE) {
    console.log(`${CYAN}[V]${RESET} ${msg}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 审计项1: 路由注册完整性（保持不变）
// ═══════════════════════════════════════════════════════════════════════════════

interface RouteEntry {
  path: string
  category: string
  description: string
}

function extractRoutesFromConfig(): RouteEntry[] {
  const routesFile = join(SRC, 'config', 'routes.ts')
  const content = readFileSync(routesFile, 'utf-8')

  const routes: RouteEntry[] = []
  const routeRegex = /path:\s*['"]([^'"]+)['"][\s\S]*?category:\s*['"]([^'"]+)['"][\s\S]*?description:\s*['"]([^'"]+)['"]/g

  let match
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      path: match[1]!,
      category: match[2]!,
      description: match[3]!,
    })
  }

  return routes
}

function auditRouteRegistry(): { violations: string[]; stats: { total: number } } {
  logInfo('审计项1: 路由注册完整性')
  const violations: string[] = []
  const routes = extractRoutesFromConfig()

  logInfo(`  发现 ${routes.length} 条路由注册`)

  // 检查路由重复
  const pathSet = new Set<string>()
  for (const route of routes) {
    if (pathSet.has(route.path)) {
      violations.push(`路由重复注册: ${route.path}`)
    }
    pathSet.add(route.path)
  }

  // 检查舱室入口路由
  const cabinPaths = ['/input', '/analysis', '/trading', '/output', '/command']
  for (const cabin of cabinPaths) {
    if (!pathSet.has(cabin)) {
      violations.push(`缺少舱室入口路由: ${cabin}`)
    }
  }

  if (violations.length === 0) {
    logSuccess('路由注册完整性检查通过')
  } else {
    for (const v of violations) {
      logError(v)
    }
  }

  return { violations, stats: { total: routes.length } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 审计项2: App分发器路由覆盖（保持不变）
// ═══════════════════════════════════════════════════════════════════════════════

interface AppDispatchEntry {
  cabin: string
  routePath: string
  componentName: string
}

function extractAppDispatchers(): AppDispatchEntry[] {
  const entries: AppDispatchEntry[] = []

  const appFiles = [
    { cabin: 'input', file: join(SRC, 'apps', 'input', 'InputApp.tsx') },
    { cabin: 'analysis', file: join(SRC, 'apps', 'analysis', 'AnalysisApp.tsx') },
    { cabin: 'trading', file: join(SRC, 'apps', 'trading', 'TradingApp.tsx') },
    { cabin: 'output', file: join(SRC, 'apps', 'output', 'OutputApp.tsx') },
    { cabin: 'command', file: join(SRC, 'apps', 'command', 'CommandApp.tsx') },
    { cabin: 'agent', file: join(SRC, 'apps', 'command', 'AgentApp.tsx') },
  ]

  for (const { cabin, file } of appFiles) {
    if (!existsSync(file)) continue

    const content = readFileSync(file, 'utf-8')

    // 匹配路径条件分支
    const pathRegex = /path\s*===?\s*['"]([^'"]+)['"]/g
    let match
    while ((match = pathRegex.exec(content)) !== null) {
      const routePath = match[1]!
      // 尝试提取对应的组件名
      const componentMatch = content.substring(match.index).match(/(?:import|React\.lazy)\s*\(\s*\(\)\s*=>\s*import\s*\(['"]@\/pages\/[^'"]+\/([^'"]+)['"]\)/)
      const componentName = componentMatch ? componentMatch[1]! : 'Unknown'
      entries.push({ cabin, routePath, componentName })
    }
  }

  return entries
}

function auditAppDispatchers(): { violations: string[]; stats: { total: number; covered: number } } {
  logInfo('审计项2: App分发器路由覆盖')
  const violations: string[] = []
  const routes = extractRoutesFromConfig()
  const dispatchers = extractAppDispatchers()

  // 提取所有被App分发器处理的路径
  const dispatcherPaths = new Set(dispatchers.map(d => d.routePath))

  // 检查每个路由是否在App分发器中有对应分支
  let covered = 0
  for (const route of routes) {
    // 舱室入口路由由PortalShell处理，不需要App分发器分支
    if (['/input', '/analysis', '/trading', '/output', '/command'].includes(route.path)) {
      covered++
      continue
    }

    // /hub 路由重定向到舱室基础路径
    if (route.path.endsWith('/hub')) {
      covered++
      continue
    }

    // 检查是否在App分发器中有对应分支
    const hasDispatcher = Array.from(dispatcherPaths).some(dp =>
      route.path === dp || route.path.startsWith(dp + '/')
    )

    if (hasDispatcher) {
      covered++
    } else {
      violations.push(`路由未在App分发器中注册: ${route.path} (${route.description})`)
    }
  }

  if (violations.length === 0) {
    logSuccess(`App分发器路由覆盖检查通过 (${covered}/${routes.length})`)
  } else {
    for (const v of violations) {
      logError(v)
    }
  }

  return { violations, stats: { total: routes.length, covered } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 审计项3: Action→Store映射唯一性（保持不变）
// ═══════════════════════════════════════════════════════════════════════════════

function auditActionStoreMapping(): { violations: string[]; stats: { total: number } } {
  logInfo('审计项3: Action→Store映射唯一性')
  const violations: string[] = []

  const databridgeFile = join(SRC, 'core', 'databridge.ts')
  const content = readFileSync(databridgeFile, 'utf-8')

  // 提取ACTION_TO_STORE_MAP
  const mapRegex = /const ACTION_TO_STORE_MAP:\s*Record<string,\s*StoreName>\s*=\s*\{([\s\S]*?)\}/
  const mapMatch = content.match(mapRegex)

  if (!mapMatch) {
    violations.push('无法找到ACTION_TO_STORE_MAP定义')
    return { violations, stats: { total: 0 } }
  }

  const mapContent = mapMatch[1]
  const entries: Array<{ action: string; store: string }> = []

  // 提取每个映射条目
  const entryRegex = /\[ENVELOPE_ACTION\.(\w+)\]:\s*STORE_NAME\.(\w+)/g
  let match
  while ((match = entryRegex.exec(mapContent ?? '')) !== null) {
    entries.push({ action: match[1]!, store: match[2]! })
  }

  logInfo(`  发现 ${entries.length} 个Action→Store映射`)

  // 检查重复Action（同一个Action映射到多个Store）
  const actionCounts = new Map<string, number>()
  for (const entry of entries) {
    actionCounts.set(entry.action, (actionCounts.get(entry.action) ?? 0) + 1)
  }

  for (const [action, count] of actionCounts) {
    if (count > 1) {
      violations.push(`Action映射重复: ${action} 映射了 ${count} 次`)
    }
  }

  // 检查ENVELOPE_ACTION中的所有Action是否都有映射
  const dbConfigFile = join(SRC, 'config', 'dbConfig.ts')
  const dbConfigContent = readFileSync(dbConfigFile, 'utf-8')

  const actionRegex = /ENVELOPE_ACTION\s*=\s*\{([\s\S]*?)\}\s*as\s*const/
  const actionMatch = dbConfigContent.match(actionRegex)

  if (actionMatch) {
    const actionContent = actionMatch[1]
    const definedActions: string[] = []
    const definedActionRegex = /(\w+):\s*['"]/g
    let definedMatch
    while ((definedMatch = definedActionRegex.exec(actionContent ?? '')) !== null) {
      definedActions.push(definedMatch[1] ?? '')
    }

    const mappedActions = new Set(entries.map(e => e.action))
    for (const action of definedActions) {
      if (!mappedActions.has(action)) {
        violations.push(`Action未映射到Store: ${action}`)
      }
    }
  }

  if (violations.length === 0) {
    logSuccess('Action→Store映射唯一性检查通过')
  } else {
    for (const v of violations) {
      logError(v)
    }
  }

  return { violations, stats: { total: entries.length } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 审计项4: 冗余Store检测（v2.0 完全重构）
// ═══════════════════════════════════════════════════════════════════════════════
//
// 重构要点（修复P0缺陷）：
//   R1. 全目录搜索：覆盖 portal/store/services/core/lib/agents/mcp（修复 workflowStore 误报）
//   R2. 多模式导入检测：绝对路径 + 相对路径(./ ../) + hook名（修复 Facade 子Store 误报）
//   R3. Store间依赖图：扫描 store/ 下相对导入，构建有向图
//   R4. 传递可达性分析：从UI直接消费的Store BFS，所有可达Store标记为used
//   R5. 注释过滤：逐行解析，排除 // 和 * 开头的注释行
//   R6. 测试文件识别：.test.ts/.test.tsx 标记为 testOnly，不计入 used
// ═══════════════════════════════════════════════════════════════════════════════

export interface StoreMeta {
  /** Store 文件名（不含扩展名），如 tradingStore */
  fileName: string
  /** Store 绝对路径 */
  filePath: string
  /** 导出的 hook 名，如 useTradingStore（从源码解析） */
  hookName: string | null
  /** 是否被标记为 @deprecated */
  deprecated: boolean
  /** 是否为 Facade（聚合其他 Store） */
  isFacade: boolean
  /** Facade 聚合的子 Store 列表 */
  aggregates: string[]
}

export interface ConsumerRef {
  /** 消费文件路径（相对项目根） */
  file: string
  /** 行号 */
  line: number
  /** 导入类型 */
  importType: 'absolute' | 'relative' | 'hookname' | 'type'
  /** 是否仅在测试文件中引用 */
  testOnly: boolean
  /** 是否为注释引用（非实际导入） */
  commentOnly: boolean
  /**
   * 是否为 store/ 目录内的消费者（Store-to-Store 导入）。
   * v2.1 新增：用于区分 UI 层直接消费者与 Store 层传递消费者。
   * BFS 起点判定仅使用 isStoreDir=false 的消费者。
   */
  isStoreDir: boolean
  /** 若通过 Facade 间接使用，记录 Facade Store 名 */
  viaFacade?: string
}

export interface StoreNode {
  meta: StoreMeta
  /** 直接消费者（UI/Services/Core 等非 Store 层） */
  directConsumers: ConsumerRef[]
  /** Store 间依赖（其他 Store 通过相对路径导入此 Store） */
  storeConsumers: string[]
  /** 综合状态 */
  status: 'used' | 'unused' | 'unknown'
  /** 是否通过传递可达性标记为 used */
  transitivelyReachable: boolean
}

/**
 * 从 Store 源码中解析导出的 hook 名。
 * 匹配模式：`export const useXxxStore = create<...>`
 * 注意：databridgeStore.ts 导出 useDataBridgeStore（大写B），与文件名不一致，需从源码解析。
 */
export function extractStoreHookName(filePath: string): string | null {
  const content = readFileSync(filePath, 'utf-8')
  // 匹配 export const useXxxStore = create
  const hookMatch = content.match(/export\s+const\s+(use\w+Store)\s*=\s*create/)
  if (hookMatch) return hookMatch[1] ?? null
  // 兜底：匹配 export function useXxxStore
  const fnMatch = content.match(/export\s+function\s+(use\w+Store)/)
  if (fnMatch) return fnMatch[1] ?? null
  return null
}

/**
 * 检测 Store 是否被标记为 @deprecated（Facade 模式常见标注）
 */
export function isStoreDeprecated(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  return /@deprecated/.test(content)
}

/**
 * 提取 Store 文件中的 Store-to-Store 依赖导入。
 *
 * v2.1 修复 Bug 2：同时支持相对路径与绝对路径导入。
 *   - 相对路径：from './xxxStore' 或 from '../xxxStore'
 *   - 绝对路径：from '@/store/xxxStore' 或 from '@/store/sub/xxxStore'
 *
 * 修复前仅匹配相对路径，遗漏 @/store/xxxStore 形式的 Store 间依赖，
 * 导致依赖图断边，BFS 传递可达性分析失效。
 *
 * 过滤注释行，仅保留实际 import 语句。
 */
export function extractStoreImports(filePath: string): Array<{ target: string; line: number; importPath: string }> {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const results: Array<{ target: string; line: number; importPath: string }> = []

  // 匹配 from './xxxStore' 或 from '../xxxStore'（相对路径）
  const relRegex = /from\s+['"](\.{1,2}\/[^'"]+Store)['"]/
  // 匹配 from '@/store/xxxStore' 或 from '@/store/sub/xxxStore'（绝对路径）
  const absRegex = /from\s+['"]@\/store\/(?:[^'"]+\/)?([^'"/]+Store)['"]/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line?.trim()!

    // R5 注释过滤：跳过注释行
    if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) {
      continue
    }

    // 优先匹配相对路径
    const relMatch = line?.match(relRegex)
    if (relMatch) {
      const importPath = relMatch[1]!
      const targetName = importPath.replace(/^.*\//, '')
      results.push({ target: targetName, line: i + 1, importPath })
      continue
    }

    // 匹配绝对路径（v2.1 新增）
    const absMatch = line?.match(absRegex)
    if (absMatch) {
      const targetName = absMatch[1]!
      results.push({ target: targetName, line: i + 1, importPath: `@/store/${targetName}` })
    }
  }

  return results
}

/**
 * 判断文件是否为测试文件（R6 测试文件识别）
 */
export function isTestFile(filePath: string): boolean {
  return /\.test\.(ts|tsx)$/.test(filePath) || /__tests__[/\\]/.test(filePath)
}

/**
 * 收集所有 Store 元信息
 * N1 检测节点：VERBOSE 模式下输出所有发现的 Store 文件及 hook 名
 */
export function collectStoreMetas(): StoreMeta[] {
  const storeDir = join(SRC, 'store')
  const storeFiles = readdirSync(storeDir).filter(
    f => f.endsWith('Store.ts') && !f.endsWith('.test.ts')
  )

  const metas: StoreMeta[] = []

  for (const storeFile of storeFiles) {
    const filePath = join(storeDir, storeFile)
    const fileName = storeFile.replace('.ts', '')
    const hookName = extractStoreHookName(filePath)
    const deprecated = isStoreDeprecated(filePath)

    metas.push({
      fileName,
      filePath,
      hookName,
      deprecated,
      isFacade: false, // 后续通过依赖图判定
      aggregates: [],
    })
  }

  // N1 VERBOSE: 输出所有 Store 文件及 hook 名解析结果
  if (VERBOSE) {
    logVerbose(`N1 collectStoreMetas: 发现 ${metas.length} 个 Store 文件`)
    for (const m of metas) {
      const hookDisplay = m.hookName ?? '(未解析到 hook)'
      const hookMismatch = m.hookName && m.hookName !== `use${m.fileName.charAt(0).toUpperCase()}${m.fileName.slice(1)}`
        ? ' [hook与文件名不一致]'
        : ''
      logVerbose(`  ${m.fileName}.ts → hook=${hookDisplay}${m.deprecated ? ' (@deprecated)' : ''}${hookMismatch}`)
    }
  }

  return metas
}

/**
 * 构建 Store 间依赖图（R3 Store间依赖图构建）
 *
 * v2.1 修复：使用 extractStoreImports 同时解析相对路径与绝对路径导入，
 * 确保依赖图边完整。修复前仅匹配相对路径，遗漏 @/store/xxxStore 形式导入。
 *
 * 扫描每个 Store 文件的 Store-to-Store 导入，建立 source→target 边。
 * N2 检测节点：VERBOSE 模式下输出每条依赖边
 */
export function buildStoreDependencyGraph(metas: StoreMeta[]): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  const storeFileNames = new Set(metas.map(m => m.fileName))
  const edgeLog: Array<{ source: string; target: string; line: number; importPath: string }> = []

  for (const meta of metas) {
    const imports = extractStoreImports(meta.filePath)
    const targets: string[] = []
    const seen = new Set<string>() // 同一 target 去重（避免相对+绝对同时匹配）
    for (const imp of imports) {
      // 仅记录目标也是 Store 的依赖
      if (storeFileNames.has(imp.target) && !seen.has(imp.target)) {
        targets.push(imp.target)
        seen.add(imp.target)
        edgeLog.push({ source: meta.fileName, target: imp.target, line: imp.line, importPath: imp.importPath })
      }
    }
    graph.set(meta.fileName, targets)
  }

  // N2 VERBOSE: 输出依赖图所有边
  if (VERBOSE) {
    const totalEdges = edgeLog.length
    logVerbose(`N2 buildStoreDependencyGraph: 共 ${totalEdges} 条 Store 间依赖边`)
    for (const e of edgeLog) {
      logVerbose(`  ${e.source}.ts:${e.line} → ${e.target} (via ${e.importPath})`)
    }
  }

  return graph
}

/**
 * 标记 Facade Store：聚合了其他 Store 的 Store（R3 辅助）
 * N3 检测节点：VERBOSE 模式下输出 Facade 识别结果
 */
export function markFacadeStores(metas: StoreMeta[], graph: Map<string, string[]>): void {
  for (const meta of metas) {
    const deps = graph.get(meta.fileName) ?? []
    if (deps.length > 0) {
      meta.isFacade = true
      meta.aggregates = deps
    }
  }

  // N3 VERBOSE: 输出 Facade Store 识别结果
  if (VERBOSE) {
    const facades = metas.filter(m => m.isFacade)
    logVerbose(`N3 markFacadeStores: 识别 ${facades.length} 个 Facade Store`)
    for (const f of facades) {
      logVerbose(`  ${f.fileName}.ts → 聚合 [${f.aggregates.join(', ')}]${f.deprecated ? ' (@deprecated)' : ''}`)
    }
  }
}

/**
 * 搜索目录下所有 .ts/.tsx 文件中对指定 Store 的引用（R1+R2+R5+R6）
 *
 * 检测模式：
 *   - 绝对路径：from '@/store/xxxStore'
 *   - 相对路径：from './xxxStore' 或 from '../xxxStore'（仅 store/ 目录内有效）
 *   - hook名引用：useXxxStore（兜底检测，需配合注释过滤）
 *
 * 返回消费者列表（已过滤注释、已标记测试文件）
 */
export function findStoreConsumers(
  storeMeta: StoreMeta,
  searchRoots: string[]
): ConsumerRef[] {
  const consumers: ConsumerRef[] = []
  const { fileName, hookName } = storeMeta

  // 构建检测正则
  const patterns: Array<{ regex: RegExp; type: ConsumerRef['importType'] }> = [
    // R2a 绝对路径导入：from '@/store/xxxStore'
    { regex: new RegExp(`from\\s+['"]@/store/${fileName}['"]`, 'g'), type: 'absolute' },
    // R2b 相对路径导入（同级）：from './xxxStore'
    { regex: new RegExp(`from\\s+['"]\\./${fileName}['"]`, 'g'), type: 'relative' },
    // R2c 相对路径导入（父级）：from '../xxxStore'
    { regex: new RegExp(`from\\s+['"]\\.\\./${fileName}['"]`, 'g'), type: 'relative' },
  ]
  // R2d hook名兜底检测：仅当 hookName 解析成功且与文件名推导不同时启用
  // 例如 databridgeStore.ts 导出 useDataBridgeStore（大写B），无法通过文件名匹配
  const expectedHookByFile = `use${fileName.charAt(0).toUpperCase()}${fileName.slice(1)}`
  const hookForSearch = hookName ?? expectedHookByFile
  // 仅当 hookName 与文件名推导不一致时，额外添加 hook 名检测（避免重复匹配）
  if (hookName && hookName !== expectedHookByFile) {
    patterns.push({
      regex: new RegExp(`\\b${hookName}\\b`, 'g'),
      type: 'hookname',
    })
  }

  for (const searchRoot of searchRoots) {
    if (!existsSync(searchRoot)) continue
    walkAndFindConsumers(searchRoot, storeMeta, patterns, hookForSearch, consumers)
  }

  return consumers
}

/**
 * 递归遍历目录，查找文件中对 Store 的引用
 * R5 注释过滤 + R6 测试文件识别 + v2.1 isStoreDir 标记 在此实现
 *
 * v2.1 新增：标记消费者文件是否位于 store/ 目录（isStoreDir）。
 * 该字段用于 BFS 起点判定，仅 isStoreDir=false 的消费者才作为 BFS 起点。
 */
export function walkAndFindConsumers(
  dir: string,
  storeMeta: StoreMeta,
  patterns: Array<{ regex: RegExp; type: ConsumerRef['importType'] }>,
  hookForSearch: string,
  consumers: ConsumerRef[]
): void {
  if (!existsSync(dir)) return

  // 判断当前目录是否位于 src/store/ 下（v2.1 新增）
  const storeDir = join(SRC, 'store')

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkAndFindConsumers(fullPath, storeMeta, patterns, hookForSearch, consumers)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      // 跳过 Store 自身定义文件（避免自引用误判）
      if (fullPath === storeMeta.filePath) continue

      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      const relPath = relative(ROOT, fullPath).replace(/\\/g, '/')
      const testOnly = isTestFile(fullPath)
      // v2.1 新增：判断是否为 store/ 目录内的消费者
      const isStoreDir = fullPath.startsWith(storeDir)

      // R5 注释过滤：逐行检测，跳过注释行
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line?.trim()!

        // 跳过注释行（// 单行注释、* JSDoc续行、/* 块注释起始）
        if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) {
          continue
        }

        // 检测各种导入模式
        for (const { regex, type } of patterns) {
          regex.lastIndex = 0
          if (regex.test(line ?? '')) {
            // 判断是否为 type-only 导入
            const isTypeImport = /^\s*import\s+type\s/.test(line ?? '') || /\btype\s*\{/.test(line ?? '')
            consumers.push({
              file: relPath,
              line: i + 1,
              importType: isTypeImport ? 'type' : type,
              testOnly,
              commentOnly: false,
              isStoreDir,
            })
            // v2.2 详细日志：输出每个消费者的分类判定
            // 关键排查：isStoreDir=true 的消费者不会作为 BFS 起点，若误判会导致污染传播
            // testOnly=true 的消费者不计入 used 判定，若误判会导致假阳性/假阴性
            const finalType = isTypeImport ? 'type' : type
            const tags: string[] = []
            if (testOnly) tags.push('testOnly')
            if (isStoreDir) tags.push('storeDir')
            if (isTypeImport) tags.push('type-only')
            const tagStr = tags.length > 0 ? ` [${tags.join(',')}]` : ''
            logVerbose(`[CONSUMER] ${storeMeta.fileName} ← ${relPath}:${i + 1} via ${finalType}${tagStr}`)
            break // 同一行只记录一次
          }
        }
      }
    }
  }
}

/**
 * 计算传递可达性（R4 传递可达性分析）
 *
 * v2.1 修复 Bug 1：BFS 起点判定从"有非测试直接消费者"收紧为
 * "有 UI 层直接消费者（isStoreDir=false 且 testOnly=false）"。
 *
 * 修复前：findStoreConsumers 搜索范围包含 store/ 目录，导致 Store-to-Store
 * 导入被计为"直接消费者"。当 Store B 仅被 Store A 导入时，B 会被错误地
 * 加入 BFS 起点队列，被标记为 used（假阳性），即使 Store A 本身未被 UI 使用。
 *
 * 修复后：仅 UI 层消费者（pages/components/apps/services 等非 store/ 目录）
 * 才作为 BFS 起点。Store-to-Store 导入仅用于 BFS 沿正向图遍历的边。
 *
 * 算法：从"有 UI 层直接消费者"的 Store 出发，沿 Store 间依赖图正向 BFS。
 * 即：若 Store A 被 UI 使用，且 Store A 导入了 Store B，
 *     则 Store B 也标记为 used（transitivelyReachable = true）。
 *
 * 正向图：sourceStore → [它导入的 targetStores]
 *
 * v2.1 新增：返回 BFS 诊断信息（起点清单、遍历路径），用于 --verbose 输出。
 */
export interface BfsDiagnostics {
  /** BFS 起点列表（有 UI 层直接消费者的 Store） */
  startingPoints: string[]
  /** BFS 遍历路径（按出队顺序记录，每条记录含 current 与新加入的 reachable） */
  traversalPath: Array<{ current: string; newReachable: string[] }>
  /** 通过传递可达性标记的 Store（非起点，仅通过 Facade 传递） */
  transitiveOnly: string[]
}

export function computeTransitiveReachability(
  metas: StoreMeta[],
  graph: Map<string, string[]>,
  directConsumersMap: Map<string, ConsumerRef[]>
): { reachable: Set<string>; diagnostics: BfsDiagnostics } {
  const reachable = new Set<string>()
  const queue: string[] = []
  const startingPoints: string[] = []
  const traversalPath: Array<{ current: string; newReachable: string[] }> = []

  // v2.1 BFS 起点：仅"有 UI 层直接消费者"的 Store
  // UI 层消费者定义：isStoreDir=false（非 store/ 目录）且 testOnly=false（非测试文件）
  //
  // v2.2 详细日志：逐 Store 输出起点判定依据，便于排查"应成为起点却未成为"的污染传播
  logVerbose(`[BFS-START] 起点判定开始，共 ${metas.length} 个 Store 待判定`)
  for (const meta of metas) {
    const consumers = directConsumersMap.get(meta.fileName) ?? []
    // 分类统计消费者，用于日志诊断
    const uiConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
    const storeDirConsumers = consumers.filter(c => c.isStoreDir && !c.testOnly)
    const testOnlyConsumers = consumers.filter(c => c.testOnly)
    const hasUiConsumer = uiConsumers.length > 0

    // 污染传播排查关键日志：说明该 Store 是否成为 BFS 起点
    // 若 Store 仅被 store/ 内文件导入（storeDirConsumers>0）但无 UI 消费者，
    // 它不会成为起点——这是防止 Store-to-Store 内部委托被误判为 UI 消费的核心修复点
    const verdict = hasUiConsumer ? '✓ 加入起点' : '✗ 非起点'
    const reason = hasUiConsumer
      ? `UI消费者=${uiConsumers.length}`
      : (storeDirConsumers.length > 0
          ? `仅Store层消费者=${storeDirConsumers.length}（不向上传播）`
          : (testOnlyConsumers.length > 0
              ? `仅测试文件引用=${testOnlyConsumers.length}（不计入）`
              : '无任何消费者'))
    logVerbose(`[BFS-START] ${meta.fileName}: ui=${uiConsumers.length}, storeDir=${storeDirConsumers.length}, testOnly=${testOnlyConsumers.length} → ${verdict} (${reason})`)

    if (hasUiConsumer) {
      reachable.add(meta.fileName)
      queue.push(meta.fileName)
      startingPoints.push(meta.fileName)
    }
  }
  logVerbose(`[BFS-START] 起点判定完成：${startingPoints.length}/${metas.length} 个 Store 成为 BFS 起点`)

  // BFS：沿正向图遍历（current 导入了哪些 Store → 它们也可达）
  //
  // v2.2 详细日志：输出每步出队节点、其导入列表、每条边的可达性判定
  // 关键排查场景：若 Facade Store A 被加入起点，但子 Store B 未出现在 A 的 imports 中，
  // 则 B 不会被传递标记为 used——这通常意味着依赖图构建（extractStoreImports）遗漏了某条边
  let stepNo = 0
  while (queue.length > 0) {
    const current = queue.shift()!
    stepNo++
    const imports = graph.get(current) ?? [] // current 导入的 Store 列表

    logVerbose(`[BFS-STEP #${stepNo}] 出队: ${current} (依赖图中有 ${imports.length} 条出边: [${imports.join(', ') || '空'}])`)

    const newReachable: string[] = []
    for (const imported of imports) {
      if (!reachable.has(imported)) {
        reachable.add(imported)
        queue.push(imported)
        newReachable.push(imported)
        logVerbose(`[BFS-STEP #${stepNo}]   ${current} → ${imported}: 新可达，加入队列`)
      } else {
        // 已可达的节点不重复入队，但这可能掩盖"多条路径可达"的事实
        // 输出此日志便于排查"为何某节点被多次尝试入队"（通常意味着多个 Facade 聚合同一子 Store）
        logVerbose(`[BFS-STEP #${stepNo}]   ${current} → ${imported}: 已可达，跳过`)
      }
    }
    if (newReachable.length > 0) {
      traversalPath.push({ current, newReachable })
    }
  }
  logVerbose(`[BFS-STEP] 遍历完成：共 ${stepNo} 步，reachable 集合大小=${reachable.size}`)

  const transitiveOnly = Array.from(reachable).filter(name => !startingPoints.includes(name))

  return {
    reachable,
    diagnostics: { startingPoints, traversalPath, transitiveOnly },
  }
}

/**
 * 审计项4 主函数：冗余Store检测（v2.1 BFS 算法修复版）
 *
 * v2.1 变更点：
 *   - BFS 起点判定使用 hasUiConsumer（isStoreDir=false && !testOnly）
 *   - 状态判定使用 hasUiConsumer || isReachable（取代 hasRealConsumer）
 *   - 移除硬编码 suspect 列表，改为动态检测"被污染"的 Store
 *   - 支持 --verbose 标志输出详细诊断（BFS 路径、依赖图边、消费者分类）
 */
export function auditUnusedStores(verbose: boolean): {
  violations: string[]
  stats: {
    total: number
    used: number
    unused: number
    facadeCount: number
    transitiveCount: number
    pollutedCount: number
  }
  details: StoreNode[]
} {
  logInfo('审计项4: 冗余Store检测 (v2.1 BFS 算法修复版)')
  logDetail('检测规则：R1全目录搜索 + R2多模式导入 + R3依赖图(含绝对路径) + R4传递可达(BFS起点修复) + R5注释过滤 + R6测试识别 + BFS起点UI层限定')
  if (verbose) {
    logDetail('诊断模式：已启用 --verbose，将输出 BFS 起点清单、遍历路径、依赖图边、消费者分类')
  }

  const violations: string[] = []

  // R1 全目录搜索：覆盖所有 src 子目录
  const searchRoots = [
    'pages', 'components', 'apps', 'cockpit', 'hooks',
    'portal', 'store', 'services', 'core', 'lib', 'agents', 'mcp',
  ].map(d => join(SRC, d))

  // 收集 Store 元信息
  const metas = collectStoreMetas()
  logDetail(`共发现 ${metas.length} 个 Store 文件`)

  // R3 构建 Store 间依赖图（v2.1 含绝对路径导入）
  const graph = buildStoreDependencyGraph(metas)
  markFacadeStores(metas, graph)

  const facadeStores = metas.filter(m => m.isFacade)
  if (facadeStores.length > 0) {
    logDetail(`识别 Facade Store ${facadeStores.length} 个：`)
    for (const fs of facadeStores) {
      logDetail(`  ${fs.fileName} → 聚合 [${fs.aggregates.join(', ')}]${fs.deprecated ? ' (@deprecated)' : ''}`)
    }
  }

  // verbose：输出完整依赖图边（由 N2 节点在 buildStoreDependencyGraph 中输出，此处不再重复）

  // R2 查找每个 Store 的直接消费者
  const directConsumersMap = new Map<string, ConsumerRef[]>()
  for (const meta of metas) {
    const consumers = findStoreConsumers(meta, searchRoots)
    directConsumersMap.set(meta.fileName, consumers)
  }

  // N4 VERBOSE: 输出每个 Store 的直接消费者明细
  if (VERBOSE) {
    logVerbose(`N4 findStoreConsumers: 输出每个 Store 的直接消费者明细`)
    for (const meta of metas) {
      const consumers = directConsumersMap.get(meta.fileName) ?? []
      if (consumers.length === 0) {
        logVerbose(`  ${meta.fileName}.ts → 无直接消费者`)
      } else {
        logVerbose(`  ${meta.fileName}.ts → ${consumers.length} 个消费者:`)
        for (const c of consumers) {
          const tags: string[] = []
          if (c.testOnly) tags.push('testOnly')
          if (c.isStoreDir) tags.push('storeDir')
          if (c.importType === 'type') tags.push('type-import')
          const tagStr = tags.length > 0 ? ` [${tags.join(',')}]` : ''
          logVerbose(`    ${c.file}:${c.line} via ${c.importType}${tagStr}`)
        }
      }
    }
  }

  // R4 计算传递可达性（v2.1 修复 BFS 起点 + 返回诊断信息）
  const { reachable, diagnostics: bfsDiag } = computeTransitiveReachability(metas, graph, directConsumersMap)

  logDetail(`BFS 起点（有 UI 层直接消费者）: ${bfsDiag.startingPoints.length} 个`)
  logDetail(`BFS 遍历步数（产生新可达的节点）: ${bfsDiag.traversalPath.length} 步`)
  logDetail(`传递可达 Store 总数: ${reachable.size} 个（其中 ${bfsDiag.transitiveOnly.length} 个仅通过 Facade 传递）`)

  if (bfsDiag.transitiveOnly.length > 0) {
    logDetail(`传递可达 Store（仅通过 Facade 间接使用）：`)
    for (const name of bfsDiag.transitiveOnly) {
      logDetail(`  ${name} ← 通过 Facade 传递使用`)
    }
  }

  // N5 VERBOSE: 输出 BFS 起点和遍历路径
  if (VERBOSE) {
    logVerbose(`N5 computeTransitiveReachability: BFS 诊断信息`)
    logVerbose(`  BFS 起点（${bfsDiag.startingPoints.length} 个）：${bfsDiag.startingPoints.join(', ')}`)
    if (bfsDiag.traversalPath.length > 0) {
      logVerbose(`  BFS 遍历路径（按出队顺序，仅记录产生新可达的节点）：`)
      for (const step of bfsDiag.traversalPath) {
        logVerbose(`    ${step.current} → 新可达: [${step.newReachable.join(', ')}]`)
      }
    } else {
      logVerbose(`  BFS 遍历路径：无（所有起点均无 Store 间依赖）`)
    }
    logVerbose(`  传递可达 Store（仅通过 Facade，非起点）：${bfsDiag.transitiveOnly.length} 个`)
    for (const name of bfsDiag.transitiveOnly) {
      logVerbose(`    ${name}`)
    }
  }

  // 构建节点并判定状态（v2.1 使用 hasUiConsumer）
  //
  // v2.2 详细日志：输出每个 Store 的状态判定依据
  // 关键排查：若某 Store 被判定为 used 但 hasUiConsumer=false 且 isReachable=true，
  // 说明它的 used 状态完全依赖传递可达性——这是 Facade 模式的预期行为，
  // 但若 Facade 本身未被 UI 使用，则该 Store 实际是"污染传播"的受害者
  logVerbose(`[STATUS] 状态判定开始，逐 Store 输出 hasUiConsumer / isReachable / status`)
  const nodes: StoreNode[] = metas.map(meta => {
    const consumers = directConsumersMap.get(meta.fileName) ?? []
    const storeConsumers = metas
      .filter(m => (graph.get(m.fileName) ?? []).includes(meta.fileName))
      .map(m => m.fileName)
    // v2.1 修复：状态判定使用 hasUiConsumer（UI 层直接消费者）
    const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir)
    const isReachable = reachable.has(meta.fileName)

    let status: StoreNode['status']
    if (hasUiConsumer || isReachable) {
      status = 'used'
    } else {
      status = 'unused'
    }

    // 状态判定诊断日志：说明 used/unused 的具体依据
    const verdict = status === 'used'
      ? (hasUiConsumer
          ? `used (UI层直接消费=${hasUiConsumer})`
          : `used (传递可达=${isReachable}, Facade间接使用)`)
      : `unused (无UI消费且不可达)`
    logVerbose(`[STATUS] ${meta.fileName}: hasUiConsumer=${hasUiConsumer}, isReachable=${isReachable}, storeConsumers=[${storeConsumers.join(',')}] → ${verdict}`)

    return {
      meta,
      directConsumers: consumers,
      storeConsumers,
      status,
      transitivelyReachable: isReachable && !hasUiConsumer,
    }
  })

  // v2.1 动态检测"被污染"的 Store（替代硬编码 suspect 列表）
  // 定义：被判定为 used，但其消费者中：
  //   - UI 层无消费者（hasUiConsumer=false）
  //   - 仅通过 Store 层消费者或测试文件引用
  //   - 通过 BFS 传递可达性标记为 used
  // 这类 Store 的 used 状态完全依赖于 Facade 传递，若 Facade 本身未被 UI 使用，则会成为假阳性
  const pollutedNodes = nodes.filter(n => {
    if (n.status !== 'used') return false
    const hasUiConsumer = n.directConsumers.some(c => !c.testOnly && !c.isStoreDir)
    return !hasUiConsumer && n.transitivelyReachable
  })

  if (pollutedNodes.length > 0) {
    logWarn(`诊断：发现 ${pollutedNodes.length} 个 Store 的 used 状态完全依赖 Facade 传递（需人工复核 Facade 是否真的被 UI 使用）：`)
    for (const node of pollutedNodes) {
      logDetail(`  ${node.meta.fileName} (hook=${node.meta.hookName}, 仅通过传递可达性判定为 used)`)
      if (node.storeConsumers.length > 0) {
        logDetail(`    Store 间消费者: ${node.storeConsumers.join(', ')}`)
      }
    }
  }

  // N6 状态判定 VERBOSE: 已在上方 [STATUS] 日志中输出（避免重复）

  // 统计与输出
  const usedNodes = nodes.filter(n => n.status === 'used')
  const unusedNodes = nodes.filter(n => n.status === 'unused')

  logDetail(`已使用: ${usedNodes.length} 个 | 未使用: ${unusedNodes.length} 个`)

  if (unusedNodes.length === 0) {
    logSuccess('冗余Store检测通过，所有 Store 均有引用')
  } else {
    logWarn(`发现 ${unusedNodes.length} 个未被引用的 Store：`)
    for (const node of unusedNodes) {
      const hookNote = node.meta.hookName && node.meta.hookName !== `use${node.meta.fileName.charAt(0).toUpperCase()}${node.meta.fileName.slice(1)}`
        ? ` (hook: ${node.meta.hookName})`
        : ''
      logWarn(`  ${node.meta.fileName}${hookNote}`)
    }
    // 冗余Store仅记录为 violations，但不作为 P0/P1 阻断
    for (const node of unusedNodes) {
      violations.push(`Store未被引用: ${node.meta.fileName}`)
    }
  }

  return {
    violations,
    stats: {
      total: metas.length,
      used: usedNodes.length,
      unused: unusedNodes.length,
      facadeCount: facadeStores.length,
      transitiveCount: bfsDiag.transitiveOnly.length,
      pollutedCount: pollutedNodes.length,
    },
    details: nodes,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 审计项5: EventBus事件订阅完整性（保持不变）
// ═══════════════════════════════════════════════════════════════════════════════

function auditEventBusIntegrity(): { violations: string[]; stats: { emitted: number; subscribed: number } } {
  logInfo('审计项5: EventBus事件订阅完整性')
  const violations: string[] = []

  // 提取所有定义的EVENT_NAMES
  const constantsFile = join(SRC, 'constants', 'store-channels.constants.ts')
  const constantsContent = readFileSync(constantsFile, 'utf-8')

  const eventNamesRegex = /EVENT_NAMES\s*=\s*\{([\s\S]*?)\}\s*as\s*const/
  const eventNamesMatch = constantsContent.match(eventNamesRegex)

  if (!eventNamesMatch) {
    violations.push('无法找到EVENT_NAMES定义')
    return { violations, stats: { emitted: 0, subscribed: 0 } }
  }

  const eventNamesContent = eventNamesMatch[1]
  const definedEvents: string[] = []
  const eventNameRegex = /(\w+):\s*['"]([^'"]+)['"]/g
  let match
  while ((match = eventNameRegex.exec(eventNamesContent ?? '')) !== null) {
    definedEvents.push(match[2]!) // 使用事件值（如 'stocks:changed'）
  }

  logInfo(`  发现 ${definedEvents.length} 个定义的EVENT_NAMES`)

  // 搜索所有eventBus.emit()调用
  const emittedEvents = new Set<string>()
  const emitPattern = /eventBus\.emit\s*\(\s*(?:EVENT_NAMES\.(\w+)|['"]([^'"]+)['"])/g

  // 搜索所有eventBus.on()调用
  const subscribedEvents = new Set<string>()
  const onPattern = /eventBus\.on\s*\(\s*(?:EVENT_NAMES\.(\w+)|['"]([^'"]+)['"])/g

  const searchDirs = ['store', 'services', 'core', 'pages', 'components', 'apps']

  for (const dir of searchDirs) {
    const dirPath = join(SRC, dir)
    if (!existsSync(dirPath)) continue

    walkAndSearch(dirPath, emitPattern, (m) => {
      const eventName = m[1] || m[2]
      if (eventName) emittedEvents.add(eventName)
    })

    walkAndSearch(dirPath, onPattern, (m) => {
      const eventName = m[1] || m[2]
      if (eventName) subscribedEvents.add(eventName)
    })
  }

  logInfo(`  发布的事件: ${emittedEvents.size}, 订阅的事件: ${subscribedEvents.size}`)

  // 检查发布但从未订阅的事件
  for (const event of emittedEvents) {
    if (!subscribedEvents.has(event)) {
      violations.push(`事件发布但从未订阅: ${event}`)
    }
  }

  // 检查订阅但从未发布的事件
  for (const event of subscribedEvents) {
    if (!emittedEvents.has(event)) {
      violations.push(`事件订阅但从未发布: ${event}`)
    }
  }

  if (violations.length === 0) {
    logSuccess('EventBus事件订阅完整性检查通过')
  } else {
    for (const v of violations) {
      logWarn(v)
    }
  }

  return { violations, stats: { emitted: emittedEvents.size, subscribed: subscribedEvents.size } }
}

function walkAndSearch(dir: string, pattern: RegExp, callback: (match: RegExpExecArray) => void): void {
  if (!existsSync(dir)) return

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkAndSearch(fullPath, pattern, callback)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const content = readFileSync(fullPath, 'utf-8')
      let match
      pattern.lastIndex = 0
      while ((match = pattern.exec(content)) !== null) {
        callback(match)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主函数（v2.1 支持 --verbose 标志）
// ═══════════════════════════════════════════════════════════════════════════════

function main(): void {
  // v2.1 解析 --verbose 标志
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')

  console.log('\n' + '='.repeat(80))
  console.log(`映射完整性审计报告 (v2.1 BFS 算法修复版${verbose ? '，诊断模式' : ''})`)
  console.log('='.repeat(80) + '\n')

  const results = {
    routeRegistry: auditRouteRegistry(),
    appDispatchers: auditAppDispatchers(),
    actionStoreMapping: auditActionStoreMapping(),
    unusedStores: auditUnusedStores(verbose),
    eventBusIntegrity: auditEventBusIntegrity(),
  }

  console.log('\n' + '='.repeat(80))
  console.log('审计汇总')
  console.log('='.repeat(80))

  let warningViolations = 0

    for (const [key, result] of Object.entries(results)) {
      const count = result.violations.length
      // v2.3 所有审计项均为警告级，不阻断CI；便于集成到全量audit流程中
      warningViolations += count
      // v2.1 附加 pollutedCount 诊断信息
      // 类型收敛：unusedStores 的 stats 包含 pollutedCount 字段
      const unusedStats = result.stats as { pollutedCount?: number }
      const pollutedCount = unusedStats?.pollutedCount ?? 0
      const pollutedNote = pollutedCount > 0 ? YELLOW + `，${pollutedCount} 个需复核` + RESET : ''
      const status = count === 0
        ? GREEN + '通过' + RESET + pollutedNote
        : YELLOW + `${count} 个警告` + RESET + pollutedNote
      console.log(`  ${key}: ${status}`)
    }

    console.log('\n' + '-'.repeat(80))
    if (warningViolations === 0) {
      logSuccess('审计完成，未发现违规问题')
    } else {
      logWarn(`审计完成，警告 ${warningViolations} 个（不阻断CI）`)
    }

    // v2.3 退出码逻辑：所有审计项均为警告级，不阻断CI
    // 便于集成到全量audit流程中，问题报告供后续处理
    process.exit(0)
}

// 仅在直接执行（非被 import）时运行 main()
// ESM 检测：使用 fileURLToPath 进行跨平台规范化比较
// Windows 上 import.meta.url 为 file:///C:/...，process.argv[1] 为 C:\...，
// 简单字符串拼接会因斜杠数量差异（file:// vs file:///）导致 main() 永不执行
const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false
if (isMainModule) {
  main()
}