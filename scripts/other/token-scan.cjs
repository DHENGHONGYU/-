#!/usr/bin/env node
/**
 * token-scan.cjs — 令牌合规扫描 + 视觉 QA 回归闸门（零依赖）
 *
 * 检测两类违规（对应 AGENTS.md §三「颜色令牌规范」）：
 *   A. 内联十六进制/rgb 颜色字面量（如 #ff0000、rgb(255,0,0)）
 *   B. JSX className 中的 Tailwind 裸色类（如 text-red-500、bg-stone-200、
 *      hover:border-emerald-500）—— 应使用 COLOR_SHADES / twText / twBg / twBorder
 *
 * 回归闸门（ratchet）机制：
 *   - 默认（基线比对）：current ≤ baseline → 通过(exit 0)；current > baseline → 失败(exit 1)
 *     即“债务只能减不能增”，新代码新增裸色类/硬编码色会在 CI 被拦截。
 *   - --update-baseline：重新生成 .token-baseline.json 并退出 0（冻结当前债务）
 *   - --strict：任意违规即失败（旧行为，供本地全量体检）
 *   - --json：stdout 输出 JSON（机器可读，供 CI 解析）
 *
 * 作用范围：
 *   - hex/rgb 字面量：扫描全部 src（排除令牌/常量/配置/图表配色/mock/test/generated）
 *   - 裸色类：仅作用于契约明令禁止的 4 层 —— components / pages / cockpit / apps
 *     （与 AGENTS.md §三对齐；portal 等外壳层暂不纳入，避免误伤设计系统底座）
 *
 * 退出码：0=通过, 1=回归/严格失败, 2=执行错误
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'src')
const BASELINE_PATH = path.join(ROOT, '.token-baseline.json')

const argv = process.argv.slice(2)
const FLAG_UPDATE = argv.includes('--update-baseline')
const FLAG_STRICT = argv.includes('--strict')
const FLAG_JSON = argv.includes('--json')

// ── 检测器 A：内联 hex / rgb 字面量 ──────────────────────────────
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB_COLOR_RE = /rgba?\(\s*\d{1,3}\s*,/g

// ── 检测器 B：JSX className 裸 Tailwind 色类 ─────────────────────
// 契约禁止裸色类的 4 层
const BARE_CLASS_LAYERS = ['components', 'pages', 'cockpit', 'apps']
const COLOR_FAMILIES = [
  'red', 'green', 'blue', 'yellow', 'amber', 'gray', 'slate', 'purple', 'orange',
  'cyan', 'emerald', 'indigo', 'teal', 'pink', 'rose', 'violet', 'fuchsia', 'lime',
  'sky', 'zinc', 'neutral', 'stone',
]
const COLOR_UTILS = [
  'text', 'bg', 'border', 'ring', 'divide', 'from', 'to', 'via', 'fill', 'stroke', 'outline',
]
const VARIANT_PREFIX = '(?:hover:|focus:|focus-visible:|active:|disabled:|visited:|dark:|md:|lg:|xl:)?'
const CLASS_TOKEN = COLOR_UTILS
  .map((u) => VARIANT_PREFIX + u + '-(?:' + COLOR_FAMILIES.join('|') + ')-\\d+')
  .join('|')
const BARE_CLASS_RE = new RegExp('(?:^|\\s|"|\'|`|\\()(' + CLASS_TOKEN + ')', 'g')
// className 值提取：拆成「引号字面量」与「模板字面量」两条平衡正则，规避嵌套括号陷阱
const CLASSNAME_LIT_RE = /className\s*=\s*["']([^"']*)["']/g
const CLASSNAME_TPL_RE = /className\s*=\s*{(`[^`]*`)}/g

// ── 排除项（令牌/常量/配置/图表配色/mock/test/generated）─────────
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
  /[\\/]generated[\\/]/,
  /chartColors.*\.ts$/i,
  /themeRegistry.*\.ts$/i,
  /theme\.config\.ts$/i,
  /theme\.tokens.*\.ts$/i,
]

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath))
}

function isBareClassLayer(filePath) {
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/')
  return BARE_CLASS_LAYERS.some((layer) => rel === layer || rel.startsWith(layer + '/'))
}

function walkDir(dir, ext, results) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, ext, results)
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
}

function rel(pathStr) {
  return path.relative(ROOT, pathStr).replace(/\\/g, '/')
}

/** 按 file:line:match 去重（className 上下文与行级兜底可能重复命中同一处） */
function dedupe(violations) {
  const seen = new Set()
  const out = []
  for (const v of violations) {
    const k = v.file + ':' + v.line + ':' + v.match
    if (!seen.has(k)) {
      seen.add(k)
      out.push(v)
    }
  }
  return out
}

