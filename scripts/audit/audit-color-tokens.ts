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

/**
 * 判断某颜色匹配位置是否位于模板字面量 ${...} 内（如 rgba(${COLOR_TOKENS.x.rgb}, ...)）。
 * 这类拼装实际引用的是设计令牌，应豁免硬编码颜色告警（修复 2026-07-24 误报）。
 */
function isInsideTemplateToken(line: string, colorIdx: number): boolean {
  const open = line.lastIndexOf('${', colorIdx)
  if (open === -1) return false
  const close = line.indexOf('}', open)
  if (close === -1) return false
  return colorIdx > open && colorIdx < close
}

/** 颜色令牌的权威源文件，其内部颜色定义是单源真相，豁免扫描 */
const TOKEN_SOURCE_FILES = new Set([
  'src/constants/theme.tokens.ts',
  'src/constants/theme.tokens.design.ts',
  'src/constants/theme/theme.tokens.base.ts',
  'src/constants/theme/theme.tokens.color.ts',
  'src/constants/theme/theme.tokens.shades.ts',
  'src/constants/theme/theme.tokens.helpers.ts',
  'src/constants/theme/theme.tokens.stock.ts',
  'src/constants/theme/theme.tokens.design.ts',
  'src/config/chartColors.ts',
  'src/config/sectorHeatmapConfig.ts',
])

export async function scan(): Promise<AuditReport> {
  const files = await glob('src/**/*.{tsx,ts}', {
    ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**', '**/dist/**'],
  })

  const violations: Violation[] = []
  const warnings: string[] = []

  for (const file of files) {
    // 统一路径分隔符（Windows glob 返回反斜杠，与 TOKEN_SOURCE_FILES 的正斜杠对齐）
    const normalizedFile = file.replace(/\\/g, '/')
    // 令牌源文件本身是颜色定义的权威来源，豁免扫描
    if (TOKEN_SOURCE_FILES.has(normalizedFile)) continue
    try {
      const content = await readFile(resolve(process.cwd(), file), 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return
        }
        // 引用令牌（COLOR_TOKENS / SEMANTIC_COLOR_ROLES / theme.tokens）的行视为已令牌化，豁免
        if (line.includes('COLOR_TOKENS') || line.includes('SEMANTIC_COLOR_ROLES') || line.includes('theme.tokens')) {
          return
        }

        HARDCODED_COLOR_PATTERNS.forEach((pattern) => {
          const matches = line.match(pattern)
          if (matches) {
            matches.forEach((color) => {
              const colorIdx = line.indexOf(color)
              // 颜色位于模板字面量 ${...} 内（如 rgba(${COLOR_TOKENS.x.rgb}, ...)）视为令牌拼装，豁免
              if (isInsideTemplateToken(line, colorIdx)) return
              // 豁免 1：CSS 变量语义引用（如 hsl(var(--success))，是 shadcn/ui 主题切换机制）
              if (color.startsWith('hsl(var(--')) return
              // 豁免 2：动态 rgba/rgb 生成（如 hexToRgba 函数内部的模板字符串）
              if (color.startsWith('rgba(${') || color.startsWith('rgb(${')) return
              const isInTailwindClass = TAILWIND_COLOR_PATTERNS.some((p) => p.test(line))
              const isVariable = line.includes('const ') || line.includes('let ') || line.includes('var ')

              if (!isInTailwindClass && !isVariable) {
                violations.push({
                  file,
                  line: index + 1,
                  column: colorIdx + 1,
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

import { pathToFileURL } from 'node:url'

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  auditColorTokens().catch((error) => {
    console.error('审计脚本执行失败:', error)
    process.exit(1)
  })
}
