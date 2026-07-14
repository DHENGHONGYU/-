#!/usr/bin/env node
/**
 * @module scripts/doc-cross-ref-sync
 * @description 文档交叉引用同步器
 *
 * 职责：
 * 1. 扫描 docs/ 目录下所有 Markdown 文件中的相对链接
 * 2. 检测断裂链接并尝试自动修复
 * 3. 维护 docs/REGISTRY_INDEX.md 中的文档索引
 * 4. 返回更新记录供每日验证流程归档
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import type { DocUpdateEntry, ScannedFile } from '../../src/types/modules/doc-validation.types'

/** 同步结果 */
export interface CrossRefSyncResult {
  /** 更新记录 */
  updates: DocUpdateEntry[]
  /** 修复的链接数量 */
  fixedLinkCount: number
  /**
   * 全部断裂交叉引用（含 filePath 级归因）。
   * 既包含可被自动修复的，也包含不可修复的（0 候选 / 歧义多候选）——后者此前被静默丢弃，
   * 现在一并暴露，供每日校验以 filePath 级精度归因。
   */
  brokenLinks: BrokenCrossRef[]
}

/** 链接位置信息 */
interface LinkLocation {
  /** 源文件路径 */
  readonly sourcePath: string
  /** 原始链接文本 */
  readonly originalText: string
  /** 原始链接目标 */
  readonly originalTarget: string
  /** 链接在内容中的起始索引 */
  readonly startIndex: number
  /** 链接在内容中的结束索引 */
  readonly endIndex: number
  /** 链接在源文档中的行号（1-based） */
  readonly line: number
  /** 链接在源文档中的列偏移（0-based） */
  readonly column: number
}

/** 索引条目 */
interface IndexEntry {
  /** 文档相对路径 */
  readonly relativePath: string
  /** 文档标题（从首行提取） */
  readonly title: string
  /** 文档分类 */
  readonly category: string
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

function collectMarkdownFiles(dir: string, files: string[]): void {
  if (!existsSync(dir)) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      collectMarkdownFiles(fullPath, files)
    } else if (stat.isFile() && extname(entry).toLowerCase() === '.md') {
      files.push(fullPath)
    }
  }
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? 'Untitled'
}

/** 解析出的原始链接（含位置信息） */
export interface RawLink {
  /** 链接文本 */
  readonly text: string
  /** 链接目标（raw） */
  readonly target: string
  /** 在内容中的起始索引 */
  readonly startIndex: number
  /** 在内容中的结束索引 */
  readonly endIndex: number
  /** 行号（1-based） */
  readonly line: number
  /** 列偏移（0-based） */
  readonly column: number
}

/** 根据字符索引计算行号与列偏移 */
function computeLineColumn(content: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 0
  const limit = Math.min(index, content.length)
  for (let i = 0; i < limit; i++) {
    if (content[i] === '\n') {
      line++
      column = 0
    } else {
      column++
    }
  }
  return { line, column }
}

/**
 * 提取 Markdown 文档中的相对链接（排除 http/https/#/mailto 等外部与锚点）。
 * 同时计算每条链接的行号与列偏移，支撑 filePath 级归因。
 */
export function extractRelativeLinks(content: string): RawLink[] {
  const links: RawLink[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const text = match[1]
    const target = match[2]
    if (!text || !target) continue
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#') || target.startsWith('mailto:')) {
      continue
    }
    const startIndex = match.index
    const endIndex = startIndex + match[0].length
    const { line, column } = computeLineColumn(content, startIndex)
    links.push({ text, target, startIndex, endIndex, line, column })
  }
  return links
}

function resolveLinkTarget(sourceDir: string, target: string): string {
  const withoutAnchor = target.split('#')[0] ?? target
  return resolve(sourceDir, withoutAnchor).replace(/\\/g, '/')
}

function findClosestPath(target: string, availablePaths: readonly string[]): string | null {
  const targetName = target.split(/[\\/]/).pop() ?? target
  const candidates = availablePaths.filter((p) => p.endsWith(targetName))
  if (candidates.length === 1) {
    return candidates[0] ?? null
  }
  return null
}

