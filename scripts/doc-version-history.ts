/**
 * @module scripts/doc-version-history
 * @description 文档版本历史记录器（最小存根）
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DocUpdateEntry, ScannedFile } from '../src/types/modules/doc-validation.types'

export interface VersionHistoryResult {
  readonly updates: DocUpdateEntry[]
  readonly historyFilePath: string
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestampSeconds(date: Date): string {
  return date.toISOString().replace(/\..+/, 'Z')
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function getHistoryPaths(
  rootDir: string,
  date: Date,
): { dir: string; file: string } {
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const dir = join(rootDir, 'docs', 'changelogs', `${year}-${month}`)
  const file = join(dir, `daily-doc-validation-${year}-${month}-${day}.md`)
  return { dir, file }
}

export function recordVersionHistory(
  rootDir: string,
  scannedFiles: readonly ScannedFile[],
): VersionHistoryResult {
  const now = new Date()
  const { dir, file } = getHistoryPaths(rootDir, now)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const changedFiles = scannedFiles.filter(
    (f) => f.updateType !== 'unchanged' && f.updateType !== 'deleted',
  )

  const typeMap: Record<string, string> = {
    added: '新增',
    modified: '修改',
    deleted: '删除',
    'format-converted': '格式转换',
  }

  let content = '# 每日文档变更历史\n\n'
  for (const f of changedFiles) {
    content += `- ${f.relativePath} | ${typeMap[f.updateType] ?? f.updateType}\n`
  }

  writeFileSync(file, content, 'utf-8')

  const updates: DocUpdateEntry[] = [
    {
      id: generateId(),
      timestamp: formatTimestampSeconds(now),
      filePath: file,
      updateType: 'added',
      reason: `记录 ${changedFiles.length} 个文件的每日变更历史`,
    },
  ]

  return { updates, historyFilePath: file }
}
