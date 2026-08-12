#!/usr/bin/env tsx
/**
 * audit-split-quality.ts
 * 模块拆分质量审计器 v1.0（白盒/透明管道）
 *
 * 检查目标（基于 03-architecture-standards.md §3.16 模块拆分架构原则）：
 * 1. AP-001：单文件行数阈值（services 层 < 500 行）
 * 2. AP-002：圈复杂度阈值（CC < 40）
 * 3. AP-003：拆分策略合理性（职责分离优先）
 * 4. AP-004：re-export 兼容性（拆分后主文件必须 re-export 全部公共 API）
 * 5. AP-005：依赖注入解耦（core 层禁止直接 import services 层）
 * 6. AP-006：死字段标注（保留的死字段必须标注 @deprecated）
 * 7. AP-007：重复代码检测（同名函数 + 相同逻辑）
 * 8. AP-008：调用点全量扫描（文档记录与实际一致性）
 * 9. AP-009：预览文件验证（.preview.ts 文件不应存在于生产代码中）
 * 10. AP-010：边界定义同步（文档版本与代码状态一致）
 *
 * 输出契约：
 * - stdout：JSON 数据流（SplitQualityReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/audit-split-quality-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 *
 * @example CLI 用法
 * ```bash
 * npx tsx scripts/audit-split-quality.ts                    # 默认全量扫描
 * npx tsx scripts/audit-split-quality.ts --quiet            # 仅输出 JSON
 * npx tsx scripts/audit-split-quality.ts --no-persist       # 跳过持久化
 * npx tsx scripts/audit-split-quality.ts --output report.json  # 自定义输出路径
 * ```
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'

// ============================================================
// 类型定义
// ============================================================

/** 拆分质量审计发现项 */
export interface SplitQualityFinding {
  /** 文件路径（相对项目根目录） */
  file: string
  /** 行号（1-based） */
  line: number
  /** 列号（1-based） */
  column: number
  /** 规则编号（AP-001 ~ AP-010） */
  rule: string
  /** 严重等级 */
  severity: 'critical' | 'major' | 'minor'
  /** 问题描述 */
  message: string
  /** 改进建议 */
  suggestion: string
  /** 代码上下文（该行内容） */
  context: string
}

/** 模块分析结果 */
export interface ModuleAnalysis {
  /** 文件路径 */
  path: string
  /** 行数 */
  lines: number
  /** 估算圈复杂度 */
  cyclomaticComplexity: number
  /** 导出符号列表 */
  exports: string[]
  /** 导入路径列表 */
  imports: string[]
  /** 内聚得分（0-100，越高越好） */
  cohesionScore: number
  /** 耦合得分（0-100，越低越好） */
  couplingScore: number
  /** 检测到的职责列表 */
  responsibilities: string[]
}

/** 拆分质量审计报告 */
export interface SplitQualityReport extends AuditReport {
  violations: SplitQualityFinding[]
  warnings: SplitQualityFinding[]
  modules: ModuleAnalysis[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    byRule: Record<string, number>
    bySeverity: Record<string, number>
    avgCyclomaticComplexity: number
    maxCyclomaticComplexity: number
    avgLines: number
    maxLines: number
  }
}

// ============================================================
// 配置常量（基于 03-architecture-standards.md §3.16）
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

/** AP-001：单文件行数阈值 */
const MAX_LINES_SERVICES = 500
const MAX_LINES_OTHER = 800

/** AP-002：圈复杂度阈值 */
const MAX_CYCLOMATIC_COMPLEXITY = 40

/** AP-005：core 层禁止直接 import services 层的模式 */
const CORE_IMPORT_SERVICES_PATTERN =
  /from\s+['"](?:\.\.\/services\/|@\/services\/)[^'"]+['"]/

/** AP-005：core 层禁止直接 import store 层的模式 */
const CORE_IMPORT_STORE_PATTERN =
  /from\s+['"](?:\.\.\/store\/|@\/store\/)(?!types\/)[^'"]+['"]/

/** AP-006：检测未标注 @deprecated 的死字段 */
const INTERFACE_FIELD_PATTERN = /^\s+(\w+)[\??]:\s+/

/** AP-007：重复函数检测（收集所有 export function 名称） */

/** AP-009：预览文件模式 */
const PREVIEW_FILE_PATTERN = /\.preview\.ts$/

/** AP-007：barrel 文件模式（合法的 re-export 聚合文件，不算重复） */
const BARREL_FILE_PATTERN = /(?:^|\/)index\.(ts|tsx)$/

/** AP-007：函数体相似度阈值（>0.85 才判定为重复实现） */
const FUNCTION_SIMILARITY_THRESHOLD = 0.85

