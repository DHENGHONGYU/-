/**
 * 间距系统合规性审计脚本
 * 检查所有组件文件中的硬编码间距值
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

// 允许的间距值（4px 栅格系统）
const VALID_SPACING_VALUES = new Set([
  '0', '0px',
  '1px',
  '2px',
  '3px',
  '4px',
  '6px',
  '8px',
  '10px',
  '12px',
  '14px',
  '16px',
  '20px',
  '24px',
  '28px',
  '32px',
  '40px',
  '48px',
  '56px',
  '64px',
  '80px',
  '96px',
  '112px',
  '128px',
])

// Tailwind 标准间距类（允许使用）
const TAILWIND_SPACING_PATTERNS = [
  /(?:p|m|gap|space-[xy])-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)\b/,
  /(?:px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)\b/,
]

// 硬编码间距正则（需要检查）
const HARDCODED_SPACING_REGEX = /(?:padding|margin|gap|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height):\s*(\d+(?:\.\d+)?)px/g

interface Violation {
  file: string
  line: number
  column: number
  value: string
  context: string
}

async function auditSpacing(): Promise<void> {
  console.log('🔍 开始间距系统合规性检查...\n')

  const files = await glob('src/**/*.{tsx,ts}', {
    ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**', '**/dist/**', 'src/constants/**'],
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

      // 检查硬编码间距
      let match
      const regex = new RegExp(HARDCODED_SPACING_REGEX)
      
      while ((match = regex.exec(line)) !== null) {
        const value = match[1] + 'px'
        
        // 检查是否在 Tailwind 类名中（允许）
        const isInTailwindClass = TAILWIND_SPACING_PATTERNS.some((p) => p.test(line))
        
        if (!isInTailwindClass && !VALID_SPACING_VALUES.has(value)) {
          violations.push({
            file,
            line: index + 1,
            column: match.index + 1,
            value,
            context: line.trim(),
          })
        }
      }
    })
  }

  // 输出结果
  if (violations.length === 0) {
    console.log('✅ 间距系统合规检查通过！未发现硬编码间距。\n')
    process.exit(0)
  } else {
    console.error(`❌ 发现 ${violations.length} 处间距违规：\n`)
    
    violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.file}:${v.line}:${v.column}`)
      console.error(`   值: ${v.value}`)
      console.error(`   上下文: ${v.context}\n`)
    })

    console.error('\n💡 建议：')
    console.error('   - 使用 Tailwind CSS 的标准间距类（如 p-4, m-2, gap-3）')
    console.error('   - 或使用 theme.tokens.ts 中定义的间距常量')
    console.error('   - 参考 src/constants/theme.tokens.ts\n')

    process.exit(1)
  }
}

auditSpacing().catch((error) => {
  console.error('审计脚本执行失败:', error)
  process.exit(1)
})
