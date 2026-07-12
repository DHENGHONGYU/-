/**
 * @fileoverview 批次 C 自动化扫描工具：识别高风险模块并生成拆分建议
 *
 * 以批次 B 的拆分方案作为标准化模板，对 src/ 下所有超过 300 行的模块进行扫描：
 * 1. 识别超过 300 行的高风险模块
 * 2. 计算圈复杂度（基于控制流关键字估算）
 * 3. 计算维护性指数（基于行数、复杂度、注释比例）
 * 4. 识别模块职责边界（通过 export 分析）
 * 5. 生成拆分建议
 *
 * 用法: npx tsx scripts/audit-batch-c-scanner.ts
 *
 * @module scripts/audit-batch-c-scanner
 * @created 2026-07-07
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// 配置
// ============================================================

const LINE_THRESHOLD = 300
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_ROOT = path.resolve(__dirname, '..')
const EXCLUDE_PATTERNS = [
  /__tests__/,
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /\.d\./,
]

// 圈复杂度权重（基于 McCabe 复杂度）
const COMPLEXITY_KEYWORDS = [
  /\bif\b/g,
  /\belse\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bdo\b/g,
  /\bswitch\b/g,
  /\bcase\b/g,
  /\bcatch\b/g,
  /\?\s*[^:]+\s*:/g, // 三元表达式
  /&&/g,
  /\|\|/g,
  /\?\?/g,
]

// ============================================================
// 类型定义
// ============================================================

interface ModuleAnalysis {
  path: string
  lines: number
  codeLines: number
  commentLines: number
  blankLines: number
  cyclomaticComplexity: number
  maintainabilityIndex: number
  exports: string[]
  exportCount: number
  importCount: number
  hasTestFile: boolean
  riskLevel: 'critical' | 'high' | 'medium'
  splitSuggestion: SplitSuggestion | null
}

interface SplitSuggestion {
  strategy: string
  boundaries: string[]
  expectedBenefit: string
  estimatedSplitFiles: number
  priority: 'P0' | 'P1' | 'P2'
}

interface ScanReport {
  scanDate: string
  totalFilesScanned: number
  highRiskModules: ModuleAnalysis[]
  summary: {
    critical: number
    high: number
    medium: number
    totalLines: number
    avgComplexity: number
    avgMaintainability: number
  }
}

// ============================================================
// 核心扫描逻辑
// ============================================================

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath))
}

function readAndAnalyze(filePath: string): ModuleAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  let codeLines = 0
  let commentLines = 0
  let blankLines = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      blankLines++
    } else if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      commentLines++
    } else {
      codeLines++
    }
  }

  // 圈复杂度：基于控制流关键字
  let cyclomaticComplexity = 1
  for (const pattern of COMPLEXITY_KEYWORDS) {
    const matches = content.match(pattern)
    if (matches) cyclomaticComplexity += matches.length
  }

  // 维护性指数 (MI) 简化计算
  // MI = max(0, (171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)) * 100/171)
  // 这里使用简化版本：基于行数、复杂度、注释比例
  const commentRatio = codeLines > 0 ? commentLines / codeLines : 0
  const mi = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (171 -
          5.2 * Math.log(Math.max(1, codeLines)) -
          0.23 * cyclomaticComplexity -
          16.2 * Math.log(Math.max(1, totalLines))) *
          (100 / 171) +
          commentRatio * 10,
      ),
    ),
  )

  // 解析 exports
  const exportMatches = content.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum|default)\s+(\w+)/g,
  )
  const exports: string[] = []
  for (const m of exportMatches) exports.push(m[1] ?? '')

  // 解析 re-exports
  const reExportMatches = content.matchAll(/export\s+\{[^}]+\}\s+from\s+['"]([^'"]+)['"]/g)
  for (const m of reExportMatches) exports.push(`re-export from ${m[1]}`)

  // 解析 imports
  const importMatches = content.matchAll(/import\s+[^;]+from\s+['"][^'"]+['"]/g)
  const importCount = [...importMatches].length

  // 检查是否有对应测试文件
  const ext = path.extname(filePath)
  const baseName = filePath.slice(0, -ext.length)
  const testCandidates = [
    `${baseName}.test${ext}`,
    `${baseName}.test.ts`,
    `${baseName}.test.tsx`,
    baseName.replace(/src[\\/]/, 'tests/').replace(ext, '.test.ts'),
    baseName.replace(/src[\\/]/, 'tests/').replace(ext, '.test.tsx'),
  ]
  const hasTestFile = testCandidates.some((p) => fs.existsSync(p))

  // 风险等级
  let riskLevel: 'critical' | 'high' | 'medium' = 'medium'
  if (totalLines > 600 || cyclomaticComplexity > 50) riskLevel = 'critical'
  else if (totalLines > 400 || cyclomaticComplexity > 30) riskLevel = 'high'

  // 生成拆分建议
  const splitSuggestion = generateSplitSuggestion(
    filePath,
    totalLines,
    cyclomaticComplexity,
    exports,
    hasTestFile,
  )

  return {
    path: filePath.replace(/\\/g, '/'),
    lines: totalLines,
    codeLines,
    commentLines,
    blankLines,
    cyclomaticComplexity,
    maintainabilityIndex: mi,
    exports,
    exportCount: exports.length,
    importCount,
    hasTestFile,
    riskLevel,
    splitSuggestion,
  }
}

function generateSplitSuggestion(
  filePath: string,
  lines: number,
  complexity: number,
  exports: string[],
  hasTestFile: boolean,
): SplitSuggestion | null {
  if (lines <= LINE_THRESHOLD) return null

  const ext = path.extname(filePath)
  const fileName = path.basename(filePath, ext)
  const dir = path.dirname(filePath)
  const relPath = filePath.replace(/\\/g, '/')

  // 根据文件类型和特征生成拆分策略
  let strategy = ''
  let boundaries: string[] = []
  let expectedBenefit = ''
  let estimatedSplitFiles = 2
  let priority: 'P0' | 'P1' | 'P2' = 'P2'

  // 常量文件（constants/、config/）
  if (relPath.includes('/constants/') || relPath.includes('/config/')) {
    strategy = '按业务域分组拆分为多个常量文件'
    boundaries = ['按 export 的业务语义分组', '每组 < 200 行']
    expectedBenefit = '减少常量查找时间，提升编译速度，降低合并冲突'
    estimatedSplitFiles = Math.ceil(lines / 200)
    priority = lines > 800 ? 'P1' : 'P2'
  }
  // 类型定义文件
  else if (relPath.includes('/types/') || fileName === 'types') {
    strategy = '按业务域拆分为独立类型文件'
    boundaries = ['按 interface/type 的业务域分组', '使用 barrel re-export 保持 API 兼容']
    expectedBenefit = '类型查找更快，减少编译依赖链，降低循环类型引用风险'
    estimatedSplitFiles = Math.ceil(exports.length / 8) || 2
    priority = lines > 600 ? 'P1' : 'P2'
  }
  // Store 文件
  else if (relPath.includes('/store/')) {
    strategy = '按职责拆分：state 定义 + actions + selectors + persist'
    boundaries = ['state 接口定义', 'create() 主体', '派生 selectors', '持久化配置']
    expectedBenefit = 'Store 职责清晰，便于测试，减少无关状态更新触发重渲染'
    estimatedSplitFiles = 3
    priority = lines > 500 ? 'P1' : 'P2'
    if (!hasTestFile) priority = 'P0'
  }
  // 服务层文件
  else if (relPath.includes('/services/')) {
    if (complexity > 40) {
      strategy = '按功能拆分：解析层 + 业务逻辑层 + 持久化层 + barrel re-export'
      boundaries = ['纯函数/解析逻辑', '业务编排逻辑', '数据持久化', 'barrel 入口']
      expectedBenefit = '降低圈复杂度，提升可测试性，支持并行开发'
      estimatedSplitFiles = 4
    } else {
      strategy = '按职责拆分 + barrel re-export（参考批次 B 模板）'
      boundaries = ['识别独立功能块', '提取纯函数', 'barrel 保持 API 兼容']
      expectedBenefit = '降低单文件复杂度，提升可维护性'
      estimatedSplitFiles = 3
    }
    priority = lines > 500 || complexity > 50 ? 'P1' : 'P2'
    if (!hasTestFile) priority = 'P0'
  }
  // 页面组件
  else if (relPath.includes('/pages/')) {
    strategy = '按 UI 区域拆分为子组件 + hooks 提取'
    boundaries = ['UI 子组件', '自定义 hooks（业务逻辑）', '常量定义', '类型定义']
    expectedBenefit = '减少组件复杂度，提升复用性，降低重渲染范围'
    estimatedSplitFiles = 4
    priority = lines > 500 ? 'P1' : 'P2'
  }
  // 数据层
  else if (relPath.includes('/data/')) {
    strategy = '按 store 域拆分 + barrel re-export'
    boundaries = ['按 IndexedDB store 分组', 'barrel 统一导出']
    expectedBenefit = '减少单文件体积，支持增量加载'
    estimatedSplitFiles = Math.ceil(lines / 200)
    priority = lines > 600 ? 'P1' : 'P2'
  }
  // 核心层
  else if (relPath.includes('/core/')) {
    strategy = '按职责拆分（参考批次 A 的 databridge 模板）'
    boundaries = ['核心调度逻辑', '适配器层', '缓存层', 'barrel 入口']
    expectedBenefit = '核心逻辑隔离，便于独立测试和优化'
    estimatedSplitFiles = 3
    priority = lines > 500 ? 'P1' : 'P2'
  }
  // 默认策略
  else {
    strategy = '按功能块拆分 + barrel re-export'
    boundaries = ['识别独立功能块', 'barrel 保持 API 兼容']
    expectedBenefit = '降低单文件复杂度'
    estimatedSplitFiles = 2
    priority = lines > 600 ? 'P1' : 'P2'
  }

  return { strategy, boundaries, expectedBenefit, estimatedSplitFiles, priority }
}

function scanDirectory(rootDir: string): ModuleAnalysis[] {
  const results: ModuleAnalysis[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (shouldExclude(fullPath + '/')) continue
        walk(fullPath)
      } else if (entry.isFile()) {
        if (!/\.(ts|tsx)$/.test(entry.name)) continue
        if (shouldExclude(fullPath)) continue
        const content = fs.readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n').length
        if (lines > LINE_THRESHOLD) {
          results.push(readAndAnalyze(fullPath))
        }
      }
    }
  }

  walk(rootDir)
  return results.sort((a, b) => b.lines - a.lines)
}

// ============================================================
// 主入口
// ============================================================

function main(): void {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  批次 C 自动化扫描工具 — 高风险模块识别与拆分建议')
  console.log('  阈值: > 300 行 | 模板: 批次 B 拆分方案')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const srcPath = path.join(SRC_ROOT, 'src')
  const modules = scanDirectory(srcPath)

  // 统计
  const critical = modules.filter((m) => m.riskLevel === 'critical')
  const high = modules.filter((m) => m.riskLevel === 'high')
  const medium = modules.filter((m) => m.riskLevel === 'medium')
  const totalLines = modules.reduce((sum, m) => sum + m.lines, 0)
  const avgComplexity =
    modules.length > 0
      ? Math.round(modules.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / modules.length)
      : 0
  const avgMaintainability =
    modules.length > 0
      ? Math.round(modules.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / modules.length)
      : 0

  const report: ScanReport = {
    scanDate: new Date().toISOString(),
    totalFilesScanned: modules.length,
    highRiskModules: modules,
    summary: {
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      totalLines,
      avgComplexity,
      avgMaintainability,
    },
  }

  // 输出 JSON 报告
  const reportPath = path.join(SRC_ROOT, 'docs', 'reports', 'batch-c-scan-report.json')
  const reportDir = path.dirname(reportPath)
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')

  // 输出控制台摘要
  console.log(`扫描完成: ${modules.length} 个高风险模块`)
  console.log(`  - Critical (>600行/CC>50): ${critical.length}`)
  console.log(`  - High (>400行/CC>30):     ${high.length}`)
  console.log(`  - Medium (>300行):          ${medium.length}`)
  console.log(`  - 总行数: ${totalLines}`)
  console.log(`  - 平均圈复杂度: ${avgComplexity}`)
  console.log(`  - 平均维护性指数: ${avgMaintainability}/100`)
  console.log(`\n报告已生成: ${reportPath}`)

  // 输出 Top 20 详情
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  Top 20 高风险模块')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const top20 = modules.slice(0, 20)
  for (let i = 0; i < top20.length; i++) {
    const m = top20[i]
    console.log(
      `${(i + 1).toString().padStart(2)}. [${m?.riskLevel.toUpperCase().padEnd(8)}] ${m?.path}`,
    )
    console.log(`    行数: ${m?.lines} | CC: ${m?.cyclomaticComplexity} | MI: ${m?.maintainabilityIndex}/100 | exports: ${m?.exportCount} | 测试: ${m?.hasTestFile ? '✓' : '✗'}`)
    if (m?.splitSuggestion) {
      console.log(`    建议: ${m?.splitSuggestion.strategy}`)
      console.log(`    边界: ${m?.splitSuggestion.boundaries.join(' | ')}`)
      console.log(`    收益: ${m?.splitSuggestion.expectedBenefit}`)
      console.log(`    优先级: ${m?.splitSuggestion.priority} | 预计拆分: ${m?.splitSuggestion.estimatedSplitFiles} 文件`)
    }
    console.log()
  }

  // 输出 P0 级模块清单
  const p0Modules = modules.filter((m) => m.splitSuggestion?.priority === 'P0')
  if (p0Modules.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  P0 级（无测试保护）— 建议优先补充测试后再拆分')
    console.log('═══════════════════════════════════════════════════════════════\n')
    for (const m of p0Modules) {
      console.log(`  [P0] ${m.path} (${m.lines} 行, CC=${m.cyclomaticComplexity})`)
    }
  }
}

main()
