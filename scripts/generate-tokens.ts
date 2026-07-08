#!/usr/bin/env tsx
/**
 * Design Tokens 生成器
 * 从 tokens.json 生成 TypeScript 和 CSS 变量
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

interface TokenValue {
  value: string
  type: string
}

interface TokenGroup {
  [key: string]: TokenValue | TokenGroup
}

interface Tokens {
  global: TokenGroup
  light: TokenGroup
  dark: TokenGroup
  semantic: TokenGroup
  chart: TokenGroup
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROOT = join(__dirname, '..')
const TOKENS_PATH = join(ROOT, 'design-tokens', 'tokens.json')
const OUTPUT_DIR = join(ROOT, 'src', 'generated')

// 解析引用 {global.color.red.500}
function resolveReference(value: string, tokens: Tokens): string {
  const match = value.match(/^\{(.+)\}$/)
  if (!match) return value

  const path = match[1]!.split('.')
  let current: any = tokens
  for (const key of path) {
    if (current[key] === undefined) {
      console.warn(`⚠️  引用未解析: ${value}`)
      return value
    }
    current = current[key]
  }

  if (current.value) {
    return resolveReference(current.value, tokens)
  }
  return current
}

// 展平嵌套对象为路径映射
function flattenTokens(group: TokenGroup, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(group)) {
    const path = prefix ? `${prefix}.${key}` : key

    if ('value' in value) {
      result[path] = value.value
    } else {
      Object.assign(result, flattenTokens(value as TokenGroup, path))
    }
  }

  return result
}

// 生成 CSS 变量
function generateCSS(tokens: Tokens): string {
  const lines: string[] = [
    '/* 自动生成 - 请勿手动编辑 */',
    '/* 源文件: design-tokens/tokens.json */',
    '',
  ]

  // 全局变量（基础色板）
  const globalFlat = flattenTokens(tokens.global)
  lines.push(':root {')
  for (const [path, value] of Object.entries(globalFlat)) {
    const resolved = resolveReference(value, tokens)
    const varName = path.replace(/\./g, '-')
    lines.push(`  --${varName}: ${resolved};`)
  }
  lines.push('}')
  lines.push('')

  // Light 主题
  const lightFlat = flattenTokens(tokens.light)
  lines.push('[data-theme="light"] {')
  for (const [path, value] of Object.entries(lightFlat)) {
    const resolved = resolveReference(value, tokens)
    const varName = path.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/\./g, '-')
    lines.push(`  --${varName}: ${resolved};`)
  }
  lines.push('}')
  lines.push('')

  // Dark 主题
  const darkFlat = flattenTokens(tokens.dark)
  lines.push('[data-theme="dark"] {')
  for (const [path, value] of Object.entries(darkFlat)) {
    const resolved = resolveReference(value, tokens)
    const varName = path.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/\./g, '-')
    lines.push(`  --${varName}: ${resolved};`)
  }
  lines.push('}')
  lines.push('')

  // 语义变量
  const semanticFlat = flattenTokens(tokens.semantic)
  lines.push(':root {')
  for (const [path, value] of Object.entries(semanticFlat)) {
    const resolved = resolveReference(value, tokens)
    const varName = path.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/\./g, '-')
    lines.push(`  --${varName}: ${resolved};`)
  }
  lines.push('}')

  return lines.join('\n')
}

// 生成 TypeScript 常量
function generateTypeScript(tokens: Tokens): string {
  const lines: string[] = [
    '/**',
    ' * 自动生成的 Design Tokens',
    ' * 源文件: design-tokens/tokens.json',
    ' * 生成时间: ' + new Date().toISOString(),
    ' * 请勿手动编辑此文件',
    ' */',
    '',
  ]

  // 生成全局色板
  lines.push('export const BASE_COLORS = {')
  const globalColors = tokens.global.color?.base || {}
  for (const [colorName, shades] of Object.entries(globalColors)) {
    lines.push(`  ${colorName}: {`)
    for (const [shade, token] of Object.entries(shades as TokenGroup)) {
      if ('value' in token) {
        lines.push(`    ${shade}: '${(token as TokenValue).value}',`)
      }
    }
    lines.push('  },')
  }
  lines.push('} as const')
  lines.push('')

  // 生成语义令牌
  lines.push('export const SEMANTIC_COLORS = {')
  const semanticFlat = flattenTokens(tokens.semantic)
  for (const [path, value] of Object.entries(semanticFlat)) {
    const resolved = resolveReference(value, tokens)
    const key = path.replace(/\./g, '_')
    lines.push(`  ${key}: '${resolved}',`)
  }
  lines.push('} as const')
  lines.push('')

  // 生成图表令牌
  lines.push('export const CHART_TOKENS = {')
  const chartFlat = flattenTokens(tokens.chart)
  for (const [path, value] of Object.entries(chartFlat)) {
    const resolved = resolveReference(value, tokens)
    const key = path.replace(/\./g, '_')
    lines.push(`  ${key}: '${resolved}',`)
  }
  lines.push('} as const')
  lines.push('')

  // 生成间距令牌
  lines.push('export const SPACING = {')
  const spacingFlat = flattenTokens(tokens.global.spacing || {} ?? '')
  for (const [key, value] of Object.entries(spacingFlat)) {
    lines.push(`  ${key}: '${value}',`)
  }
  lines.push('} as const')
  lines.push('')

  // 生成字体大小令牌
  lines.push('export const FONT_SIZE = {')
  const fontSizeFlat = flattenTokens(tokens.global.fontSize || {} ?? '')
  for (const [key, value] of Object.entries(fontSizeFlat)) {
    lines.push(`  ${key}: '${value}',`)
  }
  lines.push('} as const')
  lines.push('')

  // 生成圆角令牌
  lines.push('export const BORDER_RADIUS = {')
  const borderRadiusFlat = flattenTokens(tokens.global.borderRadius || {} ?? '')
  for (const [key, value] of Object.entries(borderRadiusFlat)) {
    lines.push(`  ${key}: '${value}',`)
  }
  lines.push('} as const')

  return lines.join('\n')
}

// 主函数
function main() {
  console.log('🎨 开始生成 Design Tokens...\n')

  // 读取源文件
  const tokensContent = readFileSync(TOKENS_PATH, 'utf-8')
  const tokens = JSON.parse(tokensContent) as Tokens

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // 生成 CSS
  const css = generateCSS(tokens)
  const cssPath = join(OUTPUT_DIR, 'tokens.css')
  writeFileSync(cssPath, css)
  console.log(`✅ CSS 变量已生成: ${cssPath}`)

  // 生成 TypeScript
  const ts = generateTypeScript(tokens)
  const tsPath = join(OUTPUT_DIR, 'tokens.ts')
  writeFileSync(tsPath, ts)
  console.log(`✅ TypeScript 常量已生成: ${tsPath}`)

  console.log('\n✨ Design Tokens 生成完成!')
}

main()
