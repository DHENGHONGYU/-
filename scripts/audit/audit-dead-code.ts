#!/usr/bin/env tsx
/**
 * audit-dead-code.ts
 * 死代码/空壳/路由一致性/未使用组件扫描器 v4.0（白盒/透明管道）
 *
 * 检查目标：
 * 1. src/ 下是否存在空函数、空组件、仅返回 null 的组件。
 * 2. src/config/routes.ts 中注册的路由是否对应真实存在的页面文件。
 * 3. pages/ 下是否存在未被任何路由或 App 分发器注册的页面文件（仅提示）。
 * 4. src/components/ 下是否存在未被任何文件引用的组件（仅提示，v3.4 新增）。
 * 5. 组件命名冲突检测：不同目录下是否存在同名导出组件（v4.0 新增）。
 *
 * v4.0 改造（2026-07-25）：
 * - 新增 --staged / --diff 增量零容忍模式：暂存区新组件零引用 → violation(exit 1)
 * - 新增组件级引用计数：每个未使用组件带 refCount，summary 带 componentRefCounts 映射
 * - 新增组件命名冲突检测：扫描默认导出/具名导出的重名组件（name-collision warning）
 * - 死代码审计闭环：增量零容忍 + 存量 warning + 季度清理 SOP
 *
 * v3.4 新增：未使用组件扫描
 * - 扫描 src/components/ 下所有 .tsx 组件文件，检查是否被项目中其他文件引用
 * - 检测策略：导入路径解析 + JSX 标签名兜底扫描
 *
 * v3.1 改造（2026-07-06）：
 * - 新增动态导入全量扫描：覆盖 React.lazy / lazy() / () => import() / import() 四种模式
 * - 扫描范围扩展：config/ + portal/ + apps/ + cockpit/ 全覆盖
 * - 路径前缀扩展：@/pages/ + @/apps/ + @/cockpit/ + @/portal/ 四类前缀
 * - 二跳分析：对动态加载的模块本身进行二次扫描，发现嵌套懒加载
 * - 修复 v3.0 漏判：widgetRegistry.ts 中的 21 个 Widget 懒加载此前未被识别
 * - 修复 v3.0 漏判：PortalShell 中 @/apps/xxx 的动态加载此前未被识别
 * - 新增统计字段：dynamicImports / dynamicImportSources
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-dead-code-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist / --staged / --diff
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 * - 退出码语义：路由文件缺失+增量零引用=violation(exit 1)，其他=warning(exit 0)
 *
 * v2.0.0 路由架构说明：
 *   routes.ts → PortalShell → App 分发器（AnalysisApp/TradingApp/...）→ React.lazy(页面)
 *   页面通过三级间接加载，审计需同时检查 routes.ts 和 src/apps/ 下的 lazy 导入。
 *   v3.1 补充：cockpit/core/widgetRegistry.ts 中的 () => import() 懒加载也需纳入审计。
 *
 * 排除规则：
 *   - 测试文件：*.test.ts / *.test.tsx / __tests__/ 目录下所有文件
 *   - 子组件：pages 各舱室 components 子目录下的文件（非独立页面，被父页面导入）
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-dead-code-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规(路由文件缺失/增量零引用), 2=执行错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** 死代码/路由一致性问题项 */
export interface Issue {
  file: string
  line: number
  type: string
  message: string
  context: string
  /** v4.0 新增：组件引用次数（仅未使用组件 issue 有值） */
  refCount?: number
  /** v4.0 新增：命名冲突文件路径列表（仅 name-collision issue 有值） */
  collisionFiles?: string[]
}

/** 死代码/路由一致性审计报告 */
export interface Report extends AuditReport {
  /** 全部问题（violations + warnings 组合，向后兼容） */
  issues: Issue[]
  /** 硬违规：路由文件缺失（导致 exit 1） */
  violations: Issue[]
  /** 软警告：空函数 / 条件返回 null / 未注册页面（仅提示） */
  warnings: Issue[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    emptyFunctions: number
    missingRouteFiles: number
    unregisteredPages: number
    /** 注册源统计：routes.ts 直接导入数 */
    routeImports: number
    /** 注册源统计：apps/ 分发器 lazy 导入数 */
    appImports: number
    /** 注册源统计：portal/ lazy 导入数 */
    portalImports: number
    /** v3.1 新增：动态导入总数（覆盖 React.lazy / lazy() / () => import() / import() 四种模式） */
    dynamicImports: number
    /** v3.1 新增：动态导入来源文件数（产生动态导入的文件数） */
    dynamicImportSources: number
    /** v3.1 新增：通过动态导入注册的页面数（仅 @/pages/ 前缀） */
    dynamicRegisteredPages: number
    /** v3.4 新增：扫描到的组件文件总数 */
    totalComponents: number
    /** v3.4 新增：未使用组件数（无任何引用的组件文件） */
    unusedComponents: number
    /** v4.0 新增：组件引用次数映射表（组件路径 → 引用次数） */
    componentRefCounts: Record<string, number>
    /** v4.0 新增：命名冲突组件组数 */
    nameCollisions: number
    /** v4.0 新增：增量零容忍模式下暂存区违规组件数（exit 1 的触发源之一） */
    stagedUnusedComponents?: number
    /** v4.0 新增：是否启用 --staged / --diff 增量模式 */
    diffMode?: boolean
  }
}

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')
const ROUTES_FILE = path.join(SRC, 'config', 'routes.ts')

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // 目录不存在或无权限时返回空列表（边界条件健壮性）
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      files.push(...collectFiles(full))
    } else if (entry.isFile() && isTsFile(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function relativeFromRoot(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function relativeFromSrc(file: string): string {
  return path.relative(SRC, file).replace(/\\/g, '/').replace(/\.tsx$/, '').replace(/\.ts$/, '')
}

/**
 * 判断当前行的 `return null` 是否属于预期的空状态/守卫回退。
 * 覆盖以下场景：
 *   - `if (...) return null` / `if (...) { return null }`
 *   - `else if (...) return null`
 *   - `if (...) { ... return null }`（多行 if 块兜底）
 *   - `catch { ... return null }` / `catch (err) { ... return null }`
 *   - `switch (...) { default: return null }`
 *   - `typeof window === 'undefined'` 后的 SSR 守卫
 *   - `for`/`while` 循环无匹配项后的兜底 return null
 * 这些通常是数据未就绪、异常回退或默认分支的预期空状态，不应视为死代码。
 */
function isExpectedNullReturn(lines: string[], currentIndex: number): boolean {
  if (currentIndex === 0) return false

  let braceDepth = 0
  for (let offset = 1; offset <= 20 && currentIndex - offset >= 0; offset++) {
    const line = lines[currentIndex - offset] ?? ''
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue

    const openBraces = (trimmed.match(/\{/g) ?? []).length
    const closeBraces = (trimmed.match(/\}/g) ?? []).length
    braceDepth += closeBraces - openBraces

    // 在当前块层级或外层块中识别守卫头
    if (braceDepth >= -1) {
      if (/^(if|else\s+if)\s*\(/.test(trimmed)) return true
      // catch 块可能以 `} catch {` 或 `} catch (err) {` 形式出现
      if (/^(\}\s*)?catch\s*(\(\s*\w+\s*\))?\s*\{?\s*$/.test(trimmed)) return true
      if (/^default\s*:\s*$/.test(trimmed)) return true
      if (/^(for|while)\s*\(/.test(trimmed)) return true
      if (/typeof\s+window\s*===?\s*['"]undefined['"]/.test(trimmed)) return true
    }

    // 若已经退到函数/类最外层（深度 > 2）仍未命中，停止查找
    if (braceDepth > 2) return false
  }
  return false
}

function scanEmptyFunctions(file: string): Issue[] {
  const issues: Issue[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relativeFromRoot(file)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw?.trim()!

    if (trimmed!.startsWith('//') || trimmed!.startsWith('*')) continue

    // 空箭头函数：const X = () => {}
    const emptyArrow = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\))?\s*=>\s*\{\s*\}/
    const arrowMatch = raw?.match(emptyArrow)
    if (arrowMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空箭头函数 ${arrowMatch[1]}`,
        context: trimmed!.slice(0, 80),
      })
      continue
    }

    // 空函数：function X() {}
    const emptyFunc = /function\s+(\w+)\s*\([^)]*\)\s*\{\s*\}/
    const funcMatch = raw?.match(emptyFunc)
    if (funcMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空函数 ${funcMatch[1]}`,
        context: trimmed!.slice(0, 80),
      })
      continue
    }

    // 无条件返回 null 的组件（单文件内）
    // v3.3 校准：扩展预期空状态识别（catch、switch default、多行 if、循环兜底、SSR 守卫），
    // 仅报告无前置条件或明显非守卫场景的 return null，进一步减少误报。
    const nullReturn = /return\s+null\s*;?\s*$/
    const isSameLineGuard = /^(if|else\s+if)\s*\(.*\)\s*\{?\s*return\s+null\s*;?\s*\}?\s*$/.test(trimmed ?? '')
    if (
      nullReturn.test(trimmed ?? '') &&
      rel.endsWith('.tsx') &&
      !isSameLineGuard &&
      !isExpectedNullReturn(lines, i)
    ) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '无条件返回 null',
        message: '组件无条件返回 null（请确认是否为死代码或预期空状态）',
        context: trimmed!.slice(0, 80),
      })
    }
  }

  return issues
}

