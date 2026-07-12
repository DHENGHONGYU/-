/**
 * 颜色系统合规性审计脚本
 * 检查所有组件文件中的硬编码颜色值
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const TAILWIND_COLOR_PATTERNS = [
  /text-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  /bg-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  /border-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  /\/(?:5|10|20|30|40|50|60|70|80|90|95|100)/,
]

const HARDCODED_COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/g,
  /rgba?\([^)]+\)/g,
  /hsla?\([^)]+\)/g,
]

export interface Violation {
  file: string
  line: number
  column: number
  color: string
  context: string
}

export interface AuditReport {
  violations: Violation[]
  warnings: string[]
  totalFiles: number
}

export async function scan(): Promise<AuditReport> {
  const files = await glob('src/**/*.{tsx,ts}', {
    ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**', '**/dist/**'],
  })

  const violations: Violation[] = []
  const warnings: string[] = []

  for (const file of files) {
    try {
      const content = await readFile(resolve(process.cwd(), file), 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return
        }

        HARDCODED_COLOR_PATTERNS.forEach((pattern) => {
          const matches = line.match(pattern)
          if (matches) {
            matches.forEach((color) => {
              const isInTailwindClass = TAILWIND_COLOR_PATTERNS.some((p) => p.test(line))
              const isVariable = line.includes('const ') || line.includes('let ') || line.includes('var ')
              
              if (!isInTailwindClass && !isVariable) {
                violations.push({
                  file,
                  line: index + 1,
                  column: line.indexOf(color) + 1,
                  color,
                  context: line.trim(),
                })
              }
            })
          }
        })
      })
    } catch {
      warnings.push(`无法读取文件: ${file}`)
    }
  }

  return {
    violations,
    warnings,
    totalFiles: files.length,
  }
}

async function auditColorTokens(): Promise<void> {
  console.log('🔍 开始颜色系统合规性检查...\n')

  const report = await scan()

  if (report.violations.length === 0) {
    console.log('✅ 颜色系统合规检查通过！未发现硬编码颜色。\n')
    process.exit(0)
  } else {
    console.error(`❌ 发现 ${report.violations.length} 处颜色违规：\n`)
    
    report.violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.file}:${v.line}:${v.column}`)
      console.error(`   颜色: ${v.color}`)
      console.error(`   上下文: ${v.context}\n`)
    })

    console.error('\n💡 建议：')
    console.error('   - 使用 theme.tokens.ts 中定义的颜色常量')
    console.error('   - 使用 Tailwind CSS 的语义化颜色类（如 text-primary, bg-card）')
    console.error('   - 参考 src/constants/theme.tokens.ts\n')

    process.exit(1)
  }
}

if (require.main === module) {
  auditColorTokens().catch((error) => {
    console.error('审计脚本执行失败:', error)
    process.exit(1)
  })
}
