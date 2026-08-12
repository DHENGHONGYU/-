/**
 * @fileoverview 常量文件自动拆分脚本
 *
 * 自动将 uiText.ts 和 theme.tokens.ts 拆分为子模块 + barrel re-export
 *
 * 用法: npx tsx scripts/split-constants.ts
 *
 * @module scripts/split-constants
 * @created 2026-07-07
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`  [创建目录] ${path.relative(PROJECT_ROOT, dir)}`)
  }
}

function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8')
  const lines = content.split('\n').length
  console.log(`  [写入] ${path.relative(PROJECT_ROOT, filePath)} (${lines} 行)`)
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

// ============================================================
// uiText.ts 拆分
// ============================================================

function splitUiText(): void {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  拆分 uiText.ts → src/constants/uiText/ 子目录')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const srcPath = path.join(PROJECT_ROOT, 'src', 'constants', 'uiText.ts')
  const targetDir = path.join(PROJECT_ROOT, 'src', 'constants', 'uiText')

  if (!fs.existsSync(srcPath)) {
    console.log('  [跳过] uiText.ts 不存在')
    return
  }

  const content = readFile(srcPath)
  const lines = content.split('\n')

  // 识别顶层分组: ^  [a-zA-Z]\w*: {
  const sections: Array<{ name: string; startLine: number; endLine: number }> = []
  const sectionRegex = /^  ([a-zA-Z]\w*):\s*\{/

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(sectionRegex)
    if (match) {
      sections.push({ name: match[1]!, startLine: i, endLine: -1 })
    }
  }

  // 计算每个分组的结束行
  for (let i = 0; i < sections.length; i++) {
    const next = i + 1 < sections.length ? sections[i + 1]!.startLine : lines.length - 1
    sections[i]!.endLine = next - 1
  }

  console.log(`  识别到 ${sections.length} 个顶层分组:`)
  for (const s of sections) {
    console.log(`    - ${s.name}: 行 ${s.startLine + 1}-${s.endLine + 1} (${s.endLine - s.startLine + 1} 行)`)
  }

  ensureDir(targetDir)

  // 为每个分组创建子文件
  for (const section of sections) {
    const sectionLines = lines.slice(section.startLine, section.endLine + 1)
    const sectionContent = sectionLines.join('\n')

    const fileName = `uiText.${section.name}.ts`
    const filePath = path.join(targetDir, fileName)

    const fileContent = `/**
 * @fileoverview UI 文本常量 — ${section.name} 分组
 *
 * 从 uiText.ts 拆分而来，职责：${section.name} 业务域的 UI 文本常量
 *
 * @module constants/uiText/uiText.${section.name}
 * @created 2026-07-07 - 从 uiText.ts 拆分
 */

export const ${section.name} = ${sectionContent.trim()}
`

    writeFile(filePath, fileContent)
  }

  // 创建 barrel re-export
  const barrelPath = path.join(PROJECT_ROOT, 'src', 'constants', 'uiText.ts')
  const importStatements = sections
    .map((s) => `import { ${s.name} } from './uiText/uiText.${s.name}'`)
    .join('\n')

  const assemblyStatements = sections.map((s) => `  ${s.name},`).join('\n')

  const barrelContent = `/**
 * @fileoverview UI 文本常量（barrel re-export）
 *
 * 原单文件 uiText.ts（1192 行），现拆分为 ${sections.length} 个子模块，本文件作为统一入口。
 *
 * 拆分结构（2026-07-07）：
${sections.map((s) => ` * - uiText/${s.name}.ts: ${s.name} 业务域文本`).join('\n')}
 * - uiText.ts（本文件）: barrel re-export，保持原 API 兼容
 *
 * @module constants/uiText
 * @updated 2026-07-07 - 拆分为多模块，保持原 API 兼容
 */

${importStatements}

export const UI_TEXT = {
${assemblyStatements}
} as const