function parseRoutes(): string[] {
  if (!fs.existsSync(ROUTES_FILE)) {
    return []
  }
  const content = fs.readFileSync(ROUTES_FILE, 'utf-8')
  const importPaths: string[] = []
  const regex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    importPaths.push(match[1]!)
  }
  return importPaths
}

function resolveImportPath(importPath: string): string | null {
  if (importPath.startsWith('@/')) {
    const sub = importPath.slice(2)
    const candidates = [
      path.join(SRC, `${sub}.tsx`),
      path.join(SRC, `${sub}.ts`),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

/**
 * 扫描 src/apps/ 目录下所有 App 分发器中的页面导入。
 * 同时捕获两种导入方式：
 *   1. React.lazy(() => import('@/pages/...'))  — 动态懒加载
 *   2. import X from '@/pages/...'              — 静态导入
 * v2.0.0 后页面通过 App 分发器加载，需合并到注册路径集合中。
 */
function collectAppDispatcherImports(): Set<string> {
  const appsDir = path.join(SRC, 'apps')
  const pageImports = new Set<string>()
  if (!fs.existsSync(appsDir)) return pageImports

  const appFiles = collectFiles(appsDir).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('.test.'),
  )
  // 动态导入：import('@/pages/xxx')
  const dynamicRegex = /import\s*\(\s*['"]@\/pages\/([^'"]+)['"]\s*\)/g
  // 静态导入：import X from '@/pages/xxx'
  const staticRegex = /import\s+\w+\s+from\s+['"]@\/pages\/([^'"]+)['"]/g

  for (const file of appFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    let match: RegExpExecArray | null

    // 扫描动态导入
    dynamicRegex.lastIndex = 0
    while ((match = dynamicRegex.exec(content)) !== null) {
      pageImports?.add(match[1]!.replace(/\.tsx?$/, ''))
    }

    // 扫描静态导入
    staticRegex.lastIndex = 0
    while ((match = staticRegex.exec(content)) !== null) {
      pageImports?.add(match[1]!.replace(/\.tsx?$/, ''))
    }
  }
  return pageImports
}

/**
 * 扫描 src/portal/ 目录下 PortalShell 直接 lazy 导入的页面。
 */
function collectPortalImports(): Set<string> {
  const portalDir = path.join(SRC, 'portal')
  const lazyImports = new Set<string>()
  if (!fs.existsSync(portalDir)) return lazyImports

  const portalFiles = collectFiles(portalDir).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('.test.'),
  )
  const regex = /import\s*\(\s*['"]@\/pages\/([^'"]+)['"]\s*\)/g

  for (const file of portalFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(content)) !== null) {
      lazyImports?.add(match[1]!.replace(/\.tsx?$/, ''))
    }
  }
  return lazyImports
}

// ═══════════════════════════════════════════════════════════════════════════════
// v3.1 新增：动态导入全量扫描
// 覆盖四种导入模式 × 四种路径前缀 × 四个来源目录
// ═══════════════════════════════════════════════════════════════════════════════

/** 动态导入模式枚举 */
type DynamicImportKind =
  | 'react-lazy' // React.lazy(() => import('...'))
  | 'named-lazy' // lazy(() => import('...'))（named import of lazy）
  | 'arrow-import' // () => import('...')
  | 'bare-import' // import('...')

/** 动态导入路径前缀枚举 */
type ImportPathPrefix =
  | '@/pages/'
  | '@/apps/'
  | '@/cockpit/'
  | '@/portal/'
  | 'other'