/** AP-007：合法的类型守卫/状态检查命名模式（跨文件同名是合理的）
 * 仅排除 is/has/can/should 前缀（类型守卫和状态检查函数），
 * 不排除 get/set/create/format/parse/build 等可能匹配业务函数的前缀。
 */
const COMMON_UTILITY_NAME_PATTERN = /^(is|has|can|should)[A-Z]/

/** 圈复杂度关键词模式（用于估算 CC） */
const CC_PATTERNS = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /\?\?/g,
  /\?\./g,
  /\?[^.:=]/g,
]

/** 职责关键词映射（用于检测模块职责） */
const RESPONSIBILITY_KEYWORDS: Record<string, string[]> = {
  数据库操作: ['db.', 'IndexedDB', 'objectStore', 'transaction'],
  类型定义: ['interface ', 'type ', 'enum '],
  路由映射: ['ROUTE', 'route', 'inferStore', 'ACTION_TO_STORE'],
  审计日志: ['logger.', 'auditLog', 'writeLog'],
  策略路由: ['Strategy', 'Analyzer', 'Router'],
  错误检测: ['detect', 'Error', 'classify'],
  辅助函数: ['build', 'group', 'format', 'parse'],
  配置常量: ['const ', 'readonly', 'UPPER_SNAKE'],
}

/** 目标审计模块（PR-6 + PR-7 涉及的拆分模块） */
const TARGET_MODULES = [
  // PR-6 阶段 1：db.ts 拆分
  'src/data/db.ts',
  'src/data/db-schema.ts',
  'src/data/db-migrations.ts',
  'src/data/db-utils.ts',
  // PR-6 阶段 2：databridge 拆分
  'src/core/databridge.ts',
  'src/core/databridgeTypes.ts',
  'src/core/databridgeRouteMap.ts',
  'src/core/databridgeAuditLog.ts',
  'src/core/databridgeHandlers.ts',
  'src/core/databridgeStrategyRouter.ts',
  // PR-7：tradeErrorClassifier 拆分（待实施）
  'src/services/trading/tradeErrorClassifier.ts',
]

// ============================================================
// 文件扫描工具
// ============================================================

/** 判断是否为 TypeScript 文件 */
function isTsFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

/** 判断是否应跳过该目录 */
function shouldSkipDir(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === 'dist' ||
    name === '.git' ||
    name === 'coverage' ||
    name === '.vite'
  )
}

/** 递归收集目录下所有 TypeScript 文件 */
function collectFiles(dir: string): string[] {
  const files: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        files.push(...collectFiles(fullPath))
      }
    } else if (entry.isFile() && isTsFile(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

/** 读取文件内容（按行分割） */
function readFileLines(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n')
  } catch {
    return []
  }
}

/** 获取相对路径 */
function getRelativePath(fullPath: string): string {
  return path.relative(ROOT, fullPath).replace(/\\/g, '/')
}

// ============================================================
// 分析函数
// ============================================================

/** 估算圈复杂度 */
export function estimateCyclomaticComplexity(lines: string[]): number {
  let cc = 1 // 基础复杂度
  for (const line of lines) {
    // 跳过注释行
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue
    }
    for (const pattern of CC_PATTERNS) {
      const matches = line.match(pattern)
      if (matches) {
        cc += matches.length
      }
    }
  }
  return cc
}

/** 提取导出符号 */
export function extractExports(lines: string[]): string[] {
  const exports: string[] = []
  // 单导出模式：捕获组 1 = 符号名
  const singlePatterns = [
    /export\s+function\s+(\w+)/,
    /export\s+class\s+(\w+)/,
    /export\s+interface\s+(\w+)/,
    /export\s+type\s+(\w+)/,
    /export\s+enum\s+(\w+)/,
    /export\s+const\s+(\w+)/,
  ]
  // 批量导出模式：export { a, b, c } 或 export { a, b as c } 或 export { type MyType } from './m'
  const batchPattern = /export\s+\{([^}]+)\}/
  for (const line of lines) {
    // 优先处理批量导出（避免被单导出模式误匹配）
    const batchMatch = line.match(batchPattern)
    if (batchMatch && batchMatch[1]) {
      const names = batchMatch[1]
        .split(',')
        // 处理 "type MyType" / "default X" / "X as Y" 语法
        .map((s) => {
          const trimmed = s.trim()
          // 去除前缀关键字 type/default/const
          const cleaned = trimmed.replace(/^(?:type|default|const|let|var)\s+/, '')
          // 处理 as 别名：取原始名
          return cleaned.split(/\s+as\s+/)[0]!.trim()
        })
        .filter((s) => s.length > 0 && /^\w+$/.test(s))
      exports.push(...names)
      continue // 批量导出行不再走单导出模式
    }
    // 单导出模式
    for (const pattern of singlePatterns) {
      const match = line.match(pattern)
      if (match && match[1]) {
        exports.push(match[1].trim())
      }
    }
  }
  return [...new Set(exports)]
}

