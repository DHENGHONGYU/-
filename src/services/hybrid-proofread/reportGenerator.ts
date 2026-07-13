import { getLogger } from '@/lib/logger'
import { COLOR_SHADES } from '@/constants/theme.tokens'
import type {
  ProofreadReport,
  LocalScanResult,
  CloudRiskResult,
  RuleMatchResult,
  RiskLevel,
} from '@/data/types'

const logger = getLogger()

/**
 * ReportGenerator
 */
export class ReportGenerator {
  generateReport(
    projectId: string,
    projectName: string,
    localScan: LocalScanResult,
    cloudRisk: CloudRiskResult | null,
  ): ProofreadReport {
    logger.info(`[ReportGenerator] 生成报告: ${projectId}`)

    const { critical_issues, high_issues, medium_issues, low_issues, total_issues } =
      this.countIssues(localScan.rule_matches, cloudRisk?.risks ?? [])

    const overall_risk_level = this.calculateOverallRiskLevel(
      critical_issues,
      high_issues,
      medium_issues,
    )

    const summary = this.generateSummary(
      projectName,
      localScan,
      cloudRisk,
      critical_issues,
      high_issues,
      medium_issues,
      low_issues,
    )

    const recommendations = this.generateRecommendations(
      localScan.rule_matches,
      cloudRisk?.risks ?? [],
    )

    const report: ProofreadReport = {
      id: `report-${Date.now()}-${projectId}`,
      project_id: projectId,
      project_name: projectName,
      scan_time: localScan.scan_time,
      local_scan: localScan,
      cloud_risk: cloudRisk,
      overall_risk_level,
      total_issues,
      critical_issues,
      high_issues,
      medium_issues,
      low_issues,
      summary,
      recommendations,
    }

    logger.info(`[ReportGenerator] 报告生成完成: 总问题数=${total_issues}, 风险等级=${overall_risk_level}`)

    return report
  }

  private countIssues(
    ruleMatches: RuleMatchResult[],
    risks: Array<{ severity: string }>,
  ): {
    critical_issues: number
    high_issues: number
    medium_issues: number
    low_issues: number
    total_issues: number
  } {
    let critical = 0
    let high = 0
    let medium = 0
    let low = 0

    for (const match of ruleMatches) {
      switch (match.severity) {
        case 'critical':
          critical++
          break
        case 'high':
          high++
          break
        case 'medium':
          medium++
          break
        case 'low':
        case 'warning':
          low++
          break
      }
    }

    for (const risk of risks) {
      switch (risk.severity) {
        case 'critical':
          critical++
          break
        case 'high':
          high++
          break
        case 'medium':
          medium++
          break
        case 'low':
        case 'info':
          low++
          break
      }
    }

    return {
      critical_issues: critical,
      high_issues: high,
      medium_issues: medium,
      low_issues: low,
      total_issues: critical + high + medium + low,
    }
  }

  private calculateOverallRiskLevel(
    critical: number,
    high: number,
    medium: number,
  ): RiskLevel {
    if (critical > 0) return 5
    if (high >= 3) return 4
    if (high >= 1) return 3
    if (medium >= 5) return 2
    if (medium >= 1) return 1
    return 0
  }

  private generateSummary(
    projectName: string,
    localScan: LocalScanResult,
    cloudRisk: CloudRiskResult | null,
    critical: number,
    high: number,
    medium: number,
    low: number,
  ): string {
    const parts: string[] = []

    parts.push(`项目 ${projectName} 的代码安全校对已完成。`)
    parts.push(`本地扫描共检查 ${localScan.scanned_files} 个文件。`)

    if (cloudRisk) {
      parts.push(`云端风险检查共验证 ${cloudRisk.hash_count} 个文件哈希，发现 ${cloudRisk.risky_count} 个风险文件。`)
    }

    if (critical > 0) {
      parts.push(`发现 ${critical} 个严重问题，建议立即修复。`)
    }

    if (high > 0) {
      parts.push(`发现 ${high} 个高危问题，建议尽快修复。`)
    }

    if (medium > 0) {
      parts.push(`发现 ${medium} 个中危问题，建议规划修复。`)
    }

    if (low > 0) {
      parts.push(`发现 ${low} 个低危问题，建议适时修复。`)
    }

    if (critical === 0 && high === 0 && medium === 0 && low === 0) {
      parts.push('未发现安全问题，项目代码质量良好。')
    }

    return parts.join(' ')
  }