/** 单条动态导入信息 */
export interface DynamicImportInfo {
  /** 产生动态导入的源文件（相对项目根） */
  sourceFile: string
  /** 行号 */
  line: number
  /** 导入模式 */
  kind: DynamicImportKind
  /** 路径前缀分类 */
  prefix: ImportPathPrefix
  /** 原始导入路径（如 @/pages/analysis/StockAnalysisPage） */
  importPath: string
  /** 规范化后的模块标识（去除前缀和扩展名，如 pages/analysis/StockAnalysisPage） */
  normalizedModule: string
}

/** 动态导入扫描结果 */
interface DynamicImportScanResult {
  /** 所有动态导入条目 */
  imports: DynamicImportInfo[]
  /** 按源文件分组的来源集合 */
  sourceFiles: Set<string>
  /** 仅 @/pages/ 前缀的规范化模块集合（用于页面注册判断） */
  registeredPages: Set<string>
}

/**
 * v3.1 核心：扫描全项目的动态导入。
 *
 * 覆盖四种导入模式：
 *   1. React.lazy(() => import('...'))   — 标准 React 懒加载
 *   2. lazy(() => import('...'))          — named import 的懒加载
 *   3. () => import('...')                — 裸箭头函数动态导入（如 widgetRegistry）
 *   4. import('...')                      — 直接动态 import 表达式
 *
 * 覆盖四个来源目录：
 *   - src/config/    （routes.ts）
 *   - src/portal/    （PortalShell.tsx）
 *   - src/apps/      （AnalysisApp/TradingApp/...）
 *   - src/cockpit/   （widgetRegistry.ts）
 *
 * 覆盖四种路径前缀：
 *   - @/pages/    （页面模块）
 *   - @/apps/    （App 分发器）
 *   - @/cockpit/ （驾驶舱组件）
 *   - @/portal/  （Portal 组件）
 */
function collectDynamicImports(): DynamicImportScanResult {
  const imports: DynamicImportInfo[] = []
  const sourceFiles = new Set<string>()
  const registeredPages = new Set<string>()

  // 扫描目录白名单（仅扫描可能产生动态导入的目录）
  const scanDirs = ['config', 'portal', 'apps', 'cockpit'].map((d) => path.join(SRC, d))

  // 四种导入模式的正则（统一捕获导入路径字符串）
  // 注意：正则设计为"宽松匹配"，避免误判注释中的 import 字符串
  // 通过 trim + 起始字符过滤减少误报
  const patterns: Array<{ kind: DynamicImportKind; regex: RegExp }> = [
    // React.lazy(() => import('...')) 或 React.lazy(() => import("..."))
    {
      kind: 'react-lazy',
      regex: /React\.lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g,
    },
    // lazy(() => import('...')) — named import 的 lazy（如 import { lazy } from 'react'）
    {
      kind: 'named-lazy',
      regex: /(?<![\w.])lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g,
    },
    // () => import('...') — 裸箭头函数（不含 React.lazy/lazy 包装）
    // 注意：此模式可能与前两种重叠，需在去重阶段处理
    {
      kind: 'arrow-import',
      regex: /(?<![\w.])\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
    // import('...') — 直接动态 import 表达式（兜底）
    // 此模式会捕获所有 import() 调用，包括前三种内部的 import()
    {
      kind: 'bare-import',
      regex: /(?<![\w.])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
  ]

  // 已处理的 (file+line+importPath) 三元组，用于跨模式去重
  const seen = new Set<string>()

  for (const scanDir of scanDirs) {
    if (!fs.existsSync(scanDir)) continue

    const files = collectFiles(scanDir).filter(
      (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('.test.'),
    )

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const relFile = relativeFromRoot(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 跳过注释行（减少误报）
        const trimmed = line?.trim()!
        if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) {
          continue
        }

        for (const { kind, regex } of patterns) {
          regex.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = regex.exec(line ?? '')) !== null) {
            const importPath = match[1]!

            // 去重：同一行同一导入路径只记录一次（优先记录更具体的模式）
            const dedupKey = `${relFile}:${i + 1}:${importPath}`
            if (seen.has(dedupKey)) continue
            seen.add(dedupKey)

            // 分类路径前缀
            const prefix = classifyImportPath(importPath ?? '')

            // 规范化模块标识（去除 @/ 前缀和扩展名）
            const normalizedModule = normalizeModulePath(importPath ?? '')

            // 仅 @/pages/ 前缀的导入纳入页面注册集合
            if (prefix === '@/pages/') {
              registeredPages.add(normalizedModule)
            }

            imports.push({
              sourceFile: relFile,
              line: i + 1,
              kind,
              prefix,
              importPath,
              normalizedModule,
            })
            sourceFiles.add(relFile)
          }
        }
      }
    }
  }

  return { imports, sourceFiles, registeredPages }
}

/** 分类动态导入的路径前缀 */
function classifyImportPath(importPath: string): ImportPathPrefix {
  if (importPath.startsWith('@/pages/')) return '@/pages/'
  if (importPath.startsWith('@/apps/')) return '@/apps/'
  if (importPath.startsWith('@/cockpit/')) return '@/cockpit/'
  if (importPath.startsWith('@/portal/')) return '@/portal/'
  return 'other'
}

/** 规范化模块路径：去除 @/ 前缀和扩展名 */
function normalizeModulePath(importPath: string): string {
  if (importPath.startsWith('@/')) {
    return importPath.slice(2).replace(/\.tsx?$/, '')
  }
  return importPath.replace(/\.tsx?$/, '')
}

/**
 * 判断文件路径是否为测试文件或被排除的目录。
 * 排除规则：
 *   - *.test.ts / *.test.tsx（测试文件）
 *   - __tests__/ 目录下的所有文件
 *   - pages 各舱室 components 子目录下的文件（子组件，非独立页面）
 *   - pages 各舱室 hooks 子目录下的文件（自定义 hooks，非独立页面）
 *   - pages 各舱室 utils 子目录下的文件（工具函数，非独立页面）
 *   - pages 各舱室 types 子目录下的文件（类型定义，非独立页面）
 *   - 文件名以 use 开头的文件（React hooks）
 *   - 文件名以 types 或 interfaces 结尾的文件（纯类型文件）
 */