/** 扫描 hex/rgb 字面量（全部 src，排除项见上） */
function scanHexLiterals(filePath) {
  if (shouldExclude(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const violations = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    const matches = [...(line.match(HEX_COLOR_RE) || []), ...(line.match(RGB_COLOR_RE) || [])]
    for (const m of matches) {
      violations.push({ file: rel(filePath), line: i + 1, match: m, kind: 'hex' })
    }
  }
  return dedupe(violations)
}

/** 从 className 值里提取裸色类 */
function extractClassValues(content) {
  const values = []
  let m
  CLASSNAME_LIT_RE.lastIndex = 0
  while ((m = CLASSNAME_LIT_RE.exec(content)) !== null) values.push(m[1] || '')
  CLASSNAME_TPL_RE.lastIndex = 0
  while ((m = CLASSNAME_TPL_RE.exec(content)) !== null) {
    const v = m[1] || ''
    values.push(v.startsWith('`') && v.endsWith('`') ? v.slice(1, -1) : v)
  }
  return values
}

/** 扫描 className 裸色类（仅 4 层） */
function scanBareClasses(filePath) {
  if (shouldExclude(filePath) || !isBareClassLayer(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const violations = []
  const lines = content.split('\n')
  // 1) className="..." / className={`...`} 上下文提取
  let m
  CLASSNAME_LIT_RE.lastIndex = 0
  while ((m = CLASSNAME_LIT_RE.exec(content)) !== null) {
    const idx = m.index
    const lineNo = content.slice(0, idx).split('\n').length
    const val = m[1] || ''
    if (!val) continue
    const cms = val.match(BARE_CLASS_RE)
    if (cms) for (const cm of cms) violations.push({ file: rel(filePath), line: lineNo, match: cm.trim(), kind: 'class' })
  }
  CLASSNAME_TPL_RE.lastIndex = 0
  while ((m = CLASSNAME_TPL_RE.exec(content)) !== null) {
    const idx = m.index
    const lineNo = content.slice(0, idx).split('\n').length
    let val = m[1] || ''
    if (val.startsWith('`') && val.endsWith('`')) val = val.slice(1, -1)
    if (!val) continue
    const cms = val.match(BARE_CLASS_RE)
    if (cms) for (const cm of cms) violations.push({ file: rel(filePath), line: lineNo, match: cm.trim(), kind: 'class' })
  }
  // 2) 兜底：行级裸色类（如模板内联未走 className=）
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    const inline = lines[i].match(BARE_CLASS_RE)
    if (inline) for (const cm of inline) violations.push({ file: rel(filePath), line: i + 1, match: cm.trim(), kind: 'class' })
  }
  return dedupe(violations)
}

function collectAll() {
  const files = []
  walkDir(SRC_DIR, '.ts', files)
  walkDir(SRC_DIR, '.tsx', files)

  const hexViolations = []
  const classViolations = []
  for (const f of files) {
    hexViolations.push(...scanHexLiterals(f))
    classViolations.push(...scanBareClasses(f))
  }
  return { files: files.length, hexViolations, classViolations }
}

function buildBaseline(current) {
  const hexByFile = {}
  for (const v of current.hexViolations) hexByFile[v.file] = (hexByFile[v.file] || 0) + 1
  const classByFile = {}
  const classByLayer = {}
  for (const v of current.classViolations) {
    classByFile[v.file] = (classByFile[v.file] || 0) + 1
    const layer = v.file.split('/')[1] || 'other'
    classByLayer[layer] = (classByLayer[layer] || 0) + 1
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    hex: { total: current.hexViolations.length, byFile: hexByFile },
    classes: {
      total: current.classViolations.length,
      byLayer: classByLayer,
      byFile: classByFile,
    },
  }
}

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function humanReport(current, baseline, regression) {
  const w = (s) => process.stderr.write(s + '\n')
  w('╔══════════════════════════════════════════════════════════════════╗')
  w('║  令牌合规扫描 · 视觉 QA 回归闸 — token-scan.cjs v2.0              ║')
  w('╚══════════════════════════════════════════════════════════════════╝')
  w('')
  w('扫描文件数: ' + current.files)
  w('')
  w('── 检测器 A：内联 hex/rgb 字面量（全部 src）──────────────────────')
  w('  当前: ' + current.hexViolations.length + (baseline ? '  基线: ' + baseline.hex.total : ''))
  if (current.hexViolations.length > 0) {
    const top = current.hexViolations.slice(0, 5)
    for (const v of top) w('    · ' + v.file + ':' + v.line + ' ' + v.match)
    if (current.hexViolations.length > 5) w('    · … 共 ' + current.hexViolations.length + ' 处')
  }
  w('')
  w('── 检测器 B：className 裸 Tailwind 色类（components/pages/cockpit/apps）─')
  w('  当前: ' + current.classViolations.length + (baseline ? '  基线: ' + baseline.classes.total : ''))
  if (current.classViolations.length > 0) {
    const top = current.classViolations.slice(0, 5)
    for (const v of top) w('    · ' + v.file + ':' + v.line + ' ' + v.match)
    if (current.classViolations.length > 5) w('    · … 共 ' + current.classViolations.length + ' 处')
  }
  w('')
  if (FLAG_STRICT) {
    const total = current.hexViolations.length + current.classViolations.length
    w(total > 0 ? '⛔ 严格模式：发现 ' + total + ' 处违规 → 失败' : '✅ 严格模式：无违规')
  } else if (regression) {
    const dh = current.hexViolations.length - (baseline ? baseline.hex.total : 0)
    const dc = current.classViolations.length - (baseline ? baseline.classes.total : 0)
    w('⛔ 回归：新增违规超过基线，CI 拦截')
    if (dh > 0) w('    hex 字面量 +' + dh)
    if (dc > 0) w('    裸色类 +' + dc)
  } else {
    const rh = (baseline ? baseline.hex.total : 0) - current.hexViolations.length
    const rc = (baseline ? baseline.classes.total : 0) - current.classViolations.length
    w('✅ 通过：违规数 ≤ 基线（债务只减不增）')
    if (rh > 0 || rc > 0) w('    较基线已消减 hex -' + rh + ' / 裸色类 -' + rc)
  }
  w('────────────────────────────────────────────────────────────────────')
}

function main() {
  let current
  try {
    current = collectAll()
  } catch (e) {
    process.stderr.write('❌ 执行错误: ' + (e && e.message ? e.message : String(e)) + '\n')
    process.exit(2)
    return
  }

  const baseline = FLAG_UPDATE ? null : loadBaseline()

  if (FLAG_UPDATE) {
    const bl = buildBaseline(current)
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(bl, null, 2) + '\n', 'utf-8')
    if (FLAG_JSON) process.stdout.write(JSON.stringify({ action: 'baseline-updated', baseline: bl }, null, 2))
    humanReport(current, bl, false)
    process.stderr.write('📌 已生成基线: ' + rel(BASELINE_PATH) + '\n')
    process.exit(0)
    return
  }

  if (FLAG_JSON) {
    process.stdout.write(JSON.stringify({ current, baseline }, null, 2))
  }

  let regression = false
  if (FLAG_STRICT) {
    regression = current.hexViolations.length + current.classViolations.length > 0
  } else if (baseline) {
    regression =
      current.hexViolations.length > (baseline.hex ? baseline.hex.total : 0) ||
      current.classViolations.length > (baseline.classes ? baseline.classes.total : 0)
  } else {
    process.stderr.write('⚠️ 未找到基线文件，请先运行: npm run audit:tokens -- --update-baseline\n')
  }

  humanReport(current, baseline, regression)

  if (FLAG_STRICT) {
    process.exit(regression ? 1 : 0)
  }
  // 基线模式：无基线时通过（避免无谓阻塞），有基线时按回归判定
  process.exit(baseline ? (regression ? 1 : 0) : 0)
}

main()
