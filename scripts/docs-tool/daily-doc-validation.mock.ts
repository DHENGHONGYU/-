#!/usr/bin/env node
/**
 * @module scripts/daily-doc-validation.mock
 * @description 每日文档验证本地 mock 运行器
 *
 * 用于在本地快速构造受控数据，验证 validateConsistency / validateCorrectness 的日志输出与发现项。
 *
 * 运行方式：
 *   npx tsx scripts/daily-doc-validation.mock.ts
 */

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync as fsReadFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ScannedFile } from '../../src/types/modules/doc-validation.types'
import { validateConsistency, validateCorrectness } from './daily-doc-validation'

function createMockScannedFiles(rootDir: string): ScannedFile[] {
  const now = new Date().toISOString()
  const files: ScannedFile[] = [
    {
      absolutePath: join(rootDir, 'docs/explanation/README.md'),
      relativePath: 'docs/explanation/README.md',
      category: 'doc',
      updateType: 'modified',
      sizeBytes: 0,
      lastModifiedAt: now,
      hash: 'mock-hash-readme',
    },
    {
      absolutePath: join(rootDir, 'guide.md'),
      relativePath: 'guide.md',
      category: 'doc',
      updateType: 'modified',
      sizeBytes: 0,
      lastModifiedAt: now,
      hash: 'mock-hash-guide',
    },
    {
      absolutePath: join(rootDir, 'bad-frontmatter.md'),
      relativePath: 'bad-frontmatter.md',
      category: 'doc',
      updateType: 'added',
      sizeBytes: 0,
      lastModifiedAt: now,
      hash: 'mock-hash-frontmatter',
    },
    {
      absolutePath: join(rootDir, 'bad-codeblock.md'),
      relativePath: 'bad-codeblock.md',
      category: 'doc',
      updateType: 'added',
      sizeBytes: 0,
      lastModifiedAt: now,
      hash: 'mock-hash-codeblock',
    },
    {
      absolutePath: join(rootDir, 'src', 'sample.ts'),
      relativePath: 'src/sample.ts',
      category: 'code',
      updateType: 'modified',
      sizeBytes: 0,
      lastModifiedAt: now,
      hash: 'mock-hash-sample',
    },
  ]

  // 重新计算 sizeBytes
  return files.map((f) => {
    const content = fsReadFileSync(f.absolutePath)
    return { ...f, sizeBytes: content.length }
  })
}

function main(): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'daily-doc-validation-mock-'))
  mkdirSync(join(tempDir, 'src'), { recursive: true })

  writeFileSync(
    join(tempDir, 'docs/explanation/README.md'),
    '# 根文档\n\n参见 [指南](./guide.md)\n\n参见 [不存在](./missing.md)\n',
    'utf-8',
  )

  writeFileSync(
    join(tempDir, 'guide.md'),
    '# 指南\n\n本文介绍 data bridge 和 Zustland 的用法。\n\n返回 [首页](./README.md)\n',
    'utf-8',
  )

  writeFileSync(
    join(tempDir, 'bad-frontmatter.md'),
    '---\ntitle: 未关闭的 frontmatter\n\n正文内容\n',
    'utf-8',
  )

  writeFileSync(
    join(tempDir, 'bad-codeblock.md'),
    '# 代码块示例\n\n```\n未指定语言的代码块\n```\n\n```typescript\nconst ok = true\n```\n',
    'utf-8',
  )

  writeFileSync(
    join(tempDir, 'src', 'sample.ts'),
    'export function broken() {\n  return (\n}\n',
    'utf-8',
  )

  const files = createMockScannedFiles(tempDir)

  console.error('═══════════════════════════════════════════════════════════')
  console.error('  每日文档验证 Mock 运行')
  console.error('  临时目录:', tempDir)
  console.error('═══════════════════════════════════════════════════════════')

  const consistency = validateConsistency(files)
  const correctness = validateCorrectness(files)

  console.error('\n───────────────────────────────────────────────────────────')
  console.error('一致性验证结果')
  console.error('───────────────────────────────────────────────────────────')
  console.error(JSON.stringify(consistency, null, 2))

  console.error('\n───────────────────────────────────────────────────────────')
  console.error('正确性验证结果')
  console.error('───────────────────────────────────────────────────────────')
  console.error(JSON.stringify(correctness, null, 2))

  rmSync(tempDir, { recursive: true, force: true })
}

main()
