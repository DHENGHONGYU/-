import { glob } from 'glob'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 轻量级 JSDoc 缺失扫描器。
 *
 * 扫描目标目录中的导出函数/组件/类，检查是否带有有效的 JSDoc 注释。
 * 输出缺失列表到控制台，并写入报告文件。
 */

const TARGET_DIRS = [
  'src/services',
  'src/store',
  'src/hooks',
  'src/lib',
  'src/components',
  'src/pages',
  'src/cockpit',
  'src/core',
]

const EXCLUDE_PATTERNS = [
  '**/*.test.{ts,tsx}',
  '**/*.d.ts',
  '**/index.ts',
  '**/theme/**',
]

interface MissingEntry {
  file: string
  line: number
  name: string
  type: 'function' | 'component' | 'class' | 'constant'
}

function findMissingJSDoc(): MissingEntry[] {
  const entries: MissingEntry[] = []
  const cwd = process.cwd()

  for (const dir of TARGET_DIRS) {
    const files = glob.sync('**/*.{ts,tsx}', {
      cwd: path.join(cwd, dir),
      ignore: EXCLUDE_PATTERNS,
    })

    for (const file of files) {
      const fullPath = path.join(cwd, dir, file)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match exported function / const / class / component
        const match = line.match(
          /^export\s+(?:async\s+)?(?:function|const|class|default\s+function)\s+(\w+)/,
        )
        if (!match) continue

        const name = match[1]
        const type = line.includes('class')
          ? 'class'
          : line.includes('function') || /^export\s+default\s+function/.test(line)
            ? 'function'
            : 'constant'

        // Check previous non-empty lines for JSDoc
        let hasJSDoc = false
        for (let j = i - 1; j >= 0 && j >= i - 10; j--) {
          const prevLine = lines[j].trim()
          if (prevLine === '') continue
          if (prevLine.startsWith('/**')) {
            hasJSDoc = true
            break
          }
          if (!prevLine.startsWith('*') && !prevLine.startsWith('/*')) {
            break
          }
        }

        if (!hasJSDoc) {
          entries.push({ file: path.relative(cwd, fullPath), line: i + 1, name, type })
        }
      }
    }
  }

  return entries
}

function main(): void {
  const entries = findMissingJSDoc()

  if (entries.length === 0) {
    console.log('✅ 未发现缺失 JSDoc 的导出实体')
    process.exit(0)
  }

  console.warn(`⚠️ 发现 ${entries.length} 个导出实体缺少 JSDoc：\n`)
  for (const entry of entries.slice(0, 50)) {
    console.warn(`  ${entry.file}:${entry.line}  ${entry.type} ${entry.name}`)
  }
  if (entries.length > 50) {
    console.warn(`  ... 还有 ${entries.length - 50} 个未显示`)
  }

  // 报告写入文件但不阻断 CI（基线过高，先逐步治理）
  const reportDir = path.join(process.cwd(), 'docs', 'reports', 'audit')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, `jsdoc-audit-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({ count: entries.length, entries }, null, 2))
  console.log(`\n报告已写入：${reportPath}`)

  // 当前基线较高，作为警告而非错误；治理完成后改为 process.exit(1)
  process.exit(0)
}

main()