  private appendRecommendation(
    recommendations: string[],
    seen: Set<string>,
    advice: string,
  ): void {
    if (seen.has(advice)) return
    recommendations.push(advice)
    seen.add(advice)
  }

  private generateRecommendations(
    ruleMatches: RuleMatchResult[],
    risks: Array<{ remediation_advice: string }>,
  ): string[] {
    const recommendations: string[] = []
    const seen = new Set<string>()

    for (const match of ruleMatches) {
      if (match.action_type === 'block') {
        const advice = `[${match.rule_name}] ${match.description}，请修复文件 ${match.file_path} 第 ${match.line_number} 行`
        this.appendRecommendation(recommendations, seen, advice)
      } else if (match.action_type === 'warn') {
        const advice = `[${match.rule_name}] ${match.description}`
        this.appendRecommendation(recommendations, seen, advice)
      }
    }

    for (const risk of risks) {
      if (risk.remediation_advice) {
        this.appendRecommendation(recommendations, seen, risk.remediation_advice)
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('当前未发现需要修复的问题，继续保持代码质量。')
    }

    return recommendations.slice(0, 10)
  }

  exportReport(report: ProofreadReport, format: 'json' | 'html' | 'markdown'): string {
    logger.info(`[ReportGenerator] 导出报告格式: ${format}`)

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2)

      case 'html':
        return this.generateHtmlReport(report)

      case 'markdown':
      default:
        return this.generateMarkdownReport(report)
    }
  }

  private generateMarkdownReport(report: ProofreadReport): string {
    const lines: string[] = []

    lines.push('# 代码安全校对报告')
    lines.push('')
    lines.push(`## 基本信息`)
    lines.push(`- 项目名称: ${report.project_name}`)
    lines.push(`- 项目 ID: ${report.project_id}`)
    lines.push(`- 扫描时间: ${new Date(report.scan_time).toLocaleString('zh-CN')}`)
    lines.push(`- 总体风险等级: ${this.getRiskLevelLabel(report.overall_risk_level)}`)
    lines.push('')

    lines.push(`## 问题统计`)
    lines.push(`| 级别 | 数量 |`)
    lines.push(`|------|------|`)
    lines.push(`| 严重 | ${report.critical_issues} |`)
    lines.push(`| 高危 | ${report.high_issues} |`)
    lines.push(`| 中危 | ${report.medium_issues} |`)
    lines.push(`| 低危 | ${report.low_issues} |`)
    lines.push(`| 总计 | ${report.total_issues} |`)
    lines.push('')

    lines.push(`## 摘要`)
    lines.push(report.summary)
    lines.push('')

    if (report.recommendations.length > 0) {
      lines.push(`## 修复建议`)
      for (let i = 0; i < report.recommendations.length; i++) {
        lines.push(`${i + 1}. ${report.recommendations[i]}`)
      }
      lines.push('')
    }

    lines.push(`## 本地扫描详情`)
    lines.push(`- 扫描文件数: ${report.local_scan.scanned_files}`)
    lines.push(`- 跳过文件数: ${report.local_scan.skipped_files}`)
    lines.push(`- 规则匹配数: ${report.local_scan.rule_matches.length}`)
    lines.push('')

    if (report.cloud_risk) {
      lines.push(`## 云端风险详情`)
      lines.push(`- 验证哈希数: ${report.cloud_risk.hash_count}`)
      lines.push(`- 风险文件数: ${report.cloud_risk.risky_count}`)
      lines.push(`- 风险条目数: ${report.cloud_risk.risks.length}`)
    }

    return lines.join('\n')
  }

  private generateHtmlReport(report: ProofreadReport): string {
    const severityColors: Record<string, string> = {
      critical: COLOR_SHADES.red.hex[600],
      high: COLOR_SHADES.orange.hex[600],
      medium: COLOR_SHADES.yellow.hex[600],
      low: COLOR_SHADES.green.hex[600],
      warning: COLOR_SHADES.yellow.hex[600],
      info: COLOR_SHADES.slate.hex[500],
    }

    const riskLevelLabels: Record<RiskLevel, string> = {
      0: '安全',
      1: '低风险',
      2: '中风险',
      3: '高风险',
      4: '严重风险',
      5: '危急',
    }

    const riskLevelColor = severityColors[
      report.overall_risk_level >= 4 ? 'critical' :
      report.overall_risk_level >= 3 ? 'high' :
      report.overall_risk_level >= 2 ? 'medium' : 'low'
    ]

    // 报告模板色常量（引用 COLOR_SHADES 令牌，消除硬编码 hex）
    const CSS_COLOR_H1 = COLOR_SHADES.slate.hex[800]
    const CSS_COLOR_H2 = COLOR_SHADES.slate.hex[700]
    const CSS_COLOR_BORDER = COLOR_SHADES.slate.hex[200]
    const CSS_COLOR_BG = COLOR_SHADES.slate.hex[50]

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>代码安全校对报告 - ${report.project_name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 2rem; }
    h1 { color: ${CSS_COLOR_H1}; }
    h2 { color: ${CSS_COLOR_H2}; border-bottom: 2px solid ${CSS_COLOR_BORDER}; padding-bottom: 0.5rem; }
    .info-box { background: ${CSS_COLOR_BG}; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; }
    .stat-item { text-align: center; padding: 1rem; border-radius: 0.5rem; }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 13px; color: ${COLOR_SHADES.slate.hex[500]}; }
    .critical { background: ${COLOR_SHADES.red.hex[50]}; color: ${COLOR_SHADES.red.hex[600]}; }
    .high { background: ${COLOR_SHADES.orange.hex[100]}; color: ${COLOR_SHADES.orange.hex[600]}; }
    .medium { background: ${COLOR_SHADES.yellow.hex[50]}; color: ${COLOR_SHADES.yellow.hex[600]}; }
    .low { background: ${COLOR_SHADES.green.hex[50]}; color: ${COLOR_SHADES.green.hex[600]}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid ${COLOR_SHADES.slate.hex[200]}; }
    th { background: ${COLOR_SHADES.slate.hex[50]}; font-weight: 600; }
    .summary { background: ${COLOR_SHADES.blue.hex[50]}; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
    .recommendations { background: ${COLOR_SHADES.slate.hex[50]}; padding: 1rem; border-radius: 0.5rem; }
    .recommendation-item { margin-bottom: 0.5rem; padding-left: 1rem; border-left: 3px solid ${COLOR_SHADES.blue.hex[500]}; }
  </style>
</head>
<body>
  <h1>代码安全校对报告</h1>
  
  <div class="info-box">
    <strong>项目名称:</strong> ${report.project_name}<br>
    <strong>项目 ID:</strong> ${report.project_id}<br>
    <strong>扫描时间:</strong> ${new Date(report.scan_time).toLocaleString('zh-CN')}<br>
    <strong>总体风险等级:</strong> <span style="color: ${riskLevelColor}">${riskLevelLabels[report.overall_risk_level]}</span>
  </div>

  <h2>问题统计</h2>
  <div class="stat-grid">
    <div class="stat-item critical"><div class="stat-value">${report.critical_issues}</div><div class="stat-label">严重</div></div>
    <div class="stat-item high"><div class="stat-value">${report.high_issues}</div><div class="stat-label">高危</div></div>
    <div class="stat-item medium"><div class="stat-value">${report.medium_issues}</div><div class="stat-label">中危</div></div>
    <div class="stat-item low"><div class="stat-value">${report.low_issues}</div><div class="stat-label">低危</div></div>
  </div>

  <h2>摘要</h2>
  <div class="summary">${report.summary}</div>

  <h2>修复建议</h2>
  <div class="recommendations">
    ${report.recommendations.map((r, i) => `<div class="recommendation-item">${i + 1}. ${r}</div>`).join('')}
  </div>

  <h2>扫描详情</h2>
  <table>
    <tr><th>指标</th><th>数值</th></tr>
    <tr><td>扫描文件数</td><td>${report.local_scan.scanned_files}</td></tr>
    <tr><td>跳过文件数</td><td>${report.local_scan.skipped_files}</td></tr>
    <tr><td>规则匹配数</td><td>${report.local_scan.rule_matches.length}</td></tr>
    ${report.cloud_risk ? `<tr><td>云端风险文件数</td><td>${report.cloud_risk.risky_count}</td></tr>` : ''}
  </table>
</body>
</html>`

    return html
  }

  private getRiskLevelLabel(level: RiskLevel): string {
    const labels: Record<RiskLevel, string> = {
      0: '安全',
      1: '低风险',
      2: '中风险',
      3: '高风险',
      4: '严重风险',
      5: '危急',
    }
    return labels[level]
  }
}

/**
 * reportGenerator
 */
export const reportGenerator = new ReportGenerator()