#!/usr/bin/env node
/**
 * @module scripts/doc-version-history
 * @description 文档版本历史记录器
 *
 * 职责：
 * 1. 根据扫描到的文件变更，生成每日文档变更历史
 * 2. 持久化到 docs/changelogs/YYYY-MM/daily-doc-validation-YYYY-MM-DD.md
 * 3. 保持版本历史记录的准确性和可追溯性
 * 4. 返回更新记录供每日验证流程归档
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import type { DocUpdateEntry, ScannedFile, UpdateType } from '../../src/types/modules/doc-validation.types'

/** 版本历史记录结果 */
export interface VersionHistoryResult {
  /** 更新记录 */
  updates: DocUpdateEntry[]
  /** 历史文件路径 */
  historyFilePath: string
}

/** 版本关联引用（约束 3 · T5）：将文档变更与代码版本强绑定 */
interface CodeRef {
  /** 关联的 git tag（无 tag 时退化为 commit sha） */
  readonly gitTag: string
  /** package.json 的 version */
  readonly packageVersion: string
  /** 当前 commit sha */
  readonly commitSha: string
}

/** 历史条目 */
interface HistoryEntry {
  /** 时间戳（秒级 ISO 8601） */
  readonly timestamp: string
  /** 文件相对路径 */
  readonly relativePath: string
  /** 更新类型 */
  readonly updateType: UpdateType
  /** 文件分类 */
  readonly category: string
  /** 文件大小（字节） */
  readonly sizeBytes: number
  /** 版本关联引用（T5） */
  readonly codeRef?: CodeRef
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * 解析当前代码版本关联引用（T5）：
 * - packageVersion 取自 package.json
 * - commitSha 取自 `git rev-parse HEAD`
 * - gitTag 取自 `git describe --tags --always`（无 tag 时退化为 sha）
 * 任何一步失败都优雅降级，绝不抛出。
 */
function resolveCodeRef(rootDir: string): CodeRef {
  let packageVersion = '0.0.0'
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8')) as {
      version?: string
    }
    if (pkg.version) packageVersion = pkg.version
  } catch {
    /* 降级 */
  }
  let commitSha = 'unknown'
  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim()
  } catch {
    /* 降级 */
  }
  let gitTag = commitSha
  try {
    const tag = execSync('git describe --tags --always', { cwd: rootDir, encoding: 'utf-8' }).trim()
    if (tag) gitTag = tag
  } catch {
    /* 降级为 sha */
  }
  return { gitTag, packageVersion, commitSha }
}

function getHistoryPaths(rootDir: string, date: Date): { dir: string; file: string } {
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const dir = join(rootDir, 'docs', 'changelogs', `${year}-${month}`)
  const file = join(dir, `daily-doc-validation-${year}-${month}-${day}.md`)
  return { dir, file }
}

function renderHistoryHeader(date: Date, codeRef: CodeRef): string {
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  return `# 每日文档变更历史 — ${year}-${month}-${day}

> 本文件由每日文档验证流程自动生成，记录当天所有材料的变更情况。
> 生成时间：${formatTimestampSeconds(new Date())}
> code_version：${codeRef.packageVersion}
> git_tag：${codeRef.gitTag}
> commit_sha：${codeRef.commitSha}

## 变更汇总

| 类型 | 数量 |
|------|------|
| 新增 | {{addedCount}} |
| 修改 | {{modifiedCount}} |
| 删除 | {{deletedCount}} |

## 变更明细

| 时间戳 | 文件路径 | 更新类型 | 分类 | 大小（字节） |
|--------|----------|----------|------|--------------|
`
}

function renderHistoryRow(entry: HistoryEntry): string {
  const typeMap: Record<UpdateType, string> = {
    added: '新增',
    modified: '修改',
    deleted: '删除',
    'format-converted': '格式转换',
    unchanged: '无变化',
    missing: '缺失',
  }
  return `| ${entry.timestamp} | ${entry.relativePath} | ${typeMap[entry.updateType]} | ${entry.category} | ${entry.sizeBytes} |`
}

function renderHistoryContent(
  date: Date,
  entries: readonly HistoryEntry[],
  codeRef: CodeRef,
): string {
  const addedCount = entries.filter((e) => e.updateType === 'added').length
  const modifiedCount = entries.filter((e) => e.updateType === 'modified').length
  const deletedCount = entries.filter((e) => e.updateType === 'deleted').length

  let content = renderHistoryHeader(date, codeRef)
    .replace('{{addedCount}}', String(addedCount))
    .replace('{{modifiedCount}}', String(modifiedCount))
    .replace('{{deletedCount}}', String(deletedCount))

  for (const entry of entries) {
    content += `${renderHistoryRow(entry)}\n`
  }

  return content
}

function parseExistingHistory(filePath: string): HistoryEntry[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8')
  const entries: HistoryEntry[] = []
  const rowRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g
  let match
  while ((match = rowRegex.exec(content)) !== null) {
    const timestamp = match[1]?.trim() ?? ''
    const relativePath = match[2]?.trim() ?? ''
    const typeLabel = match[3]?.trim() ?? ''
    const category = match[4]?.trim() ?? ''
    const sizeBytes = Number(match[5]?.trim() ?? '')
    if (!timestamp || timestamp === '时间戳' || Number.isNaN(sizeBytes)) continue

    const typeMapReverse: Record<string, UpdateType> = {
      '新增': 'added',
      '修改': 'modified',
      '删除': 'deleted',
      '格式转换': 'format-converted',
      '无变化': 'unchanged',
    }
    const updateType = typeMapReverse[typeLabel] ?? 'modified'
    entries.push({ timestamp, relativePath, updateType, category, sizeBytes })
  }
  return entries
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 记录文档版本历史
 * @param rootDir 仓库根目录
 * @param scannedFiles 扫描到的文件列表
 * @returns 版本历史结果
 */
export function recordVersionHistory(
  rootDir: string,
  scannedFiles: readonly ScannedFile[],
): VersionHistoryResult {
  const now = new Date()
  const { dir, file } = getHistoryPaths(rootDir, now)
  const codeRef = resolveCodeRef(rootDir)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const changedFiles = scannedFiles.filter(
    (f) => f.updateType !== 'unchanged' && f.updateType !== 'deleted',
  )

  const newEntries: HistoryEntry[] = changedFiles.map((scannedFile) => ({
    timestamp: formatTimestampSeconds(now),
    relativePath: scannedFile.relativePath,
    updateType: scannedFile.updateType,
    category: scannedFile.category,
    sizeBytes: scannedFile.sizeBytes,
    codeRef,
  }))

  const existingEntries = parseExistingHistory(file)

  // 合并：对于同一文件保留最新记录
  const merged = [...existingEntries]
  for (const entry of newEntries) {
    const index = merged.findIndex((e) => e.relativePath === entry.relativePath)
    if (index >= 0) {
      merged[index] = entry
    } else {
      merged.push(entry)
    }
  }

  merged.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const isNewFile = !existsSync(file)
  const content = renderHistoryContent(now, merged, codeRef)
  writeFileSync(file, content, 'utf-8')

  const updates: DocUpdateEntry[] = [
    {
      id: generateId(),
      timestamp: formatTimestampSeconds(now),
      filePath: file,
      updateType: isNewFile ? 'added' : 'modified',
      reason: `记录 ${changedFiles.length} 个文件的每日变更历史`,
    },
  ]

  return { updates, historyFilePath: file }
}