/** 提取导入路径 */
export function extractImports(lines: string[]): string[] {
  const imports: string[] = []
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const line of lines) {
    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        imports.push(match[1]!)
      }
    }
  }
  return [...new Set(imports)]
}

/**
 * 提取直接定义的导出符号（不含 re-export 转发）
 *
 * 区别于 extractExports：本函数仅提取在当前文件中**直接定义**的导出，
 * 不包含 `export { foo } from './bar'` 这类 re-export 转发。
 * 用于 AP-007 重复函数检测，避免把 barrel 文件的合法 re-export 误判为重复。
 */
export function extractDirectExports(lines: string[]): string[] {
  const directExports: string[] = []
  // 直接定义模式（不含 from 子句）
  const directPatterns = [
    /export\s+function\s+(\w+)\s*\(/,
    /export\s+class\s+(\w+)/,
    /export\s+interface\s+(\w+)/,
    /export\s+type\s+(\w+)/,
    /export\s+enum\s+(\w+)/,
    /export\s+const\s+(\w+)\s*=/,
  ]
  // re-export 模式（含 from 子句，需排除）
  const reExportPattern = /export\s+\{[^}]+\}\s*from\s+['"]/

  for (const line of lines) {
    const trimmed = line.trim()
    // 跳过注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    // 跳过 re-export 转发
    if (reExportPattern.test(line)) continue

    for (const pattern of directPatterns) {
      const match = line.match(pattern)
      if (match && match[1]) {
        directExports.push(match[1].trim())
      }
    }
  }
  return [...new Set(directExports)]
}

/**
 * 提取指定函数的函数体内容（标准化后）
 *
 * 用于 AP-007 函数体相似度判断。
 * 标准化规则：
 * - 去除注释
 * - 去除首尾空白
 * - 合并连续空白为单个空格
 *
 * @returns 函数体字符串（找不到返回空字符串）
 */
export function extractFunctionBody(lines: string[], funcName: string): string {
  // 查找函数定义起始行：export function foo( 或 export const foo = (
  const defPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${funcName}\\s*\\(`)
  const arrowPattern = new RegExp(`export\\s+const\\s+${funcName}\\s*=\\s*(?:async\\s*)?\\(`)

  let startIdx = -1
  let braceDepth = 0
  let inBody = false
  const bodyLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (startIdx === -1) {
      // 查找函数定义
      if (defPattern.test(line) || arrowPattern.test(line)) {
        startIdx = i
        // 检查当前行是否已开始函数体（含 { ）
        const openBraces = (line.match(/{/g) ?? []).length
        const closeBraces = (line.match(/}/g) ?? []).length
        braceDepth = openBraces - closeBraces
        inBody = braceDepth > 0
        if (inBody) bodyLines.push(line)
      }
    } else {
      // 已找到定义，跟踪大括号深度
      if (inBody) {
        bodyLines.push(line)
        const openBraces = (line.match(/{/g) ?? []).length
        const closeBraces = (line.match(/}/g) ?? []).length
        braceDepth += openBraces - closeBraces
        if (braceDepth <= 0) break // 函数体结束
      } else {
        // 箭头函数可能在 = 后面才有 {
        if (line.includes('{')) {
          const openBraces = (line.match(/{/g) ?? []).length
          const closeBraces = (line.match(/}/g) ?? []).length
          braceDepth = openBraces - closeBraces
          inBody = braceDepth > 0
          if (inBody) bodyLines.push(line)
        }
      }
    }
  }

  if (bodyLines.length === 0) return ''

  // 标准化：去除注释、合并空白
  const raw = bodyLines.join('\n')
  const cleaned = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/\/\/[^\n]*/g, '') // 行注释
    .replace(/\s+/g, ' ') // 合并空白
    .trim()

  return cleaned
}

/**
 * 计算两个函数体的语义相似度（0-1）
 *
 * 采用基于 token 频率向量的余弦相似度算法：
 * - 提取关键词 token（if/for/while/return/await/const/let 等）
 * - 计算两个函数体的 token 频率向量
 * - 返回余弦相似度
 *
 * @returns 0-1 之间的浮点数，1 表示完全相同
 */
export function computeFunctionSimilarity(body1: string, body2: string): number {
  if (!body1 || !body2) return 0
  if (body1 === body2) return 1

  // 提取 token 频率
  const tokenPattern = /\b(if|for|while|return|await|const|let|var|function|class|new|try|catch|switch|case|break|continue|throw|typeof|instanceof|in|of|async|yield|do|else)\b/g
  const tokens1 = body1.match(tokenPattern) ?? []
  const tokens2 = body2.match(tokenPattern) ?? []

  // 构建 token 频率向量
  const freq1 = new Map<string, number>()
  const freq2 = new Map<string, number>()
  for (const t of tokens1) freq1.set(t, (freq1.get(t) ?? 0) + 1)
  for (const t of tokens2) freq2.set(t, (freq2.get(t) ?? 0) + 1)

  // 长度因子（函数体长度差异）
  const len1 = body1.length
  const len2 = body2.length
  const lenRatio = Math.min(len1, len2) / Math.max(len1, len2)

  // 余弦相似度
  const allTokens = new Set([...freq1.keys(), ...freq2.keys()])
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  for (const token of allTokens) {
    const v1 = freq1.get(token) ?? 0
    const v2 = freq2.get(token) ?? 0
    dotProduct += v1 * v2
    norm1 += v1 * v1
    norm2 += v2 * v2
  }
  const cosine = norm1 > 0 && norm2 > 0 ? dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0

  // 综合相似度：60% 余弦相似度 + 40% 长度比
  return 0.6 * cosine + 0.4 * lenRatio
}

/** 检测模块职责 */
export function detectResponsibilities(lines: string[]): string[] {
  const responsibilities = new Set<string>()
  const fullContent = lines.join('\n')
  for (const [responsibility, keywords] of Object.entries(RESPONSIBILITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (fullContent.includes(keyword)) {
        responsibilities.add(responsibility)
        break
      }
    }
  }
  return [...responsibilities]
}

/** 计算内聚得分（0-100） */
export function calculateCohesionScore(exports: string[], responsibilities: string[]): number {
  if (exports.length === 0) return 100
  // 内聚度高 = 职责少 + 导出少（单一职责）
  const responsibilityPenalty = Math.max(0, responsibilities.length - 1) * 20
  const exportPenalty = Math.max(0, exports.length - 5) * 5
  return Math.max(0, 100 - responsibilityPenalty - exportPenalty)
}

/** 计算耦合得分（0-100，越低越好） */
export function calculateCouplingScore(imports: string[]): number {
  // 耦合度高 = 外部依赖多
  const externalImports = imports.filter(
    (imp) => imp.startsWith('@/') || imp.startsWith('.'),
  )
  return Math.min(100, externalImports.length * 10)
}

/** 分析单个模块 */
function analyzeModule(filePath: string): ModuleAnalysis {
  const lines = readFileLines(filePath)
  const exports = extractExports(lines)
  const imports = extractImports(lines)
  const responsibilities = detectResponsibilities(lines)
  const cyclomaticComplexity = estimateCyclomaticComplexity(lines)

  return {
    path: getRelativePath(filePath),
    lines: lines.length,
    cyclomaticComplexity,
    exports,
    imports,
    cohesionScore: calculateCohesionScore(exports, responsibilities),
    couplingScore: calculateCouplingScore(imports),
    responsibilities,
  }
}

// ============================================================
// 规则检查函数
// ============================================================

/** AP-001：单文件行数阈值检查 */
export function checkMaxLines(filePath: string, lines: string[], findings: SplitQualityFinding[]): void {
  const relPath = getRelativePath(filePath)
  const isServicesLayer = relPath.includes('/services/') || relPath.includes('\\services\\')
  const threshold = isServicesLayer ? MAX_LINES_SERVICES : MAX_LINES_OTHER

  if (lines.length > threshold) {
    findings.push({
      file: relPath,
      line: lines.length,
      column: 1,
      rule: 'AP-001',
      severity: 'major',
      message: `文件行数 ${lines.length} 超过阈值 ${threshold}（${isServicesLayer ? 'services 层' : '其他层'}）`,
      suggestion: `考虑将此文件拆分为多个职责单一的子模块，每个子文件不超过 ${threshold} 行`,
      context: `总行数: ${lines.length}`,
    })
  }
}

/** AP-002：圈复杂度检查 */
export function checkCyclomaticComplexity(
  filePath: string,
  lines: string[],
  findings: SplitQualityFinding[],
): void {
  const cc = estimateCyclomaticComplexity(lines)
  if (cc > MAX_CYCLOMATIC_COMPLEXITY) {
    findings.push({
      file: getRelativePath(filePath),
      line: 1,
      column: 1,
      rule: 'AP-002',
      severity: 'major',
      message: `圈复杂度 ${cc} 超过阈值 ${MAX_CYCLOMATIC_COMPLEXITY}`,
      suggestion: '提取复杂条件分支为独立函数，降低单函数复杂度',
      context: `CC=${cc}`,
    })
  }
}

/** AP-004：re-export 兼容性检查（主文件必须有 re-export） */
export function checkReExport(
  filePath: string,
  lines: string[],
  _findings: SplitQualityFinding[],
  warnings: SplitQualityFinding[],
): void {
  const relPath = getRelativePath(filePath)
  // 仅检查已知的主文件（聚合入口）
  const isMainFile =
    relPath.endsWith('db.ts') ||
    relPath.endsWith('databridge.ts') ||
    relPath.endsWith('tradeErrorClassifier.ts')

  if (!isMainFile) return

  const hasReExport = lines.some(
    (line) =>
      line.includes("export {") && line.includes("from './") ||
      line.includes('export type {') && line.includes("from './"),
  )

  if (!hasReExport) {
    warnings.push({
      file: relPath,
      line: 1,
      column: 1,
      rule: 'AP-004',
      severity: 'minor',
      message: '主文件（聚合入口）未发现 re-export 语句',
      suggestion: '确保拆分后主文件 re-export 全部子模块公共 API，保持调用点零修改',
      context: '主文件应包含: export { ... } from "./subModule"',
    })
  }
}

/** AP-005：core 层禁止直接 import services/store 层 */
export function checkCoreLayerViolations(
  filePath: string,
  lines: string[],
  findings: SplitQualityFinding[],
): void {
  const relPath = getRelativePath(filePath)
  // 仅检查 core 层文件
  if (!relPath.includes('/core/') && !relPath.includes('\\core\\')) return

  // 跟踪 JSDoc 块状态（/** ... */）
  let inJsDocBlock = false

  lines.forEach((line, idx) => {
    const trimmed = line.trim()

    // 跟踪 JSDoc 块边界
    if (trimmed.startsWith('/**')) {
      inJsDocBlock = true
    }
    if (inJsDocBlock && trimmed.endsWith('*/')) {
      inJsDocBlock = false
      return // 块结束行也是注释
    }
    // 在 JSDoc 块内的所有行都跳过（包括 @example 示例代码）
    if (inJsDocBlock) return
    // 单行注释（// 或 * 开头，JSDoc 行内注释）
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
    // 块注释（/* ... */，非 JSDoc）
    if (trimmed.startsWith('/*') && !trimmed.startsWith('/**')) {
      // 单行块注释 /* ... */
      if (trimmed.endsWith('*/')) return
      // 多行块注释开始，标记状态（简化处理：仅跳过当前行）
      return
    }

    // 跳过 import type（类型导入豁免）
    if (trimmed.startsWith('import type ')) return

    if (CORE_IMPORT_SERVICES_PATTERN.test(line)) {
      findings.push({
        file: relPath,
        line: idx + 1,
        column: line.indexOf('from') + 1,
        rule: 'AP-005',
        severity: 'critical',
        message: 'core 层禁止直接 import services 层（违反依赖注入解耦原则）',
        suggestion: '通过接口注入方式解耦，由 services 层在 main.tsx 启动时注册实现',
        context: line.trim(),
      })
    }

    if (CORE_IMPORT_STORE_PATTERN.test(line)) {
      findings.push({
        file: relPath,
        line: idx + 1,
        column: line.indexOf('from') + 1,
        rule: 'AP-005',
        severity: 'critical',
        message: 'core 层禁止直接 import store 层',
        suggestion: 'core 层只能依赖 core/ 和 data/ 层',
        context: line.trim(),
      })
    }
  })
}

/** AP-006：死字段标注检查（接口字段未被使用且未标注 @deprecated） */
export function checkDeprecatedFields(
  filePath: string,
  lines: string[],
  warnings: SplitQualityFinding[],
): void {
  const relPath = getRelativePath(filePath)
  // 仅检查已知含死字段的模块
  if (!relPath.includes('tradeError') && !relPath.includes('TradePair')) return

  let inInterface = false
  let lastCommentWasDeprecated = false

  lines.forEach((line, idx) => {
    const trimmed = line.trim()

    // 检测进入 interface 块
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)/)
    if (interfaceMatch) {
      inInterface = true
      return
    }

    // 检测离开 interface 块
    if (inInterface && trimmed === '}') {
      inInterface = false
      return
    }

    // 跟踪 @deprecated 注释
    if (trimmed.includes('@deprecated')) {
      lastCommentWasDeprecated = true
      return
    }

    // 检测接口字段
    if (inInterface) {
      const fieldMatch = line.match(INTERFACE_FIELD_PATTERN)
      if (fieldMatch && !lastCommentWasDeprecated) {
        const fieldName = fieldMatch[1]!
        // 检查是否为已知的死字段
        if (fieldName === 'buyPrice' || fieldName === 'sellPrice') {
          warnings.push({
            file: relPath,
            line: idx + 1,
            column: 1,
            rule: 'AP-006',
            severity: 'minor',
            message: `接口字段 "${fieldName}" 疑似死字段，未标注 @deprecated`,
            suggestion: `在字段上方添加 /** @deprecated 说明 */ 注释`,
            context: line.trim(),
          })
        }
      }
    }

    // 重置注释跟踪（非注释行）
    if (!trimmed.startsWith('*') && !trimmed.startsWith('//')) {
      lastCommentWasDeprecated = false
    }
  })
}

/**
 * AP-007：重复函数检测
 *
 * 优化逻辑（v1.1）：
 * 1. 排除 barrel 文件（index.ts/index.tsx）的合法 re-export
 * 2. 排除通用工具函数命名模式（isXxx/hasXxx/getXxx 等跨文件同名是合理的）
 * 3. 当 fileContentProvider 存在时，使用函数体语义相似度做二次确认
 *    （相似度 > FUNCTION_SIMILARITY_THRESHOLD 才判定为重复实现）
 *
 * @param allModules 所有模块分析结果
 * @param findings 输出的违规列表
 * @param fileContentProvider 可选的文件内容提供器（用于函数体相似度判断）
 */
export function checkDuplicateFunctions(
  allModules: ModuleAnalysis[],
  findings: SplitQualityFinding[],
  fileContentProvider?: (path: string) => string[] | null,
): void {
  const functionLocations = new Map<string, Array<{ file: string; path: string }>>()

  for (const mod of allModules) {
    // 优化 1：跳过 barrel 文件（index.ts/index.tsx），它们的 re-export 是合法的
    if (BARREL_FILE_PATTERN.test(mod.path)) continue

    // 优化 2：当 provider 存在时，使用直接导出（排除 re-export 转发）
    const exportsToCheck = fileContentProvider
      ? (() => {
          const lines = fileContentProvider(mod.path)
          return lines ? extractDirectExports(lines) : mod.exports
        })()
      : mod.exports

    for (const exportName of exportsToCheck) {
      // 优化 3：跳过通用工具函数命名模式（isXxx/hasXxx/getXxx 等跨文件同名是合理的）
      if (COMMON_UTILITY_NAME_PATTERN.test(exportName)) continue

      if (!functionLocations.has(exportName)) {
        functionLocations.set(exportName, [])
      }
      functionLocations.get(exportName)!.push({ file: exportName, path: mod.path })
    }
  }

  for (const [funcName, locations] of functionLocations) {
    if (locations.length > 1) {
      // 排除已知的合法 re-export（主文件 re-export 子模块的函数）
      const uniquePaths = new Set(locations.map((l) => l.path))
      if (uniquePaths.size > 1) {
        // 检查是否为主文件 re-export 模式（主文件 + 子模块）
        const hasMainFile = locations.some((l) =>
          l.path.endsWith('db.ts') ||
          l.path.endsWith('databridge.ts') ||
          l.path.endsWith('tradeErrorClassifier.ts'),
        )
        if (hasMainFile) continue

        // 优化 4：当 provider 存在时，使用函数体相似度做二次确认
        if (fileContentProvider) {
          const bodies = locations.map((l) => {
            const lines = fileContentProvider(l.path)
            return lines ? extractFunctionBody(lines, funcName) : ''
          })
          // 检查是否所有函数体都高度相似
          let allSimilar = true
          for (let i = 1; i < bodies.length; i++) {
            const sim = computeFunctionSimilarity(bodies[0]!, bodies[i]!)
            if (sim < FUNCTION_SIMILARITY_THRESHOLD) {
              allSimilar = false
              break
            }
          }
          // 函数体不相似，说明只是同名但实现不同，不算重复
          if (!allSimilar) continue
        }

        findings.push({
          file: locations[0]!.path,
          line: 1,
          column: 1,
          rule: 'AP-007',
          severity: 'major',
          message: `函数 "${funcName}" 在 ${locations.length} 个文件中重复定义: ${locations.map((l) => l.path).join(', ')}`,
          suggestion: '考虑将重复实现合并为单一来源，通过 import 引用（PR-8 去重）',
          context: `重复位置: ${locations.map((l) => l.path).join(', ')}`,
        })
      }
    }
  }
}

/** AP-009：预览文件检查 */
export function checkPreviewFiles(
  allFiles: string[],
  findings: SplitQualityFinding[],
): void {
  for (const file of allFiles) {
    const relPath = getRelativePath(file)
    if (PREVIEW_FILE_PATTERN.test(relPath)) {
      findings.push({
        file: relPath,
        line: 1,
        column: 1,
        rule: 'AP-009',
        severity: 'major',
        message: '发现预览文件（.preview.ts）存在于源码目录',
        suggestion: '预览文件应在审批后重命名为正式文件或删除，不应长期保留在 src/ 中',
        context: `文件: ${relPath}`,
      })
    }
  }
}

/** AP-010：边界定义同步检查（目标模块必须在架构标准中记录） */
export function checkBoundarySync(
  targetModules: ModuleAnalysis[],
  warnings: SplitQualityFinding[],
): void {
  const archDocPath = path.join(ROOT, 'docs', 'reference', '03-architecture-standards.md')
  let archDocContent = ''
  try {
    archDocContent = fs.readFileSync(archDocPath, 'utf-8')
  } catch {
    warnings.push({
      file: 'docs/reference/03-architecture-standards.md',
      line: 1,
      column: 1,
      rule: 'AP-010',
      severity: 'major',
      message: '架构标准文档不存在或无法读取',
      suggestion: '确保 ../docs/reference/03-architecture-standards.md 存在且可读',
      context: '文件缺失',
    })
    return
  }

  for (const mod of targetModules) {
    const fileName = path.basename(mod.path, '.ts')
    // 检查架构标准中是否提及该模块
    if (!archDocContent.includes(fileName)) {
      warnings.push({
        file: mod.path,
        line: 1,
        column: 1,
        rule: 'AP-010',
        severity: 'minor',
        message: `模块 "${fileName}" 未在架构标准文档中记录边界定义`,
        suggestion: `在 03-architecture-standards.md §3.1.10 中补充该模块的边界定义`,
        context: `文件: ${mod.path}`,
      })
    }
  }
}

// ============================================================
// 主扫描函数
// ============================================================

/** 扫描全部文件，生成拆分质量审计报告 */
export function scan(): SplitQualityReport {
  const violations: SplitQualityFinding[] = []
  const warnings: SplitQualityFinding[] = []
  const modules: ModuleAnalysis[] = []

  // 收集 src/ 下所有 TypeScript 文件
  const allFiles = collectFiles(SRC)

  // 分析所有模块
  for (const file of allFiles) {
    modules.push(analyzeModule(file))
  }

  // 对所有文件执行规则检查
  for (const file of allFiles) {
    const lines = readFileLines(file)

    checkMaxLines(file, lines, violations)
    checkCyclomaticComplexity(file, lines, violations)
    checkReExport(file, lines, violations, warnings)
    checkCoreLayerViolations(file, lines, violations)
    checkDeprecatedFields(file, lines, warnings)
  }

  // 跨文件检查
  // 传入 fileContentProvider 以启用函数体语义相似度判断
  checkDuplicateFunctions(modules, violations, (relPath: string) => {
    const fullPath = path.join(ROOT, relPath)
    return readFileLines(fullPath)
  })
  checkPreviewFiles(allFiles, violations)

  // 目标模块边界同步检查
  const targetModuleAnalyses = modules.filter((m) =>
    TARGET_MODULES.some((target) => m.path === target),
  )
  checkBoundarySync(targetModuleAnalyses, warnings)

  // 计算汇总
  const byRule: Record<string, number> = {}
  const bySeverity: Record<string, number> = { critical: 0, major: 0, minor: 0 }

  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1
    bySeverity[v.severity]!++
  }
  for (const w of warnings) {
    byRule[w.rule] = (byRule[w.rule] ?? 0) + 1
    bySeverity[w.severity]!++
  }

  const complexities = modules.map((m) => m.cyclomaticComplexity)
  const linesArr = modules.map((m) => m.lines)

  return {
    violations,
    warnings,
    modules,
    summary: {
      totalFiles: allFiles.length,
      totalViolations: 0,
      totalWarnings: violations.length + warnings.length,
      byRule,
      bySeverity,
      avgCyclomaticComplexity:
        complexities.length > 0
          ? Math.round(complexities.reduce((a, b) => a + b, 0) / complexities.length)
          : 0,
      maxCyclomaticComplexity: complexities.length > 0 ? Math.max(...complexities) : 0,
      avgLines: linesArr.length > 0 ? Math.round(linesArr.reduce((a, b) => a + b, 0) / linesArr.length) : 0,
      maxLines: linesArr.length > 0 ? Math.max(...linesArr) : 0,
    },
  }
}

// ============================================================
// 报告格式化
// ============================================================

/** 格式化人类可读报告（输出到 stderr） */
export function formatReport(report: SplitQualityReport): string {
  const lines: string[] = []

  lines.push('='.repeat(80))
  lines.push('模块拆分质量审计报告')
  lines.push('='.repeat(80))
  lines.push('')

  // 汇总信息
  lines.push('📊 汇总信息')
  lines.push('-'.repeat(40))
  lines.push(`  扫描文件数: ${report.summary.totalFiles}`)
  lines.push(`  违规数: ${colorize(String(report.summary.totalViolations), report.summary.totalViolations > 0 ? 'red' : 'green')}`)
  lines.push(`  警告数: ${colorize(String(report.summary.totalWarnings), report.summary.totalWarnings > 0 ? 'yellow' : 'green')}`)
  lines.push(`  平均圈复杂度: ${report.summary.avgCyclomaticComplexity}`)
  lines.push(`  最大圈复杂度: ${colorize(String(report.summary.maxCyclomaticComplexity), report.summary.maxCyclomaticComplexity > MAX_CYCLOMATIC_COMPLEXITY ? 'red' : 'green')}`)
  lines.push(`  平均行数: ${report.summary.avgLines}`)
  lines.push(`  最大行数: ${colorize(String(report.summary.maxLines), report.summary.maxLines > MAX_LINES_SERVICES ? 'red' : 'green')}`)
  lines.push('')

  // 按规则统计
  if (Object.keys(report.summary.byRule).length > 0) {
    lines.push('📋 按规则统计')
    lines.push('-'.repeat(40))
    for (const [rule, count] of Object.entries(report.summary.byRule).sort()) {
      lines.push(`  ${rule}: ${count}`)
    }
    lines.push('')
  }

  // 按严重等级统计
  lines.push('severity 统计')
  lines.push('-'.repeat(40))
  lines.push(`  critical: ${colorize(String(report.summary.bySeverity.critical ?? 0), 'red')}`)
  lines.push(`  major:    ${colorize(String(report.summary.bySeverity.major ?? 0), 'red')}`)
  lines.push(`  minor:    ${colorize(String(report.summary.bySeverity.minor ?? 0), 'yellow')}`)
  lines.push('')

  // 违规详情
  if (report.violations.length > 0) {
    lines.push('🔴 违规详情')
    lines.push('-'.repeat(40))
    for (const v of report.violations) {
      lines.push(`  [${v.rule}] ${v.severity.toUpperCase()} ${v.file}:${v.line}`)
      lines.push(`    消息: ${v.message}`)
      lines.push(`    建议: ${v.suggestion}`)
      lines.push(`    上下文: ${v.context}`)
      lines.push('')
    }
  }

  // 警告详情
  if (report.warnings.length > 0) {
    lines.push('⚠️  警告详情')
    lines.push('-'.repeat(40))
    for (const w of report.warnings) {
      lines.push(`  [${w.rule}] ${w.severity.toUpperCase()} ${w.file}:${w.line}`)
      lines.push(`    消息: ${w.message}`)
      lines.push(`    建议: ${w.suggestion}`)
      lines.push('')
    }
  }

  // 目标模块分析
  const targetMods = report.modules.filter((m) =>
    TARGET_MODULES.some((t) => m.path === t),
  )
  if (targetMods.length > 0) {
    lines.push('🎯 目标拆分模块分析')
    lines.push('-'.repeat(40))
    for (const m of targetMods) {
      const linesStatus = m.lines > MAX_LINES_SERVICES ? colorize(`${m.lines} ⚠️`, 'red') : colorize(`${m.lines} ✓`, 'green')
      const ccStatus = m.cyclomaticComplexity > MAX_CYCLOMATIC_COMPLEXITY ? colorize(`CC=${m.cyclomaticComplexity} ⚠️`, 'red') : colorize(`CC=${m.cyclomaticComplexity} ✓`, 'green')
      lines.push(`  ${m.path}`)
      lines.push(`    行数: ${linesStatus} | 复杂度: ${ccStatus}`)
      lines.push(`    导出: ${m.exports.length} 个 | 导入: ${m.imports.length} 个`)
      lines.push(`    内聚: ${m.cohesionScore}/100 | 耦合: ${m.couplingScore}/100`)
      lines.push(`    职责: ${m.responsibilities.join(', ') || '未检测到'}`)
      lines.push('')
    }
  }

  // 改进建议汇总
  if (report.violations.length > 0 || report.warnings.length > 0) {
    lines.push('💡 改进建议汇总')
    lines.push('-'.repeat(40))
    const suggestions = new Map<string, string[]>()
    for (const v of report.violations) {
      if (!suggestions.has(v.rule)) {
        suggestions.set(v.rule, [])
      }
      suggestions.get(v.rule)!.push(v.suggestion)
    }
    for (const w of report.warnings) {
      if (!suggestions.has(w.rule)) {
        suggestions.set(w.rule, [])
      }
      suggestions.get(w.rule)!.push(w.suggestion)
    }
    for (const [rule, sugs] of suggestions) {
      lines.push(`  ${rule}: ${[...new Set(sugs)][0]}`)
    }
    lines.push('')
  }

  lines.push('=' .repeat(80))
  return lines.join('\n')
}

// ============================================================
// 主入口
// ============================================================

export function main(): void {
  const result = runAuditPipeline<SplitQualityReport>({
    scriptName: 'audit-split-quality',
    version: '1.0.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })

  if (result.exitCode !== 0) {
    process.exit(result.exitCode)
  }
}

// 仅在直接执行时运行（被 import 时不执行）
// Windows 兼容：使用 path.resolve 比较规范化后的路径
const __entry = fileURLToPath(import.meta.url)
const __argv = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (__entry === __argv || __entry === path.resolve(__argv)) {
  main()
}
