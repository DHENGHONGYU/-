#!/usr/bin/env node
/**
 * @module scripts/doc-freshness-score
 * @description 文档保鲜度评分自动化 — 基于R6.P6.04提示词体系
 *
 * 评分维度（四维度加权）：
 * - 完整性 (30%)：文档是否包含必要章节和内容
 * - 时效性 (25%)：文档更新时间与代码变更的匹配程度
 * - 准确性 (25%)：文档内容与实际代码的一致性
 * - 一致性 (20%)：术语、格式、风格的统一程度
 *
 * 用法：
 *   npx tsx scripts/doc-freshness-score.ts [--auto-fix] [--output <path>]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..', '..')

const REPORT_DIR = join(ROOT, 'docs', 'reports', 'doc-freshness')

interface DocFile {
  absolutePath: string
  relativePath: string
  sizeBytes: number
  lastModifiedAt: string
  lastModifiedMs: number
  hash: string
}

interface FreshnessScore {
  totalScore: number
  dimensionScores: {
    completeness: number
    timeliness: number
    accuracy: number
    consistency: number
  }
  status: 'excellent' | 'good' | 'fair' | 'poor'
  issues: string[]
  suggestions: string[]
}

interface DocFreshnessReport {
  meta: {
    runId: string
    startedAt: string
    finishedAt: string
    rootDir: string
    totalDocs: number
  }
  docs: Array<{
    path: string
    freshness: FreshnessScore
    lastModifiedAt: string
    sizeBytes: number
  }>
  summary: {
    avgScore: number
    excellentCount: number
    goodCount: number
    fairCount: number
    poorCount: number
    overallStatus: 'pass' | 'warning' | 'failure'
  }
  recommendations: string[]
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function scanDocs(): DocFile[] {
  const docsDir = join(ROOT, 'docs')
  const files: DocFile[] = []

  function collect(dir: string): void {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          collect(fullPath)
        } else if (extname(entry) === '.md') {
          const content = readFileSync(fullPath)
          files.push({
            absolutePath: fullPath,
            relativePath: relative(ROOT, fullPath).replace(/\\/g, '/'),
            sizeBytes: content.length,
            lastModifiedAt: formatTimestamp(new Date()),
            lastModifiedMs: Date.now(),
            hash: sha256(content),
          } as DocFile)
        }
      } catch {
        continue
      }
    }
  }

  try {
    collect(docsDir)
  } catch (error) {
    console.error(`[DocFreshness] 扫描文档失败: ${error}`)
  }

  return files as DocFile[]
}

function getGitHistory(filePath: string): { lastCommitDate: Date | null; commits: number } {
  try {
    const output = execSync(`git log --follow --format=%aI -n 1 "${filePath}"`, {
      encoding: 'utf-8',
      cwd: ROOT,
    }).trim()
    const commitCount = parseInt(
      execSync(`git log --follow --oneline "${filePath}" | wc -l`, {
        encoding: 'utf-8',
        cwd: ROOT,
      }).trim(),
      10
    )
    return {
      lastCommitDate: output ? new Date(output) : null,
      commits: isNaN(commitCount) ? 0 : commitCount,
    }
  } catch {
    return { lastCommitDate: null, commits: 0 }
  }
}

function extractReferencedCodeFiles(docPath: string): string[] {
  try {
    const content = readFileSync(docPath, 'utf-8')
    const links: string[] = []
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[2]
      if (!target.startsWith('http') && !target.startsWith('#')) {
        if (target.endsWith('.ts') || target.endsWith('.tsx')) {
          const resolved = resolve(dirname(docPath), target).replace(/\\/g, '/')
          links.push(relative(ROOT, resolved))
        }
      }
    }
    return [...new Set(links)]
  } catch {
    return []
  }
}

function getRelatedCodeChanges(docPath: string): number {
  try {
    const referencedFiles = extractReferencedCodeFiles(docPath)
    if (referencedFiles.length === 0) {
      return 0
    }

    let totalChanges = 0
    for (const file of referencedFiles) {
      const output = execSync(`git log --since="2026-01-01" --oneline -- "${file}" 2>/dev/null | wc -l`, {
        encoding: 'utf-8',
        cwd: ROOT,
      }).trim()
      totalChanges += parseInt(output, 10) || 0
    }
    return totalChanges
  } catch {
    return 0
  }
}

function scoreCompleteness(content: string, fileName: string): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 100

  if (content.length === 0) {
    issues.push('文档内容为空')
    score = 0
    return { score, issues }
  }

  if (content.length < 100) {
    issues.push('文档内容过短')
    score -= 30
  }

  const hasTitle = /^#\s+/.test(content)
  if (!hasTitle) {
    issues.push('缺少标题')
    score -= 10
  }

  const hasTableOfContents = /##\s+目录|##\s+Table\s+of\s+Contents/i.test(content)
  if (fileName.includes('index') || fileName.includes('overview')) {
    if (!hasTableOfContents) {
      issues.push('索引文档缺少目录')
      score -= 10
    }
  }

  const hasCodeBlocks = /```/.test(content)
  const hasExamples = /示例|example/i.test(content)
  if (!hasCodeBlocks && !hasExamples && content.length > 500) {
    issues.push('缺少代码示例')
    score -= 10
  }

  const hasReferences = /\[.+\]\(/.test(content)
  if (!hasReferences && content.length > 300) {
    issues.push('缺少交叉引用')
    score -= 10
  }

  const hasFrontmatter = content.startsWith('---')
  if (!hasFrontmatter && fileName.includes('.md')) {
    issues.push('缺少YAML frontmatter')
    score -= 5
  }

  return { score: Math.max(0, score), issues }
}

function scoreTimeliness(docFile: DocFile): { score: number; issues: string[] } {
  const issues: string[] = []
  const { lastCommitDate, commits } = getGitHistory(docFile.relativePath)

  if (!lastCommitDate) {
    issues.push('无法获取git历史')
    return { score: 50, issues }
  }

  const daysSinceLastUpdate = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)

  let score = 100
  if (daysSinceLastUpdate > 365) {
    issues.push(`超过1年未更新 (${Math.round(daysSinceLastUpdate)}天)`)
    score = 20
  } else if (daysSinceLastUpdate > 180) {
    issues.push(`超过6个月未更新 (${Math.round(daysSinceLastUpdate)}天)`)
    score = 50
  } else if (daysSinceLastUpdate > 90) {
    issues.push(`超过3个月未更新 (${Math.round(daysSinceLastUpdate)}天)`)
    score = 70
  } else if (daysSinceLastUpdate > 30) {
    issues.push(`超过1个月未更新 (${Math.round(daysSinceLastUpdate)}天)`)
    score = 85
  }

  const codeChanges = getRelatedCodeChanges(docFile.relativePath)
  if (codeChanges > 10 && commits === 0) {
    issues.push('关联代码变更频繁但文档未更新')
    score -= 15
  }

  return { score: Math.max(0, score), issues }
}

function scoreAccuracy(content: string, docFile: DocFile): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 100

  const brokenLinks: string[] = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[2]
    if (!target.startsWith('http') && !target.startsWith('#')) {
      const resolvedPath = resolve(docFile.absolutePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/'), target).split('#')[0]
      if (!existsSync(resolvedPath)) {
        brokenLinks.push(target)
      }
    }
  }

  if (brokenLinks.length > 0) {
    issues.push(`发现 ${brokenLinks.length} 个断裂链接`)
    score -= brokenLinks.length * 5
  }

  const outdatedTerms = [
    { current: 'DataBridge', old: ['databridge', 'data bridge', 'Data Bridge'] },
    { current: 'Zustand', old: ['zustand', 'Zustland'] },
    { current: 'TypeScript', old: ['typescript'] },
  ]

  for (const { current, old } of outdatedTerms) {
    for (const term of old) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi')
      if (regex.test(content)) {
        issues.push(`发现不一致的术语 "${term}"，建议统一为 "${current}"`)
        score -= 3
      }
    }
  }

  return { score: Math.max(0, score), issues }
}

function scoreConsistency(content: string): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 100

  const unnamedCodeBlocks = (content.match(/^```\s*$/gm) || []).length
  if (unnamedCodeBlocks > 0) {
    issues.push(`发现 ${unnamedCodeBlocks} 个未指定语言的代码块`)
    score -= unnamedCodeBlocks * 3
  }

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    const requiredFields = ['title', 'description', 'version', 'date']
    for (const field of requiredFields) {
      if (!new RegExp(`^${field}:`).test(frontmatter)) {
        issues.push(`frontmatter 缺少 "${field}" 字段`)
        score -= 5
      }
    }
  }

  const headingLevels = content.match(/^#{1,6}\s+/gm) || []
  const hasMissingLevels = headingLevels.some((h, i) => {
    const currentLevel = h.trim().length
    const nextLevel = headingLevels[i + 1]?.trim().length
    return nextLevel && nextLevel > currentLevel + 1
  })

  if (hasMissingLevels) {
    issues.push('标题层级不连续')
    score -= 10
  }

  const lineLengths = content.split('\n').filter((l) => l.length > 120)
  if (lineLengths.length > 10) {
    issues.push(`发现 ${lineLengths.length} 行超过120字符`)
    score -= 5
  }

  return { score: Math.max(0, score), issues }
}

function calculateFreshness(content: string, docFile: DocFile): FreshnessScore {
  const completeness = scoreCompleteness(content, docFile.relativePath)
  const timeliness = scoreTimeliness(docFile)
  const accuracy = scoreAccuracy(content, docFile)
  const consistency = scoreConsistency(content)

  const totalScore = Math.round(
    completeness.score * 0.3 +
      timeliness.score * 0.25 +
      accuracy.score * 0.25 +
      consistency.score * 0.2
  )

  let status: FreshnessScore['status'] = 'excellent'
  if (totalScore < 40) status = 'poor'
  else if (totalScore < 60) status = 'fair'
  else if (totalScore < 80) status = 'good'

  const issues = [...completeness.issues, ...timeliness.issues, ...accuracy.issues, ...consistency.issues]

  const suggestions: string[] = []
  if (completeness.score < 70) suggestions.push('补充文档内容，添加标题、目录和示例')
  if (timeliness.score < 70) suggestions.push('检查关联代码变更，更新文档')
  if (accuracy.score < 70) suggestions.push('修复断裂链接，统一术语')
  if (consistency.score < 70) suggestions.push('规范代码块语言标记，完善frontmatter')

  return {
    totalScore,
    dimensionScores: {
      completeness: completeness.score,
      timeliness: timeliness.score,
      accuracy: accuracy.score,
      consistency: consistency.score,
    },
    status,
    issues,
    suggestions,
  }
}

function buildReport(docFiles: DocFile[]): DocFreshnessReport {
  const startedAt = new Date()
  const runId = generateId()

  const docs = docFiles.map((doc) => {
    const content = readFileSync(doc.absolutePath, 'utf-8')
    const freshness = calculateFreshness(content, doc)
    return {
      path: doc.relativePath,
      freshness,
      lastModifiedAt: doc.lastModifiedAt,
      sizeBytes: doc.sizeBytes,
    }
  })

  const scores = docs.map((d) => d.freshness.totalScore)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  const excellentCount = docs.filter((d) => d.freshness.status === 'excellent').length
  const goodCount = docs.filter((d) => d.freshness.status === 'good').length
  const fairCount = docs.filter((d) => d.freshness.status === 'fair').length
  const poorCount = docs.filter((d) => d.freshness.status === 'poor').length

  let overallStatus: 'pass' | 'warning' | 'failure' = 'pass'
  if (poorCount > 0) overallStatus = 'failure'
  else if (fairCount > docs.length * 0.2) overallStatus = 'warning'

  const recommendations: string[] = []
  if (poorCount > 0) {
    recommendations.push(`有 ${poorCount} 个文档保鲜度评分低于40，需要立即更新`)
  }
  if (fairCount > 0) {
    recommendations.push(`有 ${fairCount} 个文档保鲜度评分在40-60之间，建议更新`)
  }
  recommendations.push('运行 npx tsx scripts/doc-cross-ref-sync.ts 修复断裂链接')
  recommendations.push('运行 npx tsx scripts/daily-doc-validation.ts --auto-update 执行自动更新')

  return {
    meta: {
      runId,
      startedAt: formatTimestamp(startedAt),
      finishedAt: formatTimestamp(new Date()),
      rootDir: ROOT,
      totalDocs: docFiles.length,
    },
    docs,
    summary: {
      avgScore,
      excellentCount,
      goodCount,
      fairCount,
      poorCount,
      overallStatus,
    },
    recommendations,
  }
}

function persistReport(report: DocFreshnessReport): string | null {
  try {
    if (!existsSync(REPORT_DIR)) {
      mkdirSync(REPORT_DIR, { recursive: true })
    }
    const timestamp = report.meta.startedAt.replace(/[:.]/g, '-')
    const filePath = join(REPORT_DIR, `doc-freshness-${timestamp}.json`)
    const latestPath = join(REPORT_DIR, 'latest.json')

    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8')

    return filePath
  } catch (error) {
    console.error(`[DocFreshness] 持久化报告失败: ${error}`)
    return null
  }
}

function printSummary(report: DocFreshnessReport): void {
  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    magenta: '\x1b[35m',
  }

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║            文档保鲜度评分 — Document Freshness          ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  console.log(`${C.bold}运行ID:${C.reset} ${report.meta.runId}`)
  console.log(`${C.bold}时间:${C.reset} ${report.meta.startedAt}`)
  console.log(`${C.bold}扫描文档数:${C.reset} ${report.meta.totalDocs}`)
  console.log('')

  let statusColor = C.green
  if (report.summary.overallStatus === 'failure') statusColor = C.red
  else if (report.summary.overallStatus === 'warning') statusColor = C.yellow

  console.log(`${C.bold}平均评分:${C.reset} ${statusColor}${report.summary.avgScore}/100${C.reset}`)
  console.log(
    `${C.bold}整体状态:${C.reset} ${statusColor}${report.summary.overallStatus.toUpperCase()}${C.reset}`
  )
  console.log('')

  console.log(`${C.bold}评分分布:${C.reset}`)
  console.log(`  ${C.green}优秀 (≥80):${C.reset} ${report.summary.excellentCount} 个`)
  console.log(`  ${C.cyan}良好 (60-79):${C.reset} ${report.summary.goodCount} 个`)
  console.log(`  ${C.yellow}一般 (40-59):${C.reset} ${report.summary.fairCount} 个`)
  console.log(`  ${C.red}较差 (<40):${C.reset} ${report.summary.poorCount} 个`)
  console.log('')

  console.log(`${C.bold}评分详情:${C.reset}`)
  console.log('')

  for (const doc of report.docs.sort((a, b) => a.freshness.totalScore - b.freshness.totalScore)) {
    let color = C.green
    if (doc.freshness.status === 'poor') color = C.red
    else if (doc.freshness.status === 'fair') color = C.yellow
    else if (doc.freshness.status === 'good') color = C.cyan

    console.log(`  ${color}${doc.freshness.totalScore.toString().padStart(3)}/100${C.reset} ${doc.path}`)
    for (const issue of doc.freshness.issues) {
      console.log(`    ${C.dim}→ ${issue}${C.reset}`)
    }
  }

  console.log('')

  if (report.recommendations.length > 0) {
    console.log(`${C.bold}${C.yellow}修复建议:${C.reset}`)
    console.log('')
    for (const rec of report.recommendations) {
      console.log(`  ${C.cyan}•${C.reset} ${rec}`)
    }
    console.log('')
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const autoFix = args.includes('--auto-fix')
  const outputPathArg = args.find((a) => a.startsWith('--output='))
  const outputPath = outputPathArg ? outputPathArg.split('=')[1] : null

  console.error('[DocFreshness] 开始计算文档保鲜度...')

  const docFiles = scanDocs()
  const report = buildReport(docFiles)

  printSummary(report)

  if (!outputPath) {
    const persisted = persistReport(report)
    if (persisted) {
      console.error(`[DocFreshness] 报告已保存到: ${persisted}`)
    }
  } else {
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.error(`[DocFreshness] 报告已保存到: ${outputPath}`)
  }

  process.exit(report.summary.overallStatus === 'failure' ? 1 : 0)
}

main()