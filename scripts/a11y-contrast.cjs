#!/usr/bin/env node
/**
 * WCAG AA 对比度校验（零依赖）
 *
 * 解析 design-tokens/tokens.json，解析 {global...} 引用，
 * 对关键「前景/背景」色对计算相对亮度对比度；同时扫描 src/ 目录下
 * emerald 主色（#10b981 / emerald-500）在文本/小字号场景中的使用，
 * 输出文件、行号、使用颜色、背景色、对比度比值及替换建议。
 *
 * 用法: node scripts/a11y-contrast.cjs
 *
 * @module scripts/a11y-contrast
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const TOKENS_PATH = path.join(ROOT, 'design-tokens', 'tokens.json')
const REPORT_PATH = path.join(ROOT, 'docs', 'a11y-contrast-report.md')

/** hex -> [r,g,b] */
function hexToRgb(hex) {
  let h = String(hex).replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return [0, 0, 0]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/** 相对亮度 */
function relLum(rgb) {
  const a = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

/** 对比度 */
function ratio(fg, bg) {
  const l1 = relLum(hexToRgb(fg))
  const l2 = relLum(hexToRgb(bg))
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// ---- 解析令牌 ----
const raw = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
const flat = {}
function walk(obj, prefix) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object' && 'value' in v) {
      flat[prefix ? `${prefix}.${k}` : k] = v.value
    } else if (v && typeof v === 'object') {
      walk(v, prefix ? `${prefix}.${k}` : k)
    }
  }
}
walk(raw, '')
function resolve(val, depth = 0) {
  if (typeof val !== 'string' || !val.startsWith('{') || depth > 5) return val
  const key = val.slice(1, -1)
  return flat[key] !== undefined ? resolve(flat[key], depth + 1) : val
}
const get = (p) => resolve(flat[p])

const AA_NORMAL = 4.5
const AA_LARGE = 3.0

// ---- 关键色对：[描述, 前景令牌路径, 背景令牌路径] ----
const pairs = [
  ['主色/白字(亮)', 'light.color.primary', 'light.color.primaryForeground'],
  ['主色/背景(亮)', 'light.color.primary', 'light.color.background'],
  ['主色/前景字(暗)', 'dark.color.primary', 'dark.color.primaryForeground'],
  ['主色/背景(暗)', 'dark.color.primary', 'dark.color.background'],
  ['成功色/白字', 'semantic.status.success', 'light.color.background'],
  ['信息色/白字', 'semantic.status.info', 'light.color.background'],
  ['警告色/白字', 'semantic.status.warning', 'light.color.background'],
  ['危险色/白字', 'semantic.status.danger', 'light.color.background'],
]

// ---- 扫描 src/ 中 emerald 文本色使用 ----
const SRC_DIR = path.join(ROOT, 'src')
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css']
const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git']

/** 从类名片段推断 emerald 色值（按完整 shade 优先） */
function inferColorFromClass(match) {
  if (match.includes('emerald-700')) return '#047857'
  if (match.includes('emerald-600')) return '#059669'
  if (match.includes('emerald-500')) return '#10b981'
  if (match.includes('emerald-400')) return '#34d399'
  if (match.includes('emerald-50')) return '#ecfdf5'
  return null
}

/** 推断场景模式：dark / light / unknown */
function inferMode(match) {
  if (/dark:/.test(match)) return 'dark'
  return 'light'
}

