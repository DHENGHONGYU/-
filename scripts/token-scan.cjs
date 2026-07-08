#!/usr/bin/env node
/**
 * token-scan.cjs — 令牌合规扫描（零依赖）
 *
 * 扫描 src/ 下 .ts/.tsx 文件中的内联十六进制/rgb 颜色字面量，
 * 确保颜色使用 L1-L5 令牌体系而非硬编码。
 *
 * 排除项：
 *   - 令牌定义文件（tokens.css, *constants*.ts, *tokens*.ts）
 *   - 测试文件（*.test.*, __tests__）
 *   - STOCK_COLOR_TOKENS（股票红涨绿跌固定色，豁免主题切换）
 *
 * 不扫描 Tailwind class（由 audit:hardcode + lint:colors 覆盖）。
 * 不扫描 shadow-* 工具类（非颜色）。
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.resolve(__dirname, '..', 'src')
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB_COLOR_RE = /rgba?\(\s*\d{1,3}\s*,/g

const EXCLUDE_PATTERNS = [
  /tokens\.css$/,
  /constants.*\.ts$/,
  /token.*\.ts$/i,
  /\.test\./,
  /__tests__/,
  /stockColor.*\.ts$/i,
  /colorPalette.*\.ts$/i,
  /mockData.*\.ts$/i,
  /mock.*\.ts$/i,
  /[\\/]config[\\/]/,
]

function walkDir(dir, ext, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, ext, results)
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
}

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(p => p.test(filePath))
}

function scanFile(filePath) {
  if (shouldExclude(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const violations = []
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/')

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 跳过注释行
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 跳过字符串中的颜色名（非十六进制）
    const hexMatches = line.match(HEX_COLOR_RE) || []
    const rgbMatches = line.match(RGB_COLOR_RE) || []

    for (const match of [...hexMatches, ...rgbMatches]) {
      violations.push({
        file: relPath,
        line: i + 1,
        match,
        message: `内联颜色字面量 "${match}" 应使用令牌体系（L1-L5）`,
      })
    }
  }

  return violations
}

function main() {
  const files = []
  walkDir(SRC_DIR, '.ts', files)
  walkDir(SRC_DIR, '.tsx', files)

  let allViolations = []
  for (const file of files) {
    allViolations.push(...scanFile(file))
  }

  // 输出报告
  process.stderr.write('╔════════════════════════════════════════════════════════════╗\n')
  process.stderr.write('║  令牌合规扫描 — token-scan.cjs v1.0                        ║\n')
  process.stderr.write('╚════════════════════════════════════════════════════════════╝\n\n')

  if (allViolations.length === 0) {
    process.stderr.write('✅ 未发现内联颜色字面量违规\n')
  } else {
    process.stderr.write(`发现 ${allViolations.length} 处内联颜色字面量：\n\n`)
    for (const v of allViolations) {
      process.stderr.write(`  ${v.file}:${v.line} ${v.match} — ${v.message}\n`)
    }
  }

  process.stderr.write('\n────────────────────────────────────────────────────────────\n')
  process.stderr.write(`扫描文件数: ${files.length}\n`)
  process.stderr.write(`违规数: ${allViolations.length}\n`)
  process.stderr.write('────────────────────────────────────────────────────────────\n')

  process.exit(allViolations.length > 0 ? 1 : 0)
}

main()
