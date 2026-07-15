/**
 * fix-repeated-relative-paths.ts
 *
 * 修复 fix-doc-to-doc-basename.ts 等脚本重复运行导致的相对路径重复 bug。
 * 例如：`../../prompts/../../prompts/../../prompts/system-prompt-template.md`
 * 应修复为：`../../prompts/system-prompt-template.md`
 *
 * 策略：
 * 1. 扫描所有 .md 文件
 * 2. 检测重复的 `../../X/../../X/...` 模式
 * 3. 规范化路径（使用 node:path 的 normalize）
 * 4. 验证规范化后的路径指向有效文件
 * 5. 替换为规范化路径
 *
 * v1.0 (2026-07-15)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

interface RepeatInfo {
  original: string
  normalized: string
  count: number
  isValid: boolean
}

const REPEAT_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  // 1. ../../prompts/X/../../prompts/Y 形式
  {
    regex: /((?:\.\.\/)+prompts\/)(?:(?:\.\.\/)+prompts\/)+/g,
    description: '../../prompts/ 重复',
  },
  // 2. ../../reference/X/../../reference/Y 形式
  {
    regex: /((?:\.\.\/)+reference\/)(?:(?:\.\.\/)+reference\/)+/g,
    description: '../../reference/ 重复',
  },
  // 3. ../../explanation/X/../../explanation/Y 形式
  {
    regex: /((?:\.\.\/)+explanation\/)(?:(?:\.\.\/)+explanation\/)+/g,
    description: '../../explanation/ 重复',
  },
  // 4. ../../docs/X/../../docs/Y 形式
  {
    regex: /((?:\.\.\/)+docs\/)(?:(?:\.\.\/)+docs\/)+/g,
    description: '../../docs/ 重复',
  },
  // 5. ../../../prompts/X/../../prompts/Y 等变体
  {
    regex: /((?:\.\.\/){2,5}prompts\/)(?:(?:\.\.\/){2,5}prompts\/)+/g,
    description: '多级 prompts/ 重复',
  },
]

function normalizeRelPathFromFile(sourceFile: string, rawPath: string): string | null {
  // 从源文件所在目录出发计算规范化路径
  const sourceDir = path.dirname(path.resolve(ROOT, sourceFile))
  const targetFull = path.resolve(sourceDir, rawPath)
  let rel = path.relative(sourceDir, targetFull).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function findRepeats(content: string, sourceFile: string): RepeatInfo[] {
  const repeats: RepeatInfo[] = []
  for (const pat of REPEAT_PATTERNS) {
    let match: RegExpExecArray | null
    const regex = new RegExp(pat.regex.source, pat.regex.flags)
    while ((match = regex.exec(content)) !== null) {
      // match[0] 是整个重复段，需要找到完整的路径
      const startIdx = match.index
      // 向后扩展直到遇到非路径字符
      let endIdx = startIdx + match[0].length
      while (endIdx < content.length && /[a-zA-Z0-9_.\-\u4e00-\u9fa5]/.test(content[endIdx])) {
        endIdx++
      }
      const fullPath = content.substring(startIdx, endIdx)
      const normalized = normalizeRelPathFromFile(sourceFile, fullPath)
      if (normalized && fullPath !== normalized) {
        repeats.push({
          original: fullPath,
          normalized,
          count: 1,
          isValid: true,
        })
      }
    }
  }
  return repeats
}

function collectMdFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue
      files.push(...collectMdFiles(full))
    } else if (entry.isFile() && /\.md$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function main(): void {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  修复重复相对路径 v1.0                                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  const docsDir = path.join(ROOT, 'docs')
  const promptsDir = path.join(ROOT, 'prompts')
  const allFiles = [...collectMdFiles(docsDir), ...collectMdFiles(promptsDir)]
  console.log(`📂 扫描 ${allFiles.length} 个 .md 文件\n`)

  let totalReplacements = 0
  let fileCount = 0
  const replaceMap = new Map<string, Map<string, string>>() // filePath -> Map<original, normalized>

  for (const file of allFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const content = fs.readFileSync(file, 'utf-8')
    const repeats = findRepeats(content, rel)
    if (repeats.length === 0) continue

    const fileReplacements = new Map<string, string>()
    for (const rep of repeats) {
      // 验证目标存在
      const sourceDir = path.dirname(file)
      const targetFull = path.resolve(sourceDir, rep.normalized)
      if (!fs.existsSync(targetFull)) continue
      fileReplacements.set(rep.original, rep.normalized)
    }

    if (fileReplacements.size === 0) continue
    replaceMap.set(rel, fileReplacements)
    fileCount++
    totalReplacements += fileReplacements.size
    console.log(`📝 ${rel} (${fileReplacements.size} 处)`)
    for (const [orig, norm] of fileReplacements) {
      const origShort = orig.length > 60 ? '...' + orig.slice(-57) : orig
      const normShort = norm.length > 60 ? '...' + norm.slice(-57) : norm
      console.log(`   ${origShort}`)
      console.log(`   → ${normShort}`)
    }
  }

  if (fileCount === 0) {
    console.log('✅ 未发现重复路径')
    return
  }

  console.log(`\n📊 准备更新 ${fileCount} 个文件，共 ${totalReplacements} 处\n`)

  // 应用修复
  let applied = 0
  for (const [rel, replacements] of replaceMap.entries()) {
    const absPath = path.resolve(ROOT, rel)
    let content = fs.readFileSync(absPath, 'utf-8')
    const original = content
    for (const [orig, norm] of replacements) {
      content = content.split(orig).join(norm)
    }
    if (content !== original) {
      fs.writeFileSync(absPath, content, 'utf-8')
      applied++
    }
  }

  console.log(`✅ 已应用修复到 ${applied} 个文件\n`)
}

main()
