/**
 * scan-tofixed-mid-risk.mjs
 *
 * 扫描全项目 UI 层的中风险 .toFixed() 调用，批量生成替换为 safeFormatNumber 的补丁文件。
 *
 * 风险分级：
 *   - mid-risk: UI 渲染层中对关键金融字段（price/change/score/marketValue 等）调用 .toFixed()
 *   - low-risk:  本地计算变量、Math 运算结果、已守卫的值（本脚本跳过）
 *   - high-risk: 已在本 PR 修复的 WatchlistWidget / MarketIndicesWidget / CoreResourcePanel（跳过）
 *
 * 用法：
 *   node scripts/audit/scan-tofixed-mid-risk.mjs [--apply]
 *
 * 输出：
 *   scripts/audit/docs/reports/audit/tofixed-mid-risk-report.json  （扫描报告）
 *   scripts/audit/docs/reports/audit/tofixed-mid-risk.patch         （统一 diff 补丁）
 *
 * 选项：
 *   --apply  直接将补丁应用到源文件（默认仅生成补丁，不修改源文件）
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

// ── 配置 ──────────────────────────────────────────────────────

const SCAN_DIRS = [
  'src/components',
  'src/pages',
  'src/cockpit/widgets',
  'src/apps',
  'src/hooks',
  'src/showcase',
  'src/store',
]

const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\/__tests__\//,
  /\.d\.ts$/,
]

const EXCLUDE_FILES = new Set([
  'src/lib/format.ts',
  'src/cockpit/widgets/WatchlistWidget.tsx',
  'src/cockpit/widgets/MarketIndicesWidget.tsx',
  'src/apps/trading/panels/CoreResourcePanel.tsx',
])

/** 高风险金融字段（直接对应可空数据源字段，优先替换） */
const CRITICAL_FINANCIAL_FIELDS = new Set([
  'price', 'change', 'changePercent', 'score', 'marketValue',
  'totalValue', 'cashReserve', 'currentPrice', 'avgCost',
  'floatingPnl', 'floatingPnlPercent', 'pnl', 'pnlPercent',
  'currentWeight', 'targetWeight', 'weight',
])

/** 一般金融字段关键词（辅助判定，风险略低） */
const FINANCIAL_KEYWORDS = [
  'volume', 'amount', 'turnover', 'drawdown', 'sharpe', 'winRate',
  'ratio', 'percent', 'rate', 'equity', 'netValue', 'funding',
  'balance', 'asset', 'revenue', 'profit', 'loss', 'margin',
  'premium', 'yield', 'beta', 'alpha', 'exposure', 'nav',
]

const TOFIXED_REGEX = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.toFixed\((\d+|[A-Za-z_$][\w$]*)\)/g

const LOW_RISK_PREFIXES = /^(Math\.|Number\(|parseFloat|parseInt|Number\.isFinite)/

// ── 工具函数 ──────────────────────────────────────────────────

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walkDir(fullPath, files)
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const relPath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/')
      if (EXCLUDE_PATTERNS.some((p) => p.test(relPath))) continue
      if (EXCLUDE_FILES.has(relPath)) continue
      files.push({ fullPath, relPath })
    }
  }
  return files
}

function isCriticalFinancialField(receiver) {
  const lastSegment = receiver.split('.').pop()
  return CRITICAL_FINANCIAL_FIELDS.has(lastSegment)
}

function isFinancialField(receiver) {
  const lastSegment = receiver.split('.').pop().toLowerCase()
  return FINANCIAL_KEYWORDS.some((kw) => lastSegment.includes(kw))
}

function isLowRisk(receiver, lineContent) {
  if (LOW_RISK_PREFIXES.test(receiver)) return true
  if (/Number\.isFinite|isValidNumber/.test(lineContent)) return true
  return false
}

function classifyRisk(receiver, lineContent) {
  if (isLowRisk(receiver, lineContent)) return 'low'
  if (isCriticalFinancialField(receiver)) return 'mid'
  return 'low'
}

function scanFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const occurrences = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('`')) continue

    let match
    TOFIXED_REGEX.lastIndex = 0
    while ((match = TOFIXED_REGEX.exec(line)) !== null) {
      const [fullMatch, receiver, decimals] = match
      const column = match.index + 1
      const financial = isFinancialField(receiver) || isCriticalFinancialField(receiver)
      const riskLevel = classifyRisk(receiver, line)

      const contextStart = Math.max(0, i - 1)
      const contextEnd = Math.min(lines.length - 1, i + 1)

      occurrences.push({
        file: relPath,
        line: i + 1,
        column,
        receiver,
        decimals,
        fullMatch,
        lineContent: line.trim(),
        context: lines.slice(contextStart, contextEnd + 1).join('\n'),
        riskLevel,
        financialField: financial,
        suggestion: `safeFormatNumber(${receiver}, ${decimals})`,
      })
    }
  }
  return occurrences
}

function generateModifiedContent(filePath, occurrences) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const hasImport = /import\s+.*\bsafeFormatNumber\b.*from\s+['"]@\/lib\/format['"]/.test(content)

  const sortedOccs = [...occurrences].sort((a, b) => b.line - a.line || b.column - a.column)
  for (const occ of sortedOccs) {
    const lineIdx = occ.line - 1
    lines[lineIdx] = lines[lineIdx].replaceAll(occ.fullMatch, occ.suggestion)
  }

  let importAdded = false
  if (!hasImport && occurrences.length > 0) {
    const formatImportRegex = /(import\s+\{[^}]+\}\s+from\s+['"]@\/lib\/format['"])/
    const formatImportMatch = content.match(formatImportRegex)
    if (formatImportMatch) {
      for (let i = 0; i < lines.length; i++) {
        if (formatImportRegex.test(lines[i]) && !/\bsafeFormatNumber\b/.test(lines[i])) {
          lines[i] = lines[i].replace(
            /import\s+\{([^}]+)\}\s+from\s+(['"]@\/lib\/format['"])/,
            (m, imports, quote) => `import { safeFormatNumber, ${imports.trim()} } from ${quote}`,
          )
          break
        }
      }
    } else {
      let lastImportIdx = -1
      for (let i = 0; i < lines.length; i++) {
        if (/^import\s+/.test(lines[i].trim())) lastImportIdx = i
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, "import { safeFormatNumber } from '@/lib/format'")
      } else {
        lines.unshift("import { safeFormatNumber } from '@/lib/format'")
      }
    }
    importAdded = true
  }

  return { modifiedContent: lines.join('\n'), importAdded, hasImport }
}

/** 使用 git diff --no-index 生成正确的统一 diff */
function generateDiffHunk(relPath, originalContent, modifiedContent) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tofixed-patch-'))
  const oldFile = path.join(tmpDir, 'old')
  const newFile = path.join(tmpDir, 'new')
  fs.writeFileSync(oldFile, originalContent, 'utf-8')
  fs.writeFileSync(newFile, modifiedContent, 'utf-8')

  try {
    let output
    try {
      output = execSync(
        `git diff --no-index --unified=3 --no-color -- "${oldFile}" "${newFile}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      )
    } catch (err) {
      if (err.status === 1 && err.stdout) {
        output = err.stdout
      } else {
        throw err
      }
    }
    return output
      .replace(/^--- .*$/m, `--- a/${relPath}`)
      .replace(/^\+\+\+ .*$/m, `+++ b/${relPath}`)
      .replace(/^diff --git.*$/m, '')
      .replace(/^index .*$/m, '')
      .trim()
      .split('\n')
      .filter((l) => l.length > 0)
  } catch (err) {
    console.error(`[scan-tofixed] diff 生成失败: ${relPath}`, err.message)
    return []
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ── 主流程 ────────────────────────────────────────────────────

function main() {
  const shouldApply = process.argv.includes('--apply')

  console.log('[scan-tofixed] 开始扫描 UI 层中风险 .toFixed() 调用...')

  const allFiles = []
  for (const dir of SCAN_DIRS) {
    walkDir(path.join(PROJECT_ROOT, dir), allFiles)
  }
  console.log(`[scan-tofixed] 扫描 ${SCAN_DIRS.length} 个目录，${allFiles.length} 个文件`)

  const allOccurrences = []
  for (const { fullPath, relPath } of allFiles) {
    allOccurrences.push(...scanFile(fullPath, relPath))
  }

  const midRiskOccs = allOccurrences.filter((o) => o.riskLevel === 'mid')
  const lowRiskOccs = allOccurrences.filter((o) => o.riskLevel === 'low')

  console.log(`[scan-tofixed] 发现 ${allOccurrences.length} 处 .toFixed() 调用`)
  console.log(`  - 中风险（mid）: ${midRiskOccs.length} 处`)
  console.log(`  - 低风险（low）:  ${lowRiskOccs.length} 处（已跳过）`)

  const midRiskByFile = new Map()
  for (const occ of midRiskOccs) {
    if (!midRiskByFile.has(occ.file)) midRiskByFile.set(occ.file, [])
    midRiskByFile.get(occ.file).push(occ)
  }
  console.log(`[scan-tofixed] 涉及 ${midRiskByFile.size} 个文件`)

  const patchLines = []
  const fileReports = []

  for (const [relPath, occs] of midRiskByFile) {
    const fullPath = path.join(PROJECT_ROOT, relPath)
    const originalContent = fs.readFileSync(fullPath, 'utf-8')
    const { modifiedContent, importAdded, hasImport } = generateModifiedContent(fullPath, occs)

    const diffHunk = generateDiffHunk(relPath, originalContent, modifiedContent)
    if (diffHunk.length > 0) {
      patchLines.push(...diffHunk, '')
    }

    fileReports.push({
      file: relPath,
      occurrenceCount: occs.length,
      importAdded: !hasImport,
      occurrences: occs.map((o) => ({
        line: o.line,
        receiver: o.receiver,
        decimals: o.decimals,
        original: o.fullMatch,
        replacement: o.suggestion,
        financialField: o.financialField,
      })),
    })

    if (shouldApply) {
      fs.writeFileSync(fullPath, modifiedContent, 'utf-8')
      console.log(`[scan-tofixed] [APPLY] 已修改 ${relPath}（${occs.length} 处替换）`)
    }
  }

  const reportDir = path.join(__dirname, 'docs', 'reports', 'audit')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const patchPath = path.join(reportDir, 'tofixed-mid-risk.patch')
  fs.writeFileSync(patchPath, patchLines.join('\n') + '\n', 'utf-8')
  console.log(`[scan-tofixed] 补丁已生成: ${path.relative(PROJECT_ROOT, patchPath)}`)

  const report = {
    scanTime: new Date().toISOString(),
    scanDirs: SCAN_DIRS,
    totalOccurrences: allOccurrences.length,
    midRiskCount: midRiskOccs.length,
    lowRiskCount: lowRiskOccs.length,
    affectedFiles: midRiskByFile.size,
    applied: shouldApply,
    files: fileReports,
    lowRiskSkipped: lowRiskOccs.map((o) => ({
      file: o.file,
      line: o.line,
      receiver: o.receiver,
      reason: 'computed-or-guarded-or-local-var',
    })),
  }

  const reportPath = path.join(reportDir, 'tofixed-mid-risk-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`[scan-tofixed] 报告已生成: ${path.relative(PROJECT_ROOT, reportPath)}`)

  console.log('\n[scan-tofixed] ── 中风险文件摘要 ──')
  for (const { file, occurrenceCount, importAdded: ia } of fileReports) {
    const importNote = ia ? ' (+import)' : ''
    console.log(`  ${file}: ${occurrenceCount} 处${importNote}`)
  }

  console.log(`\n[scan-tofixed] 完成。${shouldApply ? '已应用补丁' : '仅生成补丁（使用 --apply 应用）'}`)
}

main()