function isExcludedFromPageAudit(relativePath: string): boolean {
  // 测试文件：包含 .test. 或以 .test 结尾（覆盖 .test.ts / .test.tsx）
  if (relativePath.includes('.test.') || relativePath.endsWith('.test')) return true
  // __tests__/ 目录
  if (relativePath.includes('__tests__/')) return true
  // 子组件目录（pages/trading/components/ 等，支持任意深度嵌套）
  if (/pages\/(?:[\w-]+\/)+components\//.test(relativePath)) return true
  // v2.0 新增：hooks 子目录（支持任意深度嵌套）
  if (/pages\/(?:[\w-]+\/)+hooks\//.test(relativePath)) return true
  // v2.0 新增：utils 子目录（支持任意深度嵌套）
  if (/pages\/(?:[\w-]+\/)+utils\//.test(relativePath)) return true
  // v2.0 新增：types 子目录（支持任意深度嵌套）
  if (/pages\/(?:[\w-]+\/)+types\//.test(relativePath)) return true
  // v2.0 新增：文件名以 use 开头（React hooks）
  const fileName = relativePath.split('/').pop() || ''
  if (fileName.startsWith('use') && fileName[3]! >= 'A' && fileName[3]! <= 'Z') return true
  // v2.0 新增：纯类型文件
  if (fileName.endsWith('types.ts') || fileName.endsWith('interfaces.ts')) return true
  // 页面级工具文件（非独立页面，扩展名已被 relativeFromSrc 去除）
  if (fileName === 'utils') return true
  return false
}

// ═══════════════════════════════════════════════════════════════════════════════
// v4.0 新增：扫描选项与 Git 增量模式支持
// ═══════════════════════════════════════════════════════════════════════════════

/** 扫描选项（v4.0 新增，支持增量模式等高级特性） */
export interface ScanOptions {
  /**
   * --staged / --diff：增量零容忍模式
   * - true：只检查 git 暂存区中新增/修改的组件文件
   * - 暂存区中的新组件零引用 → violation（exit 1）
   * - 存量组件零引用 → 保持 warning 级别
   */
  staged?: boolean
}

/**
 * 获取 git 暂存区中的文件列表（新增/修改的文件）。
 * 通过 `git diff --cached --name-only` 实现。
 * 返回相对于项目根目录的路径（使用 / 分隔符）。
 */
function getStagedFiles(): string[] {
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const output = execSync('git diff --cached --name-only', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as string
    return output
      .trim()
      .split('\n')
      .map((line) => line.trim().replace(/\\/g, '/'))
      .filter((line) => line.length > 0)
  } catch {
    // git 命令失败（非 git 仓库、无 git 命令等），返回空列表
    return []
  }
}

/**
 * 判断暂存区中的文件是否为新增组件文件（src/components/ 下的 .tsx 文件）。
 * 同时包含新增（A）和修改（M）的文件，因为修改也可能引入死代码风险。
 */
function isStagedComponentFile(relativePath: string): boolean {
  return relativePath.startsWith('src/components/') && relativePath.endsWith('.tsx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// v3.4 新增：未使用组件扫描
// 扫描 src/components/ 下所有组件文件，检查是否被项目中其他文件引用
// ═══════════════════════════════════════════════════════════════════════════════

/** 组件文件信息 */
interface ComponentInfo {
  /** 组件文件相对路径（从 src/ 开始，不含扩展名） */
  filePath: string
  /** 组件名（从文件名推导，PascalCase） */
  componentName: string
  /** 绝对路径 */
  absolutePath: string
  /** 是否为 index 桶文件（目录入口） */
  isIndex: boolean
}

/**
 * 从文件名推导组件名（PascalCase）。
 * 例如：stock-card.tsx → StockCard，Button.tsx → Button
 */
function deriveComponentName(fileName: string): string {
  const base = fileName.replace(/\.(tsx?|jsx?)$/, '')
  return base
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * 收集 src/components/ 下所有组件文件。
 * 排除：测试文件、__tests__/ 目录、纯类型文件、hooks 文件
 */
function collectComponentFiles(): ComponentInfo[] {
  const componentsDir = path.join(SRC, 'components')
  if (!fs.existsSync(componentsDir)) return []

  const files = collectFiles(componentsDir).filter((f) => {
    const rel = relativeFromRoot(f)
    // 排除测试文件
    if (rel.includes('.test.') || rel.includes('.spec.')) return false
    if (rel.includes('__tests__/')) return false
    // 排除 .ts 纯类型/工具文件（只扫描 .tsx 组件文件）
    if (!f.endsWith('.tsx')) return false
    // 排除 hooks 文件
    const baseName = path.basename(f)
    if (baseName.startsWith('use') && baseName[3]! >= 'A' && baseName[3]! <= 'Z') return false
    return true
  })

  return files.map((absPath) => {
    const relPath = relativeFromSrc(absPath) // 如 components/atoms/Button
    const fileName = path.basename(absPath)
    const isIndex = fileName === 'index.tsx'
    // 对于 index 文件，组件名取父目录名
    const nameSource = isIndex ? path.basename(path.dirname(absPath)) : fileName
    const componentName = deriveComponentName(nameSource)

    return {
      filePath: relPath,
      componentName,
      absolutePath: absPath,
      isIndex,
    }
  })
}

/**
 * v4.1 新增：解析 barrel/index.ts 文件的重导出关系。
 * 构建 "barrel 路径 → 实际组件路径" 的映射表，用于消除 barrel 假阳性。
 * 
 * 例如：components/chart/index.ts 包含 `export { CandlestickChart } from './CandlestickChart'`
 * 则 consumers 导入 `@/components/chart` 时，实际引用了 CandlestickChart 组件。
 */
function buildBarrelExportMap(): Map<string, Map<string, string>> {
  // 外层 Map: barrel 文件路径（相对于 src/）→ 内层 Map
  // 内层 Map: 导出名 → 实际组件文件路径（相对于 src/）
  const barrelMap = new Map<string, Map<string, string>>()
  
  const componentsDir = path.join(SRC, 'components')
  if (!fs.existsSync(componentsDir)) return barrelMap
  
  // 查找所有 index.ts / index.tsx 文件
  const indexFiles: string[] = []
  const findIndexFiles = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const fp = path.join(dir, e.name)
        if (e.isDirectory() && e.name !== 'node_modules') {
          findIndexFiles(fp)
        } else if (e.isFile() && (e.name === 'index.ts' || e.name === 'index.tsx')) {
          indexFiles.push(fp)
        }
      }
    } catch { /* skip */ }
  }
  findIndexFiles(componentsDir)
  
  for (const indexFile of indexFiles) {
    try {
      const content = fs.readFileSync(indexFile, 'utf-8')
      const relPath = path.relative(SRC, indexFile).replace(/\\/g, '/')
      const exportMap = new Map<string, string>()
      
      // 匹配 export { X } from './Y' 或 export { X, Z } from './Y'
      // 匹配 export { X as Y } from './Z'
      const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g
      let match: RegExpExecArray | null
      while ((match = namedExportRegex.exec(content)) !== null) {
        const namesBlock = match[1]!.trim()
        const sourcePath = match[2]!
        
        // 解析 source 路径
        const sourceDir = path.dirname(indexFile)
        const resolvedSource = path.resolve(sourceDir, sourcePath)
        
        // 规范化导出名 → 实际文件路径
        const candidates = [
          `${resolvedSource}.tsx`,
          `${resolvedSource}.ts`,
          `${resolvedSource}/index.tsx`,
          `${resolvedSource}/index.ts`,
        ]
        let actualPath: string | null = null
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            actualPath = path.relative(SRC, c).replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '')
            break
          }
        }
        
        if (!actualPath) continue
        
        // 解析导出名称
        const names = namesBlock.split(',').map(n => {
          const trimmed = n.trim()
          // 处理 "X as Y" 模式
          const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
          return asMatch ? asMatch[1]! : trimmed
        }).filter(n => n.length > 0)
        
        for (const name of names) {
          exportMap.set(name, actualPath)
        }
      }
      
      // 匹配 export default X from './Y'
      const defaultExportRegex = /export\s+default\s+from\s*['"]([^'"]+)['"]/g
      while ((match = defaultExportRegex.exec(content)) !== null) {
        const sourcePath = match[1]!
        const sourceDir = path.dirname(indexFile)
        const resolvedSource = path.resolve(sourceDir, sourcePath)
        
        const candidates = [
          `${resolvedSource}.tsx`,
          `${resolvedSource}.ts`,
        ]
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            const actualPath = path.relative(SRC, c).replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '')
            exportMap.set('default', actualPath)
            break
          }
        }
      }
      
      if (exportMap.size > 0) {
        barrelMap.set(relPath, exportMap)
      }
    } catch { /* skip */ }
  }
  
  return barrelMap
}

