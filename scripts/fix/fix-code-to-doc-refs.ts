/**
 * fix-code-to-doc-refs.ts
 *
 * 修复源代码中 code-to-doc 类型的断裂引用，主要处理：
 * 1. 源代码中 `《》` 中文书名号导致的伪路径 → 真实 docs/reference/ 路径
 * 2. 错误的具体子目录路径 → 实际文件路径
 * 3. 已删除/不存在的文档引用 → 修正或移除
 *
 * v1.0 (2026-07-15) 初始化版本
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

/** 路径映射：旧引用 → 新引用 */
const PATH_MAP: Array<{ from: RegExp; to: string; description: string }> = [
  // 1. 功能模块数据契约（高频 11 处）
  {
    from: /docs\/《功能模块数据契约》\.md/g,
    to: 'docs/reference/功能模块数据契约.md',
    description: '功能模块数据契约：移到 docs/reference/ 并去除书名号',
  },
  // 2. V9 核心数据字典与类型定义（整合版）（高频 9 处）
  {
    from: /docs\/《V9核心数据字典与类型定义（整合版）》\.md/g,
    to: 'docs/reference/v9核心数据字典与类型定义(整合版).md',
    description: 'V9 核心数据字典：移到 docs/reference/ 并去除书名号',
  },
  // 3. DataBridge 端点与数据映射清单（2 处）
  {
    from: /docs\/《DataBridge端点与数据映射清单》\.md/g,
    to: 'docs/reference/databridge端点与数据映射清单.md',
    description: 'DataBridge 端点：移到 docs/reference/ 并去除书名号',
  },
  // 4. V9 架构缺陷与整改行动清单（1 处）
  {
    from: /docs\/《V9 架构缺陷与整改行动清单》\.md/g,
    to: 'docs/explanation/v9-架构缺陷与整改行动清单.md',
    description: 'V9 架构缺陷清单：移到 docs/explanation/ 并去除书名号',
  },
  // 5. V9 现有数据资产清单（1 处）
  {
    from: /docs\/《V9\s?现有数据资产清单》\.md/g,
    to: 'docs/reference/V9现有数据资产清单.md',
    description: 'V9 现有数据资产清单：移到 docs/reference/ 并去除书名号',
  },
  // 6. data-flow-spec 子目录修正（1 处）
  {
    from: /docs\/explanation\/data-flow-spec\.md/g,
    to: 'docs/explanation/design/data-flow-spec.md',
    description: 'data-flow-spec：补充 design/ 子目录',
  },
]

/** 目标文件存在性预校验 */
function validateTargets(): Array<{ ok: boolean; to: string; description: string; absPath: string }> {
  return PATH_MAP.map((m) => {
    const absPath = path.join(ROOT, m.to)
    return {
      ok: fs.existsSync(absPath),
      to: m.to,
      description: m.description,
      absPath,
    }
  })
}

interface FileFix {
  file: string
  changes: Array<{ from: string; to: string; line: number }>
}

function fixFile(absPath: string, relPath: string): FileFix | null {
  let content = fs.readFileSync(absPath, 'utf-8')
  const originalContent = content
  const changes: Array<{ from: string; to: string; line: number }> = []
  const lines = content.split('\n')

  for (const m of PATH_MAP) {
    let match: RegExpExecArray | null
    const regex = new RegExp(m.from.source, m.from.flags)
    while ((match = regex.exec(content)) !== null) {
      const offset = match.index
      // 计算所在行号
      let line = 1
      for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') line++
      }
      changes.push({
        from: match[0],
        to: m.to,
        line,
      })
    }
  }

  if (changes.length === 0) return null

  // 应用所有替换
  for (const m of PATH_MAP) {
    content = content.replace(m.from, m.to)
  }

  if (content === originalContent) return null

  fs.writeFileSync(absPath, content, 'utf-8')
  return { file: relPath, changes }
}

function collectFiles(dir: string): string[] {
  const files: string[] = []
  const skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage', 'public'])
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      files.push(...collectFiles(full))
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(full)
      }
    }
  }
  return files
}

function main(): void {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  修复 code-to-doc 断裂引用 v1.0                           ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // 1. 预校验目标存在性
  console.log('📋 目标存在性预校验:\n')
  const validations = validateTargets()
  let allTargetsValid = true
  for (const v of validations) {
    const status = v.ok ? '✅' : '❌'
    console.log(`  ${status} ${v.to}`)
    console.log(`     ${v.description}`)
    if (!v.ok) {
      console.log(`     缺失: ${v.absPath}`)
      allTargetsValid = false
    }
  }
  console.log()
  if (!allTargetsValid) {
    console.error('❌ 部分目标文件不存在，请先创建或修正 PATH_MAP')
    process.exit(1)
  }

  // 2. 收集所有源文件
  const targets = ['src', 'scripts']
  const sourceFiles: string[] = []
  for (const t of targets) {
    const dir = path.join(ROOT, t)
    if (fs.existsSync(dir)) {
      sourceFiles.push(...collectFiles(dir))
    }
  }
  console.log(`📂 扫描源文件: ${sourceFiles.length} 个\n`)

  // 3. 修复
  console.log('🔧 修复中...\n')
  const fixes: FileFix[] = []
  for (const file of sourceFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const result = fixFile(file, rel)
    if (result) {
      fixes.push(result)
    }
  }

  // 4. 输出报告
  if (fixes.length === 0) {
    console.log('✅ 未发现需要修复的引用')
    return
  }

  let totalChanges = 0
  for (const f of fixes) {
    console.log(`📝 ${f.file} (${f.changes.length} 处)`)
    for (const c of f.changes) {
      console.log(`   L${c.line}: ${c.from}`)
      console.log(`      → ${c.to}`)
      totalChanges++
    }
  }
  console.log(`\n✅ 共修复 ${totalChanges} 处引用，涉及 ${fixes.length} 个文件`)
}

main()
