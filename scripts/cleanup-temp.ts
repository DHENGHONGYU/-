#!/usr/bin/env tsx
/**
 * cleanup-temp.ts — 按保留期清理 temp/ 下的临时产物
 *
 * 保留策略（来源：docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md §6.2）：
 *   .log           7 天
 *   .json / .txt   14 天
 *   .test.ts       1 天（验证完成后应立即删除，此处兜底）
 * 其他扩展名不在策略内，默认保留（不删）。
 *
 * 安全策略：默认 dry-run（只列出将删除的文件）；
 *   加 --execute 才真正删除。绝不删除目录本身，绝不触碰 src/ 等代码区。
 *
 * 用法：
 *   tsx scripts/cleanup-temp.ts            # dry-run
 *   tsx scripts/cleanup-temp.ts --execute  # 实际删除
 *   tsx scripts/cleanup-temp.ts --dir=build/tmp  # 指定其他临时根
 */
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, extname } from 'node:path'

const DAY_MS = 1000 * 60 * 60 * 24

const RETENTION_DAYS: Record<string, number> = {
  '.log': 7,
  '.json': 14,
  '.txt': 14,
  '.test.ts': 1,
}

function parseArgs(argv: string[]): { execute: boolean; dir: string } {
  let execute = false
  let dir = 'temp'
  for (const a of argv.slice(2)) {
    if (a === '--execute') execute = true
    else if (a.startsWith('--dir=')) dir = a.slice('--dir='.length)
  }
  return { execute, dir }
}

function collectFiles(root: string, out: string[]): void {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      // 仅递归一层内的文件；不删除任何目录，避免破坏结构
      collectFiles(full, out)
    } else {
      out.push(full)
    }
  }
}

function isExpired(filePath: string, mtimeMs: number, now: number): boolean {
  const key = filePath.endsWith('.test.ts') ? '.test.ts' : extname(filePath)
  const days = RETENTION_DAYS[key]
  if (days === undefined) return false
  return now - mtimeMs > days * DAY_MS
}

function main(): void {
  const { execute, dir } = parseArgs(process.argv)
  const now = Date.now()
  const files: string[] = []
  collectFiles(dir, files)

  const expired = files.filter((f) => {
    try {
      return isExpired(f, statSync(f).mtimeMs, now)
    } catch {
      return false
    }
  })

  console.log(`[cleanup-temp] 扫描根: ${dir}`)
  console.log(`[cleanup-temp] 文件总数: ${files.length}，命中保留期: ${expired.length}`)
  if (expired.length === 0) {
    console.log('[cleanup-temp] 无需清理。')
    return
  }

  console.log(`[cleanup-temp] ${execute ? '将删除' : '待删除(dry-run，加 --execute 实际删除)'}:`)
  for (const f of expired) {
    const age = ((now - statSync(f).mtimeMs) / DAY_MS).toFixed(1)
    console.log(`  - ${f}  (age ${age}d)`)
  }

  if (execute) {
    let removed = 0
    let failed = 0
    for (const f of expired) {
      try {
        unlinkSync(f)
        removed++
      } catch (e) {
        failed++
        console.error(`  ✗ 删除失败 ${f}: ${(e as Error).message}`)
      }
    }
    console.log(`[cleanup-temp] 完成：删除 ${removed} 个，失败 ${failed} 个。`)
    process.exit(failed > 0 ? 1 : 0)
  } else {
    console.log('[cleanup-temp] 未执行删除（dry-run）。')
  }
}

main()
