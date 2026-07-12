#!/usr/bin/env tsx
/**
 * audit-reserved-stores.ts
 * @reserved Store 引用完整性审计器 v1.1（白盒/透明管道）
 *
 * 检查目标：
 * 1. 扫描 src/store/ 下所有标记 @reserved 的 Store 文件
 * 2. 对每个 @reserved Store 执行全路径引用搜索（静态/动态/Hook/函数/类型）
 * 3. 识别"标记 @reserved 但实际被引用"的违规情况
 * 4. 识别"标记 @reserved 且确实零引用"的正确情况
 *
 * v1.1 改造（2026-07-06）：
 * - 修复 v1.0 误报：hook-call / function-call / type-reference 三种维度
 *   在 v1.0 中仅靠符号名匹配，无法区分"从该 Store 导入的符号"与"其他源同名符号碰撞"。
 *   现升级为"import 路径验证"模式：仅当引用方文件中存在从 @/store/{storeName}
 *   或 ./{storeName} 明确导入该符号的 import 语句时，才确认为真实引用。
 * - 修复 chatStore.ChatMessage 类型名碰撞误报（其他源的同名类型）
 * - 修复 rotationSignalStore.bySector 函数名碰撞误报（hotSectorStore 的同名函数）
 * - 新增字段：references[].verified（是否通过 import 路径验证）
 * - 新增字段：summary.sameNameCollisions（疑似同名碰撞但未通过验证的引用数）
 *
 * 检测维度（六重交叉验证 + import 路径验证）：
 *   1. 静态 import: from '@/store/xxxStore'              → 直接确认
 *   2. 相对 import: from './xxxStore'（Facade 委托）      → 直接确认
 *   3. 动态 import: import('@/store/xxxStore')            → 直接确认
 *   4. Hook 调用: useXxxStore                            → 需 import 路径验证
 *   5. 派生函数: Store 中导出的所有函数名                 → 需 import 路径验证
 *   6. 类型引用: Store 中导出的所有类型名                 → 需 import 路径验证
 *
 * 输出契约：
 * - stdout：JSON 数据流（Report 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-reserved-stores-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规（@reserved Store 被引用）, 2=执行错误
 *
 * @compliance AGENTS.md §三 零硬编码 / §十 自主决策规则
 * @created 2026-07-06
 * @upgraded 2026-07-06 v1.1 添加 import 路径验证，消除同名碰撞误报
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_audit-pipeline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================
// 类型定义
// ============================================================

/** @reserved Store 信息 */
interface ReservedStore {
  /** Store 名称（不含扩展名，如 riskStore） */
  name: string
  /** 文件绝对路径 */
  filePath: string
  /** 相对项目根的路径 */
  relativePath: string
  /** @reserved 标记后的描述文本 */
  reservedDescription: string
  /** 从文件中提取的导出符号 */
  exports: StoreExports
}

/** Store 导出符号集合 */
interface StoreExports {
  /** Hook 函数名（如 useRiskStore） */
  hooks: string[]
  /** 导出的普通函数名（如 recentVerdicts、initRiskStoreSubscriptions） */
  functions: string[]
  /** 导出的类型名（如 RiskVerdict、RiskTriState） */
  types: string[]
  /** 导出的常量名（如 DEFAULT_RISK_CONFIG） */
  constants: string[]
}

/** 单条引用记录 */
interface Reference {
  /** 引用所在的源文件（相对项目根） */
  file: string
  /** 行号 */
  line: number
  /** 引用方式 */
  kind: ReferenceKind
  /** 匹配的符号名 */
  symbol: string
  /** 该行的代码片段（用于人工核对） */
  context: string
  /**
   * 是否通过 import 路径验证（v1.1 新增）
   * - true：引用方文件中存在从 @/store/{storeName} 或 ./{storeName}
   *         明确导入该符号的 import 语句
   * - false：仅符号名匹配，可能是同名碰撞（疑似误报）
   * - 对于 static/relative/dynamic-import 三种维度，恒为 true（直接确认）
   */
  verified: boolean
}

/** 引用方式枚举 */
type ReferenceKind =
  | 'static-import' // from '@/store/xxxStore'
  | 'relative-import' // from './xxxStore'
  | 'dynamic-import' // import('@/store/xxxStore')
  | 'hook-call' // useXxxStore(...)
  | 'function-call' // recentVerdicts(...)
  | 'type-reference' // : RiskVerdict