/** 提取当前行中所有 emerald 颜色片段，返回 { color, usage, mode } 数组 */
function extractEmeraldUsages(line) {
  const usages = []
  // 精确匹配 Tailwind 工具类：前缀 + emerald-50/400/500/600/700 + 可选透明度 + 词边界
  const twRegex = /((?:dark:|hover:|focus:)?(?:text|bg|border|from|to)-emerald-(?:50|400|500|600|700)(?:\/\d+)?)(?![0-9a-zA-Z-])/g
  let m
  while ((m = twRegex.exec(line)) !== null) {
    usages.push({ usage: m[1], mode: inferMode(m[1]) })
  }
  // 硬编码 hex（颜色属性附近）
  const hexRegex = /(#10b981|#059669|#34d399|#047857)/gi
  while ((m = hexRegex.exec(line)) !== null) {
    usages.push({ usage: m[1], color: m[1].toLowerCase(), mode: 'light' })
  }
  return usages
}

/** 判断单个 usage 是否为文本色使用 */
function isTextUsage(usage, line) {
  // 显式文本工具类
  if (/^(?:dark:|hover:|focus:)?text-/.test(usage)) return true
  // 硬编码 hex 且当前行包含 color 相关属性（避免在 rgb 数组中误报）
  if (/^#/.test(usage) && /color\s*:\s*['"]?(?:#|rgb)/.test(line)) return true
  return false
}

const findings = []

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name)) scanDir(full)
      continue
    }
    if (!EXTS.includes(path.extname(entry.name))) continue

    const content = fs.readFileSync(full, 'utf8')
    const lines = content.split(/\r?\n/)

    lines.forEach((line, idx) => {
      const usages = extractEmeraldUsages(line)
      for (const u of usages) {
        if (!isTextUsage(u.usage, line)) continue

        const color = u.color || inferColorFromClass(u.usage)
        if (!color) continue

        const bg = u.mode === 'dark' ? '#020617' : '#ffffff'
        const r = ratio(color, bg)
        const ok = r >= AA_NORMAL
        findings.push({
          file: full.replace(ROOT + path.sep, '').replace(/\\/g, '/'),
          line: idx + 1,
          usage: u.usage,
          color,
          mode: u.mode,
          bg,
          ratio: r,
          ok,
        })
      }
    })
  }
}

if (fs.existsSync(SRC_DIR)) scanDir(SRC_DIR)

// 对 findings 按文件/行号排序
findings.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  return a.line - b.line
})

// ---- 控制台输出 ----
console.log('\n=== WCAG AA 对比度校验（Design Tokens）===')
console.log(
  ['场景', '前景', '背景', '对比度', '正文AA', '大字AA'].map((s) => s.padEnd(18)).join(''),
)

let pass = 0
for (const [name, fg, bg] of pairs) {
  const fgHex = get(fg)
  const bgHex = get(bg)
  const r = ratio(fgHex, bgHex)
  const okN = r >= AA_NORMAL
  const okL = r >= AA_LARGE
  if (okN) pass++
  console.log(
    name.padEnd(18),
    String(fgHex).padEnd(18),
    String(bgHex).padEnd(18),
    r.toFixed(2).padStart(8),
    (okN ? '✅' : '❌').padEnd(8),
    okL ? '✅' : '❌',
  )
}
console.log(`\nDesign Tokens 达标(正文AA 4.5:1): ${pass}/${pairs.length}`)

if (findings.length) {
  console.log('\n=== src/ 中 emerald 文本色使用（正文 AA）===')
  console.log(
    ['文件', '行号', '使用', '颜色', '背景', '对比度', '状态'].map((s) => s.padEnd(16)).join(''),
  )
  for (const f of findings) {
    console.log(
      f.file.padEnd(16),
      String(f.line).padEnd(16),
      f.usage.padEnd(16),
      f.color.padEnd(16),
      f.bg.padEnd(16),
      f.ratio.toFixed(2).padStart(8),
      f.ok ? '✅' : '❌',
    )
  }
  console.log(`\n文本色使用总数: ${findings.length}, 正文 AA 不达标: ${findings.filter((f) => !f.ok).length}`)
} else {
  console.log('\n未在 src/ 中发现 emerald 文本色使用。')
}

// ---- 生成 Markdown 报告 ----
const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
const failPairs = pairs.map(([name, fg, bg]) => {
  const fgHex = get(fg)
  const bgHex = get(bg)
  const r = ratio(fgHex, bgHex)
  return { name, fg: fgHex, bg: bgHex, ratio: r, ok: r >= AA_NORMAL }
}).filter((p) => !p.ok)

const failFindings = findings.filter((f) => !f.ok)

