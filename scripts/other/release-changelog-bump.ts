#!/usr/bin/env node
/**
 * @module scripts/release-changelog-bump
 * @description T6 release 钩子：CHANGELOG [Unreleased]→版本段 + 新建空 [Unreleased] 段
 *
 * 用法：
 *   npx tsx scripts/release-changelog-bump.ts [version]
 *
 * version 缺省时从 package.json 读取。通常由 package.json `postversion` 钩子调用
 * （npm version 已先把新版本写入 package.json）。
 *
 * 行为：
 *   1. 将首个 `## [Unreleased]` 替换为 `## [<version>] - <YYYY-MM-DD>`；
 *   2. 在其前插入新的空 `## [Unreleased]` 段（含 `### Added` 占位）；
 *   3. 若 `## [<version>] - <date>` 已存在则跳过（幂等）。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHANGELOG = join(ROOT, 'CHANGELOG.md')
const PKG = join(ROOT, 'package.json')
const UNRELEASED = '## [Unreleased]'

function resolveVersion(): string | undefined {
  if (process.argv[2]) return process.argv[2]
  const pkg = readFileSync(PKG, 'utf-8')
  return pkg.match(/"version"\s*:\s*"([^"]+)"/)?.[1]
}

function main(): void {
  const version = resolveVersion()
  if (!version) {
    console.error('[release-changelog-bump] 无法确定版本（参数未提供且 package.json 解析失败）')
    process.exit(1)
  }

  const content = readFileSync(CHANGELOG, 'utf-8')
  const date = new Date().toISOString().slice(0, 10)
  const releasedHeader = `## [${version}] - ${date}`

  if (!content.includes(UNRELEASED)) {
    console.error(`[release-changelog-bump] CHANGELOG.md 未找到 ${UNRELEASED} 段`)
    process.exit(1)
  }
  if (content.includes(releasedHeader)) {
    console.warn(`[release-changelog-bump] ${releasedHeader} 已存在，跳过（幂等）`)
    return
  }

  // 首个 [Unreleased] → 版本段；其前插入新的空 [Unreleased] 段
  const newUnreleasedBlock = `${UNRELEASED}\n\n### Added\n\n_(待补充)_\n\n---\n\n`
  const updated = content.replace(UNRELEASED, `${newUnreleasedBlock}${releasedHeader}`)

  writeFileSync(CHANGELOG, updated, 'utf-8')
  console.log(`[release-changelog-bump] ✓ [Unreleased] → [${version}] - ${date}，新建空 [Unreleased]`)
}

main()
