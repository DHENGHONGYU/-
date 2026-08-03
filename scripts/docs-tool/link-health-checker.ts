#!/usr/bin/env node
/**
 * @module scripts/docs-tool/link-health-checker
 * @description 文档链接健康度检查器 — 扫描 docs/ 目录，提取并验证 Markdown/HTML 链接
 *
 * 功能：
 * - 递归扫描 docs/ 下的 .md/.html/.htm 文件，提取 [text](url)、<a href>、<img src> 链接
 * - 跳过 ``` 围栏代码块内的链接
 * - 分类：file-absolute(P0) / relative(P2) / external-url(跳过) / anchor(P2) / malformed(P2)
 * - --fix：自动修复 file:/// 绝对路径为相对路径（即使目标不存在也修复）
 * - --ci：P0>0 则 process.exit(1)
 * - --staged：仅检查 git diff --cached --name-only 的文件
 * - --json：JSON 输出到 stdout
 * - 报告保存到 docs/reports/audit/link-health-{timestamp}.json
 *
 * 用法：
 *   npx tsx scripts/docs-tool/link-health-checker.ts [--fix] [--ci] [--staged] [--json]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// === 路径常量 ===
const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const DOCS_ROOT = resolve(PROJECT_ROOT, 'docs')
const REPORT_DIR = resolve(PROJECT_ROOT, 'docs', 'reports', 'audit')

// === 支持的文件扩展名 ===
const SUPPORTED_EXTENSIONS = ['.md', '.html', '.htm']

// === 链接类型 ===
type LinkType = 'file-absolute' | 'relative' | 'external-url' | 'anchor' | 'malformed'

// === 链接状态 ===
type LinkStatus = 'ok' | 'broken' | 'fixable' | 'fixed' | 'skipped'

// === 提取的链接 ===
interface ExtractedLink {
  file: string       // 源文件路径（相对 PROJECT_ROOT，正斜杠）
  line: number       // 行号（1-based）
  column: number     // 列号（1-based）
  rawUrl: string     // 原始 URL
  url: string        // 处理后的 URL
  text: string       // 链接文本
  type: LinkType     // 链接类型
}

// === 链接问题 ===
interface LinkIssue {
  file: string       // 源文件路径
  line: number       // 行号
  column: number     // 列号
  rawUrl: string     // 原始 URL
  url: string        // 处理后的 URL
  text: string       // 链接文本
  type: LinkType     // 链接类型
  status: LinkStatus // 链接状态
  message: string    // 问题描述
  relPath?: string   // 可修复的相对路径（仅 fixable/fixed）
}

// === 健康度报告 ===
interface LinkHealthReport {
  timestamp: string
  projectRoot: string
  totalFiles: number
  totalLinks: number
  totalIssues: number
  fixedCount: number
  byStatus: Record<LinkStatus, number>
  byType: Record<LinkType, number>
  issues: LinkIssue[]
}

// === 解析命令行参数 ===
function parseArgs(): { fix: boolean; ci: boolean; staged: boolean; json: boolean } {
  const args = process.argv.slice(2)
  return {
    fix: args.includes('--fix'),
    ci: args.includes('--ci'),
    staged: args.includes('--staged'),
    json: args.includes('--json')
  }
}

// === 递归扫描目录，收集支持的文件 ===
function collectFiles(rootDir: string, extensions: string[]): string[] {
  const results: string[] = []
  function scan(dir: string) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        scan(fullPath)
      } else if (extensions.includes(extname(entry).toLowerCase())) {
        results.push(fullPath)
      }
    }
  }
  scan(rootDir)
  return results
}

// === 获取 git 暂存文件列表 ===
function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return output.split('\n').map(f => f.trim()).filter(Boolean)
  } catch {
    return []
  }
}

// === 判断指定行是否在围栏代码块内 ===
function isInFencedCodeBlock(lines: string[], targetLineIdx: number): boolean {
  let inCodeBlock = false
  for (let i = 0; i < targetLineIdx; i++) {
    if (/^```/.test(lines[i].trim())) {
      inCodeBlock = !inCodeBlock
    }
  }
  return inCodeBlock
}

// === 分类链接 ===
function classifyLink(url: string): LinkType {
  // file:/// 或 file://// 开头 → file-absolute (P0)
  if (/^file:\/+/i.test(url)) {
    return 'file-absolute'
  }
  // 外部 URL（http/https/ftp/mailto/tel/data/javascript）→ external-url（跳过）
  if (/^(https?|ftp|ftps|mailto|tel|data|javascript):/i.test(url)) {
    return 'external-url'
  }
  // 锚点（# 开头）→ anchor (P2)
  if (url.startsWith('#')) {
    return 'anchor'
  }
  // 空链接或仅空白 → malformed (P2)
  if (!url.trim()) {
    return 'malformed'
  }
  // 其他视为相对路径 → relative (P2)
  return 'relative'
}

// === 从内容中提取 Markdown 链接 ===
function extractMarkdownLinks(content: string, filePath: string, lines: string[]): ExtractedLink[] {
  const links: ExtractedLink[] = []
  // Markdown 链接正则：[text](url) 或 ![alt](url)，支持可选 title
  const mdLinkRegex = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    // 跳过围栏代码块内的链接
    if (isInFencedCodeBlock(lines, lineIdx)) continue

    const line = lines[lineIdx]
    mdLinkRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = mdLinkRegex.exec(line)) !== null) {
      const text = match[1]
      const url = match[2]
      const column = match.index + match[0].indexOf('(') + 1
      links.push({
        file: filePath,
        line: lineIdx + 1,
        column,
        rawUrl: url,
        url,
        text,
        type: classifyLink(url)
      })
    }
  }
  return links
}

// === 从内容中提取 HTML 链接（<a href> 和 <img src>）===
function extractHtmlLinks(content: string, filePath: string, lines: string[], isMarkdown: boolean): ExtractedLink[] {
  const links: ExtractedLink[] = []
  // <a href="...">text</a>
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  // <img src="..." />
  const imgSrcRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    // Markdown 文件需要跳过围栏代码块
    if (isMarkdown && isInFencedCodeBlock(lines, lineIdx)) continue

    const line = lines[lineIdx]

    // 提取 <a href>
    hrefRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = hrefRegex.exec(line)) !== null) {
      const url = match[1]
      const text = match[2] || ''
      const hrefIdx = line.indexOf('href=', match.index)
      const column = hrefIdx !== -1 ? hrefIdx + 7 : match.index + 1
      links.push({
        file: filePath,
        line: lineIdx + 1,
        column,
        rawUrl: url,
        url,
        text,
        type: classifyLink(url)
      })
    }

    // 提取 <img src>
    imgSrcRegex.lastIndex = 0
    while ((match = imgSrcRegex.exec(line)) !== null) {
      const url = match[1]
      const srcIdx = line.indexOf('src=', match.index)
      const column = srcIdx !== -1 ? srcIdx + 6 : match.index + 1
      links.push({
        file: filePath,
        line: lineIdx + 1,
        column,
        rawUrl: url,
        url,
        text: '[image]',
        type: classifyLink(url)
      })
    }
  }
  return links
}

// === 解析 file:/// 绝对路径为项目相对路径 ===
// 支持三种策略：
// 1) 匹配 PROJECT_ROOT（兼容不同盘符）
// 2) 查找项目名 FinSightV9 或 智能投研复盘系统V9
// 3) 以 src/scripts/tests/docs/.github/.trae 开头
function parseFileAbsoluteUrl(rawUrl: string): string | null {
  // 去除 file:/ 前缀，统一处理 file:/// 和 file:////
  let pathPart = rawUrl.replace(/^file:\/+/i, '')
  // URL 解码
  try {
    pathPart = decodeURIComponent(pathPart)
  } catch {
    // 解码失败则原样使用
  }
  // 统一为正斜杠
  const normalizedPath = pathPart.replace(/\\/g, '/')

  // 策略1：匹配 PROJECT_ROOT（兼容不同盘符，不区分大小写）
  const normalizedRoot = PROJECT_ROOT.replace(/\\/g, '/')
  const lowerPath = normalizedPath.toLowerCase()
  const lowerRoot = normalizedRoot.toLowerCase()
  const rootIdx = lowerPath.indexOf(lowerRoot)
  if (rootIdx !== -1) {
    const relPath = normalizedPath.substring(rootIdx + normalizedRoot.length).replace(/^\/+/, '')
    return relPath || null
  }

  // 策略2：查找项目名 FinSightV9 或 智能投研复盘系统V9
  const projectNames = ['FinSightV9', '智能投研复盘系统V9']
  for (const name of projectNames) {
    const nameIdx = normalizedPath.indexOf(name)
    if (nameIdx !== -1) {
      const relPath = normalizedPath.substring(nameIdx + name.length).replace(/^\/+/, '')
      return relPath || null
    }
  }

  // 策略3：以已知项目目录开头
  const prefixes = ['src/', 'scripts/', 'tests/', 'docs/', '.github/', '.trae/']
  const trimmedPath = normalizedPath.replace(/^\/+/, '')
  for (const prefix of prefixes) {
    if (trimmedPath.startsWith(prefix)) {
      return trimmedPath
    }
  }

  return null
}

// === 验证单个链接，返回问题（无问题返回 null）===
function verifyLink(link: ExtractedLink): LinkIssue | null {
  const { url, type, file } = link

  // 外部 URL：跳过
  if (type === 'external-url') {
    return null
  }

  // file-absolute：P0 级别
  if (type === 'file-absolute') {
    const relPath = parseFileAbsoluteUrl(url)
    if (relPath) {
      // 有 relPath 就标记 fixable（不检查目标存在性）
      return {
        ...link,
        status: 'fixable',
        message: `file:/// 绝对路径可修复为相对路径: ${relPath}`,
        relPath
      }
    }
    // 无法解析的 file:/// 路径
    return {
      ...link,
      status: 'broken',
      message: 'file:/// 绝对路径无法解析为项目相对路径'
    }
  }

  // relative：P2，检查目标文件存在性
  if (type === 'relative') {
    const sourceAbsPath = resolve(PROJECT_ROOT, file)
    const sourceDir = dirname(sourceAbsPath)
    const targetPath = resolve(sourceDir, url)
    if (existsSync(targetPath)) {
      return null // 链接有效
    }
    return {
      ...link,
      status: 'broken',
      message: '相对路径指向的文件不存在'
    }
  }

  // anchor：P2，不阻断
  if (type === 'anchor') {
    return null
  }

  // malformed：P2
  if (type === 'malformed') {
    return {
      ...link,
      status: 'broken',
      message: '链接格式错误'
    }
  }

  return null
}

// === 计算从源文件到目标文件的相对路径 ===
function calculateRelativePath(sourceFile: string, targetRelPath: string): string {
  // sourceFile 和 targetRelPath 都是相对于 PROJECT_ROOT 的路径（正斜杠）
  const sourceDir = dirname(sourceFile)
  const rel = relative(sourceDir, targetRelPath)
  return rel.replace(/\\/g, '/')
}

// === 修复文件中的 file:/// 链接，返回修复数 ===
function fixFileLinks(filePath: string, issues: LinkIssue[]): number {
  if (issues.length === 0) return 0

  const absPath = resolve(PROJECT_ROOT, filePath)
  let content = readFileSync(absPath, 'utf-8')
  let fixCount = 0

  // 按行号降序排序，避免修改影响后续行号
  const sortedIssues = [...issues].sort((a, b) => b.line - a.line)

  for (const issue of sortedIssues) {
    if (issue.status !== 'fixable' || !issue.relPath) continue

    const lines = content.split('\n')
    const lineIdx = issue.line - 1
    if (lineIdx < 0 || lineIdx >= lines.length) continue

    const line = lines[lineIdx]
    // 替换 file:/// URL 为相对路径
    const newRelPath = calculateRelativePath(issue.file, issue.relPath)
    const fixedLine = line.replace(issue.rawUrl, newRelPath)

    if (fixedLine !== line) {
      lines[lineIdx] = fixedLine
      content = lines.join('\n')
      fixCount++
    }
  }

  if (fixCount > 0) {
    writeFileSync(absPath, content, 'utf-8')
  }

  return fixCount
}

// === 生成时间戳 ===
function generateTimestamp(): { iso: string; filename: string } {
  const now = new Date()
  const iso = now.toISOString()
  // 文件名安全的时间戳（冒号替换为短横线）
  const filename = iso.replace(/:/g, '-')
  return { iso, filename }
}

// === 主函数 ===
function main(): void {
  const args = parseArgs()

  // 确定要扫描的文件列表
  let filesToScan: string[]
  if (args.staged) {
    // 仅检查暂存文件
    const stagedFiles = getStagedFiles()
    filesToScan = stagedFiles
      .filter(f => f.startsWith('docs/'))
      .filter(f => SUPPORTED_EXTENSIONS.includes(extname(f).toLowerCase()))
      .map(f => f.replace(/\\/g, '/'))
  } else {
    // 扫描整个 docs/ 目录
    const allFiles = collectFiles(DOCS_ROOT, SUPPORTED_EXTENSIONS)
    filesToScan = allFiles.map(f => relative(PROJECT_ROOT, f).replace(/\\/g, '/'))
  }

  // 提取所有链接
  const allLinks: ExtractedLink[] = []
  for (const file of filesToScan) {
    const absPath = resolve(PROJECT_ROOT, file)
    if (!existsSync(absPath)) continue
    const content = readFileSync(absPath, 'utf-8')
    const lines = content.split('\n')
    const ext = extname(file).toLowerCase()

    if (ext === '.md') {
      // Markdown 文件：提取 Markdown 链接 + HTML 链接（都跳过代码块）
      allLinks.push(...extractMarkdownLinks(content, file, lines))
      allLinks.push(...extractHtmlLinks(content, file, lines, true))
    } else if (ext === '.html' || ext === '.htm') {
      // HTML 文件：仅提取 HTML 链接（不跳过代码块）
      allLinks.push(...extractHtmlLinks(content, file, lines, false))
    }
  }

  // 验证所有链接
  const issues: LinkIssue[] = []
  for (const link of allLinks) {
    const issue = verifyLink(link)
    if (issue) issues.push(issue)
  }

  // 如果 --fix，修复 fixable 的 file-absolute 链接
  let fixedCount = 0
  if (args.fix) {
    const fixableIssues = issues.filter(i => i.status === 'fixable')
    // 按文件分组
    const byFile = new Map<string, LinkIssue[]>()
    for (const issue of fixableIssues) {
      if (!byFile.has(issue.file)) byFile.set(issue.file, [])
      byFile.get(issue.file)!.push(issue)
    }
    // 修复每个文件
    for (const [file, fileIssues] of byFile) {
      fixedCount += fixFileLinks(file, fileIssues)
    }
    // 标记已修复的 issue
    for (const issue of issues) {
      if (issue.status === 'fixable') {
        issue.status = 'fixed'
      }
    }
  }

  // 统计按类型
  const byType: Record<LinkType, number> = {
    'file-absolute': 0,
    'relative': 0,
    'external-url': 0,
    'anchor': 0,
    'malformed': 0
  }
  for (const link of allLinks) {
    byType[link.type]++
  }

  // 统计按状态
  const byStatus: Record<LinkStatus, number> = {
    'ok': 0,
    'broken': 0,
    'fixable': 0,
    'fixed': 0,
    'skipped': 0
  }
  for (const issue of issues) {
    byStatus[issue.status]++
  }
  // 外部 URL 被跳过
  byStatus.skipped = byType['external-url']
  // OK = 总链接 - 问题链接 - 跳过的外部 URL
  byStatus.ok = allLinks.length - issues.length - byStatus.skipped

  // 生成报告
  const { iso, filename } = generateTimestamp()
  const report: LinkHealthReport = {
    timestamp: iso,
    projectRoot: PROJECT_ROOT.replace(/\\/g, '/'),
    totalFiles: filesToScan.length,
    totalLinks: allLinks.length,
    totalIssues: issues.length,
    fixedCount,
    byStatus,
    byType,
    issues
  }

  // 保存报告到文件
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true })
  }
  const reportPath = join(REPORT_DIR, `link-health-${filename}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')

  // 输出结果
  if (args.json) {
    // JSON 输出到 stdout（供调度器解析）
    process.stdout.write(JSON.stringify(report, null, 2))
  } else {
    // 人类可读输出
    console.log(`\n📄 文档链接健康度检查报告`)
    console.log(`═══════════════════════════════════════════`)
    console.log(`时间戳:     ${iso}`)
    console.log(`扫描文件数: ${filesToScan.length}`)
    console.log(`总链接数:   ${allLinks.length}`)
    console.log(`总问题数:   ${issues.length}`)
    console.log(`已修复数:   ${fixedCount}`)
    console.log(`\n按类型统计:`)
    console.log(`  file-absolute (P0):   ${byType['file-absolute']}`)
    console.log(`  relative (P2):        ${byType['relative']}`)
    console.log(`  external-url (跳过):  ${byType['external-url']}`)
    console.log(`  anchor (P2):          ${byType['anchor']}`)
    console.log(`  malformed (P2):       ${byType['malformed']}`)
    console.log(`\n按状态统计:`)
    console.log(`  ok:       ${byStatus.ok}`)
    console.log(`  broken:   ${byStatus.broken}`)
    console.log(`  fixable:  ${byStatus.fixable}`)
    console.log(`  fixed:    ${byStatus.fixed}`)
    console.log(`  skipped:  ${byStatus.skipped}`)
    console.log(`\n报告已保存: ${reportPath}`)
  }

  // CI 模式：P0 > 0 则退出 1
  if (args.ci) {
    const p0Count = byType['file-absolute']
    if (p0Count > 0) {
      if (!args.json) {
        console.error(`\n❌ CI 检查失败: 检测到 ${p0Count} 个 P0 级别 file:/// 绝对路径链接`)
      }
      process.exit(1)
    } else {
      if (!args.json) {
        console.log(`\n✅ CI 检查通过: P0 问题数为 0`)
      }
    }
  }
}

main()