/** 单个 @reserved Store 的审计结果 */
interface StoreAuditResult {
  /** Store 名称 */
  storeName: string
  /** Store 文件路径 */
  storeFile: string
  /** @reserved 描述 */
  reservedDescription: string
  /** 发现的所有引用（含已验证和疑似同名碰撞） */
  references: Reference[]
  /** 已验证的引用数（通过 import 路径验证，确认为真实引用） */
  verifiedCount: number
  /** 疑似同名碰撞数（仅符号名匹配，未通过 import 路径验证） */
  sameNameCollisionCount: number
  /** 引用总数（已验证 + 疑似碰撞） */
  referenceCount: number
  /**
   * 是否违反 @reserved 约定
   * v1.1 改造：仅当存在 verified 引用时才判为违规
   * （疑似同名碰撞不计入违规，但保留在 references 中供人工核对）
   */
  violated: boolean
  /** 按引用方式分组的统计（含已验证和疑似碰撞） */
  byKind: Record<ReferenceKind, number>
}

/** 审计报告 */
export interface Report extends AuditReport {
  /** 违规列表（@reserved Store 被引用，且通过 import 路径验证） */
  violations: StoreAuditResult[]
  /** 正常列表（@reserved Store 零引用，或仅有疑似同名碰撞） */
  warnings: StoreAuditResult[]
  /** 全部 Store 审计结果 */
  stores: StoreAuditResult[]
  summary: {
    /** @reserved Store 总数 */
    totalReservedStores: number
    /** 违反 @reserved 约定的 Store 数（有已验证引用） */
    violatedStores: number
    /** 符合 @reserved 约定的 Store 数（零已验证引用） */
    cleanStores: number
    /** 引用总数（含已验证和疑似碰撞） */
    totalReferences: number
    /** 已验证的引用总数 */
    totalVerifiedReferences: number
    /** 疑似同名碰撞引用总数（v1.1 新增） */
    totalSameNameCollisions: number
    /** 扫描的文件总数 */
    totalFilesScanned: number
  }
}

// ============================================================
// 配置
// ============================================================

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const STORE_DIR = path.join(SRC, 'store')

/** 搜索引用时扫描的目录白名单 */
const SEARCH_DIRS = ['pages', 'components', 'apps', 'cockpit', 'portal', 'store', 'services', 'core', 'lib', 'hooks']

/** 排除的文件模式（不扫描引用） */
const EXCLUDE_PATTERNS = [/\.test\.ts$/, /\.test\.tsx$/, /\.spec\.ts$/, /__tests__\//, /node_modules\//, /dist\//]

// ============================================================
// 工具函数
// ============================================================

function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
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
  return path.relative(SRC, file).replace(/\\/g, '/')
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath.replace(/\\/g, '/')))
}

// ============================================================
// 核心扫描逻辑
// ============================================================

/**
 * 扫描 src/store/ 目录，找到所有标记 @reserved 的 Store 文件。
 * 识别规则：JSDoc 注释中包含 @reserved 标签
 */
function findReservedStores(): ReservedStore[] {
  const stores: ReservedStore[] = []
  if (!fs.existsSync(STORE_DIR)) return stores

  const storeFiles = collectFiles(STORE_DIR).filter(
    (f) => f.endsWith('Store.ts') && !f.endsWith('.test.ts'),
  )

  for (const file of storeFiles) {
    const content = fs.readFileSync(file, 'utf-8')

    // 匹配 @reserved 标签及其后的描述文本（直到行尾或下一个 @ 标签）
    // 支持：@reserved、@reserved 描述文本
    const reservedRegex = /@reserved\s+([^\n*@]+)/g
    const matches = [...content.matchAll(reservedRegex)]

    if (matches.length === 0) continue

    // 取第一个 @reserved 描述
    const reservedDescription = matches[0][1].trim()

    const name = path.basename(file).replace(/\.ts$/, '')
    const exports = extractExports(content)

    stores.push({
      name,
      filePath: file,
      relativePath: relativeFromRoot(file),
      reservedDescription,
      exports,
    })
  }

  return stores
}

