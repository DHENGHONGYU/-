#!/usr/bin/env node
/**
 * @module scripts/doc-arch-version-compare
 * @description B12：架构文档版本比对常态化——比对关键文档声称的依赖版本与 package.json 实况，报告漂移
 *
 * 用法：
 *   npx tsx scripts/doc-arch-version-compare.ts
 *
 * 退出码：0=一致；1=发现漂移（可作 CI 门禁）
 *
 * 原理：扫描关键架构文档中的版本声明（如 "React 19"、"Vite 6"），
 * 与 package.json 的 dependencies/devDependencies 比对，主版本号不一致即报告漂移。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

interface Pkg {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const PKG: Pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const deps: Record<string, string> = { ...PKG.dependencies, ...PKG.devDependencies }

/** 监控的依赖及其在文档中的版本声明模式（捕获组 1 = 声明的主版本号片段） */
const WATCH: ReadonlyArray<{ readonly pkg: string; readonly pattern: RegExp; readonly label: string }> = [
  { pkg: 'react', pattern: /React\s+v?(\d+)\b/, label: 'React' },
  { pkg: 'react-dom', pattern: /React\s+DOM\s+v?(\d+)\b/, label: 'React DOM' },
  { pkg: 'typescript', pattern: /TypeScript\s+v?(\d+\.\d+)/, label: 'TypeScript' },
  { pkg: 'vite', pattern: /Vite\s+v?(\d+)\b/, label: 'Vite' },
  { pkg: 'zustand', pattern: /Zustand\s+v?(\d+)\b/, label: 'Zustand' },
]

/** 待扫描的关键架构文档 */
const DOCS: ReadonlyArray<string> = [
  'architecture.md',
  'docs/reference/05-engine-specs.md',
  'docs/explanation/design/ui-design-system.md',
  'docs/explanation/design/component-library-guide.md',
  'docs/reference/03-architecture-standards.md',
]

interface Drift {
  readonly doc: string
  readonly pkg: string
  readonly label: string
  readonly declared: string
  readonly actual: string
}

/** 取 package.json 版本的主版本号片段（用于与文档声明比对） */
function majorOf(version: string): string {
  return version.replace(/[\^~>=<]/, '').split('.')[0] ?? version
}

function main(): void {
  const drifts: Drift[] = []

  for (const doc of DOCS) {
    const abs = join(ROOT, doc)
    if (!existsSync(abs)) continue
    const content = readFileSync(abs, 'utf-8')
    for (const w of WATCH) {
      const m = content.match(w.pattern)
      if (!m) continue
      const declared = m[1] ?? ''
      const actualRaw = deps[w.pkg]
      if (!actualRaw) continue
      const actualMajor = majorOf(actualRaw)
      // TypeScript 声明形如 "5.7"，比主版本号前缀
      const isMatch = w.pattern.source.includes('\\d+\\.\\d+')
        ? actualRaw.replace(/[\^~]/, '').startsWith(declared)
        : actualMajor === declared
      if (!isMatch) {
        drifts.push({ doc, pkg: w.pkg, label: w.label, declared, actual: actualRaw })
      }
    }
  }

  if (drifts.length === 0) {
    console.log('[arch-version-compare] ✓ 关键架构文档版本声明与 package.json 一致')
    process.exit(0)
  }

  console.log(`[arch-version-compare] ⚠ 发现 ${drifts.length} 处版本漂移：`)
  for (const d of drifts) {
    console.log(`  ${d.doc}: ${d.label} 文档声明=v${d.declared}，package.json 实际=${d.actual}`)
  }
  console.log('')
  console.log('  修复建议：更新文档版本声明以匹配 package.json，或在 package.json 升级后同步文档。')
  process.exit(1)
}

main()
