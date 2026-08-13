/**
 * @module scripts/doc-cross-ref-sync
 * @description 文档交叉引用同步器（最小存根）
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import type { DocUpdateEntry, ScannedFile } from '../src/types/modules/doc-validation.types'
import { safeWriteFileSync } from '../src/lib/safeFs'

export interface RawLink {
  readonly text: string
  readonly target: string
  readonly startIndex: number
  readonly endIndex: number
  readonly line: number
  readonly column: number
}

export interface LinkClassification {
  readonly resolvedTargetPath: string
  readonly fixable: boolean
  readonly candidates: readonly string[]
  readonly diagnostic: string
}

export interface BrokenCrossRef {
  readonly sourcePath: string
  readonly sourceRelativePath: string
  readonly line: number
  readonly column: number
  readonly originalText: string
  readonly originalTarget: string
  readonly resolvedTargetPath: string
  readonly fixable: boolean
  readonly candidates: readonly string[]
  readonly diagnostic: string
}

export interface BrokenCrossRefReport {
  readonly brokenLinks: readonly BrokenCrossRef[]
  readonly totalLinksChecked: number
  readonly filesScanned: number
}

export interface CrossRefSyncResult {
  readonly updates: DocUpdateEntry[]
  readonly fixedLinkCount: number
  readonly brokenLinks: readonly BrokenCrossRef[]
}

export interface CrossRefSyncOptions {
  readonly scope?: 'all' | 'changed'
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

function resolveLinkTarget(sourceDir: string, target: string): string {
  const withoutAnchor = target.split('#')[0] ?? target
  return resolve(sourceDir, withoutAnchor).replace(/\\/g, '/')
}

export function classifyLinkTarget(
  sourceDir: string,
  target: string,
  availablePaths: readonly string[],
): LinkClassification {
  const resolved = resolveLinkTarget(sourceDir, target)
  const targetName = resolved.split(/[\\/]/).pop() ?? resolved
  const candidates = availablePaths.filter((p) => p.endsWith(targetName))
  const fixable = candidates.length === 1
  const diagnostic =
    candidates.length === 0
      ? `无候选：目标 ${resolved} 不存在，且未找到同名文件`
      : `歧义：找到 ${candidates.length} 个同名候选，未自动修复`
  return { resolvedTargetPath: resolved, fixable, candidates, diagnostic }
}

export function extractRelativeLinks(content: string): RawLink[] {
  const links: RawLink[] = []
  const lines = content.split('\n')
  let offset = 0
  let inFence = false

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      offset += line.length + 1
      continue
    }

    if (inFence) {
      offset += line.length + 1
      continue
    }

    const regex = /\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))*)\)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(line)) !== null) {
      const text = match[1]
      const target = match[2]
      if (!text || !target) continue

      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('#') ||
        target.startsWith('mailto:') ||
        target.startsWith('file://') ||
        target.startsWith('javascript:')
      ) {
        continue
      }

      const targetNoAnchor = target.split('#')[0] ?? target
      if (targetNoAnchor.endsWith('/')) continue

      const startIndex = offset + match.index
      const endIndex = startIndex + match[0].length
      links.push({
        text,
        target,
        startIndex,
        endIndex,
        line: li + 1,
        column: match.index,
      })
    }

    offset += line.length + 1
  }

  return links
}

function collectMarkdownFiles(dir: string, files: string[]): void {
  if (!existsSync(dir)) return

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  const EXCLUDE = new Set(['node_modules', 'deprecated-docs', 'old-versions', 'ai-index'])

  for (const entry of entries) {
    if (EXCLUDE.has(entry)) continue

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

function isCodeOrAssetLink(target: string): boolean {
  const t = target.split('#')[0] ?? target
  const base = t.split(/[\\/]/).pop() ?? ''
  if (!base.includes('.')) return false
  const ext = base.slice(base.lastIndexOf('.')).toLowerCase()
  return ext !== '.md'
}

function isDotfileLink(target: string): boolean {
  const t = (target.split('#')[0] ?? target).split('?')[0] ?? target
  return t.split('/').some((seg) => seg.startsWith('.') && seg !== '.' && seg !== '..')
}

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
      if (!resolved.startsWith(docsDir.replace(/\\/g, '/') + '/')) continue
      if (isCodeOrAssetLink(link.target)) continue
      if (isDotfileLink(link.target)) continue
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

export function syncCrossReferences(
  docsDir: string,
  scannedFiles: readonly ScannedFile[],
  options: CrossRefSyncOptions = {},
): CrossRefSyncResult {
  const report = findBrokenCrossReferences(docsDir, scannedFiles, options)
  const updates: DocUpdateEntry[] = []

  const indexPath = join(docsDir, 'meta', 'REGISTRY_INDEX.md')
  try {
    const docFiles = scannedFiles.filter((f) => f.category === 'doc')
    const lines: string[] = ['# 文档索引', '']
    for (const f of docFiles) {
      lines.push(`- ${f.relativePath}`)
    }
    const newIndex = lines.join('\n') + '\n'
    const isNewFile = !existsSync(indexPath)
    safeWriteFileSync(indexPath, newIndex)
    updates.push({
      id: generateId(),
      timestamp: formatTimestampSeconds(new Date()),
      filePath: indexPath,
      updateType: isNewFile ? 'added' : 'modified',
      reason: '自动同步文档索引',
    })
  } catch {
    // 索引写入失败时保持静默，不影响返回类型
  }

  return { updates, fixedLinkCount: 0, brokenLinks: report.brokenLinks }
}