/**
 * 从 Store 文件内容中提取导出的符号（Hook、函数、类型、常量）。
 * 使用正则提取 export 语句，避免引入 TypeScript 编译器依赖。
 */
function extractExports(content: string): StoreExports {
  const hooks: string[] = []
  const functions: string[] = []
  const types: string[] = []
  const constants: string[] = []

  // 匹配 export const useXxxStore = ...
  const hookRegex = /export\s+const\s+(use\w+Store)\s*=/g
  let match: RegExpExecArray | null
  while ((match = hookRegex.exec(content)) !== null) {
    hooks.push(match[1]!)
  }

  // 匹配 export function xxx 或 export const xxx = (非 Hook)
  const funcRegex = /export\s+function\s+(\w+)/g
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1]
    if (!name?.startsWith('use')) {
      functions.push(name ?? '')
    } else if (!name?.endsWith('Store')) {
      functions.push(name ?? '')
    }
  }

  // 匹配 export const xxx = (非 Hook)
  const constRegex = /export\s+const\s+(\w+)\s*=/g
  while ((match = constRegex.exec(content)) !== null) {
    const name = match[1]
    if (!name?.startsWith('use') && !name?.endsWith('Store')) {
      constants.push(name ?? '')
    }
  }

  // 匹配 export type xxx 或 export interface xxx
  const typeRegex = /export\s+(?:type|interface)\s+(\w+)/g
  while ((match = typeRegex.exec(content)) !== null) {
    types.push(match[1]!)
  }

  return { hooks, functions, types, constants }
}

/**
 * 对单个 @reserved Store 执行全路径引用搜索。
 * 搜索范围：src/ 下的所有非测试 .ts/.tsx 文件（排除 Store 自身文件）。
 *
 * v1.1 改造：引入 import 路径验证机制。
 * - static/relative/dynamic-import 三种维度的命中直接视为已验证（verified=true）
 * - hook-call / function-call / type-reference 三种维度的命中需进一步验证：
 *   检查引用方文件中是否存在从 @/store/{storeName} 或 ./{storeName}
 *   明确导入该符号的 import 语句。若存在则 verified=true，否则 verified=false。
 */
