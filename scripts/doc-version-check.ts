#!/usr/bin/env node
/**
 * @module scripts/doc-version-check
 * @description 校验 docs/**\*.md 的 frontmatter `code_version` 与 package.json 一致（约束 3 · T4）
 *
 * 自动更新体系要求文档版本随代码版本同步：
 *   - 文档 frontmatter 含 `code_version: <semver>` 字段；
 *   - CI 在 version bump 时校验其与 `package.json` 的 `version` 一致。
 *
 * 行为：
 *   - 默认只读校验：仅报告「已声明 code_version 但不匹配」的文档，退出码 1（可作 CI 门禁）。
 *   - 未声明 code_version 的文档不计入失败（由 inject 流程另行补全）。
 *   - `--fix`：将缺失/不匹配的 code_version 就地对齐为 package.json 版本（写盘，需谨慎）。
 *
 * 用法：
 *   npx tsx scripts/doc-version-check.ts [--fix] [--silent]
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname as pathDirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = pathDirname(__filename)
const ROOT = __dirname.replace(/[\\/]scripts$/, '')

interface Mismatch {
  path: string
  declared?: string
  expected: string
  hasFrontmatter: boolean
}

/** 安全读取 package.json 的 version */
function readPackageVersion(): string {
  const pkgPath = join(ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
  return pkg.version ?? '0.0.0'
}

/** 取得受跟踪的 docs/**\*.md 列表 */
function listTrackedDocs(): string[] {
  try {
    return execSync('git ls-files', { cwd: ROOT, encoding: 'utf-8' })
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^docs\/.*\.md$/.test(l) && !/^docs\/(reports|changelogs)\//.test(l))
  } catch {
    return []
  }
}

/** 从文件头部抽取 YAML frontmatter 的 code_version 字段 */
function extractCodeVersion(content: string): { hasFrontmatter: boolean; codeVersion?: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return { hasFrontmatter: false }
  const fm = fmMatch[1]!
  const line = fm.split('\n').find((l) => /^code_version\s*:/i.test(l.trim()))
  if (!line) return { hasFrontmatter: true }
  const value = line.split(':').slice(1).join(':').trim().replace(/^["']|["']$/g, '')
  return { hasFrontmatter: true, codeVersion: value || undefined }
}

/** 将 code_version 写入/对齐到 frontmatter（--fix 用） */
function stampCodeVersion(relPath: string, version: string): void {
  const abs = join(ROOT, relPath)
  const content = readFileSync(abs, 'utf-8')
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    // 无 frontmatter：前置一个最小 frontmatter
    const newContent = `---\ntitle: ${relPath}\ncode_version: ${version}\n---\n\n${content}`
    writeFileSync(abs, newContent, 'utf-8')
    return
  }
  const fm = fmMatch[1]!
  const hasField = fm.split('\n').some((l) => /^code_version\s*:/i.test(l.trim()))
  const newFm = hasField
    ? fm.replace(/^code_version\s*:.*$/im, `code_version: ${version}`)
    : `${fm}\ncode_version: ${version}`
  const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFm}\n---`)
  writeFileSync(abs, newContent, 'utf-8')
}

export interface VersionCheckResult {
  checked: number
  declared: number
  mismatches: Mismatch[]
  missing: string[]
}

export function checkVersionSync(fix: boolean): VersionCheckResult {
  const expected = readPackageVersion()
  const docs = listTrackedDocs()
  const mismatches: Mismatch[] = []
  const missing: string[] = []

  for (const rel of docs) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) continue
    const { hasFrontmatter, codeVersion } = extractCodeVersion(readFileSync(abs, 'utf-8'))
    if (!hasFrontmatter || codeVersion === undefined) {
      missing.push(rel)
      continue
    }
    if (codeVersion !== expected) {
      mismatches.push({ path: rel, declared: codeVersion, expected, hasFrontmatter })
      if (fix) {
        try {
          stampCodeVersion(rel, expected)
        } catch (err) {
          console.error(`[doc-version-check] 写入失败 ${rel}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  return { checked: docs.length, declared: docs.length - missing.length, mismatches, missing }
}

function main(): void {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const silent = args.includes('--silent')
  const result = checkVersionSync(fix)

  if (!silent) {
    console.log(`[doc-version-check] package.json version = ${readPackageVersion()}`)
    console.log(`[doc-version-check] 扫描 ${result.checked} 份文档，含 code_version ${result.declared} 份，未声明 ${result.missing.length} 份`)
    for (const m of result.mismatches) {
      console.log(`  ❌ ${m.path} — 声明 ${m.declared} ≠ 期望 ${m.expected}${fix ? '（已对齐）' : ''}`)
    }
  }

  if (result.mismatches.length > 0 && !silent) {
    console.error(`[doc-version-check] 发现 ${result.mismatches.length} 份文档 code_version 与 package.json 不一致`)
  }

  // CI 门禁：存在不匹配即非零退出（--fix 已就地修正后不再失败）
  process.exit(result.mismatches.length > 0 && !fix ? 1 : 0)
}

if (process.argv[1] && process.argv[1].endsWith('doc-version-check.ts')) {
  main()
}