/**
 * v4.1 新增：解析 barrel 导入的实际组件引用。
 * 当消费者从 barrel index 导入时，解析 barrel 的重导出关系，
 * 将引用计数正确归因到实际组件文件。
 */
function resolveBarrelImports(
  imp: string,
  refCounts: Record<string, number>,
  seenInThisFile: Set<string>,
  barrelMap: Map<string, Map<string, string>>,
): boolean {
  // imp 如 "components/chart" 或 "@/components/chart"
  // barrel 路径如 "components/chart/index"
  
  // 找到对应的 barrel
  let barrelPath: string | null = null
  
  // 直接匹配：import 路径指向 index 文件
  const impNormalized = imp.replace(/^@\//, '')
  if (barrelMap.has(impNormalized)) {
    barrelPath = impNormalized
  } else if (barrelMap.has(impNormalized + '/index')) {
    barrelPath = impNormalized + '/index'
  } else {
    // 检查 import 路径是否指向包含 index 的目录
    for (const [key] of barrelMap) {
      if (key === impNormalized || key === impNormalized + '/index') {
        barrelPath = key
        break
      }
    }
  }
  
  if (!barrelPath) return false
  
  const exports = barrelMap.get(barrelPath)
  if (!exports) return false
  
  // 将 barrel 的所有导出组件计为被引用
  for (const [, actualComponentPath] of exports) {
    if (!seenInThisFile.has(actualComponentPath)) {
      seenInThisFile.add(actualComponentPath)
      refCounts[actualComponentPath] = (refCounts[actualComponentPath] ?? 0) + 1
    }
  }
  
  // 同时将 barrel 自身计为被引用
  if (!seenInThisFile.has(barrelPath)) {
    seenInThisFile.add(barrelPath)
    refCounts[barrelPath] = (refCounts[barrelPath] ?? 0) + 1
  }
  
  return true
}

/**
 * v4.1 增强：extractImportsFromFile 现在同时返回动态 import 信息
 * 用于 React.lazy 引用追踪
 */
function extractImportsFromFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: string[] = []

  // 匹配 ES Module import 语句
  // import X from '...'
  // import { X, Y } from '...'
  // import * as X from '...'
  // import '...'
  const importRegex = /import\s+(?:(?:type\s+)?[\w*{}\s,]+from\s+)?['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]!)
  }

  // 匹配动态 import() — v4.1 增强：捕获所有动态导入
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]!)
  }

  // 匹配 require()（兼容旧代码）
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]!)
  }

  return imports
}

/**
 * 解析导入路径为组件文件的相对路径（相对于 src/）。
 * 处理 @/ 别名和相对路径。
 */
function resolveComponentImport(importPath: string, fromFile: string): string | null {
  // 只处理项目内部导入（@/ 开头或相对路径）
  if (importPath.startsWith('@/')) {
    const sub = importPath.slice(2)
    // 尝试直接匹配（不含扩展名）
    const candidates = [
      `${sub}.tsx`,
      `${sub}.ts`,
      `${sub}/index.tsx`,
      `${sub}/index.ts`,
    ]
    for (const c of candidates) {
      if (fs.existsSync(path.join(SRC, c))) {
        return c.replace(/\.(tsx?|jsx?)$/, '')
      }
    }
    return null
  }

  // 相对路径
  if (importPath.startsWith('.') || importPath.startsWith('..')) {
    const fromDir = path.dirname(fromFile)
    const resolved = path.resolve(fromDir, importPath)
    const candidates = [
      `${resolved}.tsx`,
      `${resolved}.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.ts`,
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return path.relative(SRC, c).replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '')
      }
    }
    return null
  }

  return null // 第三方依赖，跳过
}

/**
 * 检查组件是否被 JSX 直接使用（作为补充判断，防止桶导出漏判）。
 * 对于通过 index 桶文件导出的组件，导入路径可能指向目录而非具体文件，
 * 此时通过 JSX 标签名匹配作为辅助判断。
 */
function isComponentUsedInJSX(componentName: string, allSourceFiles: string[]): boolean {
  // 组件名太短（如 2 字母缩写）容易误判，跳过
  if (componentName.length < 3) return false

  // JSX 标签使用模式：<ComponentName 或 <ComponentName/> 或 </ComponentName>
  const jsxRegex = new RegExp(
    `</?${componentName}(\\s|>|\\.|/)`,
    'g',
  )

  for (const file of allSourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8')
      // 跳过组件自身文件
      const fileName = path.basename(file)
      if (deriveComponentName(fileName) === componentName) continue

      if (jsxRegex.test(content)) {
        return true
      }
    } catch {
      // 文件读取失败，跳过
    }
  }

  return false
}

/**
 * 未使用组件扫描结果（v4.0 扩展，带引用计数）
 */
interface UnusedComponentsScanResult {
  /** 未使用组件的 issue 列表 */
  issues: Issue[]
  /** 组件引用次数映射表（组件路径 → 引用次数），覆盖所有扫描到的组件 */
  refCounts: Record<string, number>
}

