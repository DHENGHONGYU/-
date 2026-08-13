#!/usr/bin/env tsx
/**
 * @fileoverview migrate-metriccard-hex-to-token.ts
 *
 * 扫描 src/ 下所有 .ts/.tsx 源文件（排除 .test./.spec.），
 * 将 MetricCard 组件使用处的 color="#XXXXXX" HEX 字面量
 * 替换为最接近的 ColorTokenKey（基于 RGB 欧氏距离）。
 *
 * 目标 Token 映射来自 src/constants/theme/theme.tokens.color.ts 的 COLOR_TOKENS 子集
 * （danger / success / warning / info / emerald / scoreHigh / scoreMid / scoreLow /
 *  up / down / orange / purple / cyan / pink / teal / indigo / neutral）。
 *
 * 用法：
 *   npx tsx scripts/audit/migrate-metriccard-hex-to-token.ts          # dry-run（默认，仅输出报告）
 *   npx tsx scripts/audit/migrate-metriccard-hex-to-token.ts --write   # 实际写入修改
 *
 * 注意：当多个 Token 的 HEX 相同（如 danger / scoreLow / up 均为 #ef4444），
 * 按下方 TARGET_TOKENS 声明顺序选择第一个（精确匹配时距离为 0）。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

// ============================================================
// 目标 Token 映射（HEX 来自 COLOR_TOKENS，RGB 由 hexToRgb 推导，避免手算错误）
// ============================================================
type TargetToken = { key: string; hex: string; rgb: [number, number, number] }

const TARGET_TOKENS: ReadonlyArray<TargetToken> = ([
  { key: 'danger',    hex: '#ef4444' },
  { key: 'success',   hex: '#21c45d' },
  { key: 'warning',   hex: '#f59e0b' },
  { key: 'info',      hex: '#3b82f6' },
  { key: 'emerald',   hex: '#10b981' },
  { key: 'scoreHigh', hex: '#22c55e' },
  { key: 'scoreMid',  hex: '#f59e0b' },
  { key: 'scoreLow',  hex: '#ef4444' },
  { key: 'up',        hex: '#ef4444' },
  { key: 'down',      hex: '#22c55e' },
  { key: 'orange',    hex: '#f97316' },
  { key: 'purple',    hex: '#8b5cf6' },
  { key: 'cyan',      hex: '#06b6d4' },
  { key: 'pink',      hex: '#ec4899' },
  { key: 'teal',      hex: '#14b8a6' },
  { key: 'indigo',    hex: '#6366f1' },
  { key: 'neutral',   hex: '#9ca3af' },
] as const).map((t) => ({ key: t.key, hex: t.hex, rgb: hexToRgb(t.hex) }))

// ============================================================
// 工具函数
// ============================================================

/** #RRGGBB → [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** RGB 欧氏距离 */
function rgbDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** 四舍五入到指定小数位 */
function round(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

/** 为给定 HEX 找最近 Token（距离相等时保留先声明的） */
function findNearestToken(
  hex: string,
): { key: string; hex: string; distance: number } | null {
  const rgb = hexToRgb(hex)
  let best: { key: string; hex: string; distance: number } | null = null
  for (const t of TARGET_TOKENS) {
    const d = rgbDistance(rgb, t.rgb)
    if (best === null || d < best.distance) {
      best = { key: t.key, hex: t.hex, distance: d }
    }
  }
  return best
}

/** 递归收集 .ts/.tsx 文件（排除 .test./.spec.） */
function walk(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec)\./.test(ent.name)) {
      out.push(full)
    }
  }
  return out
}

/** 预计算每行起始偏移，用于 O(log n) 行号查询 */
function buildLineIndex(content: string): number[] {
  const lines = [0]
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lines.push(i + 1)
  }
  return lines
}

/** 二分查找 offset 所在行号（1-based） */
function lineOf(lines: number[], offset: number): number {
  let lo = 0
  let hi = lines.length - 1
  let res = 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid] <= offset) {
      res = mid + 1
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return res
}

// ============================================================
// 匹配
// ============================================================

/**
 * 匹配 <MetricCard ... color="#XXXXXX" /> 中的 HEX 字面量。
 * - `[^>]*?` 将匹配范围限制在同一个 MetricCard 开标签内（跨行）。
 * - 支持 `color="#xxxxxx"` 与 `color='#xxxxxx'` 两种引号形式。
 * - `d` 标志用于获取捕获组在原文中的精确偏移，便于 --write 仅替换 HEX 值本身。
 */
const METRICCARD_COLOR_HEX_RE = /<MetricCard\b[^>]*?\bcolor\s*=\s*(['"])(#[0-9a-fA-F]{6})\1/gid

interface Finding {
  file: string       // 相对路径（posix 风格）
  line: number       // HEX 所在行（1-based）
  hex: string        // 原 HEX（小写，如 #10b981）
  tokenKey: string   // 建议 TokenKey
  tokenHex: string   // Token 的 HEX
  distance: number   // 欧氏距离（4 位小数）
  lineText: string   // 该行原文（trim，便于人工核对）
  hexStart: number   // HEX 在文件内容中的起始偏移
  hexEnd: number     // HEX 在文件内容中的结束偏移
}

function scanFile(file: string, content: string): Finding[] {
  const findings: Finding[] = []
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const lineIndex = buildLineIndex(content)
  const lines = content.split('\n')

  METRICCARD_COLOR_HEX_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = METRICCARD_COLOR_HEX_RE.exec(content)) !== null) {
    const hexRaw = m[2] // #XXXXXX
    const hex = hexRaw.toLowerCase()
    const indices = m.indices
    if (!indices) continue
    const hexRange = indices[2]
    if (!hexRange) continue
    const [hexStart, hexEnd] = hexRange

    const line = lineOf(lineIndex, hexStart)
    const lineText = (lines[line - 1] ?? '').trim()
    const nearest = findNearestToken(hex)
    if (!nearest) continue

    findings.push({
      file: rel,
      line,
      hex,
      tokenKey: nearest.key,
      tokenHex: nearest.hex,
      distance: round(nearest.distance, 4),
      lineText,
      hexStart,
      hexEnd,
    })
  }
  return findings
}

