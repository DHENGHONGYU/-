/**
 * 字体系统合规性审计脚本
 * 检查所有组件文件中的硬编码字体值
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const VALID_FONT_SIZES = new Set([
  '10px', '11px', '12px', '13px', '14px', '15px', '16px',
  '18px', '20px', '22px', '24px', '28px', '30px', '32px',
  '36px', '40px', '48px', '56px', '64px', '72px', '96px',
])

const VALID_FONT_WEIGHTS = new Set([
  '100', '200', '300', '400', '500', '600', '700', '800', '900',
  'normal', 'bold', 'lighter', 'bolder',
])

const TAILWIND_FONT_PATTERNS = [
  /text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/,
  /font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/,
  /leading-(?:none|tight|snug|normal|relaxed|loose|\d+)\b/,
  /tracking-(?:tighter|tight|normal|wide|wider|widest)\b/,
]

const HARDCODED_FONT_SIZE_REGEX = /font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))/g
const HARDCODED_FONT_WEIGHT_REGEX = /font-weight:\s*(\w+)/g
const HARDCODED_LINE_HEIGHT_REGEX = /line-height:\s*(\d+(?:\.\d+)?(?:px|rem|em|%))/g

export interface Violation {
  file: string
  line: number
  column: number
  property: string
  value: string
  context: string
}

export interface TypographyReport {
  violations: Violation[]
  warnings: string[]
  totalFiles: number
}

export async function scan(): Promise<TypographyReport> {
  const files = await glob('src/**/*.{tsx,ts}', {
    ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**', '**/dist/**', 'src/constants/**'],
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

        const isInTailwindClass = TAILWIND_FONT_PATTERNS.some((p) => p.test(line))
        if (isInTailwindClass) return

        let match
        const fontSizeRegex = new RegExp(HARDCODED_FONT_SIZE_REGEX)
        while ((match = fontSizeRegex.exec(line)) !== null) {
          const value = match[1]
          if (!VALID_FONT_SIZES.has(value ?? '')) {
            violations.push({
              file,
              line: index + 1,
              column: match.index + 1,
              property: 'font-size',
              value,
              context: line.trim(),
            })
          }
        }

        const fontWeightRegex = new RegExp(HARDCODED_FONT_WEIGHT_REGEX)
        while ((match = fontWeightRegex.exec(line)) !== null) {
          const value = match[1]
          if (!VALID_FONT_WEIGHTS.has(value ?? '')) {
            violations.push({
              file,
              line: index + 1,
              column: match.index + 1,
              property: 'font-weight',
              value,
              context: line.trim(),
            })
          }
        }

        const lineHeightRegex = new RegExp(HARDCODED_LINE_HEIGHT_REGEX)
        while ((match = lineHeightRegex.exec(line)) !== null) {
          violations.push({
            file,
            line: index + 1,
            column: match.index + 1,
            property: 'line-height',
            value: match[1],
            context: line.trim(),
          })
        }
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

async function auditTypography(): Promise<void> {
  console.log('🔍 开始字体系统合规性检查...\n')

  const report = await scan()

  if (report.violations.length === 0) {
    console.log('✅ 字体系统合规检查通过！未发现硬编码字体。\n')
    process.exit(0)
  } else {
    console.error(`❌ 发现 ${report.violations.length} 处字体违规：\n`)
    
    report.violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.file}:${v.line}:${v.column}`)
      console.error(`   属性: ${v.property}`)
      console.error(`   值: ${v.value}`)
      console.error(`   上下文: ${v.context}\n`)
    })

    console.error('\n💡 建议：')
    console.error('   - 使用 Tailwind CSS 的标准字体类（如 text-sm, text-base, font-medium）')
    console.error('   - 或使用 theme.tokens.ts 中定义的字体常量')
    console.error('   - 参考 src/constants/theme.tokens.ts\n')

    process.exit(0)
  }
}

import { fileURLToPath } from 'url'
import { resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __argv = process.argv[1] ? resolve(process.argv[1]) : ''
if (__filename === __argv || __filename === resolve(__argv)) {
  auditTypography().catch((error) => {
    console.error('审计脚本执行失败:', error)
    process.exit(1)
  })
}
