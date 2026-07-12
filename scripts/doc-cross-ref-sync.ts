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
import type { DocUpdateEntry, ScannedFile } from '../src/types/modules/doc-validation.types'

/** 同步结果 */
export interface CrossRefSyncResult {
  /** 更新记录 */
  updates: DocUpdateEntry[]
  /** 修复的链接数量 */
  fixedLinkCount: number
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

function extractRelativeLinks(content: string): Array<{ text: string; target: string; startIndex: number; endIndex: number }> {
  const links: Array<{ text: string; target: string; startIndex: number; endIndex: number }> = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const text = match[1]
    const target = match[2]
    if (!text || !target) continue
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#') || target.startsWith('mailto:')) {
      continue
    }
    links.push({
      text,
      target,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
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

/**
 * 同步文档交叉引用
 * @param docsDir docs 目录绝对路径
 * @param scannedFiles 扫描到的文件列表
 * @returns 同步结果
 */
export function syncCrossReferences(
  docsDir: string,
  scannedFiles: readonly ScannedFile[],
): CrossRefSyncResult {
  const updates: DocUpdateEntry[] = []
  let fixedLinkCount = 0

  const docFiles: string[] = []
  collectMarkdownFiles(docsDir, docFiles)

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
        })
      }
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

  // 2. 更新索引文件
  const indexPath = join(docsDir, 'REGISTRY_INDEX.md')
  try {
    const entries = buildIndexEntries(docsDir)
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
        reason: '自动同步文档索引',
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`更新文档索引失败: ${message}`)
  }

  return { updates, fixedLinkCount }
}
