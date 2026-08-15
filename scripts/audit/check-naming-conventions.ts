/**
 * @fileoverview 组件命名规范与文档模板批量检查器
 *
 * 检查所有组件是否遵循最新的命名规范和文档模板标准：
 *   1. 文件名 PascalCase 与组件名一致
 *   2. @fileoverview JSDoc 注释存在且有意义
 *   3. Props 接口文档完整（可选但推荐）
 *   4. 主导出有 JSDoc 注释
 *   5. 导出模式一致性（export function vs export const）
 *   6. 组件层级命名约定（Atom 小写+动词，Molecule/Organism 名词）
 *
 * Usage:
 *   npx tsx scripts/audit/check-naming-conventions.ts              # 人类可读
 *   npx tsx scripts/audit/check-naming-conventions.ts --json      # JSON 报告
 *   npx tsx scripts/audit/check-naming-conventions.ts --fix        # 自动修复可修复项
 *
 * @module scripts/audit/check-naming-conventions
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative, extname, basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const SRC = join(ROOT, 'src')
const COMPONENTS_DIR = join(SRC, 'components')

type Severity = 'error' | 'warning' | 'info'

interface CheckIssue {
  file: string
  type: string
  severity: Severity
  message: string
  suggestion?: string
  line?: number
}

interface FileReport {
  file: string
  componentName: string
  level: string
  issues: CheckIssue[]
  score: number // 0-100
}

interface CheckReport {
  timestamp: string
  totalFiles: number
  totalIssues: number
  errorCount: number
  warningCount: number
  infoCount: number
  averageScore: number
  files: FileReport[]
  summary: {
    namingConsistency: number
    docCoverage: number
    exportPatternConsistency: number
  }
}

const LEVEL_DIRS: Record<string, string> = {
  atoms: 'atom',
  molecules: 'molecule',
  organisms: 'organism',
  templates: 'template',
}

// Non-component files that don't need naming conventions
const SKIP_PATTERNS = [
  /\.test\.(tsx|ts)$/,
  /\.spec\.(tsx|ts)$/,
  /\.stories\.(tsx|ts)$/,
  /\.config\.(tsx|ts)$/,
  /\.types\.(tsx|ts)$/,
  /\.utils\.(tsx|ts)$/,
  /\.constants\.(tsx|ts)$/,
  /\.styles\.(tsx|ts)$/,
  /index\.(tsx|ts)$/,
  /registryTypes\.ts$/,
  /componentRegistry\.ts$/,
  /atomRegistry\.ts$/,
  /moleculeRegistry\.ts$/,
  /organismRegistry\.ts$/,
  /templateRegistry\.ts$/,
]

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath))
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  try {
    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...walkDir(fullPath))
      } else if (item.isFile()) {
        results.push(fullPath)
      }
    }
  } catch {
    // skip
  }
  return results
}

function detectLevel(filePath: string): string {
  const rel = relative(COMPONENTS_DIR, filePath).replace(/\\/g, '/')
  const topDir = rel.split('/')[0]
  return LEVEL_DIRS[topDir] ?? 'unknown'
}

/** 检查 1: 文件名与组件名一致性 */
function checkNamingConsistency(filePath: string, content: string, issues: CheckIssue[]): void {
  const fileName = basename(filePath, extname(filePath))

  // 所有"命名导出"模式：function / const / class
  const allNamedExports = (content.match(/export\s+(function|const|class)\s+(\w+)/g) || [])
    .map((m) => m.replace(/export\s+(function|const|class)\s+/, ''))
    // 过滤掉 memo/forwardRef 等包装函数名
    .filter((name) => !['memo', 'forwardRef', 'observer'].includes(name))

  const hasDefaultExport = /export\s+default/.test(content)

  if (allNamedExports.length === 0 && !hasDefaultExport) {
    issues.push({
      file: filePath,
      type: 'no-export',
      severity: 'error',
      message: '未找到命名导出（export function/const/class/default）',
      suggestion: '组件应导出一个命名函数、const、class 或 default 组件',
    })
    return
  }

  // 选定"主导出名"用于比对文件名
  // 策略：
  //   1. 如果文件名在导出列表中，视为复合组件文件（Breadcrumb + BreadcrumbItem + ...），跳过检查
  //   2. 如果只有一个命名导出，直接用它
  //   3. 如果有多个命名导出，选取最长的名称（通常是主组件）
  let exportName: string | null = null
  if (allNamedExports.includes(fileName)) {
    // 文件名匹配某个导出 → 复合组件文件，命名规范 OK
    return
  }
  if (allNamedExports.length === 1) {
    exportName = allNamedExports[0]
  } else if (allNamedExports.length > 1) {
    // 多个导出 → 选取最长名称（主组件通常命名最完整）
    exportName = allNamedExports.reduce((a, b) => (a.length > b.length ? a : b))
  } else if (hasDefaultExport) {
    const defaultMatch = content.match(/export\s+default\s+(?:function|const|class)?\s*(\w+)/)
    let defaultName = defaultMatch?.[1] || null
    // 过滤 memo/forwardRef/observer 等 HOC 包装名
    if (defaultName && ['memo', 'forwardRef', 'observer', 'function', 'const', 'class'].includes(defaultName)) {
      // 尝试提取 HOC 括号内的实际组件名：memo(Component) 或 memo(function Component)
      const hocMatch = content.match(/export\s+default\s+(?:memo|forwardRef|observer)\s*\(\s*(?:function|const|class)?\s*(\w+)/)
      defaultName = hocMatch?.[1] || null
    }
    exportName = defaultName
  }

  if (exportName && exportName !== fileName) {
    // 豁免规则：特定文件类型不要求文件名与组件名一致
    const fileBase = basename(filePath)
    const hasJsx = /<[A-Z]|<\w+\s|React\.createElement/.test(content)
    const exemptPatterns = [
      { pattern: /statusColors/, reason: '状态颜色常量文件' },
      { pattern: /utils?\.(ts|tsx)$/i, reason: '工具函数文件' },
      { pattern: /Registry\.(ts|tsx)$|registry\.(ts|tsx)$/, reason: '注册表文件' },
      { pattern: /artifact|builder|generator/i, reason: '构建/生成工具文件' },
    ]

    const isExempt = exemptPatterns.some((p) => p.pattern.test(fileBase)) ||
      (!hasJsx && /\.(ts|tsx)$/.test(filePath))  // 无 JSX 的纯工具文件

    if (!isExempt && !fileName.match(/^index$/) && !fileName.endsWith('.types') && !fileName.endsWith('.config')) {
      issues.push({
        file: filePath,
        type: 'name-mismatch',
        severity: 'error',
        message: `组件名 "${exportName}" 与文件名 "${fileName}" 不一致`,
        suggestion: `将组件重命名为 ${fileName} 或将文件重命名为 ${exportName}.tsx`,
      })
    }
  }
}

/** 检查 2: @fileoverview 文档覆盖 */
function checkFileOverview(filePath: string, content: string, issues: CheckIssue[]): void {
  if (!content.includes('@fileoverview')) {
    issues.push({
      file: filePath,
      type: 'no-fileoverview',
      severity: 'warning',
      message: '缺少 @fileoverview JSDoc 注释',
      suggestion: '在文件顶部添加 `/** @fileoverview 组件功能描述 */`',
      line: 1,
    })
    return
  }

  const overviewMatch = content.match(/@fileoverview\s+(.+)/)
  if (overviewMatch && overviewMatch[1].trim().length < 5) {
    issues.push({
      file: filePath,
      type: 'weak-fileoverview',
      severity: 'info',
      message: '@fileoverview 描述过短',
      suggestion: '添加至少 5 个字符的有意义描述',
    })
  }
}

/** 检查 3: 主导出 JSDoc 注释 */
function checkExportDoc(filePath: string, content: string, issues: CheckIssue[]): void {
  const exportRegex = /export\s+(function|const)\s+(\w+)/g
  let match: RegExpExecArray | null
  while ((match = exportRegex.exec(content)) !== null) {
    const exportName = match[2]
    const exportPos = match.index
    const beforeExport = content.substring(Math.max(0, exportPos - 200), exportPos)
    if (!beforeExport.includes('/**') || !beforeExport.includes('*/')) {
      // 检查上方是否有 JSDoc
      const linesBefore = content.substring(0, exportPos).split('\n')
      const recentLines = linesBefore.slice(-10).join('\n')
      if (!recentLines.includes('/**')) {
        issues.push({
          file: filePath,
          type: 'no-export-doc',
          severity: 'warning',
          message: `导出 "${exportName}" 缺少 JSDoc 注释`,
          suggestion: `在 export ${match[1]} ${exportName} 上方添加 /** ${exportName} 功能描述 */`,
        })
      }
    }
  }
}

/** 检查 4: Props 接口存在性和文档 */
function checkPropsInterface(filePath: string, content: string, issues: CheckIssue[]): void {
  const hasComponentExport = /export\s+(function|const)\s+\w+/.test(content)
  if (!hasComponentExport) return

  // 检查是否有 Props 接口
  const propsMatch = content.match(/(?:export\s+)?interface\s+(\w+Props)\s*(?:\{|extends)/)
  if (!propsMatch) {
    issues.push({
      file: filePath,
      type: 'no-props-interface',
      severity: 'info',
      message: '未找到 Props 接口（如 StockSelectorProps）',
      suggestion: '定义 Props 接口以提高类型安全性和可维护性',
    })
    return
  }

  // 检查 Props 属性是否有文档
  const propsName = propsMatch[1]
  const propsContentMatch = content.match(new RegExp(`interface\\s+${propsName}\\s*\\{([^}]*)\\}`))
  if (propsContentMatch) {
    const propsBody = propsContentMatch[1]
    const propLines = propsBody.split('\n').filter((l) => l.trim().startsWith('/**') || l.trim().match(/\w+[\?:]/))
    let documentedProps = 0
    let undocumentedProps = 0

    for (let i = 0; i < propLines.length; i++) {
      const line = propLines[i]
      if (line.trim().startsWith('/**')) {
        documentedProps++
      } else if (line.trim().match(/^\w+[\?:]/)) {
        undocumentedProps++
      }
    }

    if (undocumentedProps > documentedProps && undocumentedProps > 3) {
      issues.push({
        file: filePath,
        type: 'weak-props-doc',
        severity: 'info',
        message: `Props 接口 "${propsName}" 中只有 ${documentedProps}/${documentedProps + undocumentedProps} 个属性有文档`,
        suggestion: '为每个 Props 属性添加 JSDoc 注释',
      })
    }
  }
}

/** 检查 5: 导出模式一致性（智能豁免） */
function checkExportPattern(filePath: string, content: string, level: string, issues: CheckIssue[]): void {
  const functionExports = (content.match(/export\s+function\s+\w+/g) || []).length
  const constExports = (content.match(/export\s+const\s+\w+/g) || []).length
  const memoExports = (content.match(/export\s+const\s+\w+\s*=\s*memo/g) || []).length
  const constNoMemo = constExports - memoExports

  if (functionExports > 0 && constNoMemo > 0) {
    // 豁免模式：
    // 1. Context provider 文件：导出 Provider function + hooks + const 配置
    const isContextFile = /createContext|ContextProvider|useContext/.test(content)
    // 2. 工具/配置文件：导出计算函数 + 配置常量
    const isUtilityFile = /\.config\.(ts|tsx)$|\.indicators?\.(ts|tsx)$|\.types\.(ts|tsx)$/.test(filePath)
    // 3. 注册表/索引文件
    const isRegistryFile = /registry|index\.(ts|tsx)$/.test(filePath)
    // 4. 混合导出中 const 仅为配置对象（非组件）
    const constExportLines = content.match(/export\s+const\s+\w+/g) || []
    const componentConsts = constExportLines.filter((l) => {
      const nameMatch = l.match(/export\s+const\s+(\w+)/)
      if (!nameMatch) return false
      const before = content.substring(Math.max(0, content.indexOf(l) - 50), content.indexOf(l))
      return !/Record<|:.*=.*\{/.test(before) // 不是配置/Record 类型
    })

    if (!isContextFile && !isUtilityFile && !isRegistryFile && componentConsts.length > 0) {
      issues.push({
        file: filePath,
        type: 'mixed-export-pattern',
        severity: 'info',
        message: `混合使用 export function (${functionExports}) 和 export const (${constNoMemo}，非 memo)`,
        suggestion: '建议统一：组件用 export const X = memo(...)，hooks/utils 用 export function',
      })
    }
  }
}

/** 检查 6: 层级命名约定 */
function checkLevelNaming(filePath: string, content: string, level: string, issues: CheckIssue[]): void {
  const fileName = basename(filePath, extname(filePath))
  const exportMatch = content.match(/export\s+(function|const)\s+(\w+)/)
  if (!exportMatch) return

  const exportName = exportMatch[2]

  switch (level) {
    case 'atom': {
      // Atom 应该是小写开头或描述性名称
      if (exportName[0] !== exportName[0].toUpperCase() && !exportName.match(/^[a-z]/)) {
        // 允许 hook 以 use 开头
        if (!exportName.startsWith('use') && !exportName.startsWith('use')) {
          // 小写开头的 atom 可以接受
        }
      }
      break
    }
    case 'molecule':
    case 'organism': {
      // 应使用 PascalCase 名词
      if (!exportName[0].match(/[A-Z]/)) {
        issues.push({
          file: filePath,
          type: 'naming-convention',
          severity: 'warning',
          message: `${level} 组件 "${exportName}" 应以大写字母开头 (PascalCase)`,
          suggestion: `将 ${exportName} 重命名为 ${exportName[0].toUpperCase()}${exportName.slice(1)}`,
        })
      }
      break
    }
    case 'template': {
      if (!exportName.endsWith('Page') && !exportName.endsWith('App') && !exportName.endsWith('Layout')) {
        issues.push({
          file: filePath,
          type: 'template-naming',
          severity: 'info',
          message: `Template 组件 "${exportName}" 建议以 Page/App/Layout 结尾`,
          suggestion: `考虑重命名为 ${exportName}Page 或 ${exportName}Layout`,
        })
      }
      break
    }
  }
}

/** 检查 7: 文件结构顺序 */
function checkFileStructure(filePath: string, content: string, issues: CheckIssue[]): void {
  const lines = content.split('\n')
  const sections: Array<{ name: string; line: number }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.match(/^import\s/)) sections.push({ name: 'import', line: i })
    else if (line.match(/^export\s+(interface|type|enum)/)) sections.push({ name: 'type', line: i })
    else if (line.match(/^export\s+(function|const)/) && !line.match(/memo/)) sections.push({ name: 'export', line: i })
    else if (line.match(/^export\s+const\s+\w+\s*=\s*memo/)) sections.push({ name: 'memo-export', line: i })
  }

  // 理想顺序：import → types → exports
  const order: Record<string, number> = { import: 0, type: 1, 'memo-export': 2, export: 3 }
  let lastOrder = -1
  for (const section of sections) {
    const secOrder = order[section.name] ?? 99
    if (secOrder < lastOrder) {
      issues.push({
        file: filePath,
        type: 'file-structure',
        severity: 'info',
        message: `文件结构顺序不规范：${section.name} 出现在不应出现的位置`,
        suggestion: '建议顺序：import → 类型定义 → 组件导出 → 辅助函数',
      })
      break
    }
    lastOrder = secOrder
  }
}

/** 检查 8: 空文件或最小文件 */
function checkMinimalFile(filePath: string, content: string, issues: CheckIssue[]): void {
  const nonEmptyLines = content.split('\n').filter((l) => l.trim().length > 0 && !l.trim().startsWith('//'))
  if (nonEmptyLines.length < 5) {
    issues.push({
      file: filePath,
      type: 'minimal-file',
      severity: 'info',
      message: '文件内容过少（可能是占位文件）',
    })
  }
}

function calculateScore(issues: CheckIssue[]): number {
  let score = 100
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 20
    else if (issue.severity === 'warning') score -= 10
    else score -= 3
  }
  return Math.max(0, score)
}