// ============================================================
// 写入
// ============================================================

/**
 * 按 hexStart 降序替换 HEX → tokenKey。
 * 仅替换 HEX 值本身（#xxxxxx → tokenKey），保留 `color="`、空格与引号，最小化 diff。
 */
function applyWrites(findings: Finding[]): number {
  const byFile = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file)!.push(f)
  }
  let written = 0
  for (const [relPath, finds] of byFile) {
    const abs = path.join(ROOT, relPath)
    let content = fs.readFileSync(abs, 'utf8')
    // 从后往前替换，避免偏移变化影响后续替换
    const sorted = [...finds].sort((a, b) => b.hexStart - a.hexStart)
    for (const f of sorted) {
      content = content.slice(0, f.hexStart) + f.tokenKey + content.slice(f.hexEnd)
      written++
    }
    fs.writeFileSync(abs, content, 'utf8')
  }
  return written
}

// ============================================================
// 报告
// ============================================================

/** 近似计算字符串显示宽度（CJK 字符算 2） */
function visualWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return w
}

/** 对齐填充 */
function pad(s: string, w: number, align: 'left' | 'right'): string {
  const visualLen = visualWidth(s)
  if (visualLen >= w) return s
  const padLen = w - visualLen
  return align === 'left' ? s + ' '.repeat(padLen) : ' '.repeat(padLen) + s
}

function printReport(findings: Finding[], scannedFiles: number, writeMode: boolean): void {
  const mode = writeMode ? 'WRITE（实际修改文件）' : 'DRY-RUN（默认，不修改文件）'
  const sep = '═'.repeat(80)
  const sep2 = '─'.repeat(80)

  console.log('\n' + sep)
  console.log(' MetricCard HEX → Token 迁移脚本')
  console.log(` 模式: ${mode}`)
  console.log(sep)
  console.log(` 扫描目录: src/`)
  console.log(` 扫描文件: ${scannedFiles} 个（已排除 .test./.spec.）`)
  console.log(` 匹配发现: ${findings.length} 处`)
  console.log(sep2)

  if (findings.length === 0) {
    console.log(' 未发现 <MetricCard color="#XXXXXX"> 形式的 HEX 字面量，无需迁移。')
  } else {
    const cols = [
      { name: '#', w: 3 },
      { name: '文件:行', w: 50 },
      { name: '原 HEX', w: 9 },
      { name: '建议 Token', w: 13 },
      { name: 'Token HEX', w: 11 },
      { name: '距离', w: 8 },
    ]
    const header = cols.map((c) => pad(c.name, c.w, 'left')).join(' │ ')
    console.log(' ' + header)
    console.log(' ' + cols.map((c) => '─'.repeat(c.w)).join('─┼─'))

    findings.forEach((f, i) => {
      const loc = `${f.file}:${f.line}`
      const row = [
        pad(String(i + 1), cols[0].w, 'right'),
        pad(loc, cols[1].w, 'left'),
        pad(f.hex, cols[2].w, 'left'),
        pad(f.tokenKey, cols[3].w, 'left'),
        pad(f.tokenHex, cols[4].w, 'left'),
        pad(f.distance.toFixed(4), cols[5].w, 'right'),
      ].join(' │ ')
      console.log(' ' + row)
      // 附上下文行（便于人工核对），超长截断
      const ctx =
        f.lineText.length > 76 ? f.lineText.slice(0, 73) + '...' : f.lineText
      console.log('   ' + ' '.repeat(cols[0].w) + '  ↳ ' + ctx)
    })
  }

  console.log(sep2)
  const files = new Set(findings.map((f) => f.file)).size
  console.log(
    ` 摘要: 扫描 ${scannedFiles} 个文件，发现 ${findings.length} 处 HEX 字面量（涉及 ${files} 个文件）`,
  )
  if (writeMode) {
    console.log(' 已写入修改。')
  } else if (findings.length > 0) {
    console.log(' 提示: 加 --write 参数以实际写入修改。')
  }
  console.log(sep + '\n')
}

// ============================================================
// 主入口
// ============================================================

function main(): void {
  const argv = process.argv.slice(2)
  const WRITE = argv.includes('--write')

  if (!fs.existsSync(SRC)) {
    console.error(`[错误] src/ 目录不存在: ${SRC}`)
    process.exit(1)
  }

  const files = walk(SRC)
  const allFindings: Finding[] = []
  for (const file of files) {
    let content: string
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    // 快速过滤：无 MetricCard 字样的文件直接跳过，减少正则开销
    if (!content.includes('MetricCard')) continue
    allFindings.push(...scanFile(file, content))
  }

  printReport(allFindings, files.length, WRITE)

  if (WRITE && allFindings.length > 0) {
    const n = applyWrites(allFindings)
    console.log(
      ` ✓ 已写入 ${n} 处替换（涉及 ${new Set(allFindings.map((f) => f.file)).size} 个文件）`,
    )
  }
}

main()