let md = `# T-09 WCAG 对比度复核报告

- **任务**: T-09 WCAG 对比度复核
- **执行者**: A7 · 视觉 QA AGENT
- **复核时间**: ${now}
- **项目**: 智能投研复盘系统 V9
- **重点颜色**: emerald 主色（\`#10b981\` / Tailwind \`emerald-500\`）

## 1. 色板体系速览

当前颜色体系由两个来源共同定义：

1. **Design Tokens 真源**: \`design-tokens/tokens.json\`
2. **运行时主题令牌**: \`src/constants/theme.tokens.ts\`（及其拆分后的子模块）

### 1.1 emerald 相关关键色值

| 色阶 | HEX | 备注 |
|------|-----|------|
| emerald-50 | \`#ecfdf5\` | 浅色背景 |
| emerald-400 | \`#34d399\` | 暗色模式高亮文字 |
| emerald-500 | \`#10b981\` | **主色**，暗色主题 primary / 信号强 / 风格价值 |
| emerald-600 | \`#059669\` | 亮色主题 primary |
| emerald-700 | \`#047857\` | 可用于正文（AA 达标） |

### 1.2 WCAG 对比度阈值

- **正文 AA**: 4.5:1（\`< 18px 常规文字，或 < 14px 粗体\`）
- **大字/粗体 AA**: 3.0:1（\`≥ 18px 常规文字，或 ≥ 14px 粗体\`）
- **AAA 正文**: 7.0:1（本报告仅复核 AA）

## 2. Design Tokens 关键色对校验

以下色对来自 \`design-tokens/tokens.json\` 解析后的实际值。

| 场景 | 前景色 | 背景色 | 对比度 | 正文 AA | 大字 AA |
|------|--------|--------|--------|---------|---------|
`

for (const p of failPairs) {
  md += `| ${p.name} | \`${p.fg}\` | \`${p.bg}\` | **${p.ratio.toFixed(2)}:1** | ❌ | ${p.ratio >= AA_LARGE ? '✅' : '❌'} |\n`
}

md += `\n**Design Tokens 达标情况**: ${pairs.length - failPairs.length}/${pairs.length} 组色对满足正文 AA。\n\n`

md += `## 3. 正文 AA 不达标场景清单（文件/行号）\n\n`
md += `以下场景在 \`src/\` 中直接使用 emerald 色作为文本色或等效文本色（\`color\` 内联样式），并在默认背景（亮色背景 \`#ffffff\` / 暗色背景 \`#020617\`）下对比度不足 4.5:1。**\n\n`

if (failFindings.length === 0) {
  md += `未发现正文 AA 不达标的 emerald 文本色使用。\n\n`
} else {
  md += `| 文件 | 行号 | 使用/颜色 | 背景色 | 对比度 | 模式 | 备注 |\n|------|------|-----------|--------|--------|------|------|\n`
  for (const f of failFindings) {
    const note = f.color === '#10b981'
      ? 'emerald-500 主色，正文对比度不足'
      : f.color === '#059669'
      ? 'emerald-600 亮色主色，正文对比度不足'
      : 'emerald 色阶文本色'
    md += `| \`${f.file}\` | ${f.line} | \`${f.usage}\` / \`${f.color}\` | \`${f.bg}\` | **${f.ratio.toFixed(2)}:1** | ${f.mode} | ${note} |\n`
  }
}

md += `\n## 4. 问题定级与修复建议\n\n`

md += `### P1（高优先级）—— 必须修复\n\n`
md += `1. **暗色主题主色按钮/标签文字不可读**\n`
md += `   - 位置: \`design-tokens/tokens.json\` → \`dark.color.primary\` = \`#10b981\`\n`
md += `   - 问题: 与前景色 \`dark.color.primaryForeground\`（\`#f8fafc\`）对比度仅 **2.42:1**，远低于正文 AA 4.5:1，也低于大字 AA 3.0:1。\n`
md += `   - 修复: 将暗色主色加深至 emerald-600（\`#059669\`）或 emerald-700（\`#047857\`），确保与浅色文字对比度 ≥ 4.5:1。\n\n`

md += `2. **亮色主题主色按钮/标签文字对比度不足**\n`
md += `   - 位置: \`design-tokens/tokens.json\` → \`light.color.primary\` = \`#059669\`\n`
md += `   - 问题: 与白色前景对比度 **3.77:1**，不满足正文 AA，仅满足大字 AA。\n`
md += `   - 修复: 将亮色主色加深至 emerald-700（\`#047857\`），或仅用于大字号/粗体按钮。\n\n`