export type UiTextKey = keyof typeof UI_TEXT
`

  writeFile(barrelPath, barrelContent)
  console.log(`\n  [完成] uiText.ts 拆分为 ${sections.length} 个子文件 + barrel`)
}

// ============================================================
// theme.tokens.ts 拆分
// ============================================================

function splitThemeTokens(): void {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  拆分 theme.tokens.ts → src/constants/theme/ 子目录')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const srcPath = path.join(PROJECT_ROOT, 'src', 'constants', 'theme.tokens.ts')
  const targetDir = path.join(PROJECT_ROOT, 'src', 'constants', 'theme')

  if (!fs.existsSync(srcPath)) {
    console.log('  [跳过] theme.tokens.ts 不存在')
    return
  }

  const content = readFile(srcPath)
  const lines = content.split('\n')

  // 定义导出块边界（基于已分析的结构）
  const blocks: Array<{
    name: string
    fileName: string
    startLine: number
    endLine: number
    exports: string[]
    description: string
  }> = []

  // 查找所有 export 声明的行号
  const exportRegex = /^export\s+(const|function|type|class)\s+(\w+)/
  const exportLines: Array<{ line: number; name: string; type: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(exportRegex)
    if (match) {
      exportLines.push({ line: i, name: match[2]!, type: match[1]! })
    }
  }

  // 按业务逻辑分组导出块
  const groups = [
    {
      name: 'base',
      fileName: 'theme.tokens.base.ts',
      exports: ['THEME_TOKENS'],
      description: 'L1 基础令牌（通用语义色+尺寸+间距+圆角+排版）',
      findStart: () => lines.findIndex((l) => l.match(/^export const THEME_TOKENS/)),
    },
    {
      name: 'color',
      fileName: 'theme.tokens.color.ts',
      exports: ['COLOR_TOKENS', 'getColorHex', 'getColorTailwind', 'getColorBgClass'],
      description: 'L2 语义色（业务语义色：涨跌/评分/信号/背景/文字/边框）',
      findStart: () => lines.findIndex((l) => l.match(/^export const COLOR_TOKENS/)),
    },
    {
      name: 'shades',
      fileName: 'theme.tokens.shades.ts',
      exports: ['COLOR_SHADES', 'SEMANTIC_COLORS', 'twText', 'twBg', 'twBorder'],
      description: 'L3 色阶 + 辅助函数（特定色阶 + twText/twBg/twBorder）',
      findStart: () => lines.findIndex((l) => l.match(/^export const COLOR_SHADES/)),
    },
    {
      name: 'helpers',
      fileName: 'theme.tokens.helpers.ts',
      exports: ['DARK', 'HOVER', 'GRADIENT', 'CHART_PALETTE', 'SPACING_TOKENS'],
      description: 'L3/4 辅助类（暗色/悬停/渐变 + 图表调色板 + 间距令牌）',
      findStart: () => lines.findIndex((l) => l.match(/^export const DARK/)),
    },
    {
      name: 'stock',
      fileName: 'theme.tokens.stock.ts',
      exports: [
        'STOCK_COLOR_TOKENS',
        'getStockColor',
        'getStockColorClass',
        'getStockColorHex',
        'getStockColorBg',
      ],
      description: 'L5 股票颜色（红涨绿跌例外规则，豁免主题切换）',
      findStart: () => lines.findIndex((l) => l.match(/^export const STOCK_COLOR_TOKENS/)),
    },
    {
      name: 'design',
      fileName: 'theme.tokens.design.ts',
      exports: ['SEMANTIC_COLOR_ROLES', 'TYPOGRAPHY_SCALE', 'ELEVATION'],
      description: 'L6 设计系统（语义色角色 + 排版阶梯 + 层级阴影）',
      findStart: () => lines.findIndex((l) => l.match(/^export const SEMANTIC_COLOR_ROLES/)),
    },
  ]

  // 为每个分组确定行范围
  for (const group of groups) {
    const startLine = group.findStart()
    if (startLine === -1) {
      console.log(`  [警告] 未找到 ${group.name} 分组`)
      continue
    }

    // 向上查找注释块开头
    let commentStart = startLine
    for (let i = startLine - 1; i >= 0; i--) {
      const line = lines[i]!.trim()
      if (line === '' || line.startsWith('/**') || line.startsWith('*') || line.startsWith('*/') || line.startsWith('//')) {
        commentStart = i
      } else {
        break
      }
    }

    // 向下查找下一个 export 块的开头
    let endLine = lines.length - 1
    for (const other of groups) {
      if (other.name === group.name) continue
      const otherStart = other.findStart()
      if (otherStart > startLine && otherStart < endLine) {
        endLine = otherStart - 1
      }
    }

    // 去除尾部空行
    while (endLine > startLine && lines[endLine]!.trim() === '') {
      endLine--
    }

    blocks.push({
      name: group.name,
      fileName: group.fileName,
      startLine: commentStart,
      endLine: endLine,
      exports: group.exports,
      description: group.description,
    })
  }

  // 收集所有类型定义到 types 文件
  const typeExports = exportLines.filter((e) => e.type === 'type')
  const typesBlock = {
    name: 'types',
    fileName: 'theme.tokens.types.ts',
    startLine: -1,
    endLine: -1,
    exports: typeExports.map((t) => t.name),
    description: '所有类型定义（集中管理）',
  }

  console.log(`  识别到 ${blocks.length} 个导出块分组:`)
  for (const b of blocks) {
    console.log(
      `    - ${b.name}: 行 ${b.startLine + 1}-${b.endLine + 1} (${b.endLine - b.startLine + 1} 行) exports: [${b.exports.join(', ')}]`,
    )
  }
  console.log(`    - types: ${typeExports.length} 个类型导出`)

  ensureDir(targetDir)

  // 为每个分组创建子文件
  for (const block of blocks) {
    const sectionLines = lines.slice(block.startLine, block.endLine + 1)
    let sectionContent = sectionLines.join('\n').trim()

    // 确保所有声明都是 export 的
    const filePath = path.join(targetDir, block.fileName)

    const fileContent = `/**
 * @fileoverview ${block.description}
 *
 * 从 theme.tokens.ts 拆分而来。
 *
 * @module constants/theme/${block.name}
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
 */

