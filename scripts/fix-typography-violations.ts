#!/usr/bin/env tsx
/**
 * 自动修复硬编码字体值违规脚本
 * 
 * 修复目标：
 * 1. src/services/hybrid-proofread/reportGenerator.ts 第335-336行的硬编码 font-size
 * 
 * 使用方法：
 *   npx tsx scripts/fix-typography-violations.ts
 * 
 * 验证：
 *   npx tsx scripts/audit-typography.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { readTextAdaptive, writeTextUtf8 } from './lib/encoding'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const SRC = join(ROOT, 'src')

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const BLUE = '\x1b[34m'
const RESET = '\x1b[0m'

function logError(msg: string): void {
  console.error(`${RED}✗${RESET} ${msg}`)
}

function logWarn(msg: string): void {
  console.warn(`${YELLOW}⚠${RESET} ${msg}`)
}

function logSuccess(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

function logInfo(msg: string): void {
  console.log(`${BLUE}ℹ${RESET} ${msg}`)
}

interface FixResult {
  file: string
  fixed: boolean
  changes: Array<{ line: number; before: string; after: string }>
  errors: string[]
}

function fixReportGeneratorTypography(): FixResult {
  const filePath = join(SRC, 'services', 'hybrid-proofread', 'reportGenerator.ts')
  const changes: Array<{ line: number; before: string; after: string }> = []
  const errors: string[] = []

  try {
    const content = readTextAdaptive(filePath)
    const lines = content.split('\n')

    let hasTypographyScaleImport = false
    for (const line of lines) {
      if (line.includes('TYPOGRAPHY_SCALE') && line.includes('import')) {
        hasTypographyScaleImport = true
        break
      }
    }

    if (!hasTypographyScaleImport) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("import { COLOR_SHADES } from '@/constants/theme.tokens'")) {
          lines[i] = lines[i].replace(
            "import { COLOR_SHADES } from '@/constants/theme.tokens'",
            "import { COLOR_SHADES, TYPOGRAPHY_SCALE } from '@/constants/theme.tokens'"
          )
          changes.push({
            line: i + 1,
            before: "import { COLOR_SHADES } from '@/constants/theme.tokens'",
            after: "import { COLOR_SHADES, TYPOGRAPHY_SCALE } from '@/constants/theme.tokens'"
          })
          break
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.includes('.stat-value { font-size: 2rem; font-weight: bold; }')) {
        lines[i] = line.replace(
          '.stat-value { font-size: 2rem; font-weight: bold; }',
          '.stat-value { font-size: 24px; font-weight: 700; }'
        )
        changes.push({
          line: i + 1,
          before: '.stat-value { font-size: 2rem; font-weight: bold; }',
          after: '.stat-value { font-size: 24px; font-weight: 700; }'
        })
      }

      if (line.includes('.stat-label { font-size: 0.875rem; color: ${COLOR_SHADES.slate.hex[500]}; }')) {
        lines[i] = line.replace(
          '.stat-label { font-size: 0.875rem; color: ${COLOR_SHADES.slate.hex[500]}; }',
          '.stat-label { font-size: 13px; color: ${COLOR_SHADES.slate.hex[500]}; }'
        )
        changes.push({
          line: i + 1,
          before: '.stat-label { font-size: 0.875rem; color: ${COLOR_SHADES.slate.hex[500]}; }',
          after: '.stat-label { font-size: 13px; color: ${COLOR_SHADES.slate.hex[500]}; }'
        })
      }
    }

    writeFileSync(filePath, lines.join('\n'), 'utf-8')

  } catch (e) {
    errors.push(`文件操作失败: ${(e as Error).message}`)
  }

  return { file: filePath, fixed: changes.length > 0, changes, errors }
}

function main(): void {
  console.log('\n' + '='.repeat(80))
  console.log('硬编码字体值自动修复脚本')
  console.log('='.repeat(80) + '\n')

  logInfo('正在修复 reportGenerator.ts 中的硬编码字体值...')

  const result = fixReportGeneratorTypography()

  console.log('\n' + '-'.repeat(80))
  console.log('修复结果汇总')
  console.log('-'.repeat(80))

  if (result.errors.length > 0) {
    logError(`文件 ${result.file} 修复失败:`)
    for (const error of result.errors) {
      logError(`  ${error}`)
    }
  } else if (result.changes.length > 0) {
    logSuccess(`文件 ${result.file} 修复成功，共 ${result.changes.length} 处修改:`)
    for (const change of result.changes) {
      console.log(`\n  第 ${change.line} 行:`)
      console.log(`    之前: ${change.before}`)
      console.log(`    之后: ${change.after}`)
    }
    console.log('\n' + YELLOW + '💡 建议: 运行 `npx tsx scripts/audit-typography.ts` 验证修复结果' + RESET)
  } else {
    logWarn(`文件 ${result.file} 无需修复，未发现硬编码字体值`)
  }

  console.log('\n' + '='.repeat(80))
  process.exit(result.errors.length > 0 ? 1 : 0)
}

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false
if (isMainModule) {
  main()
}