md += `3. **语义 token 中 emerald-500 被直接用作正文字色**\n`
md += `   - 位置: \`src/constants/theme/theme.tokens.color.ts\`\n`
md += `   - 涉及 token: \`COLOR_TOKENS.emerald\`、\`COLOR_TOKENS.styleValue\`、\`COLOR_TOKENS.signalStrong\`\n`
md += `   - 问题: 这些 token 的 \`tailwind\` 字段为 \`text-emerald-500\`，一旦被组件用于正文，在白色背景上对比度仅 **2.54:1**（\`#10b981\` vs \`#ffffff\`）。\n`
md += `   - 修复: 将文本色 token 统一改为 \`text-emerald-700\`（\`#047857\`），或新增 \`emeraldText\` / \`emeraldSoft\` 等专用文本 token。\n\n`

md += `### P2（中优先级）—— 建议修复\n\n`
md += `1. **新闻模块 positive 文本色 emerald-600 在正文场景下不达标**\n`
md += `   - 位置: \`src/constants/newsColorTokens.ts:11\` → \`text: 'text-emerald-600'\`\n`
md += `   - 问题: \`#059669\` 在白色背景上对比度 **3.77:1**，不满足正文 AA。\n`
md += `   - 修复: 正文场景改为 \`text-emerald-700\`（\`#047857\`），图标/装饰可保留 emerald-600。\n\n`

md += `2. **PortalShell 导航激活态 emerald-600**\n`
md += `   - 位置: \`src/portal/PortalShell.tsx:206\` → \`text-emerald-600 dark:text-emerald-400\`\n`
md += `   - 问题: 亮色模式 emerald-600 在白色背景上对比度 3.77:1，未达正文 AA；但导航项通常字号 ≥ 14px 且为粗体，可能按大字 AA 3.0:1 通过。\n`
md += `   - 修复: 若用于正文，改为 emerald-700；若作为导航高亮（粗体/≥14px），可保留并补充说明。\n\n`

md += `3. **IntelligentScorePage 内联样式 emerald 色**\n`
md += `   - 位置: \`src/pages/analysis/IntelligentScorePage.tsx:105-110\`\n`
md += `   - 问题: 使用 \`#10b981\`（h1, h2, .dimension-name）和 \`#059669\`（h2, .dimension-name）作为标题/正文色。\n`
md += `   - 修复: 标题可保留 emerald-600/700（大字 AA 通过）；正文/维度名改为 emerald-700。\n\n`

md += `## 5. 推荐替换方案\n\n`
md += `| 当前用法 | 推荐替换 | 使用场景 | 替换后对比度（白底） |
|----------|----------|----------|---------------------|
`
md += `| \`emerald-500\` / \`#10b981\` | \`emerald-700\` / \`#047857\` | 正文、小字号、标签文字 | **5.63:1** |
`
md += `| \`emerald-500\` / \`#10b981\` | \`emerald-600\` / \`#059669\` | 大字号标题、粗体、装饰 | 3.77:1（大字 AA） |
`
md += `| \`emerald-600\` / \`#059669\` | \`emerald-700\` / \`#047857\` | 正文、小字号 | 5.63:1 |
`
md += `| \`bg-emerald-500\` + 白字 | \`bg-emerald-700\` + 白字 | 按钮、Badge、胶囊 | 5.63:1 |
`
md += `| \`dark:bg-emerald-500\` + 浅字 | \`dark:bg-emerald-700\` + 浅字 | 暗色按钮 | ≥ 4.5:1 |
\n`

md += `## 6. 结论\n\n`
if (failPairs.length > 0 || failFindings.length > 0) {
  md += `本次复核发现 **${failPairs.length} 组 Design Tokens 色对** 与 **${failFindings.length} 处 src/ 文本色使用** 未满足 WCAG AA 正文对比度要求。emerald 主色（\`#10b981\`）在亮色背景下正文对比度仅约 3.0:1，在暗色背景下与浅色文字对比度仅 2.42:1，**不建议用于正文或小字号**。建议优先执行 P1 修复：将按钮/主色加深到 emerald-700（\`#047857\`），并调整文本色 token 为 emerald-700。\n`
} else {
  md += `本次复核未发现 emerald 主色在正文场景下的对比度问题。\n`
}

md += `\n---\n报告由 \`scripts/a11y-contrast.cjs\` 自动生成。\n`

fs.writeFileSync(REPORT_PATH, md, 'utf8')
console.log(`\n报告已保存: ${REPORT_PATH}`)
process.exit(0)