${sectionContent}
`

    writeFile(filePath, fileContent)
  }

  // 创建类型文件 — 收集所有 export type 声明
  const typeLines: string[] = []
  for (const typeExp of typeExports) {
    // 查找类型声明的完整行
    const line = lines[typeExp.line]!
    typeLines.push(line)
  }

  const typesFilePath = path.join(targetDir, typesBlock.fileName)
  const typesContent = `/**
 * @fileoverview ${typesBlock.description}
 *
 * 从 theme.tokens.ts 拆分而来，集中所有类型导出。
 *
 * @module constants/theme/types
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
 */

${typeLines.join('\n')}
`
  writeFile(typesFilePath, typesContent)

  // 创建 barrel re-export
  const barrelPath = path.join(PROJECT_ROOT, 'src', 'constants', 'theme.tokens.ts')
  const reExportStatements = blocks
    .map(
      (b) =>
        `export { ${b.exports.join(', ')} } from './theme/${b.fileName.replace('.ts', '')}'`,
    )
    .join('\n')

  const typeNames = typeExports.map((t) => t.name).join(', ')
  const barrelContent = `/**
 * @fileoverview 主题令牌（barrel re-export）
 *
 * 原单文件 theme.tokens.ts（1114+ 行），现拆分为 ${blocks.length} 个子模块 + 1 个类型文件。
 * 本文件作为统一入口，保持原 API 兼容。
 *
 * 拆分结构（2026-07-07）：
${blocks.map((b) => ` * - theme/${b.fileName}: ${b.description}`).join('\n')}
 * - theme/theme.tokens.types.ts: 类型定义集中管理
 * - theme.tokens.ts（本文件）: barrel re-export
 *
 * 令牌层次结构：
 * - L1 基础令牌（THEME_TOKENS）
 * - L2 语义色（COLOR_TOKENS）
 * - L3 色阶（COLOR_SHADES + twText/twBg/twBorder）
 * - L4 图表（CHART_PALETTE）
 * - L5 股票颜色（STOCK_COLOR_TOKENS，红涨绿跌例外）
 * - L6 设计系统（SEMANTIC_COLOR_ROLES + TYPOGRAPHY_SCALE + ELEVATION）
 *
 * @module constants/theme.tokens
 * @updated 2026-07-07 - 拆分为多模块，保持原 API 兼容
 */

// L1 基础令牌
export { THEME_TOKENS } from '../../src/theme/theme.tokens.base'

// L2 语义色
export { COLOR_TOKENS, getColorHex, getColorTailwind, getColorBgClass } from '../../src/theme/theme.tokens.color'

// L3 色阶 + 辅助函数
export { COLOR_SHADES, SEMANTIC_COLORS, twText, twBg, twBorder } from '../../src/theme/theme.tokens.shades'

// L3/4 辅助类
export { DARK, HOVER, GRADIENT, CHART_PALETTE, SPACING_TOKENS } from './theme/theme.tokens.helpers'

// L5 股票颜色（红涨绿跌例外规则，豁免主题切换）
export {
  STOCK_COLOR_TOKENS,
  getStockColor,
  getStockColorClass,
  getStockColorHex,
  getStockColorBg,
} from './theme/theme.tokens.stock'

// L6 设计系统
export { SEMANTIC_COLOR_ROLES, TYPOGRAPHY_SCALE, ELEVATION } from './theme/theme.tokens.design'

// 类型导出
export type {
  ThemeColorToken,
  SpacingKey,
  ColorTokenKey,
  ThemeIconSizeToken,
  ThemeControlSizeToken,
  ThemeSpacingToken,
  ThemeRadiusToken,
  ThemeGapToken,
  ThemeStackGapToken,
  ThemeScoreThresholdToken,
  StockColorTokenKey,
  SemanticColorRole,
  TypographyRole,
} from './theme/theme.tokens.types'
`

  writeFile(barrelPath, barrelContent)
  console.log(`\n  [完成] theme.tokens.ts 拆分为 ${blocks.length} 个子文件 + types + barrel`)
}

// ============================================================
// 主入口
// ============================================================

function main(): void {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  常量文件自动拆分脚本')
  console.log('  目标: uiText.ts + theme.tokens.ts')
  console.log('  策略: 按业务域/令牌层级拆分 + barrel re-export')
  console.log('═══════════════════════════════════════════════════════════════')

  splitUiText()
  splitThemeTokens()

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  拆分完成！请执行以下验证：')
  console.log('  1. npx tsc --noEmit')
  console.log('  2. npx madge --circular --extensions ts src/constants/')
  console.log('  3. npx vitest run src/constants/ src/components/ src/pages/')
  console.log('═══════════════════════════════════════════════════════════════')
}

main()
