import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { cruise, ICruiseOptions } from 'dependency-cruiser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'reports')

const cruiseOptions: ICruiseOptions = {
  config: '.dependency-cruiser.js',
}

interface DependencyIssue {
  readonly type: 'circular' | 'orphan' | 'unreachable' | 'deprecated' | 'missing' | 'unknown'
  readonly severity: 'error' | 'warn' | 'info'
  readonly message: string
  readonly files: readonly string[]
}

interface DependencyReport {
  readonly timestamp: string
  readonly circularDependencies: readonly string[][]
  readonly orphanedModules: readonly string[]
  readonly unreachableModules: readonly string[]
  readonly issues: readonly DependencyIssue[]
  readonly summary: {
    readonly totalModules: number
    readonly totalDependencies: number
    readonly circularCount: number
    readonly orphanCount: number
    readonly errorCount: number
    readonly warnCount: number
  }
}

async function generateDependencyReport(): Promise<DependencyReport> {
  console.log('[dependency-audit] 开始分析依赖...')

  const cruiseResult = await cruise(['src'], cruiseOptions)
  console.log('[dependency-audit] cruiseResult keys:', Object.keys(cruiseResult))
  console.log('[dependency-audit] cruiseResult type:', typeof cruiseResult.output)

  const output = 'output' in cruiseResult ? cruiseResult.output : undefined
  if (!output || typeof output !== 'object') {
    console.log('[dependency-audit] 没有找到有效的输出数据')
    return {
      timestamp: new Date().toISOString(),
      circularDependencies: [],
      orphanedModules: [],
      unreachableModules: [],
      issues: [],
      summary: {
        totalModules: 0,
        totalDependencies: 0,
        circularCount: 0,
        orphanCount: 0,
        errorCount: 0,
        warnCount: 0,
      },
    }
  }

  const modules = 'modules' in output ? output.modules : []
  if (!Array.isArray(modules)) {
    console.log('[dependency-audit] modules 不是数组')
    return {
      timestamp: new Date().toISOString(),
      circularDependencies: [],
      orphanedModules: [],
      unreachableModules: [],
      issues: [],
      summary: {
        totalModules: 0,
        totalDependencies: 0,
        circularCount: 0,
        orphanCount: 0,
        errorCount: 0,
        warnCount: 0,
      },
    }
  }

  const circularDependencies: string[][] = []
  const orphanedModules: string[] = []
  const unreachableModules: string[] = []
  const issues: DependencyIssue[] = []

  let totalModules = 0
  let totalDependencies = 0
  let errorCount = 0
  let warnCount = 0

  modules.forEach((module) => {
    totalModules++
    totalDependencies += module.dependencies?.length || 0

    if (module.cycle) {
      circularDependencies.push(module.cycle)
    }

    if (module.orphan) {
      orphanedModules.push(module.source)
    }

    if (module.reachable === false) {
      unreachableModules.push(module.source)
    }
  })

  console.log('[dependency-audit] 分析完成')

  return {
    timestamp: new Date().toISOString(),
    circularDependencies,
    orphanedModules,
    unreachableModules,
    issues,
    summary: {
      totalModules,
      totalDependencies,
      circularCount: circularDependencies.length,
      orphanCount: orphanedModules.length,
      errorCount,
      warnCount,
    },
  }
}

function getIssueType(ruleName: string): DependencyIssue['type'] {
  switch (ruleName) {
    case 'no-circular':
      return 'circular'
    case 'no-orphans':
      return 'orphan'
    case 'no-unreachable':
      return 'unreachable'
    case 'no-deprecated':
      return 'deprecated'
    case 'no-missing':
    case 'no-non-package-json':
      return 'missing'
    default:
      return 'unknown'
  }
}

function printReport(report: DependencyReport): void {
  console.log('\n📊 依赖分析报告')
  console.log('='.repeat(50))

  console.log(`\n📦 模块统计:`)
  console.log(`  - 总模块数: ${report.summary.totalModules}`)
  console.log(`  - 总依赖数: ${report.summary.totalDependencies}`)

  console.log(`\n🔄 循环依赖: ${report.summary.circularCount}`)
  if (report.circularDependencies.length > 0) {
    report.circularDependencies.forEach((cycle, index) => {
      console.log(`  ${index + 1}. ${cycle.join(' → ')}`)
    })
  }

  console.log(`\n🏳️  孤立模块: ${report.summary.orphanCount}`)
  if (report.orphanedModules.length > 0) {
    report.orphanedModules.slice(0, 10).forEach((module) => {
      console.log(`  - ${module}`)
    })
    if (report.orphanedModules.length > 10) {
      console.log(`  ... 还有 ${report.orphanedModules.length - 10} 个`)
    }
  }

  console.log(`\n🚫 不可达模块: ${report.unreachableModules.length}`)
  if (report.unreachableModules.length > 0) {
    report.unreachableModules.slice(0, 10).forEach((module) => {
      console.log(`  - ${module}`)
    })
    if (report.unreachableModules.length > 10) {
      console.log(`  ... 还有 ${report.unreachableModules.length - 10} 个`)
    }
  }

  console.log(`\n⚠️  问题统计:`)
  console.log(`  - 错误: ${report.summary.errorCount}`)
  console.log(`  - 警告: ${report.summary.warnCount}`)
}

function writeReport(report: DependencyReport): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const reportPath = path.join(OUTPUT_DIR, 'dependency-analysis.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📝 报告已写入: ${reportPath}`)

  const mdReport = generateMarkdownReport(report)
  // OUTPUT_DIR 已为 <root>/docs/reports，避免 docs/reports 双重拼接（P2 修复）
  const mdPath = path.join(OUTPUT_DIR, 'retrospectives', 'dependency-analysis.md')
  fs.writeFileSync(mdPath, mdReport)
  console.log(`📝 Markdown 报告已写入: ${mdPath}`)
}

function generateMarkdownReport(report: DependencyReport): string {
  return `# 依赖分析报告

生成时间: ${report.timestamp}

## 模块统计

| 指标 | 数值 |
|------|------|
| 总模块数 | ${report.summary.totalModules} |
| 总依赖数 | ${report.summary.totalDependencies} |
| 循环依赖数 | ${report.summary.circularCount} |
| 孤立模块数 | ${report.summary.orphanCount} |

## 循环依赖

${report.circularDependencies.length === 0 
  ? '无循环依赖 ✅' 
  : report.circularDependencies.map((cycle, i) => `- ${i + 1}. ${cycle.join(' → ')}`).join('\n')}

## 孤立模块

${report.orphanedModules.length === 0 
  ? '无孤立模块 ✅' 
  : report.orphanedModules.map((m) => `- ${m}`).join('\n')}

## 不可达模块

${report.unreachableModules.length === 0 
  ? '无不可达模块 ✅' 
  : report.unreachableModules.map((m) => `- ${m}`).join('\n')}

## 问题统计

| 级别 | 数量 |
|------|------|
| 错误 | ${report.summary.errorCount} |
| 警告 | ${report.summary.warnCount} |
`
}

async function main(): Promise<void> {
  try {
    const report = await generateDependencyReport()
    printReport(report)
    writeReport(report)

    if (report.summary.errorCount > 0) {
      console.log('\n❌ 发现严重依赖问题，退出码 1')
      process.exit(1)
    } else {
      console.log('\n✅ 依赖分析通过')
      process.exit(0)
    }
  } catch (error) {
    console.error('[dependency-audit] 分析失败:', error)
    process.exit(1)
  }
}

main()