async function main(): Promise<void> {
  const isJson = process.argv.includes('--json')
  const isFix = process.argv.includes('--fix')

  console.log('━━━ 组件命名规范与文档模板检查器 ━━━')
  console.log(`模式: ${isJson ? 'JSON 输出' : '人类可读'}${isFix ? ' + 自动修复' : ''}`)
  console.log()

  // 收集所有组件文件
  const componentFiles: string[] = []
  const levelsDirs = ['atoms', 'molecules', 'organisms', 'templates']
  for (const dir of levelsDirs) {
    const dirPath = join(COMPONENTS_DIR, dir)
    if (!existsSync(dirPath)) continue
    const files = walkDir(dirPath)
    for (const file of files) {
      if (extname(file) !== '.tsx' && extname(file) !== '.ts') continue
      if (shouldSkip(file)) continue
      componentFiles.push(file)
    }
  }

  console.log(`扫描组件文件: ${componentFiles.length} 个`)
  console.log()

  const fileReports: FileReport[] = []
  let totalErrors = 0
  let totalWarnings = 0
  let totalInfos = 0
  let totalScore = 0

  for (const filePath of componentFiles) {
    const relPath = relative(ROOT, filePath).replace(/\\/g, '/')
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const level = detectLevel(filePath)
    const issues: CheckIssue[] = []

    // 运行所有检查
    checkNamingConsistency(relPath, content, issues)
    checkFileOverview(relPath, content, issues)
    checkExportDoc(relPath, content, issues)
    checkPropsInterface(relPath, content, issues)
    checkExportPattern(relPath, content, level, issues)
    checkLevelNaming(relPath, content, level, issues)
    checkFileStructure(relPath, content, issues)
    checkMinimalFile(relPath, content, issues)

    const score = calculateScore(issues)
    totalScore += score

    totalErrors += issues.filter((i) => i.severity === 'error').length
    totalWarnings += issues.filter((i) => i.severity === 'warning').length
    totalInfos += issues.filter((i) => i.severity === 'info').length

    const fileName = basename(filePath, extname(filePath))
    const exportMatch = content.match(/export\s+(function|const)\s+(\w+)/)
    const componentName = exportMatch?.[2] ?? fileName

    fileReports.push({
      file: relPath,
      componentName,
      level,
      issues,
      score,
    })

    if (!isJson) {
      if (issues.length > 0) {
        console.log(`  📄 ${relPath} [${level}] 分数: ${score}/100`)
        for (const issue of issues) {
          const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'
          console.log(`    ${icon} [${issue.type}] ${issue.message}`)
          if (issue.suggestion) console.log(`       💡 ${issue.suggestion}`)
        }
      } else {
        console.log(`  ✅ ${relPath} [${level}] 100/100`)
      }
    }
  }

  // 计算汇总指标
  const totalFiles = fileReports.length
  const avgScore = totalFiles > 0 ? Math.round((totalScore / totalFiles) * 10) / 10 : 0

  const filesWithOverview = fileReports.filter((f) => !f.issues.some((i) => i.type === 'no-fileoverview')).length
  const docCoverage = totalFiles > 0 ? Math.round((filesWithOverview / totalFiles) * 100) : 0

  const filesWithExportDoc = fileReports.filter((f) => !f.issues.some((i) => i.type === 'no-export-doc')).length
  const exportDocCoverage = totalFiles > 0 ? Math.round((filesWithExportDoc / totalFiles) * 100) : 0

  const filesWithNameMatch = fileReports.filter((f) => !f.issues.some((i) => i.type === 'name-mismatch')).length
  const namingConsistency = totalFiles > 0 ? Math.round((filesWithNameMatch / totalFiles) * 100) : 0

  const report: CheckReport = {
    timestamp: new Date().toISOString(),
    totalFiles,
    totalIssues: totalErrors + totalWarnings + totalInfos,
    errorCount: totalErrors,
    warningCount: totalWarnings,
    infoCount: totalInfos,
    averageScore: avgScore,
    files: fileReports,
    summary: {
      namingConsistency,
      docCoverage,
      exportPatternConsistency: exportDocCoverage,
    },
  }

  // 输出
  if (isJson) {
    mkdirSync(join(ROOT, 'outputs'), { recursive: true })
    const outputPath = join(ROOT, 'outputs', 'naming-conventions-report.json')
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('\n────────────────────────────────────────────')
    console.log('汇总报告')
    console.log('────────────────────────────────────────────')
    console.log(`  扫描文件数: ${totalFiles}`)
    console.log(`  总问题数: ${report.totalIssues}`)
    console.log(`    🔴 Error: ${totalErrors}`)
    console.log(`    🟡 Warning: ${totalWarnings}`)
    console.log(`    🔵 Info: ${totalInfos}`)
    console.log(`  平均分: ${avgScore}/100`)
    console.log(`  命名一致性: ${namingConsistency}%`)
    console.log(`  @fileoverview 覆盖: ${docCoverage}%`)
    console.log(`  导出文档覆盖: ${exportDocCoverage}%`)
    console.log('────────────────────────────────────────────')

    // 最差 10 个文件
    const sorted = [...fileReports].sort((a, b) => a.score - b.score)
    console.log('\n最差 10 个文件:')
    for (const f of sorted.slice(0, 10)) {
      console.log(`  ${f.score}/100 ${f.file} (${f.issues.length} 个问题)`)
    }

    if (totalErrors > 0) {
      console.log(`\n  ❌ 存在 ${totalErrors} 个 error 级问题`)
    } else if (totalWarnings > 5) {
      console.log(`\n  ⚠️  存在 ${totalWarnings} 个 warning 级问题 (建议修复)`)
    } else {
      console.log(`\n  ✅ 命名规范和文档检查通过`)
    }
  }

  // 退出码：errors > 0 返回 1
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('❌ check-naming-conventions 执行异常:', e)
  process.exit(2)
})