#!/usr/bin/env node
/**
 * @module scripts/lessons-learned
 * @description 教训总结与知识沉淀 — 分析系统检查结果，总结开发教训供后续二开或新项目参考
 *
 * 分析维度：
 * - 架构设计教训
 * - 代码质量教训
 * - 文档管理教训
 * - 测试策略教训
 * - 团队协作教训
 *
 * 输出：
 *   - docs/reports/lessons-learned/lessons-learned-{YYYY-MM-DD}.md
 *   - docs/reports/lessons-learned/latest.md
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')

const REPORT_DIR = join(ROOT, 'docs', 'reports', 'lessons-learned')
const ISSUE_DIR = join(ROOT, 'docs', 'reports', 'issues')

interface Lesson {
  id: string
  category: 'architecture' | 'code-quality' | 'documentation' | 'testing' | 'team'
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  impact: string
  rootCause: string
  solution: string
  relatedIssues: string[]
  createdAt: string
}

interface LessonsReport {
  meta: {
    reportId: string
    generatedAt: string
    rootDir: string
    sourceReports: string[]
  }
  lessons: Lesson[]
  summary: {
    totalLessons: number
    architectureCount: number
    codeQualityCount: number
    documentationCount: number
    testingCount: number
    teamCount: number
  }
  recommendations: string[]
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

function getGitHistory(): { commits: number; activeDays: number } {
  try {
    const commitsOutput = execSync('git log --oneline', { encoding: 'utf-8', cwd: ROOT }).trim()
    const commits = commitsOutput ? commitsOutput.split('\n').length : 0
    
    const datesOutput = execSync('git log --format=%ad --date=short', { encoding: 'utf-8', cwd: ROOT }).trim()
    const activeDays = datesOutput ? new Set(datesOutput.split('\n')).size : 0
    
    return { commits, activeDays }
  } catch {
    return { commits: 0, activeDays: 0 }
  }
}

function loadIssues(): any[] {
  const issueFile = join(ISSUE_DIR, 'issues.json')
  if (existsSync(issueFile)) {
    try {
      return JSON.parse(readFileSync(issueFile, 'utf-8'))
    } catch {
      return []
    }
  }
  return []
}

function extractLessons(issues: any[]): Lesson[] {
  const lessons: Lesson[] = []

  const architectureIssues = issues.filter((i) => 
    i.source.includes('layers') || i.source.includes('architecture') || i.source.includes('dependency')
  )
  for (const issue of architectureIssues) {
    lessons.push({
      id: generateId(),
      category: 'architecture',
      title: `架构设计问题: ${issue.title}`,
      description: issue.description,
      severity: issue.type,
      impact: '违反分层架构原则，可能导致模块耦合度上升，影响后续维护',
      rootCause: '开发过程中未严格遵循分层调用规则，或架构设计存在缺陷',
      solution: '严格遵守AGENTS.md中的分层规则，使用store作为UI与services的中间层',
      relatedIssues: [issue.id],
      createdAt: formatTimestamp(new Date()),
    })
  }

  const codeQualityIssues = issues.filter((i) => 
    i.source.includes('hardcode') || i.source.includes('deadcode') || i.source.includes('lint')
  )
  for (const issue of codeQualityIssues) {
    lessons.push({
      id: generateId(),
      category: 'code-quality',
      title: `代码质量问题: ${issue.title}`,
      description: issue.description,
      severity: issue.type,
      impact: '降低代码可维护性，增加技术债务，可能引入潜在Bug',
      rootCause: '开发过程中未严格执行编码规范，或缺乏自动化检查机制',
      solution: '使用ESLint和Prettier强制执行代码规范，定期运行审计脚本',
      relatedIssues: [issue.id],
      createdAt: formatTimestamp(new Date()),
    })
  }

  const docIssues = issues.filter((i) => 
    i.source.includes('docs') || i.source.includes('freshness') || i.source.includes('validation')
  )
  for (const issue of docIssues) {
    lessons.push({
      id: generateId(),
      category: 'documentation',
      title: `文档管理问题: ${issue.title}`,
      description: issue.description,
      severity: issue.type,
      impact: '文档与代码不一致，影响团队协作和知识传递',
      rootCause: '文档更新滞后于代码变更，缺乏自动化同步机制',
      solution: '建立代码变更→文档更新的自动化触发器，定期检查文档保鲜度',
      relatedIssues: [issue.id],
      createdAt: formatTimestamp(new Date()),
    })
  }

  return lessons
}

function buildReport(lessons: Lesson[]): LessonsReport {
  const { commits, activeDays } = getGitHistory()

  const architectureCount = lessons.filter((l) => l.category === 'architecture').length
  const codeQualityCount = lessons.filter((l) => l.category === 'code-quality').length
  const documentationCount = lessons.filter((l) => l.category === 'documentation').length
  const testingCount = lessons.filter((l) => l.category === 'testing').length
  const teamCount = lessons.filter((l) => l.category === 'team').length

  const recommendations: string[] = []
  if (architectureCount > 0) {
    recommendations.push('加强架构审查，在代码审查阶段增加架构合规性检查')
    recommendations.push('使用架构雷达扫描工具定期检测架构腐化点')
  }
  if (codeQualityCount > 0) {
    recommendations.push('增加自动化测试覆盖率，特别是核心业务逻辑')
    recommendations.push('在CI流程中增加代码质量门禁')
  }
  if (documentationCount > 0) {
    recommendations.push('建立文档更新的自动化机制，确保文档与代码同步')
    recommendations.push('定期运行文档保鲜度检查')
  }
  recommendations.push('将本次总结的教训纳入团队知识库，用于新成员培训')
  recommendations.push('在新项目启动时，参考本次总结的教训制定开发规范')

  return {
    meta: {
      reportId: generateId(),
      generatedAt: formatTimestamp(new Date()),
      rootDir: ROOT,
      sourceReports: ['issues.json', 'system-health-dashboard', 'doc-freshness-score'],
    },
    lessons,
    summary: {
      totalLessons: lessons.length,
      architectureCount,
      codeQualityCount,
      documentationCount,
      testingCount,
      teamCount,
    },
    recommendations,
  }
}

function renderMarkdownReport(report: LessonsReport): string {
  const lines: string[] = [
    '# 开发教训总结与知识沉淀报告',
    '',
    `> 生成时间: ${report.meta.generatedAt}`,
    `> 报告ID: ${report.meta.reportId}`,
    '',
    '## 执行摘要',
    '',
    `本报告基于系统检查结果，共总结了 **${report.summary.totalLessons}** 条开发教训。`,
    '',
    '### 教训分类统计',
    '',
    '| 分类 | 数量 |',
    '|------|------|',
    `| 架构设计 | ${report.summary.architectureCount} |`,
    `| 代码质量 | ${report.summary.codeQualityCount} |`,
    `| 文档管理 | ${report.summary.documentationCount} |`,
    `| 测试策略 | ${report.summary.testingCount} |`,
    `| 团队协作 | ${report.summary.teamCount} |`,
    '',
  ]

  const categoryNames: Record<string, string> = {
    architecture: '架构设计',
    'code-quality': '代码质量',
    documentation: '文档管理',
    testing: '测试策略',
    team: '团队协作',
  }

  for (const category of ['architecture', 'code-quality', 'documentation', 'testing', 'team'] as const) {
    const categoryLessons = report.lessons.filter((l) => l.category === category)
    if (categoryLessons.length === 0) continue

    lines.push(`## ${categoryNames[category]}`, '')

    for (const lesson of categoryLessons) {
      const severityColors: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }

      lines.push(`### ${severityColors[lesson.severity]} ${lesson.title}`, '')
      lines.push(`**严重程度**: ${lesson.severity.toUpperCase()}`, '')
      lines.push(`**描述**: ${lesson.description}`, '')
      lines.push(`**影响**: ${lesson.impact}`, '')
      lines.push(`**根本原因**: ${lesson.rootCause}`, '')
      lines.push(`**解决方案**: ${lesson.solution}`, '')
      lines.push('')
    }
  }

  lines.push('## 改进建议', '')
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`)
  }
  lines.push('')

  lines.push('## 后续二开/新项目建议', '')
  lines.push('基于本次总结的教训，建议在后续开发中:', '')
  lines.push('1. **架构层面**: 严格遵循分层架构原则，定期进行架构审查', '')
  lines.push('2. **代码层面**: 强制执行编码规范，增加自动化测试覆盖率', '')
  lines.push('3. **文档层面**: 建立代码变更→文档更新的自动化机制', '')
  lines.push('4. **流程层面**: 在CI流程中增加质量门禁，确保代码质量', '')
  lines.push('5. **团队层面**: 将教训纳入知识库，用于新成员培训', '')

  return lines.join('\n')
}

function persistReport(report: LessonsReport): string | null {
  try {
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }
    const dateStr = report.meta.generatedAt.split('T')[0]
    const mdPath = join(REPORT_DIR, `lessons-learned-${dateStr}.md`)
    const latestMdPath = join(REPORT_DIR, 'latest.md')
    const jsonPath = join(REPORT_DIR, `lessons-learned-${dateStr}.json`)

    const markdownContent = renderMarkdownReport(report)
    writeFileSync(mdPath, markdownContent, 'utf-8')
    writeFileSync(latestMdPath, markdownContent, 'utf-8')
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')

    return mdPath
  } catch (error) {
    console.error(`[LessonsLearned] 持久化报告失败: ${error}`)
    return null
  }
}

function printSummary(report: LessonsReport): void {
  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
  }

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║      教训总结与知识沉淀 — Lessons Learned Report         ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  console.log(`${C.bold}报告ID:${C.reset} ${report.meta.reportId}`)
  console.log(`${C.bold}生成时间:${C.reset} ${report.meta.generatedAt}`)
  console.log('')

  console.log(`${C.bold}教训分类统计:${C.reset}`)
  console.log(`  ${C.red}架构设计:${C.reset} ${report.summary.architectureCount} 条`)
  console.log(`  ${C.yellow}代码质量:${C.reset} ${report.summary.codeQualityCount} 条`)
  console.log(`  ${C.cyan}文档管理:${C.reset} ${report.summary.documentationCount} 条`)
  console.log(`  ${C.green}测试策略:${C.reset} ${report.summary.testingCount} 条`)
  console.log(`  ${C.dim}团队协作:${C.reset} ${report.summary.teamCount} 条`)
  console.log(`  ${C.dim}总计:${C.reset} ${report.summary.totalLessons} 条`)
  console.log('')

  if (report.recommendations.length > 0) {
    console.log(`${C.bold}${C.yellow}改进建议:${C.reset}`)
    console.log('')
    for (const rec of report.recommendations) {
      console.log(`  ${C.cyan}•${C.reset} ${rec}`)
    }
    console.log('')
  }

  console.log(`${C.bold}${C.green}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.green}║              知识沉淀报告已生成                          ║${C.reset}`)
  console.log(`${C.bold}${C.green}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')
}

function main(): void {
  console.error('[LessonsLearned] 开始生成教训总结与知识沉淀报告...')

  const issues = loadIssues()
  console.error(`[LessonsLearned] 加载了 ${issues.length} 个问题`)

  const lessons = extractLessons(issues)
  const report = buildReport(lessons)

  printSummary(report)

  const persisted = persistReport(report)
  if (persisted) {
    console.error(`[LessonsLearned] 报告已保存到: ${persisted}`)
  }
}

main()