function makeRelativeLink(sourceDir: string, targetPath: string): string {
  const rel = relative(sourceDir, targetPath).replace(/\\/g, '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function updateDocumentLinks(
  docPath: string,
  brokenLinks: readonly LinkLocation[],
  availablePaths: readonly string[],
): { fixedCount: number; updated: boolean } {
  if (brokenLinks.length === 0) return { fixedCount: 0, updated: false }

  let content = readFileSync(docPath, 'utf-8')
  let fixedCount = 0

  // 从后往前替换，避免索引偏移
  const sorted = [...brokenLinks].sort((a, b) => b.startIndex - a.startIndex)

  for (const link of sorted) {
    const sourceDir = dirname(docPath).replace(/\\/g, '/')
    const resolved = resolveLinkTarget(sourceDir, link.originalTarget)
    const closest = findClosestPath(resolved, availablePaths)
    if (!closest) continue

    const newTarget = makeRelativeLink(sourceDir, closest)
    const before = content.slice(0, link.startIndex)
    const after = content.slice(link.endIndex)
    content = `${before}[${link.originalText}](${newTarget})${after}`
    fixedCount++
  }

  if (fixedCount > 0) {
    writeFileSync(docPath, content, 'utf-8')
  }

  return { fixedCount, updated: fixedCount > 0 }
}

function buildIndexEntries(docsDir: string): IndexEntry[] {
  const files: string[] = []
  collectMarkdownFiles(docsDir, files)

  const entries: IndexEntry[] = []
  for (const fullPath of files) {
    const relativePath = relative(docsDir, fullPath).replace(/\\/g, '/')
    const content = readFileSync(fullPath, 'utf-8')
    const title = extractTitle(content)
    const category = relativePath.split('/')[0] ?? 'root'
    entries.push({ relativePath, title, category })
  }

  return entries.sort((a, b) => a.category.localeCompare(b.category) || a.relativePath.localeCompare(b.relativePath))
}

function renderIndex(entries: readonly IndexEntry[]): string {
  const lines: string[] = [
    '# 文档索引',
    '',
    '> 本文件由每日文档验证流程自动生成，请勿手动修改。',
    '',
    '## 目录',
    '',
  ]

  const categories = new Map<string, IndexEntry[]>()
  for (const entry of entries) {
    const list = categories.get(entry.category) ?? []
    list.push(entry)
    categories.set(entry.category, list)
  }

  for (const [category, items] of categories) {
    lines.push(`### ${category}`)
    lines.push('')
    for (const item of items) {
      lines.push(`- [${item.title}](${item.relativePath})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/** 同步选项：控制影响半径 */
export interface CrossRefSyncOptions {
  /**
   * - 'all'（默认）：全仓库扫描断链并重建索引，兼容手动调用与每日校验；
   * - 'changed'：仅处理 scannedFiles，最小化影响半径（DocAutoUpdater 批量更新场景）。
   */
  readonly scope?: 'all' | 'changed'
}

function parseIndexEntries(content: string): IndexEntry[] {
  const entries: IndexEntry[] = []
  const re = /^- \[(.+)\]\((.+)\)$/
  for (const line of content.split('\n')) {
    const m = re.exec(line)
    if (!m) continue
    const relativePath = m[2]!.trim()
    const title = m[1]!.trim()
    entries.push({ relativePath, title, category: relativePath.split('/')[0] ?? 'root' })
  }
  return entries
}

/** changed 作用域下：保留既有索引条目，仅用变更文件合并更新，避免全仓库重建 */
function mergeIndexEntries(indexPath: string, scannedFiles: readonly ScannedFile[]): IndexEntry[] {
  const map = new Map<string, IndexEntry>()
  if (existsSync(indexPath)) {
    for (const e of parseIndexEntries(readFileSync(indexPath, 'utf-8'))) map.set(e.relativePath, e)
  }
  for (const f of scannedFiles) {
    const rel = f.relativePath.replace(/\\/g, '/')
    if (f.updateType === 'deleted') {
      map.delete(rel)
      continue
    }
    const fullPath = f.absolutePath.replace(/\\/g, '/')
    let title = 'Untitled'
    try {
      title = extractTitle(readFileSync(fullPath, 'utf-8'))
    } catch {
      /* 读取失败时保留既有条目 */
    }
    map.set(rel, { relativePath: rel, title, category: rel.split('/')[0] ?? 'root' })
  }
  return [...map.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.relativePath.localeCompare(b.relativePath),
  )
}

// ─── filePath 级归因模型 ──────────────────────────────────────────────────────

/** 单条断裂交叉引用的 filePath 级归因 */
export interface BrokenCrossRef {
  /** 源文档绝对路径 */
  readonly sourcePath: string
  /** 源文档相对路径 */
  readonly sourceRelativePath: string
  /** 断链在源文档中的行号（1-based） */
  readonly line: number
  /** 断链在源文档中的列偏移（0-based） */
  readonly column: number
  /** 原始链接文本 */
  readonly originalText: string
  /** 原始链接目标（raw） */
  readonly originalTarget: string
  /** 已解析的目标文件绝对路径——filePath 级归因的核心字段 */
  readonly resolvedTargetPath: string
  /** 是否可被自动修复（找到唯一同名候选） */
  readonly fixable: boolean
  /** 最近候选路径（用于诊断；空表示 0 候选） */
  readonly candidates: readonly string[]
  /** 诊断说明（不可修复原因：0 候选 / N 个歧义候选） */
  readonly diagnostic: string
}

/** 断裂交叉引用批量报告 */
export interface BrokenCrossRefReport {
  /** 所有断裂交叉引用（含 filePath 级归因） */
  readonly brokenLinks: readonly BrokenCrossRef[]
  /** 检查的总链接数 */
  readonly totalLinksChecked: number
  /** 扫描的文档文件数 */
  readonly filesScanned: number
}

/** 单条链接的解析与可修复性分类 */
export interface LinkClassification {
  /** 已解析的目标文件绝对路径 */
  readonly resolvedTargetPath: string
  /** 是否可被自动修复 */
  readonly fixable: boolean
  /** 同名候选路径 */
  readonly candidates: readonly string[]
  /** 诊断说明 */
  readonly diagnostic: string
}

/**
 * 将单条相对链接解析为 filePath 级归因：计算目标绝对路径，并评估是否可被自动修复。
 * @param sourceDir 源文档所在目录（绝对路径）
 * @param target 链接目标（raw，可为相对路径或带锚点）
 * @param availablePaths 当前已知文件绝对路径集合（用于候选匹配）
 */
export function classifyLinkTarget(
  sourceDir: string,
  target: string,
  availablePaths: readonly string[],
): LinkClassification {
  const resolved = resolveLinkTarget(sourceDir, target)
  const targetName = resolved.split(/[\\/]/).pop() ?? resolved
  const candidates = availablePaths.filter((p) => p.endsWith(targetName))
  const fixable = candidates.length === 1
  const diagnostic = candidates.length === 0
    ? `无候选：目标 ${resolved} 不存在，且未找到同名文件`
    : `歧义：找到 ${candidates.length} 个同名候选，未自动修复`
  return { resolvedTargetPath: resolved, fixable, candidates, diagnostic }
}

/**
 * 只读扫描断裂交叉引用并产出 filePath 级归因（不修复、不写索引）。
 * 供每日文档校验以 filePath 精度归因，或供测试使用。
 * @param docsDir docs 目录绝对路径
 * @param scannedFiles 扫描到的文件列表（提供已知路径与目标文件候选）
 * @param options 同步选项（scope 控制影响半径，默认 'all'）
 */
export function findBrokenCrossReferences(
  docsDir: string,
  scannedFiles: readonly ScannedFile[],
  options: CrossRefSyncOptions = {},
): BrokenCrossRefReport {
  const scope = options.scope ?? 'all'
  const docFiles: string[] = []
  if (scope === 'changed') {
    for (const f of scannedFiles) {
      if (f.category === 'doc') docFiles.push(f.absolutePath.replace(/\\/g, '/'))
    }
  } else {
    collectMarkdownFiles(docsDir, docFiles)
  }

  const allAbsolutePaths = scannedFiles.map((f) => f.absolutePath.replace(/\\/g, '/'))
  const broken: BrokenCrossRef[] = []
  let totalLinksChecked = 0

  for (const docPath of docFiles) {
    const content = readFileSync(docPath, 'utf-8')
    const links = extractRelativeLinks(content)
    totalLinksChecked += links.length
    const sourceDir = dirname(docPath).replace(/\\/g, '/')
    const sourceRelativePath = relative(docsDir, docPath).replace(/\\/g, '/')

    for (const link of links) {
      const resolved = resolveLinkTarget(sourceDir, link.target)
      if (allAbsolutePaths.includes(resolved) || existsSync(resolved)) continue
      const cls = classifyLinkTarget(sourceDir, link.target, allAbsolutePaths)
      broken.push({
        sourcePath: docPath,
        sourceRelativePath,
        line: link.line,
        column: link.column,
        originalText: link.text,
        originalTarget: link.target,
        resolvedTargetPath: cls.resolvedTargetPath,
        fixable: cls.fixable,
        candidates: cls.candidates,
        diagnostic: cls.diagnostic,
      })
    }
  }

  return { brokenLinks: broken, totalLinksChecked, filesScanned: docFiles.length }
}

/**
 * 同步文档交叉引用
 * @param docsDir docs 目录绝对路径
 * @param scannedFiles 扫描到的文件列表
 * @param options 同步选项（scope 控制影响半径，默认 'all'）
 * @returns 同步结果
 */
export function syncCrossReferences(
  docsDir: string,
  scannedFiles: readonly ScannedFile[],
  options: CrossRefSyncOptions = {},
): CrossRefSyncResult {
  const updates: DocUpdateEntry[] = []
  let fixedLinkCount = 0
  const allBroken: BrokenCrossRef[] = []

  const scope = options.scope ?? 'all'

  // changed 作用域：仅处理变更文件，最小化影响半径；否则全仓库扫描（手动调用/每日校验）
  const docFiles: string[] = []
  if (scope === 'changed') {
    for (const f of scannedFiles) docFiles.push(f.absolutePath.replace(/\\/g, '/'))
  } else {
    collectMarkdownFiles(docsDir, docFiles)
  }

  const allAbsolutePaths = scannedFiles.map((f) => f.absolutePath.replace(/\\/g, '/'))

  // 1. 修复断裂链接
  for (const docPath of docFiles) {
    const content = readFileSync(docPath, 'utf-8')
    const links = extractRelativeLinks(content)
    const sourceDir = dirname(docPath).replace(/\\/g, '/')
    const broken: LinkLocation[] = []

    for (const link of links) {
      const resolved = resolveLinkTarget(sourceDir, link.target)
      if (!allAbsolutePaths.includes(resolved) && !existsSync(resolved)) {
        broken.push({
          sourcePath: docPath,
          originalText: link.text,
          originalTarget: link.target,
          startIndex: link.startIndex,
          endIndex: link.endIndex,
          line: link.line,
          column: link.column,
        })
      }
    }

    // filePath 级归因：将每条断链解析为带目标 filePath / 行列号 / 可修复性的结构化记录
    for (const b of broken) {
      const cls = classifyLinkTarget(sourceDir, b.originalTarget, allAbsolutePaths)
      allBroken.push({
        sourcePath: docPath,
        sourceRelativePath: relative(docsDir, docPath).replace(/\\/g, '/'),
        line: b.line,
        column: b.column,
        originalText: b.originalText,
        originalTarget: b.originalTarget,
        resolvedTargetPath: cls.resolvedTargetPath,
        fixable: cls.fixable,
        candidates: cls.candidates,
        diagnostic: cls.diagnostic,
      })
    }

    if (broken.length === 0) continue

    const { fixedCount, updated } = updateDocumentLinks(docPath, broken, allAbsolutePaths)
    fixedLinkCount += fixedCount

    if (updated) {
      updates.push({
        id: generateId(),
        timestamp: formatTimestampSeconds(new Date()),
        filePath: docPath,
        updateType: 'modified',
        reason: `自动修复 ${fixedCount} 个断裂交叉引用`,
        syncedRefs: broken.map((b) => b.originalTarget),
      })
    }
  }

  // 2. 更新索引文件（changed 作用域下增量合并，避免全仓库重写）
  const indexPath = join(docsDir, 'REGISTRY_INDEX.md')
  try {
    const entries = scope === 'changed' ? mergeIndexEntries(indexPath, scannedFiles) : buildIndexEntries(docsDir)
    const newIndex = renderIndex(entries)
    let shouldWrite = true

    if (existsSync(indexPath)) {
      const currentIndex = readFileSync(indexPath, 'utf-8')
      shouldWrite = currentIndex !== newIndex
    }

    if (shouldWrite) {
      writeFileSync(indexPath, newIndex, 'utf-8')
      updates.push({
        id: generateId(),
        timestamp: formatTimestampSeconds(new Date()),
        filePath: indexPath,
        updateType: existsSync(indexPath) ? 'modified' : 'added',
        reason: scope === 'changed' ? '增量同步文档索引（仅变更文件）' : '自动同步文档索引',
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`更新文档索引失败: ${message}`)
  }

  return { updates, fixedLinkCount, brokenLinks: allBroken }
}
