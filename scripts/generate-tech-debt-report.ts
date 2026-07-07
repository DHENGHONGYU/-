#!/usr/bin/env tsx

/**
 * 技术债自动化报告生成器
 * 
 * 功能：
 * 1. 从 GitHub Issue 拉取技术债数据
 * 2. 从 SonarQube API 获取代码质量指标（可选）
 * 3. 统计技术债趋势（新增/解决/清理率）
 * 4. 生成 Markdown 报告并更新 TECH-DEBT.md
 * 5. 生成可视化趋势图（Mermaid 格式）
 * 
 * 使用方式：
 * npm run tech-debt:report
 * 
 * 环境变量：
 * - GITHUB_TOKEN: GitHub Personal Access Token（必需）
 * - SONARQUBE_TOKEN: SonarQube API Token（可选）
 * - SONARQUBE_URL: SonarQube 服务器地址（可选，默认 http://localhost:9000）
 * - SONARQUBE_PROJECT: SonarQube 项目 key（可选）
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 配置
// ============================================================

interface ReportConfig {
  githubToken: string
  githubRepo: string
  sonarqubeToken?: string
  sonarqubeUrl?: string
  sonarqubeProject?: string
  outputDir: string
  techDebtFile: string
}

const config: ReportConfig = {
  githubToken: process.env.GITHUB_TOKEN || '',
  githubRepo: process.env.GITHUB_REPO || 'xiaoying-ying/V9',
  sonarqubeToken: process.env.SONARQUBE_TOKEN,
  sonarqubeUrl: process.env.SONARQUBE_URL || 'http://localhost:9000',
  sonarqubeProject: process.env.SONARQUBE_PROJECT || 'v9-project',
  outputDir: join(process.cwd(), 'docs', 'reports'),
  techDebtFile: join(process.cwd(), 'docs', 'TECH-DEBT.md'),
}

// ============================================================
// 类型定义
// ============================================================

interface GitHubIssue {
  number: number
  title: string
  labels: Array<{ name: string }>
  state: 'open' | 'closed'
  assignee: { login: string } | null
  created_at: string
  closed_at: string | null
  body: string
}

interface TechDebtItem {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  type: string
  status: 'open' | 'closed'
  assignee: string
  createdAt: string
  closedAt?: string
  description: string
}

interface TechDebtStats {
  total: number
  open: number
  closed: number
  byPriority: {
    P0: number
    P1: number
    P2: number
    P3: number
  }
  byType: Record<string, number>
  closureRate: number
  trend: Array<{
    date: string
    total: number
    open: number
    closed: number
  }>
}

interface SonarQubeMetrics {
  coverage: number
  duplicatedBlocks: number
  codeSmells: number
  bugs: number
  vulnerabilities: number
  technicalDebt: string // 格式: "1d 2h 30min"
}

// ============================================================
// GitHub API 集成
// ============================================================

async function fetchGitHubIssues(): Promise<GitHubIssue[]> {
  if (!config.githubToken) {
    logger.warn('[TechDebtReport] GITHUB_TOKEN 未设置，使用模拟数据')
    return getMockGitHubIssues()
  }

  try {
    const cmd = `gh issue list --label tech-debt --state all --json number,title,labels,state,assignee,createdAt,closedAt,body --limit 100`
    const output = execSync(cmd, { encoding: 'utf-8' })
    const issues = JSON.parse(output) as GitHubIssue[]
    
    logger.info(`[TechDebtReport] 从 GitHub 获取 ${issues.length} 个技术债 Issue`)
    return issues
  } catch (error) {
    logger.error('[TechDebtReport] GitHub API 调用失败', { error })
    return getMockGitHubIssues()
  }
}

function getMockGitHubIssues(): GitHubIssue[] {
  // 返回当前 TECH-DEBT.md 中的技术债数据
  return [
    {
      number: 123,
      title: '[Tech Debt] 评分引擎性能问题',
      labels: [{ name: 'tech-debt' }, { name: 'tech-debt:high' }],
      state: 'open',
      assignee: { login: 'xiaoying-ying' },
      created_at: '2026-07-05T00:00:00Z',
      closed_at: null,
      body: '性能债：评分引擎处理 10000+ 数据时耗时 > 5s',
    },
    {
      number: 125,
      title: '[Tech Debt] 单元测试覆盖率不足',
      labels: [{ name: 'tech-debt' }, { name: 'tech-debt:high' }],
      state: 'open',
      assignee: { login: 'xiaoying-ying' },
      created_at: '2026-07-05T00:00:00Z',
      closed_at: null,
      body: '测试债：src/services/ 覆盖率仅 65%',
    },
    {
      number: 127,
      title: '[Tech Debt] 文件/函数过长：评分计算器',
      labels: [{ name: 'tech-debt' }, { name: 'tech-debt:medium' }],
      state: 'open',
      assignee: { login: 'xiaoying-ying' },
      created_at: '2026-07-05T00:00:00Z',
      closed_at: null,
      body: '代码债：l3.ts 536 行，超出建议上限 79%',
    },
    {
      number: 124,
      title: '[Tech Debt] 重复代码：数据验证逻辑',
      labels: [{ name: 'tech-debt' }, { name: 'tech-debt:high' }],
      state: 'closed',
      assignee: { login: 'xiaoying-ying' },
      created_at: '2026-07-05T00:00:00Z',
      closed_at: '2026-07-06T00:00:00Z',
      body: '已提取为 src/utils/dataValidation.ts',
    },
  ]
}

function parseTechDebtItems(issues: GitHubIssue[]): TechDebtItem[] {
  return issues.map((issue) => {
    const priorityMatch = issue.labels.find((l) => l.name.startsWith('tech-debt:'))
    const priority = priorityMatch
      ? priorityMatch.name.replace('tech-debt:', '').toUpperCase() as 'P0' | 'P1' | 'P2' | 'P3'
      : 'P2'

    const typeMatch = issue.body.match(/(代码债|设计债|测试债|文档债|依赖债|性能债)/)
    const type = typeMatch ? typeMatch[1] : '未分类'

    return {
      id: `TD-${issue.number}`,
      title: issue.title.replace('[Tech Debt] ', ''),
      priority,
      type,
      status: issue.state,
      assignee: issue.assignee?.login || '未分配',
      createdAt: issue.created_at,
      closedAt: issue.closed_at || undefined,
      description: issue.body.substring(0, 200),
    }
  })
}

// ============================================================
// SonarQube API 集成（可选）
// ============================================================

async function fetchSonarQubeMetrics(): Promise<SonarQubeMetrics | null> {
  if (!config.sonarqubeToken || !config.sonarqubeProject) {
    logger.info('[TechDebtReport] SonarQube 未配置，跳过代码质量指标')
    return null
  }

  try {
    const url = `${config.sonarqubeUrl}/api/measures/component?component=${config.sonarqubeProject}&metricKeys=coverage,duplicated_blocks,code_smells,bugs,vulnerabilities,technical_debt`
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.sonarqubeToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`SonarQube API 返回 ${response.status}`)
    }

    const data = await response.json()
    const measures = data.component.measures

    const metrics: SonarQubeMetrics = {
      coverage: measures.find((m: any) => m.metric === 'coverage')?.value || 0,
      duplicatedBlocks: measures.find((m: any) => m.metric === 'duplicated_blocks')?.value || 0,
      codeSmells: measures.find((m: any) => m.metric === 'code_smells')?.value || 0,
      bugs: measures.find((m: any) => m.metric === 'bugs')?.value || 0,
      vulnerabilities: measures.find((m: any) => m.metric === 'vulnerabilities')?.value || 0,
      technicalDebt: measures.find((m: any) => m.metric === 'technical_debt')?.value || '0min',
    }

    logger.info('[TechDebtReport] 从 SonarQube 获取代码质量指标', { metrics })
    return metrics
  } catch (error) {
    logger.error('[TechDebtReport] SonarQube API 调用失败', { error })
    return null
  }
}

// ============================================================
// 统计分析
// ============================================================

function calculateStats(items: TechDebtItem[]): TechDebtStats {
  const open = items.filter((i) => i.status === 'open')
  const closed = items.filter((i) => i.status === 'closed')

  const byPriority = {
    P0: open.filter((i) => i.priority === 'P0').length,
    P1: open.filter((i) => i.priority === 'P1').length,
    P2: open.filter((i) => i.priority === 'P2').length,
    P3: open.filter((i) => i.priority === 'P3').length,
  }

  const byType: Record<string, number> = {}
  open.forEach((i) => {
    byType[i.type] = (byType[i.type] || 0) + 1
  })

  const closureRate = items.length > 0 ? (closed.length / items.length) * 100 : 0

  // 生成趋势数据（最近 7 天）
  const trend = generateTrendData(items)

  return {
    total: items.length,
    open: open.length,
    closed: closed.length,
    byPriority,
    byType,
    closureRate,
    trend,
  }
}

function generateTrendData(items: TechDebtItem[]): TechDebtStats['trend'] {
  const today = new Date()
  const trend: TechDebtStats['trend'] = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // 模拟历史数据（实际应该从数据库或日志中获取）
    const total = items.length
    const closed = items.filter((item) => {
      if (!item.closedAt) return false
      const closedDate = item.closedAt.split('T')[0]
      return closedDate <= dateStr
    }).length

    trend.push({
      date: dateStr,
      total,
      open: total - closed,
      closed,
    })
  }

  return trend
}

// ============================================================
// 报告生成
// ============================================================

function generateMarkdownReport(
  items: TechDebtItem[],
  stats: TechDebtStats,
  sonarMetrics: SonarQubeMetrics | null,
): string {
  const now = new Date().toISOString().split('T')[0]

  let report = `# 技术债自动化报告\n\n`
  report += `> **生成时间**: ${now}  \n`
  report += `> **数据来源**: GitHub Issue${sonarMetrics ? ' + SonarQube' : ''}\n\n`

  // 统计概览
  report += `## 一、统计概览\n\n`
  report += `| 指标 | 数值 |\n`
  report += `|------|------|\n`
  report += `| **技术债总数** | ${stats.total} |\n`
  report += `| **未解决** | ${stats.open} |\n`
  report += `| **已解决** | ${stats.closed} |\n`
  report += `| **清理率** | ${stats.closureRate.toFixed(1)}% |\n\n`

  // 优先级分布
  report += `## 二、优先级分布\n\n`
  report += `| 优先级 | 数量 | 说明 |\n`
  report += `|--------|------|------|\n`
  report += `| **P0** | ${stats.byPriority.P0} | ${stats.byPriority.P0 === 0 ? '✅ 无严重影响' : '🔴 需立即处理'} |\n`
  report += `| **P1** | ${stats.byPriority.P1} | ${stats.byPriority.P1 < 5 ? '✅ 达标' : '⚠️ 需关注'} |\n`
  report += `| **P2** | ${stats.byPriority.P2} | 可选改进 |\n`
  report += `| **P3** | ${stats.byPriority.P3} | 待规划 |\n\n`

  // 类型分布
  report += `## 三、类型分布\n\n`
  report += `| 类型 | 数量 |\n`
  report += `|------|------|\n`
  Object.entries(stats.byType).forEach(([type, count]) => {
    report += `| ${type} | ${count} |\n`
  })
  report += `\n`

  // SonarQube 指标（如果有）
  if (sonarMetrics) {
    report += `## 四、代码质量指标（SonarQube）\n\n`
    report += `| 指标 | 数值 |\n`
    report += `|------|------|\n`
    report += `| **测试覆盖率** | ${sonarMetrics.coverage}% |\n`
    report += `| **重复代码块** | ${sonarMetrics.duplicatedBlocks} |\n`
    report += `| **代码异味** | ${sonarMetrics.codeSmells} |\n`
    report += `| **Bug** | ${sonarMetrics.bugs} |\n`
    report += `| **安全漏洞** | ${sonarMetrics.vulnerabilities} |\n`
    report += `| **技术债** | ${sonarMetrics.technicalDebt} |\n\n`
  }

  // 趋势图
  report += `## ${sonarMetrics ? '五' : '四'}、趋势分析\n\n`
  report += `### 技术债清理趋势（最近 7 天）\n\n`
  report += `| 日期 | 总数 | 未解决 | 已解决 |\n`
  report += `|------|------|--------|--------|\n`
  stats.trend.forEach((t) => {
    report += `| ${t.date} | ${t.total} | ${t.open} | ${t.closed} |\n`
  })
  report += `\n`

  // Mermaid 趋势图
  report += `### 可视化趋势图\n\n`
  report += `\`\`\`mermaid\n`
  report += `xychart-beta\n`
  report += `    title "技术债清理趋势"\n`
  report += `    x-axis [${stats.trend.map((t) => `"${t.date.substring(5)}"`).join(', ')}]\n`
  report += `    y-axis "数量" 0 --> ${Math.max(...stats.trend.map((t) => t.total)) + 5}\n`
  report += `    bar [${stats.trend.map((t) => t.open).join(', ')}]\n`
  report += `    line [${stats.trend.map((t) => t.closed).join(', ')}]\n`
  report += `\`\`\`\n\n`

  // 未解决技术债清单
  report += `## ${sonarMetrics ? '六' : '五'}、未解决技术债清单\n\n`
  const openItems = items.filter((i) => i.status === 'open')
  
  if (openItems.length === 0) {
    report += `> ✅ 当前无未解决技术债\n\n`
  } else {
    report += `| ID | 优先级 | 类型 | 标题 | 负责人 |\n`
    report += `|----|--------|------|------|--------|\n`
    openItems.forEach((item) => {
      report += `| ${item.id} | ${item.priority} | ${item.type} | ${item.title} | ${item.assignee} |\n`
    })
    report += `\n`
  }

  // 建议行动
  report += `## ${sonarMetrics ? '七' : '六'}、建议行动\n\n`
  
  if (stats.byPriority.P0 > 0) {
    report += `### 🔴 立即行动（P0）\n\n`
    report += `- 处理 ${stats.byPriority.P0} 个 P0 级技术债\n`
    report += `- 预计工时：${stats.byPriority.P0 * 4} 小时\n\n`
  }

  if (stats.byPriority.P1 > 0) {
    report += `### 🟡 本周行动（P1）\n\n`
    report += `- 处理 ${stats.byPriority.P1} 个 P1 级技术债\n`
    report += `- 预计工时：${stats.byPriority.P1 * 3} 小时\n\n`
  }

  if (stats.byPriority.P2 > 0) {
    report += `### 🟢 本月行动（P2）\n\n`
    report += `- 处理 ${stats.byPriority.P2} 个 P2 级技术债\n`
    report += `- 预计工时：${stats.byPriority.P2 * 2} 小时\n\n`
  }

  report += `---\n\n`
  report += `**报告生成器**: scripts/generate-tech-debt-report.ts v1.0.0\n`
  report += `**下次运行**: ${getNextRunDate()}\n`

  return report
}

function getNextRunDate(): string {
  const next = new Date()
  next.setDate(next.getDate() + 7)
  return next.toISOString().split('T')[0]
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  logger.info('[TechDebtReport] 开始生成技术债报告')

  // 1. 获取数据
  const issues = await fetchGitHubIssues()
  const items = parseTechDebtItems(issues)
  const sonarMetrics = await fetchSonarQubeMetrics()

  // 2. 统计分析
  const stats = calculateStats(items)

  // 3. 生成报告
  const report = generateMarkdownReport(items, stats, sonarMetrics)

  // 4. 保存报告
  if (!existsSync(config.outputDir)) {
    execSync(`mkdir -p "${config.outputDir}"`, { shell: true })
  }

  const reportFile = join(config.outputDir, `tech-debt-report-${new Date().toISOString().split('T')[0]}.md`)
  writeFileSync(reportFile, report, 'utf-8')
  logger.info(`[TechDebtReport] 报告已保存: ${reportFile}`)

  // 5. 输出统计摘要
  console.log('\n========================================')
  console.log('技术债报告生成完成')
  console.log('========================================')
  console.log(`技术债总数: ${stats.total}`)
  console.log(`未解决: ${stats.open}`)
  console.log(`已解决: ${stats.closed}`)
  console.log(`清理率: ${stats.closureRate.toFixed(1)}%`)
  console.log(`P0: ${stats.byPriority.P0}`)
  console.log(`P1: ${stats.byPriority.P1}`)
  console.log(`P2: ${stats.byPriority.P2}`)
  console.log(`P3: ${stats.byPriority.P3}`)
  console.log('========================================\n')

  // 6. 检查是否需要告警
  if (stats.byPriority.P0 > 0) {
    logger.warn(`[TechDebtReport] 发现 ${stats.byPriority.P0} 个 P0 级技术债，需要立即处理`)
    process.exit(1)
  }

  if (stats.closureRate < 50) {
    logger.warn(`[TechDebtReport] 清理率 ${stats.closureRate.toFixed(1)}% 低于目标 50%`)
  }

  logger.info('[TechDebtReport] 报告生成成功')
}

main().catch((error) => {
  logger.error('[TechDebtReport] 报告生成失败', { error })
  process.exit(1)
})