function searchReferences(store: ReservedStore): StoreAuditResult {
  const references: Reference[] = []
  const storeName = store.name

  // 构建搜索模式列表
  const patterns: Array<{
    kind: ReferenceKind
    regex: RegExp
    symbol: string
    /** 是否需要 import 路径验证 */
    needsImportVerification: boolean
  }> = []

  // 1. 静态 import: from '@/store/xxxStore'（直接确认，无需验证）
  patterns.push({
    kind: 'static-import',
    regex: new RegExp(`from\\s+['"]@/store/${storeName}['"]`, 'g'),
    symbol: `@/store/${storeName}`,
    needsImportVerification: false,
  })

  // 2. 相对 import: from './xxxStore'（直接确认，无需验证）
  patterns.push({
    kind: 'relative-import',
    regex: new RegExp(`from\\s+['"]\\./${storeName}['"]`, 'g'),
    symbol: `./${storeName}`,
    needsImportVerification: false,
  })

  // 3. 动态 import: import('@/store/xxxStore')（直接确认，无需验证）
  patterns.push({
    kind: 'dynamic-import',
    regex: new RegExp(`import\\s*\\(\\s*['"]@/store/${storeName}['"]\\s*\\)`, 'g'),
    symbol: `import(@/store/${storeName})`,
    needsImportVerification: false,
  })

  // 4. Hook 调用（需 import 路径验证）
  for (const hook of store.exports.hooks) {
    patterns.push({
      kind: 'hook-call',
      regex: new RegExp(`\\b${escapeRegExp(hook)}\\b`, 'g'),
      symbol: hook,
      needsImportVerification: true,
    })
  }

  // 5. 派生函数引用（需 import 路径验证）
  for (const fn of store.exports.functions) {
    patterns.push({
      kind: 'function-call',
      regex: new RegExp(`\\b${escapeRegExp(fn)}\\b`, 'g'),
      symbol: fn,
      needsImportVerification: true,
    })
  }

  // 6. 类型引用（需 import 路径验证）
  for (const type of store.exports.types) {
    patterns.push({
      kind: 'type-reference',
      regex: new RegExp(`\\b${escapeRegExp(type)}\\b`, 'g'),
      symbol: type,
      needsImportVerification: true,
    })
  }

  // 7. 常量引用（需 import 路径验证）
  for (const constant of store.exports.constants) {
    patterns.push({
      kind: 'function-call',
      regex: new RegExp(`\\b${escapeRegExp(constant)}\\b`, 'g'),
      symbol: constant,
      needsImportVerification: true,
    })
  }

  // 扫描所有搜索目录
  for (const dir of SEARCH_DIRS) {
    const dirPath = path.join(SRC, dir)
    if (!fs.existsSync(dirPath)) continue

    const files = collectFiles(dirPath)
    for (const file of files) {
      const relFile = relativeFromRoot(file)
      if (shouldExclude(relFile)) continue

      // 排除 Store 自身文件（自引用不算）
      if (path.resolve(file) === path.resolve(store.filePath)) continue

      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      // v1.1 新增：预扫描引用方文件中的 import 语句，提取从该 Store 导入的符号集
      // 无论 patterns 是否需要验证，都先提取（避免在循环中重复提取）
      // 对于无需验证的维度（static/relative/dynamic-import），此集合不参与判断
      const importedSymbolsFromThisStore = extractImportedSymbolsFromStore(content, storeName)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line?.trim()!
        if (trimmed!.startsWith('//') || trimmed!.startsWith('*') || trimmed!.startsWith('/*')) continue

        for (const { kind, regex, symbol, needsImportVerification } of patterns) {
          regex.lastIndex = 0
          if (regex.test(line ?? '')) {
            // v1.1 改造：对需要 import 路径验证的维度，进行二次验证
            const verified = needsImportVerification
              ? importedSymbolsFromThisStore.has(symbol)
              : true

            references.push({
              file: relFile,
              line: i + 1,
              kind,
              symbol,
              context: trimmed!.slice(0, 100),
              verified,
            })
          }
        }
      }
    }
  }

  // 按引用方式分组统计
  const byKind: Record<ReferenceKind, number> = {
    'static-import': 0,
    'relative-import': 0,
    'dynamic-import': 0,
    'hook-call': 0,
    'function-call': 0,
    'type-reference': 0,
  }
  for (const ref of references) {
    byKind[ref.kind]++
  }

  const verifiedCount = references.filter((r) => r.verified).length
  const sameNameCollisionCount = references.length - verifiedCount

  return {
    storeName,
    storeFile: store.relativePath,
    reservedDescription: store.reservedDescription,
    references,
    verifiedCount,
    sameNameCollisionCount,
    referenceCount: references.length,
    // v1.1 改造：仅当存在已验证引用时才判为违规
    violated: verifiedCount > 0,
    byKind,
  }
}

/**
 * v1.1 新增：转义正则特殊字符，避免符号名中的特殊字符破坏正则匹配。
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * v1.1 新增：从引用方文件内容中提取"明确从 @/store/{storeName} 或 ./{storeName} 导入的符号集合"。
 *
 * 支持的 import 语句形式：
 *   1. import { useXxxStore, foo } from '@/store/xxxStore'
 *   2. import { useXxxStore, foo } from './xxxStore'
 *   3. import type { RiskVerdict } from '@/store/xxxStore'
 *   4. import { type RiskVerdict, useXxxStore } from '@/store/xxxStore'
 *   5. import useDefaultExport from '@/store/xxxStore'（默认导入不纳入符号验证）
 *
 * @returns 从该 Store 明确导入的具名符号集合（大括号内的标识符）
 */
