#!/usr/bin/env node
/**
 * @module scripts/doc-dict-ast-extract
 * @description B15：数据字典自动生成探索——从 src/types/modules 提取类型定义生成 DATA_DICTIONARY_INDEX 段骨架
 *
 * 用法：
 *   npx tsx scripts/doc-dict-ast-extract.ts [--output <file>]
 *
 * 缺省输出到 stdout；--output 写入文件。
 *
 * 注：本脚本为探索性原型，用 regex 提取 export interface/type 名称 + 前置 JSDoc 摘要；
 *     后续可用 TS Compiler API 增强（精确字段、继承关系、泛型）。
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TYPES_DIR = join(ROOT, 'src', 'types', 'modules')

interface TypeEntry {
  readonly kind: string
  readonly name: string
  readonly jsdoc: string
}

/** 递归收集 .ts 文件 */
function collectTsFiles(dir: string, files: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectTsFiles(full, files)
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(full)
    }
  }
}

/** 提取 export interface/type 名称 + 前置块注释摘要 */
function extractTypes(content: string): TypeEntry[] {
  const lines = content.split('\n')
  const types: TypeEntry[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*export\s+(interface|type)\s+(\w+)/)
    if (!m) continue
    const kind = m[1]!
    const name = m[2]!
    // 向上查找最近的块注释末行作为 JSDoc 摘要
    let jsdoc = ''
    for (let j = i - 1; j >= 0; j--) {
      const ln = lines[j]!.trim()
      if (ln.endsWith('*/')) {
        // 取注释内最后一个有内容的描述行
        for (let k = j; k >= Math.max(0, j - 3); k--) {
          const desc = lines[k]!.trim().replace(/^[*/]+/, '').trim()
          if (desc && !desc.startsWith('@')) {
            jsdoc = desc
            break
          }
        }
        break
      }
      if (ln === '' || ln.startsWith('//')) continue
      break
    }
    types.push({ kind, name, jsdoc })
  }
  return types
}

function main(): void {
  const files: string[] = []
  collectTsFiles(TYPES_DIR, files)
  const date = new Date().toISOString().slice(0, 10)

  const lines: string[] = [
    '# 数据字典（自动提取骨架）',
    '',
    `> 由 \`doc-dict-ast-extract.ts\` 探索性生成（B15），非权威来源。`,
    `> 生成时间：${date} ｜ 来源：\`src/types/modules/**/*.ts\``,
    '',
    '| 类型名 | 种类 | 文件 | JSDoc 摘要 |',
    '|------|------|------|-----------|',
  ]

  let count = 0
  for (const f of files.sort()) {
    const rel = relative(join(ROOT, 'src'), f).replace(/\\/g, '/')
    const content = readFileSync(f, 'utf-8')
    for (const t of extractTypes(content)) {
      const desc = t.jsdoc.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '—'
      lines.push(`| \`${t.name}\` | ${t.kind} | \`${rel}\` | ${desc} |`)
      count++
    }
  }

  lines.push('')
  lines.push(`> 共提取 ${count} 个类型定义（来自 ${files.length} 个文件）。`)
  lines.push('')

  const out = lines.join('\n')
  const outIdx = process.argv.indexOf('--output')
  if (outIdx > -1 && process.argv[outIdx + 1]) {
    writeFileSync(process.argv[outIdx + 1]!, out, 'utf-8')
    console.log(`[doc-dict-ast-extract] 已写入 ${process.argv[outIdx + 1]}（${count} 个类型）`)
  } else {
    console.log(out)
  }
}

main()
