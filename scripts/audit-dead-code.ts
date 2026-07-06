#!/usr/bin/env tsx
/**
 * audit-dead-code.ts
 * 死代码/空壳/路由一致性扫描器 v3.0（白盒/透明管道）
 *
 * 检查目标：
 * 1. src/ 下是否存在空函数、空组件、仅返回 null 的组件。
 * 2. src/config/routes.ts 中注册的路由是否对应真实存在的页面文件。
 * 3. pages/ 下是否存在未被任何路由或 App 分发器注册的页面文件（仅提示）。
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/audit-dead-code-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 * - 退出码语义：路由文件缺失=violation(exit 1)，空函数/未注册页面=warning(exit 0)
 *
 * v2.0.0 路由架构说明：
 *   routes.ts → PortalShell → App 分发器（AnalysisApp/TradingApp/...）→ React.lazy(页面)
 *   页面通过三级间接加载，审计需同时检查 routes.ts 和 src/apps/ 下的 lazy 导入。
 *
 * 排除规则：
 *   - 测试文件：*.test.ts / *.test.tsx / __tests__/ 目录下所有文件
 *   - 子组件：pages 各舱室 components 子目录下的文件（非独立页面，被父页面导入）
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-dead-code-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规(路由文件缺失), 2=执行错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_audit-pipeline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** 死代码/路由一致性问题项 */
export interface Issue {
  file: string
  line: number
  type: string
  message: string
  context: string
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
  }
}

const ROOT = path.resolve(__dirname, '..')
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

function scanEmptyFunctions(file: string): Issue[] {
  const issues: Issue[] = []
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const rel = relativeFromRoot(file)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

    // 空箭头函数：const X = () => {}
    const emptyArrow = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\))?\s*=>\s*\{\s*\}/
    const arrowMatch = raw.match(emptyArrow)
    if (arrowMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空箭头函数 ${arrowMatch[1]}`,
        context: trimmed.slice(0, 80),
      })
      continue
    }

    // 空函数：function X() {}
    const emptyFunc = /function\s+(\w+)\s*\([^)]*\)\s*\{\s*\}/
    const funcMatch = raw.match(emptyFunc)
    if (funcMatch) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '空函数',
        message: `空函数 ${funcMatch[1]}`,
        context: trimmed.slice(0, 80),
      })
      continue
    }

    // 仅返回 null 的组件（单文件内）
    const nullReturn = /return\s+null\s*;?\s*$/
    if (nullReturn.test(trimmed) && rel.endsWith('.tsx')) {
      issues.push({
        file: rel,
        line: i + 1,
        type: '条件返回 null',
        message: '组件在条件分支中返回 null（请确认是否为预期空状态）',
        context: trimmed.slice(0, 80),
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
    importPaths.push(match[1])
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
      pageImports.add(match[1].replace(/\.tsx?$/, ''))
    }

    // 扫描静态导入
    staticRegex.lastIndex = 0
    while ((match = staticRegex.exec(content)) !== null) {
      pageImports.add(match[1].replace(/\.tsx?$/, ''))
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
      lazyImports.add(match[1].replace(/\.tsx?$/, ''))
    }
  }
  return lazyImports
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
  // 子组件目录（pages/trading/components/ 等）
  if (/pages\/\w+\/components\//.test(relativePath)) return true
  // v2.0 新增：hooks 子目录
  if (/pages\/\w+\/hooks\//.test(relativePath)) return true
  // v2.0 新增：utils 子目录
  if (/pages\/\w+\/utils\//.test(relativePath)) return true
  // v2.0 新增：types 子目录
  if (/pages\/\w+\/types\//.test(relativePath)) return true
  // v2.0 新增：文件名以 use 开头（React hooks）
  const fileName = relativePath.split('/').pop() || ''
  if (fileName.startsWith('use') && fileName[3] >= 'A' && fileName[3] <= 'Z') return true
  // v2.0 新增：纯类型文件
  if (fileName.endsWith('types.ts') || fileName.endsWith('interfaces.ts')) return true
  return false
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

    // 合并三个注册源：routes.ts 直接导入 + App 分发器 lazy 导入 + Portal lazy 导入
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

    for (const pageFile of pageFiles) {
      if (!registeredPaths.has(pageFile)) {
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

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
  const files = collectFiles(SRC)
  const issues: Issue[] = []

  for (const file of files) {
    issues.push(...scanEmptyFunctions(file))
  }

  issues.push(...scanRouteConsistency())

  // 退出码语义：路由文件缺失=violation(exit 1)，空函数/未注册页面/条件返回 null=warning(exit 0)
  const violations = issues.filter((i) => i.type === '路由文件缺失')
  const warnings = issues.filter((i) => i.type !== '路由文件缺失')

  const routeImports = parseRoutes().length
  const appImports = collectAppDispatcherImports().size
  const portalImports = collectPortalImports().size

  return {
    issues,
    violations,
    warnings,
    summary: {
      totalFiles: files.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      emptyFunctions: issues.filter((i) => i.type === '空函数' || i.type === '空组件').length,
      missingRouteFiles: violations.length,
      unregisteredPages: issues.filter((i) => i.type === '未注册页面').length,
      routeImports,
      appImports,
      portalImports,
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  死代码与路由一致性审计 — audit-dead-code.ts v3.0          ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.issues.length === 0) {
    lines.push(colorize('✅ 未发现空壳函数/组件或路由不一致', 'green'))
  } else {
    lines.push(
      colorize(
        `发现 ${report.issues.length} 处问题：`,
        report.violations.length > 0 ? 'red' : 'yellow',
      ),
    )
    lines.push('')
    for (const issue of report.issues) {
      lines.push(`  ${issue.file}:${issue.line} [${issue.type}]`)
      lines.push(`    ${issue.message}`)
      lines.push(`    ${issue.context}`)
      lines.push('')
    }
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push(`扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`空函数/组件: ${report.summary.emptyFunctions}`)
  lines.push(`路由文件缺失: ${report.summary.missingRouteFiles}`)
  lines.push(`未注册页面: ${report.summary.unregisteredPages}（仅提示）`)
  lines.push('────────────────────────────────────────────────────────────')
  lines.push(
    `注册源统计: routes.ts(${report.summary.routeImports}) + apps/(${report.summary.appImports}) + portal/(${report.summary.portalImports})`,
  )
  lines.push(`排除规则: 测试文件 + __tests__/ + pages/*/components/`)
  lines.push('────────────────────────────────────────────────────────────')

  if (report.summary.missingRouteFiles > 0) {
    lines.push(colorize('❌ 存在路由文件缺失，请补全组件或清理路由表', 'red'))
  }

  return lines.join('\n')
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-dead-code',
    version: '3.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