function extractImportedSymbolsFromStore(
  fileContent: string,
  storeName: string,
): Set<string> {
  const symbols = new Set<string>()

  // 匹配两种路径前缀的 import 语句：
  //   1. from '@/store/{storeName}'
  //   2. from './{storeName}'
  // 两种路径都视为"从该 Store 导入"
  const importRegex = new RegExp(
    `import\\s+(?:type\\s+)?(?:(\\w+)(?:\\s*,\\s*)?)?\\{([^}]+)\\}\\s*from\\s*['"](?:@/store/${escapeRegExp(storeName)}|\\./${escapeRegExp(storeName)})['"]`,
    'g',
  )

  let match: RegExpExecArray | null
  while ((match = importRegex.exec(fileContent)) !== null) {
    const namedBlock = match[2]
    if (!namedBlock) continue

    // 解析大括号内的具名符号（支持 "type Foo" 语法）
    const parts = namedBlock.split(',')
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      // 处理 "type Foo" 和 "Foo as Bar" 两种形式
      const tokens = trimmed.split(/\s+as\s+/)
      const effective = tokens[0].trim()

      // 去除可能的 "type" 前缀
      const cleaned = effective.replace(/^type\s+/, '').trim()
      if (cleaned && /^[A-Za-z_$][\w$]*$/.test(cleaned)) {
        symbols.add(cleaned)
      }
    }
  }

  return symbols
}

// ============================================================
// 白盒导出：scan / formatReport / main
// ============================================================

