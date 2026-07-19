#!/usr/bin/env tsx
/**
 * @fileoverview 颜色令牌单源守护门禁
 *
 * 校验「运行时权威源」src/index.css 的语义色 HSL，与「图表取色源」
 * src/constants/theme/theme.tokens.design.ts 的 SEMANTIC_COLOR_ROLES.<role>.raw
 * 在亮色模式下是否一致。任一角色 HEX 不等即 exit 1，防止多源颜色再次漂移。
 *
 * 背景：V9 设计系统曾出现主色 4 值分裂（index.css / SEMANTIC.raw / tokens.json /
 * 文档），历史多次手动整改均半途而废。本门禁把「index.css 为唯一事实源」从约定
 * 变成可自动守护的工程约束。
 *
 * 用法：tsx scripts/verify-color-single-source.ts [--check-only]
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const INDEX_CSS = resolve(rootDir, 'src', 'index.css')
const DESIGN_TS = resolve(rootDir, 'src', 'constants', 'theme', 'theme.tokens.design.ts')

/** index.css 变量名 → SEMANTIC_COLOR_ROLES 角色键 */
const ROLE_MAP: Record<string, string> = {
  '--primary': 'primary',
  '--success': 'success',
  '--warning': 'warning',
  '--destructive': 'danger',
  '--info': 'info',
}

interface Mismatch {
  role: string
  indexCssHex: string
  rawHex: string
}

/** HSL "H S% L%" → "#RRGGBB"（大写） */
function hslStringToHex(hsl: string): string {
  const m = hsl.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!m) throw new Error(`无法解析 HSL: "${hsl}"`)
  const h = parseFloat(m[1]!)
  const s = parseFloat(m[2]!) / 100
  const l = parseFloat(m[3]!) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m2 = l - c / 2
  const toHex = (v: number) =>
    Math.round((v + m2) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${(toHex(r) + toHex(g) + toHex(b)).toUpperCase()}`
}

/** 提取 index.css :root 块中各语义变量的 HSL */
function parseIndexCss(): Record<string, string> {
  const css = readFileSync(INDEX_CSS, 'utf-8')
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/)
  if (!rootMatch) throw new Error('index.css 未找到 :root 块')
  const block = rootMatch[1]!
  const result: Record<string, string> = {}
  for (const varName of Object.keys(ROLE_MAP)) {
    const re = new RegExp(`${varName}\\s*:\\s*([^;]+);`)
    const m = block.match(re)
    if (!m) throw new Error(`index.css :root 未找到 ${varName}`)
    result[varName] = hslStringToHex(m[1]!)
  }
  return result
}

/** 提取 SEMANTIC_COLOR_ROLES.<role>.raw 的 HEX */
function parseDesignTs(): Record<string, string> {
  const ts = readFileSync(DESIGN_TS, 'utf-8')
  const result: Record<string, string> = {}
  for (const role of Object.values(ROLE_MAP)) {
    const re = new RegExp(`${role}\\s*:\\s*\\{[\\s\\S]*?raw:\\s*'(#[0-9a-fA-F]{6})'`)
    const m = ts.match(re)
    if (!m) throw new Error(`theme.tokens.design.ts 未找到 SEMANTIC_COLOR_ROLES.${role}.raw`)
    result[role] = m[1]!.toUpperCase()
  }
  return result
}

function main(): void {
  if (!existsSync(INDEX_CSS) || !existsSync(DESIGN_TS)) {
    console.error('❌ 颜色单源校验：源文件缺失')
    process.exit(1)
  }

  const indexVars = parseIndexCss()
  const rawRoles = parseDesignTs()
  const mismatches: Mismatch[] = []

  for (const [varName, role] of Object.entries(ROLE_MAP)) {
    const indexHex = indexVars[varName]!
    const rawHex = rawRoles[role]!
    if (indexHex.toLowerCase() !== rawHex.toLowerCase()) {
      mismatches.push({ role, indexCssHex: indexHex, rawHex })
    }
  }

  if (mismatches.length > 0) {
    console.error('❌ 颜色单源校验失败：index.css 与 SEMANTIC_COLOR_ROLES.raw 不一致\n')
    for (const mm of mismatches) {
      console.error(`  - ${mm.role}: index.css=${mm.indexCssHex}  raw=${mm.rawHex}`)
    }
    console.error('\n💡 请以 src/index.css 的 :root HSL 为唯一事实源，将 SEMANTIC_COLOR_ROLES.<role>.raw 对齐。')
    process.exit(1)
  }

  console.log('✅ 颜色单源校验通过：index.css ↔ SEMANTIC_COLOR_ROLES.raw 五个语义色一致')
  console.log(
    `   primary=${indexVars['--primary']} success=${indexVars['--success']} warning=${indexVars['--warning']} danger=${indexVars['--destructive']} info=${indexVars['--info']}`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, '/') === resolve(process.argv[1]!).replace(/\\/g, '/')) {
  main()
}

export { hslStringToHex, parseIndexCss, parseDesignTs }
