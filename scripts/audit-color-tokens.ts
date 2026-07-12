/**
 * 颜色系统合规性审计脚本
 * 检查所有组件文件中的硬编码颜色值
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

// Tailwind 标准颜色类（允许使用）
const TAILWIND_COLOR_PATTERNS = [
  // 文本颜色
  /text-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  // 背景颜色
  /bg-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  // 边框颜色
  /border-(?:primary|secondary|muted|accent|destructive|background|foreground|card|popover|border|input|ring)/,
  // 不透明度变体
  /\/(?:5|10|20|30|40|50|60|70|80|90|95|100)/,
]

// 硬编码颜色正则（需要检查）
const HARDCODED_COLOR_PATTERNS = [
  // HEX 颜色
  /#[0-9a-fA-F]{3,8}\b/g,
  // RGB/RGBA
  /rgba?\([^)]+\)/g,
  // HSL/HSLA
  /hsla?\([^)]+\)/g,
]

interface Violation {
  file: string
  line: number
  column: number
  color: string
  context: string
}

async function auditColorTokens(): Promise<void> {
  console.log('🔍 开始颜色系统合规性检查...\n')

  const files = await glob('src/**/*.{tsx,ts}', {
    ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**', '**/dist/**'],
  })

  const violations: Violation[] = []

  for (const file of files) {
    const content = await readFile(resolve(process.cwd(), file), 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // 跳过注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return
      }

      // 检查硬编码颜色
      HARDCODED_COLOR_PATTERNS.forEach((pattern) => {
        const matches = line.match(pattern)
        if (matches) {
          matches.forEach((color) => {
            // 检查是否在 Tailwind 类名中（允许）
            const isInTailwindClass = TAILWIND_COLOR_PATTERNS.some((p) => p.test(line))
            
            // 检查是否在字符串模板或变量中（可能允许）
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
  }

  // 输出结果
  if (violations.length === 0) {
    console.log('✅ 颜色系统合规检查通过！未发现硬编码颜色。\n')
    process.exit(0)
  } else {
    console.error(`❌ 发现 ${violations.length} 处颜色违规：\n`)
    
    violations.forEach((v, i) => {
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

auditColorTokens().catch((error) => {
  console.error('审计脚本执行失败:', error)
  process.exit(1)
})