/** 扫描函数（白盒导出，供测试和外部调用） */
export function scan(): Report {
  const reservedStores = findReservedStores()
  const stores: StoreAuditResult[] = []

  for (const store of reservedStores) {
    stores.push(searchReferences(store))
  }

  // v1.1 改造：violations 仅包含有"已验证引用"的 Store
  const violations = stores.filter((s) => s.violated)
  // warnings 包含零引用或仅有疑似同名碰撞的 Store
  const warnings = stores.filter((s) => !s.violated)

  // 统计扫描的文件总数
  let totalFilesScanned = 0
  for (const dir of SEARCH_DIRS) {
    const dirPath = path.join(SRC, dir)
    if (fs.existsSync(dirPath)) {
      totalFilesScanned += collectFiles(dirPath).filter((f) => !shouldExclude(relativeFromRoot(f))).length
    }
  }

  return {
    violations,
    warnings,
    stores,
    summary: {
      totalReservedStores: reservedStores.length,
      violatedStores: violations.length,
      cleanStores: warnings.length,
      totalReferences: stores.reduce((sum, s) => sum + s.referenceCount, 0),
      totalVerifiedReferences: stores.reduce((sum, s) => sum + s.verifiedCount, 0),
      totalSameNameCollisions: stores.reduce((sum, s) => sum + s.sameNameCollisionCount, 0),
      totalFilesScanned,
    },
  }
}

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  @reserved Store 引用完整性审计 — audit-reserved-stores v1.1')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  if (report.stores.length === 0) {
    lines.push(colorize('ℹ 未发现 @reserved 标记的 Store', 'yellow'))
    return lines.join('\n')
  }

  lines.push(`@reserved Store 总数: ${report.summary.totalReservedStores}`)
  lines.push(
    `合规: ${colorize(String(report.summary.cleanStores), 'green')} | ` +
      `违规: ${colorize(String(report.summary.violatedStores), report.summary.violatedStores > 0 ? 'red' : 'green')}`,
  )
  lines.push(`引用总数: ${report.summary.totalReferences}`)
  lines.push(
    `  已验证引用: ${colorize(String(report.summary.totalVerifiedReferences), report.summary.totalVerifiedReferences > 0 ? 'red' : 'green')}` +
      ` | 疑似同名碰撞: ${colorize(String(report.summary.totalSameNameCollisions), 'yellow')}`,
  )
  lines.push(`扫描文件数: ${report.summary.totalFilesScanned}`)
  lines.push('')

  // 违规 Store 详情（有已验证引用）
  if (report.violations.length > 0) {
    lines.push(colorize('════════════════════════════════════════════════════════════', 'red'))
    lines.push(colorize(`❌ 违规：${report.violations.length} 个 @reserved Store 有已验证引用`, 'red'))
    lines.push(colorize('════════════════════════════════════════════════════════════', 'red'))
    lines.push('')

    for (const store of report.violations) {
      const verifiedRefs = store.references.filter((r) => r.verified)
      lines.push(colorize(`  [违规] ${store.storeName} (${store.verifiedCount} 处已验证引用)`, 'red'))
      lines.push(`    文件: ${store.storeFile}`)
      lines.push(`    @reserved: ${store.reservedDescription}`)
      lines.push(`    引用方式: ${formatByKind(store.byKind)}`)
      lines.push(`    已验证引用详情:`)
      for (const ref of verifiedRefs.slice(0, 10)) {
        lines.push(`      ${ref.file}:${ref.line} [${ref.kind}] ${ref.symbol}`)
        lines.push(`        ${ref.context}`)
      }
      if (verifiedRefs.length > 10) {
        lines.push(`      ... 还有 ${verifiedRefs.length - 10} 处已验证引用`)
      }
      if (store.sameNameCollisionCount > 0) {
        lines.push(colorize(`    （另有 ${store.sameNameCollisionCount} 处疑似同名碰撞，未计入违规）`, 'yellow'))
      }
      lines.push('')
    }
  }

  // 合规 Store 详情（零已验证引用）
  if (report.warnings.length > 0) {
    lines.push(colorize('════════════════════════════════════════════════════════════', 'green'))
    lines.push(colorize(`✅ 合规：${report.warnings.length} 个 @reserved Store 零已验证引用`, 'green'))
    lines.push(colorize('════════════════════════════════════════════════════════════', 'green'))
    lines.push('')

    for (const store of report.warnings) {
      const collisionTag = store.sameNameCollisionCount > 0
        ? colorize(`（疑似同名碰撞 ${store.sameNameCollisionCount} 处，不计入违规）`, 'yellow')
        : ''
      lines.push(colorize(`  [合规] ${store.storeName} ${collisionTag}`, 'green'))
      lines.push(`    文件: ${store.storeFile}`)
      lines.push(`    @reserved: ${store.reservedDescription}`)
      lines.push(`    已验证引用数: 0`)
      if (store.sameNameCollisionCount > 0) {
        lines.push(`    疑似同名碰撞: ${store.sameNameCollisionCount} 处`)
        // 列出前 3 条疑似碰撞，供人工核对
        const collisions = store.references.filter((r) => !r.verified).slice(0, 3)
        for (const ref of collisions) {
          lines.push(`      ${ref.file}:${ref.line} [${ref.kind}] ${ref.symbol}`)
        }
        if (store.sameNameCollisionCount > 3) {
          lines.push(`      ... 还有 ${store.sameNameCollisionCount - 3} 处疑似碰撞`)
        }
      }
      lines.push('')
    }
  }

  lines.push('────────────────────────────────────────────────────────────')
  lines.push('检测维度（六重交叉验证 + import 路径验证）:')
  lines.push('  1. 静态 import: from "@/store/xxxStore"              → 直接确认')
  lines.push('  2. 相对 import: from "./xxxStore"（Facade 委托）     → 直接确认')
  lines.push('  3. 动态 import: import("@/store/xxxStore")            → 直接确认')
  lines.push('  4. Hook 调用: useXxxStore                            → 需 import 路径验证')
  lines.push('  5. 派生函数: Store 导出的所有函数名                 → 需 import 路径验证')
  lines.push('  6. 类型引用: Store 导出的所有类型名                 → 需 import 路径验证')
  lines.push('────────────────────────────────────────────────────────────')
  lines.push('v1.1 改造：仅当存在已验证引用时才判为违规，同名碰撞不计入违规')

  if (report.summary.violatedStores > 0) {
    lines.push(colorize('❌ 存在 @reserved Store 有已验证引用，请取消 @reserved 标记或移除引用', 'red'))
  } else {
    lines.push(colorize('✅ 所有 @reserved Store 均无已验证引用，状态正确', 'green'))
  }

  return lines.join('\n')
}

/** 格式化引用方式统计 */
function formatByKind(byKind: Record<ReferenceKind, number>): string {
  const parts: string[] = []
  if (byKind['static-import'] > 0) parts.push(`静态import=${byKind['static-import']}`)
  if (byKind['relative-import'] > 0) parts.push(`相对import=${byKind['relative-import']}`)
  if (byKind['dynamic-import'] > 0) parts.push(`动态import=${byKind['dynamic-import']}`)
  if (byKind['hook-call'] > 0) parts.push(`Hook=${byKind['hook-call']}`)
  if (byKind['function-call'] > 0) parts.push(`函数=${byKind['function-call']}`)
  if (byKind['type-reference'] > 0) parts.push(`类型=${byKind['type-reference']}`)
  return parts.length > 0 ? parts.join(', ') : '无'
}

/** CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit） */
export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'audit-reserved-stores',
    version: '1.1',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
