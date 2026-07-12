#!/usr/bin/env tsx
/**
 * 审计警告趋势监控脚本
 * 
 * 功能：
 * 1. 运行所有审计脚本，收集警告统计数据
 * 2. 将数据写入趋势文件（按日期归档）
 * 3. 生成趋势分析报告
 * 4. 支持手动触发和定时执行
 * 
 * 使用方法：
 *   npx tsx scripts/audit-trend-monitor.ts              # 运行扫描并记录
 *   npx tsx scripts/audit-trend-monitor.ts --report    # 生成趋势报告
 *   npx tsx scripts/audit-trend-monitor.ts --compare   # 对比历史数据
 * 
 * 数据存储：
 *   docs/reports/audit/trends/YYYY-MM-DD.json
 *   docs/reports/audit/trends/trend-summary.json
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const BLUE = '\x1b[34m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function logError(msg: string): void {
  console.error(`${RED}✗${RESET} ${msg}`)
}

function logWarn(msg: string): void {
  console.warn(`${YELLOW}⚠${RESET} ${msg}`)
}

function logSuccess(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

function logInfo(msg: string): void {
  console.log(`${BLUE}ℹ${RESET} ${msg}`)
}

function logDetail(msg: string): void {
  console.log(`${CYAN}  →${RESET} ${msg}`)
}

interface AuditResult {
  name: string
  warnings: number
  violations: number
  timestamp: string
  details?: unknown
}

interface TrendRecord {
  date: string
  timestamp: string
  totalWarnings: number
  totalViolations: number
  audits: AuditResult[]
}

interface TrendSummary {
  latestDate: string
  latestTotalWarnings: number
  trend: 'improving' | 'stable' | 'deteriorating'
  changeFromLastWeek: number
  changeFromLastMonth: number
  weeklyData: Array<{ date: string; warnings: number }>
  topScripts: Array<{ name: string; warnings: number; trend: string }>
}

const TRENDS_DIR = join(ROOT, 'docs', 'reports', 'audit', 'trends')

function ensureDirExists(): void {
  if (!existsSync(TRENDS_DIR)) {
    mkdirSync(TRENDS_DIR, { recursive: true })
  }
}

function runAuditScript(scriptName: string): AuditResult {
  try {
    logInfo(`正在运行 ${scriptName}...`)
    const startTime = Date.now()
    const result = execSync(`npx tsx scripts/${scriptName}.ts 2>&1`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 300000
    })
    const duration = Date.now() - startTime

    const cleanOutput = result.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/[\u200b-\u200d\uFEFF]/g, '')

    let warnings = 0
    let violations = 0

    const lines = cleanOutput.split('\n')
    
    const warningPatterns = [
      /(\d+)\s*处警告/,
      /警告数[：:]\s*(\d+)/,
      /警告\s+(\d+)\s+个/,
      /发现\s+(\d+)\s+处警告/,
      /(\d+)\s+处警告/,
      /警告\s+(\d+)\s*个/,
    ]
    
    for (const line of lines) {
      if (line.includes('警告')) {
        const debugLine = line.trim().replace(/\s+/g, ' ')
        for (const pattern of warningPatterns) {
          const match = line.match(pattern)
          if (match) {
            warnings = Math.max(warnings, parseInt(match[1]))
          }
        }
      }
    }
    
    const violationPatterns = [
      /(\d+)\s*处违规/,
      /违规数[：:]\s*(\d+)/,
      /违规\s+(\d+)\s+个/,
      /发现\s+(\d+)\s+处违规/,
      /(\d+)\s+处违规/,
    ]
    
    for (const line of lines) {
      for (const pattern of violationPatterns) {
        const match = line.match(pattern)
        if (match) {
          violations = Math.max(violations, parseInt(match[1]))
        }
      }
    }

    if (cleanOutput.includes('通过') && warnings === 0 && violations === 0) {
      warnings = 0
      violations = 0
    }

    logDetail(`${scriptName}: ${warnings} 警告, ${violations} 违规 (${duration}ms)`)

    return {
      name: scriptName,
      warnings,
      violations,
      timestamp: new Date().toISOString(),
      details: result
    }
  } catch (e) {
    logWarn(`${scriptName} 执行失败: ${(e as Error).message}`)
    return {
      name: scriptName,
      warnings: -1,
      violations: -1,
      timestamp: new Date().toISOString(),
      details: (e as Error).message
    }
  }
}

function scanAllAudits(): AuditResult[] {
  const scripts = [
    'audit-layer-calls',
    'audit-hardcode',
    'audit-dead-code',
    'audit-doc-sync',
    'audit-mapping-integrity',
    'audit-execution-paths',
    'audit-split-quality',
    'audit-typography',
    'audit-jsdoc',
    'audit-atomic',
    'audit-mcp',
    'audit-token-consumption',
  ]

  const results: AuditResult[] = []
  for (const script of scripts) {
    results.push(runAuditScript(script))
  }
  return results
}

function saveTrendRecord(results: AuditResult[]): string {
  ensureDirExists()
  
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const timestamp = now.toISOString()

  const record: TrendRecord = {
    date: dateStr,
    timestamp,
    totalWarnings: results.reduce((sum, r) => sum + (r.warnings >= 0 ? r.warnings : 0), 0),
    totalViolations: results.reduce((sum, r) => sum + (r.violations >= 0 ? r.violations : 0), 0),
    audits: results
  }

  const filePath = join(TRENDS_DIR, `${dateStr}.json`)
  writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8')

  updateTrendSummary(record)

  return filePath
}

function updateTrendSummary(record: TrendRecord): void {
  const summaryPath = join(TRENDS_DIR, 'trend-summary.json')
  
  let summary: TrendSummary = {
    latestDate: record.date,
    latestTotalWarnings: record.totalWarnings,
    trend: 'stable',
    changeFromLastWeek: 0,
    changeFromLastMonth: 0,
    weeklyData: [],
    topScripts: []
  }

  if (existsSync(summaryPath)) {
    try {
      const existing = JSON.parse(readFileSync(summaryPath, 'utf-8'))
      summary = { ...existing, latestDate: record.date, latestTotalWarnings: record.totalWarnings }
    } catch {
      // Ignore parse errors
    }
  }

  const history = loadAllTrendRecords()
  summary.weeklyData = history.slice(-7).map(h => ({ date: h.date, warnings: h.totalWarnings }))

  if (history.length >= 2) {
    const lastWeek = history[history.length - 7]
    if (lastWeek) {
      summary.changeFromLastWeek = record.totalWarnings - lastWeek.totalWarnings
    }
    const lastMonth = history[history.length - 30]
    if (lastMonth) {
      summary.changeFromLastMonth = record.totalWarnings - lastMonth.totalWarnings
    }
  }

  if (summary.changeFromLastWeek < 0) summary.trend = 'improving'
  else if (summary.changeFromLastWeek > 0) summary.trend = 'deteriorating'
  else summary.trend = 'stable'

  summary.topScripts = record.audits
    .filter(a => a.warnings > 0)
    .sort((a, b) => b.warnings - a.warnings)
    .slice(0, 5)
    .map(a => ({
      name: a.name,
      warnings: a.warnings,
      trend: 'stable'
    }))

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')
}

function loadAllTrendRecords(): TrendRecord[] {
  if (!existsSync(TRENDS_DIR)) return []

  const files = readdirSync(TRENDS_DIR).filter(f => f.endsWith('.json') && !f.includes('trend-summary'))

  const records: TrendRecord[] = []
  for (const file of files) {
    try {
      const content = readFileSync(join(TRENDS_DIR, file), 'utf-8')
      records.push(JSON.parse(content))
    } catch {
      // Skip invalid files
    }
  }

  return records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function generateTrendReport(): void {
  const records = loadAllTrendRecords()
  const summaryPath = join(TRENDS_DIR, 'trend-summary.json')
  
  let summary: TrendSummary = {
    latestDate: '',
    latestTotalWarnings: 0,
    trend: 'stable',
    changeFromLastWeek: 0,
    changeFromLastMonth: 0,
    weeklyData: [],
    topScripts: []
  }

  if (existsSync(summaryPath)) {
    try {
      summary = JSON.parse(readFileSync(summaryPath, 'utf-8'))
    } catch {
      // Ignore
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('审计警告趋势报告')
  console.log('='.repeat(80) + '\n')

  console.log(`${BLUE}📊 概览${RESET}`)
  console.log(`  最新日期: ${summary.latestDate}`)
  console.log(`  当前警告数: ${summary.latestTotalWarnings}`)
  console.log(`  趋势状态: ${getTrendColor(summary.trend)}${summary.trend}${RESET}`)
  console.log(`  较上周变化: ${getChangeColor(summary.changeFromLastWeek)}${summary.changeFromLastWeek > 0 ? '+' : ''}${summary.changeFromLastWeek}${RESET}`)
  console.log(`  较上月变化: ${getChangeColor(summary.changeFromLastMonth)}${summary.changeFromLastMonth > 0 ? '+' : ''}${summary.changeFromLastMonth}${RESET}`)

  console.log('\n' + `${BLUE}📈 近7天趋势${RESET}`)
  if (summary.weeklyData.length > 0) {
    const maxWarnings = Math.max(...summary.weeklyData.map(d => d.warnings))
    for (const day of summary.weeklyData) {
      const barLength = Math.max(1, Math.round((day.warnings / maxWarnings) * 40))
      const bar = '█'.repeat(barLength)
      console.log(`  ${day.date}: ${bar} ${day.warnings}`)
    }
  } else {
    console.log('  暂无数据')
  }

  console.log('\n' + `${BLUE}🏆 警告数最多的脚本${RESET}`)
  if (summary.topScripts.length > 0) {
    summary.topScripts.forEach((script, index) => {
      console.log(`  ${index + 1}. ${script.name}: ${YELLOW}${script.warnings}${RESET} 警告`)
    })
  } else {
    console.log('  暂无警告')
  }

  if (records.length >= 2) {
    console.log('\n' + `${BLUE}🔄 历史对比${RESET}`)
    const latest = records[records.length - 1]
    const previous = records[records.length - 2]
    console.log(`  上次扫描 (${previous.date}): ${previous.totalWarnings} 警告`)
    console.log(`  当前扫描 (${latest.date}): ${latest.totalWarnings} 警告`)
    const change = latest.totalWarnings - previous.totalWarnings
    console.log(`  变化: ${getChangeColor(change)}${change > 0 ? '+' : ''}${change}${RESET}`)
  }

  console.log('\n' + '='.repeat(80))
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return GREEN
    case 'deteriorating': return RED
    default: return YELLOW
  }
}

function getChangeColor(change: number): string {
  if (change < 0) return GREEN
  if (change > 0) return RED
  return YELLOW
}

function compareHistory(): void {
  const records = loadAllTrendRecords()
  
  console.log('\n' + '='.repeat(80))
  console.log('审计警告历史对比')
  console.log('='.repeat(80) + '\n')

  if (records.length === 0) {
    console.log('  暂无历史数据')
    console.log('='.repeat(80))
    return
  }

  console.log(`${BLUE}📅 历史记录列表${RESET}`)
  console.log('  ' + '-'.repeat(70))
  console.log('  日期        | 总警告数 | 总违规数')
  console.log('  ' + '-'.repeat(70))
  
  for (const record of records) {
    console.log(`  ${record.date} | ${record.totalWarnings.toString().padStart(8)} | ${record.totalViolations.toString().padStart(8)}`)
  }

  if (records.length >= 2) {
    console.log('\n' + `${BLUE}📉 变化趋势${RESET}`)
    let prevWarnings = records[0].totalWarnings
    for (let i = 1; i < records.length; i++) {
      const current = records[i]
      const change = current.totalWarnings - prevWarnings
      const color = change < 0 ? GREEN : change > 0 ? RED : YELLOW
      console.log(`  ${records[i - 1].date} → ${current.date}: ${color}${change > 0 ? '+' : ''}${change}${RESET}`)
      prevWarnings = current.totalWarnings
    }
  }

  console.log('\n' + '='.repeat(80))
}

function main(): void {
  const args = process.argv.slice(2)

  if (args.includes('--report')) {
    generateTrendReport()
    return
  }

  if (args.includes('--compare')) {
    compareHistory()
    return
  }

  console.log('\n' + '='.repeat(80))
  console.log('审计警告趋势监控 - 扫描模式')
  console.log('='.repeat(80) + '\n')

  logInfo('开始运行所有审计脚本...')
  
  const results = scanAllAudits()
  
  console.log('\n' + '-'.repeat(80))
  console.log('扫描结果汇总')
  console.log('-'.repeat(80))

  const totalWarnings = results.reduce((sum, r) => sum + (r.warnings >= 0 ? r.warnings : 0), 0)
  const failedScripts = results.filter(r => r.warnings < 0)

  for (const result of results) {
    if (result.warnings < 0) {
      logError(`${result.name}: 执行失败`)
    } else if (result.warnings > 0) {
      logWarn(`${result.name}: ${result.warnings} 警告`)
    } else {
      logSuccess(`${result.name}: 通过`)
    }
  }

  console.log('\n' + '-'.repeat(80))
  console.log(`总警告数: ${YELLOW}${totalWarnings}${RESET}`)
  if (failedScripts.length > 0) {
    console.log(`失败脚本数: ${RED}${failedScripts.length}${RESET}`)
  }

  const filePath = saveTrendRecord(results)
  logSuccess(`趋势数据已保存到: ${filePath}`)
  
  console.log('\n' + YELLOW + '💡 提示: 使用 --report 参数生成趋势报告，使用 --compare 参数对比历史数据' + RESET)
  console.log('='.repeat(80))

  process.exit(failedScripts.length > 0 ? 1 : 0)
}

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false
if (isMainModule) {
  main()
}