/**
 * 扫描未使用的组件（v4.0 增强版，带引用计数和增量模式支持）。
 *
 * 检测策略：
 * 1. 收集 src/components/ 下所有 .tsx 组件文件
 * 2. 遍历全项目所有 .ts/.tsx 文件，提取导入路径
 * 3. 将导入路径解析为组件文件路径，建立"被引用组件"集合，并统计引用次数
 * 4. 对于未被导入路径直接命中的组件，额外用 JSX 标签名扫描兜底
 * 5. 输出未使用组件列表（带 refCount）
 *
 * v4.0 新增：
 * - 组件引用计数统计（refCount）
 * - --staged 增量模式：暂存区零引用组件升级为 violation
 *
 * 注意：
 * - 这是启发式检测，可能存在误判（如通过字符串动态加载、MCP 服务端渲染等）
 * - 默认仅作为提示，不作为硬性违规（exit code 不受影响）
 * - --staged 模式下，暂存区中的零引用新组件会触发 violation
 *
 * @param options 扫描选项
 */
function scanUnusedComponents(options: ScanOptions = {}): UnusedComponentsScanResult {
  const components = collectComponentFiles()
  if (components.length === 0) return { issues: [], refCounts: {} }

  // v4.1 新增：构建 barrel 导出映射表（仅一次）
  const barrelMap = buildBarrelExportMap()

  // 收集所有源文件（用于导入分析和 JSX 扫描）
  const allSourceFiles = collectFiles(SRC).filter(
    (f) =>
      (f.endsWith('.ts') || f.endsWith('.tsx')) &&
      !f.includes('.test.') &&
      !f.includes('.spec.') &&
      !f.includes('__tests__/'),
  )

  // 构建"被引用的组件文件"映射（相对 src/ 路径，不含扩展名 → 引用次数）
  const refCounts: Record<string, number> = {}

  // 初始化所有组件引用计数为 0
  for (const comp of components) {
    refCounts[comp.filePath] = 0
  }

  for (const file of allSourceFiles) {
    const imports = extractImportsFromFile(file)
    const seenInThisFile = new Set<string>() // 同一文件内同一组件只计一次
    for (const imp of imports) {
      const resolved = resolveComponentImport(imp, file)
      if (resolved && resolved.startsWith('components/')) {
        if (!seenInThisFile.has(resolved)) {
          seenInThisFile.add(resolved)
          refCounts[resolved] = (refCounts[resolved] ?? 0) + 1
        }
      }
      
      // v4.1 新增：barrel 解析 — 若导入指向 barrel，将引用归因到实际组件
      if (!resolved && imp.includes('components')) {
        // 尝试 barrel 解析（调用本身完成引用计数归因）
        resolveBarrelImports(imp, refCounts, seenInThisFile, barrelMap)
      }
    }
  }

  // 获取暂存区文件（仅 staged 模式需要）
  const stagedFiles = options.staged ? new Set(getStagedFiles()) : null
  const stagedComponentPaths = new Set<string>()
  if (stagedFiles) {
    for (const f of stagedFiles) {
      if (isStagedComponentFile(f)) {
        // 转换为相对 src/ 且不带扩展名的路径
        const compPath = f
          .replace(/^src\//, '')
          .replace(/\.tsx$/, '')
          .replace(/\.ts$/, '')
        stagedComponentPaths.add(compPath)
      }
    }
  }

  // 检查每个组件是否被引用
  const issues: Issue[] = []
  for (const comp of components) {
    const compPath = comp.filePath // 如 components/atoms/Button
    const refCount = refCounts[compPath] ?? 0

    // 1. 检查是否被导入路径直接命中
    if (refCount > 0) continue

    // 2. 对于非 index 文件，检查是否通过父目录 index 桶被引用
    if (!comp.isIndex) {
      const parentDir = path.dirname(compPath)
      if ((refCounts[parentDir] ?? 0) > 0) continue
      // 也可能是 components/atoms/index 这种桶
      const grandParentDir = path.dirname(parentDir)
      if ((refCounts[grandParentDir] ?? 0) > 0) continue
    }

    // 3. JSX 标签名兜底扫描（防止桶导出漏判）
    if (isComponentUsedInJSX(comp.componentName, allSourceFiles)) continue

    // 未被引用，报告为警告（或 staged 模式下为违规）
    const isStaged = stagedComponentPaths.has(compPath)
    const issueType = options.staged && isStaged ? '增量零引用组件' : '未使用组件'
    const stagedNote = isStaged ? ' [暂存区增量零容忍]' : ''

    issues.push({
      file: `src/${compPath}.tsx`,
      line: 1,
      type: issueType,
      message: `组件 ${comp.componentName} 未在项目中找到任何引用（导入或 JSX 使用）${stagedNote}`,
      context: `src/${compPath}.tsx`,
      refCount: 0,
    })
  }

  return { issues, refCounts }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v4.0 新增：组件命名冲突检测
// 扫描 src/components/ 下所有 .tsx 组件的默认导出名 / 具名导出组件名
// 检测是否有重名组件（不同目录下同名）
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 从组件文件中提取导出的组件名。
 * 包括：
 * 1. 默认导出名（export default Xxx / export default function Xxx()）
 * 2. 具名导出的组件（export function Xxx() / export const Xxx = ）
 *
 * 只提取看起来像组件的名称（PascalCase，首字母大写）。
 */
function extractExportedComponentNames(filePath: string): string[] {
  const names: string[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const trimmed = line.trim()

      // 跳过注释行
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue
      }

      // 默认导出：export default Xxx
      // 匹配：export default ComponentName
      const defaultExportMatch = trimmed.match(/^export\s+default\s+function\s+([A-Z]\w*)/)
      if (defaultExportMatch) {
        names.push(defaultExportMatch[1]!)
        continue
      }

      // 默认导出：export default Xxx（变量/类）
      const defaultVarMatch = trimmed.match(/^export\s+default\s+([A-Z]\w*)\s*[;=]/)
      if (defaultVarMatch) {
        names.push(defaultVarMatch[1]!)
        continue
      }

      // 默认导出：export default memo(Xxx) / forwardRef(Xxx) 等
      const defaultWrappedMatch = trimmed.match(
        /^export\s+default\s+(?:memo|forwardRef|observer|connect)\s*\(\s*([A-Z]\w*)/,
      )
      if (defaultWrappedMatch) {
        names.push(defaultWrappedMatch[1]!)
        continue
      }

      // 具名导出函数组件：export function Xxx()
      const namedFuncMatch = trimmed.match(/^export\s+function\s+([A-Z]\w*)\s*\(/)
      if (namedFuncMatch) {
        names.push(namedFuncMatch[1]!)
        continue
      }

      // 具名导出变量组件：export const Xxx =
      const namedConstMatch = trimmed.match(/^export\s+const\s+([A-Z]\w*)\s*=/)
      if (namedConstMatch) {
        names.push(namedConstMatch[1]!)
        continue
      }
    }
  } catch {
    // 文件读取失败，跳过
  }
  return names
}

/**
 * 扫描组件命名冲突。
 *
 * 检测策略：
 * 1. 收集 src/components/ 下所有 .tsx 组件文件
 * 2. 从每个文件中提取导出的组件名（默认导出 + 具名导出）
 * 3. 按组件名分组，发现同一组件名出现在不同文件中 → 命名冲突
 * 4. 同一文件内的重名导出不算冲突（TypeScript 编译器会自己报错）
 *
 * @returns 命名冲突 issue 列表（warning 级别）
 */
function scanNameCollisions(): Issue[] {
  const components = collectComponentFiles()
  if (components.length === 0) return []

  // 组件名 → 文件路径列表的映射
  const nameToFiles = new Map<string, string[]>()

  for (const comp of components) {
    const exportedNames = extractExportedComponentNames(comp.absolutePath)
    // 如果文件没有显式导出的组件名，使用从文件名推导的组件名作为兜底
    const names = exportedNames.length > 0 ? exportedNames : [comp.componentName]

    for (const name of names) {
      // 过滤掉非组件名（太短或不是 PascalCase）
      if (name.length < 3) continue
      if (name[0]! < 'A' || name[0]! > 'Z') continue

      const relPath = `src/${comp.filePath}.tsx`
      if (!nameToFiles.has(name)) {
        nameToFiles.set(name, [])
      }
      const files = nameToFiles.get(name)!
      if (!files.includes(relPath)) {
        files.push(relPath)
      }
    }
  }

  // 找出重名的组件（出现在 2 个或更多文件中）
  const issues: Issue[] = []
  for (const [name, files] of nameToFiles) {
    if (files.length >= 2) {
      issues.push({
        file: files[0]!,
        line: 1,
        type: 'name-collision',
        message: `组件名 "${name}" 在 ${files.length} 个文件中重复定义，可能导致导入混淆`,
        context: files.join(', '),
        collisionFiles: files,
      })
    }
  }

  return issues
}

function scanRouteConsistency(): Issue[] {
  const issues: Issue[] = []
  const importPaths = parseRoutes()

  for (const importPath of importPaths) {
    const resolved = resolveImportPath(importPath)
    if (!resolved) {
      issues.push({
        file: relativeFromRoot(ROUTES_FILE),
        line: 0,
        type: '路由文件缺失',
        message: `路由导入的文件不存在: ${importPath}`,
        context: importPath,
      })
    }
  }

  // 反向检查：pages/ 下 .tsx 文件是否被注册
  const pagesDir = path.join(SRC, 'pages')
  if (fs.existsSync(pagesDir)) {
    const pageFiles = collectFiles(pagesDir)
      .map(relativeFromSrc)
      .filter((f) => !isExcludedFromPageAudit(f))

    // 合并四个注册源（v3.1 升级为四源合并）：
    //   源 1：routes.ts 直接导入
    //   源 2：App 分发器 lazy 导入（向后兼容保留）
    //   源 3：Portal lazy 导入（向后兼容保留）
    //   源 4：v3.1 新增 - 全项目动态导入扫描（覆盖 React.lazy / lazy() / () => import() / import()）
    const registeredPaths = new Set<string>()

    // 源 1：routes.ts 中的 import() 路径
    for (const p of importPaths) {
      if (p.startsWith('@/')) {
        registeredPaths.add(p.slice(2).replace(/\.tsx?$/, ''))
      } else {
        registeredPaths.add(p.replace(/\.tsx?$/, ''))
      }
    }

    // 源 2：src/apps/ 下 App 分发器的 React.lazy() 导入
    // 正则捕获的是 @/pages/ 之后的部分（如 analysis/StockAnalysisPage），
    // 需拼接 pages/ 前缀以匹配 relativeFromSrc 输出格式
    const appDispatcherImports = collectAppDispatcherImports()
    for (const p of appDispatcherImports) {
      registeredPaths.add(`pages/${p}`)
    }

    // 源 3：src/portal/ 下 PortalShell 的 React.lazy() 导入
    const portalImports = collectPortalImports()
    for (const p of portalImports) {
      registeredPaths.add(`pages/${p}`)
    }

    // 源 4（v3.1 新增）：全项目动态导入扫描
    // 覆盖 widgetRegistry.ts 的 () => import('@/pages/...')
    // 覆盖 PortalShell 中 @/apps/xxx 内部嵌套的 lazy 导入
    // 覆盖 routes.ts 中 React.lazy 包装的页面导入
    const dynamicScan = collectDynamicImports()
    for (const mod of dynamicScan.registeredPages) {
      registeredPaths.add(mod)
    }

    for (const pageFile of pageFiles) {
      // index.tsx / index.ts 页面入口与不带 /index 的导入路径等价
      const normalizedPageFile = pageFile.replace(/\/index$/, '')
      if (!registeredPaths.has(pageFile) && !registeredPaths.has(normalizedPageFile)) {
        const displayPath = `src/${pageFile}.tsx`
        issues.push({
          file: displayPath,
          line: 1,
          type: '未注册页面',
          message: `pages/ 下页面未在路由表或 App 分发器中注册`,
          context: displayPath,
        })
      }
    }
  }

  return issues
}

/** 扫描函数（白盒导出，供测试和外部调用）
 *
 * v4.0 新增：支持 ScanOptions，可启用 --staged 增量零容忍模式
 */
export function scan(options: ScanOptions = {}): Report {
  const files = collectFiles(SRC)
  const issues: Issue[] = []

  for (const file of files) {
    issues.push(...scanEmptyFunctions(file))
  }

  issues.push(...scanRouteConsistency())

  // v3.4 新增：未使用组件扫描（v4.0 增强：带引用计数和增量模式）
  const unusedResult = scanUnusedComponents(options)
  issues.push(...unusedResult.issues)

  // v4.0 新增：组件命名冲突检测
  issues.push(...scanNameCollisions())

  // 退出码语义：
  // - 路由文件缺失 = violation (exit 1)
  // - 增量零引用组件（--staged 模式下）= violation (exit 1)
  // - 其他（空函数、存量未使用组件、命名冲突等）= warning (exit 0)
  const violations = issues.filter(
    (i) => i.type === '路由文件缺失' || i.type === '增量零引用组件',
  )
  const warnings = issues.filter(
    (i) => i.type !== '路由文件缺失' && i.type !== '增量零引用组件',
  )

  const routeImports = parseRoutes().length
  const appImports = collectAppDispatcherImports().size
  const portalImports = collectPortalImports().size

  // v3.1 新增：动态导入全量统计
  const dynamicScan = collectDynamicImports()
  const dynamicImports = dynamicScan.imports.length
  const dynamicImportSources = dynamicScan.sourceFiles.size
  const dynamicRegisteredPages = dynamicScan.registeredPages.size

  // v3.4 新增：组件统计
  const componentFiles = collectComponentFiles()
  const unusedComponents = issues.filter((i) => i.type === '未使用组件').length
  const stagedUnusedComponents = issues.filter((i) => i.type === '增量零引用组件').length
  const nameCollisions = issues.filter((i) => i.type === 'name-collision').length

  return {
    issues,
    violations,
    warnings,
    summary: {
      totalFiles: files.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      emptyFunctions: issues.filter((i) => i.type === '空函数' || i.type === '空组件').length,
      missingRouteFiles: violations.filter((i) => i.type === '路由文件缺失').length,
      unregisteredPages: issues.filter((i) => i.type === '未注册页面').length,
      routeImports,
      appImports,
      portalImports,
      dynamicImports,
      dynamicImportSources,
      dynamicRegisteredPages,
      totalComponents: componentFiles.length,
      unusedComponents,
      componentRefCounts: unusedResult.refCounts,
      nameCollisions,
      stagedUnusedComponents,
      diffMode: options.staged ?? false,
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  死代码/路由一致性/未使用组件审计 — audit-dead-code.ts v4.0 ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  // v4.0 新增：增量模式标识
  if (report.summary.diffMode) {
    lines.push(colorize('📌 增量模式（--staged）：暂存区新组件零引用将触发违规', 'yellow'))
    lines.push(`   暂存区零引用组件数: ${report.summary.stagedUnusedComponents ?? 0}`)
    lines.push('')
  }

  if (report.issues.length === 0) {
    lines.push(colorize('✅ 未发现空壳函数/组件、路由不一致或未使用组件', 'green'))
  } else {
    lines.push(
      colorize(
        `发现 ${report.issues.length} 处问题：`,
        report.violations.length > 0 ? 'red' : 'yellow',
      ),
    )
    lines.push('')
    for (const issue of report.issues) {
      const severity = issue.type === '路由文件缺失' || issue.type === '增量零引用组件'
        ? colorize('VIOLATION', 'red')
        : colorize('WARNING', 'yellow')
      lines.push(`  ${issue.file}:${issue.line} [${issue.type}] ${severity}`)
      lines.push(`    ${issue.message}`)
      lines.push(`    ${issue.context}`)
      // v4.0 新增：引用计数显示
      if (issue.refCount !== undefined) {
        lines.push(`    refCount: ${issue.refCount}`)
      }
      // v4.0 新增：命名冲突文件列表
      if (issue.collisionFiles && issue.collisionFiles.length > 0) {
        lines.push(`    冲突文件:`)
        for (const f of issue.collisionFiles) {
          lines.push(`      - ${f}`)
        }
      }
      lines.push('')
    }
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push(`扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`空函数/组件: ${report.summary.emptyFunctions}`)
  lines.push(`路由文件缺失: ${report.summary.missingRouteFiles}`)
  lines.push(`未注册页面: ${report.summary.unregisteredPages}（仅提示）`)
  lines.push(
    `未使用组件: ${report.summary.unusedComponents}/${report.summary.totalComponents}（仅提示，v3.4）`,
  )
  // v4.0 新增：命名冲突统计
  lines.push(`命名冲突: ${report.summary.nameCollisions} 组（仅提示，v4.0）`)
  // v4.0 新增：增量零引用统计
  if (report.summary.diffMode) {
    lines.push(`增量零引用: ${report.summary.stagedUnusedComponents ?? 0} 个（违规，触发 exit 1）`)
  }
  lines.push('────────────────────────────────────────────────────────────')
  lines.push(
    `注册源统计: routes.ts(${report.summary.routeImports}) + apps/(${report.summary.appImports}) + portal/(${report.summary.portalImports})`,
  )
  lines.push(
    `动态导入: ${report.summary.dynamicImports} 处，来自 ${report.summary.dynamicImportSources} 个源文件，注册页面 ${report.summary.dynamicRegisteredPages} 个`,
  )
  lines.push(`覆盖模式: React.lazy / lazy() / () => import() / import()`)
  lines.push(`覆盖路径: @/pages/ + @/apps/ + @/cockpit/ + @/portal/`)
  lines.push(`排除规则: 测试文件 + __tests__/ + pages/*/components/`)
  lines.push('────────────────────────────────────────────────────────────')
  lines.push('未使用组件检测策略: 导入路径解析 + JSX 标签名兜底扫描')
  lines.push('注意: 未使用组件为启发式检测，可能存在误判（动态加载/桶导出等）')

  // v4.0 新增：低引用组件 Top 10（濒临僵尸组件预警）
  const refCounts = report.summary.componentRefCounts
  if (refCounts && Object.keys(refCounts).length > 0) {
    const lowRefComps = Object.entries(refCounts)
      .filter(([, count]) => count > 0 && count <= 2)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 10)
    if (lowRefComps.length > 0) {
      lines.push('────────────────────────────────────────────────────────────')
      lines.push('⚠️  低引用组件 Top 10（引用次数 ≤ 2，濒临僵尸预警）:')
      for (const [compPath, count] of lowRefComps) {
        lines.push(`   ${count} 引用 → src/${compPath}.tsx`)
      }
    }
  }

  lines.push('────────────────────────────────────────────────────────────')

  if (report.violations.length > 0) {
    lines.push(colorize('❌ 存在违规项，请修复后重试', 'red'))
  } else if (report.issues.length > 0) {
    lines.push(colorize('⚠️  存在警告项，请酌情清理或确认', 'yellow'))
  }

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  // 解析脚本专属 CLI 参数（--staged / --diff）
  const argv = process.argv.slice(2)
  const scanOptions: ScanOptions = {
    staged: argv.includes('--staged') || argv.includes('--diff'),
  }

  const result = runAuditPipeline<Report>({
    scriptName: 'audit-dead-code',
    version: '4.0',
    scanFn: () => scan(scanOptions),
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
