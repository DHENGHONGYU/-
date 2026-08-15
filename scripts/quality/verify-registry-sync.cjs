#!/usr/bin/env node
/**
 * verify-registry-sync.cjs — 组件/Widget 注册表同步一键验证
 *
 * 本脚本在修改 componentRegistry.ts / widgetRegistry.ts / cockpit.constants.ts 后，
 * 一键执行所有关键验证命令，快速定位同步问题。
 *
 * 覆盖检查：
 *   1. P0 关键门禁（类型检查、分层合规、原子层级、Widget 三件套）
 *   2. P1 重要检查（注册表完整性、硬编码颜色、令牌合规）
 *   3. P2 辅助验证（Widget 跨注册表交叉验证、组件文件存在性）
 *   4. 跨注册表交叉验证：
 *      4a. Widget 孤儿诊断（A=死代码 / B=漏注册 / C=有意不注册 / D=正常）
 *      4b. Store 注册表：条目↔磁盘文件 双向一致性
 *      4c. Service 注册表：条目↔磁盘文件 双向一致性
 *
 * 用法：
 *   node scripts/quality/verify-registry-sync.cjs          # 完整验证
 *   node scripts/quality/verify-registry-sync.cjs --quick  # 仅 P0 关键项
 *   node scripts/quality/verify-registry-sync.cjs --widget # 仅 Widget 相关
 *   node scripts/quality/verify-registry-sync.cjs --store  # 仅 Store/Service 相关
 *   node scripts/quality/verify-registry-sync.cjs --orphan # 仅孤儿 Widget 诊断
 *   node scripts/quality/verify-registry-sync.cjs --json   # JSON 输出
 *
 * 退出码：0=全部通过, 1=有 P0 阻断, 2=执行异常
 */

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// ============================================================
// 门禁定义（按严重级别分组）
// ============================================================

const GATE_P0 = [
  { id: 'tsc:prod',            npm: 'tsc:prod',            desc: '生产类型检查 (TypeScript)' },
  { id: 'layers',              npm: 'audit:layers',        desc: '跨层调用合规' },
  { id: 'atomic',              npm: 'audit:atomic',        desc: '原子组件层级边界' },
  { id: 'widget-registry',    npm: 'audit:widget-registry', desc: 'Widget 三处注册一致性' },
  { id: 'acl-consistency',    npm: 'audit:acl-consistency', desc: 'ACL 权限矩阵一致性' },
]

const GATE_P1 = [
  { id: 'registry',            npm: 'audit:registry',     desc: '组件注册表完整性' },
  { id: 'hardcode',            npm: 'audit:hardcode',     desc: '颜色硬编码扫描' },
  { id: 'tokens',              npm: 'audit:tokens',       desc: '令牌合规扫描' },
  { id: 'db-references',      npm: 'audit:db-references', desc: '数据库定义交叉引用' },
  { id: 'secrets',             npm: 'audit:secrets',      desc: '密钥/敏感信息扫描' },
  { id: 'deadcode',            npm: 'audit:deadcode',     desc: '死代码检测' },
]

const GATE_P2 = [
  { id: 'complexity',          npm: 'complexity-scan',    desc: '代码复杂度扫描' },
  { id: 'jsdoc',               npm: 'audit:jsdoc',        desc: 'JSDoc 覆盖检查' },
  { id: 'docs',                npm: 'audit:docs',         desc: '文档版本/同步' },
]

// ============================================================
// 跨注册表交叉验证（widgetRegistry ↔ componentRegistry）
// ============================================================

const WIDGET_REGISTRY_PATH = path.join(ROOT, 'src', 'cockpit', 'core', 'widgetRegistry.ts')
const COMPONENT_REGISTRY_PATH = path.join(ROOT, 'src', 'components', 'registry', 'organismRegistry.ts')
const WIDGETS_DIR = path.join(ROOT, 'src', 'cockpit', 'widgets')
const COCKPIT_CONSTANTS_PATH = path.join(ROOT, 'src', 'constants', 'cockpit.constants.ts')
const STORE_REGISTRY_PATH = path.join(ROOT, 'src', 'store', 'storeRegistry.ts')
const SERVICE_REGISTRY_PATH = path.join(ROOT, 'src', 'services', 'serviceRegistry.ts')
const STORE_DIR = path.join(ROOT, 'src', 'store')
const SERVICES_DIR = path.join(ROOT, 'src', 'services')

/**
 * 从 widgetRegistry.ts 提取所有已注册 Widget ID
 */
function extractWidgetIds() {
  const content = fs.readFileSync(WIDGET_REGISTRY_PATH, 'utf-8')
  const ids = []
  const regex = /id:\s*'([^']+)'/g
  let match
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

/**
 * 从 widgetRegistry.ts 提取 Widget ID → import 路径映射
 */
function extractWidgetImportMap() {
  const content = fs.readFileSync(WIDGET_REGISTRY_PATH, 'utf-8')
  const importMap = new Map()
  const idRegex = /id:\s*'([^']+)'/g
  const importRegex = /import\(\s*'([^']+)'\s*\)/g
  const ids = []
  let m
  while ((m = idRegex.exec(content)) !== null) {
    ids.push({ id: m[1], pos: m.index })
  }
  const imports = []
  while ((m = importRegex.exec(content)) !== null) {
    imports.push({ importPath: m[1], pos: m.index })
  }
  for (const idEntry of ids) {
    let best = null
    let bestPos = Infinity
    for (const imp of imports) {
      if (imp.pos > idEntry.pos && imp.pos < bestPos) {
        best = imp.importPath
        bestPos = imp.pos
      }
    }
    if (best) importMap.set(idEntry.id, best)
  }
  return importMap
}

/**
 * 从 componentRegistry.ts (organismRegistry) 提取组件 consumers 中引用 Widget 的条目
 */
function extractWidgetConsumers() {
  const content = fs.readFileSync(COMPONENT_REGISTRY_PATH, 'utf-8')
  const refs = []
  const entryRegex = /\{\s*name:\s*['"]([^'"]+)['"][^}]*consumers:\s*\[([^\]]*)\][^}]*\}/g
  let m
  while ((m = entryRegex.exec(content)) !== null) {
    const name = m[1]
    const consumersRaw = m[2].trim()
    if (!consumersRaw) continue
    const consumers = consumersRaw.split(',').map((c) => c.trim().replace(/^['"]|['"]$/g, ''))
    const widgetRelated = consumers.filter(
      (c) =>
        c.toLowerCase().includes('widget') ||
        c.toLowerCase().includes('cockpit') ||
        c.toLowerCase().includes('widgetregistry'),
    )
    if (widgetRelated.length > 0) {
      refs.push({ name, consumers, widgetRefs: widgetRelated })
    }
  }
  return refs
}

/**
 * 检查 Widget 组件文件是否存在
 */
function checkWidgetFile(importPath) {
  const rel = importPath.replace(/^@\//, '')
  let filePath = path.join(ROOT, 'src', rel)
  if (!/\.(tsx?|jsx?)$/.test(filePath)) filePath += '.tsx'
  return fs.existsSync(filePath)
}

/**
 * 从 cockpit.constants.ts 提取已声明"迁移/移除"的 Widget key
 * 形如：// 系统监控 Widget（engineStatus/systemArchitecture/mechanismHealth 已移至 Command）
 */
function extractMigratedWidgets() {
  if (!fs.existsSync(COCKPIT_CONSTANTS_PATH)) return new Map()
  const content = fs.readFileSync(COCKPIT_CONSTANTS_PATH, 'utf-8')
  const migrated = new Map()
  // 匹配形如：// ... 已移至 ... 或 // ... 已迁移 ... 等的整行注释
  const commentRegex = /\/\/[^\n]*?(已移至|已迁移|已移除|已废弃|migrated|deprecated)[^\n]*/gi
  let m
  while ((m = commentRegex.exec(content)) !== null) {
    const line = m[0]
    // 从注释中提取所有 camelCase 标识符（首字母小写，后续可大写）
    const keyRegex = /\b([a-z][a-zA-Z0-9]+)\b/g
    let km
    while ((km = keyRegex.exec(line)) !== null) {
      const key = km[1]
      // 跳过中文关键字与通用单词
      const skipList = ['已', '已移至', '已迁移', '已移除', '已废弃', 'migrated', 'deprecated', 'Widget', '数据源', '系统', '监控', '至']
      if (skipList.includes(key)) continue
      // 跳过过短或常见的英文介词
      if (['the', 'and', 'for', 'has', 'have', 'hasbeen'].includes(key)) continue
      migrated.set(key.toLowerCase(), line.trim())
    }
  }
  if (process.env.VERIFY_DEBUG === '1') {
    process.stderr.write(`[extractMigratedWidgets] found ${migrated.size} keys: ${[...migrated.keys()].join(', ')}\n`)
  }
  return migrated
}

/**
 * 列出 src/cockpit/widgets 目录下所有 *Widget.tsx 文件（不含 .test.）
 */
function listWidgetFiles() {
  if (!fs.existsSync(WIDGETS_DIR)) return []
  return fs
    .readdirSync(WIDGETS_DIR)
    .filter((f) => /^.+Widget\.tsx$/.test(f) && !/\.test\./.test(f) && !/\.d\.ts$/.test(f))
    .map((f) => ({ fileName: f, baseName: f.replace(/\.tsx$/, ''), stem: f.replace(/Widget\.tsx$/, '') }))
}

/**
 * 递归列出 src 下所有 .ts/.tsx 文件（排除测试、声明、widgetRegistry 自身）
 */
let _srcFileCache = null
function listSrcFiles() {
  if (_srcFileCache) return _srcFileCache
  const SRC_DIR = path.join(ROOT, 'src')
  const result = []
  const widgetRegistryRel = path.relative(ROOT, WIDGET_REGISTRY_PATH).replace(/\\/g, '/')
  const walk = (dir) => {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const full = path.join(dir, item)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (/\.(ts|tsx)$/.test(item) && !/\.test\./.test(item) && !/\.d\.ts$/.test(item)) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/')
        if (rel === widgetRegistryRel) continue
        result.push({ abs: full, rel })
      }
    }
  }
  walk(SRC_DIR)
  _srcFileCache = result
  return result
}

/**
 * 全仓搜索某 Widget 名称的 import 引用（纯 Node.js 实现，避免依赖 rg shell 行为）
 * 返回引用文件路径列表（不含 widget 自身、不含测试、不含 widgetRegistry.ts）
 */
function searchWidgetReferences(widgetName) {
  const selfFile = `${widgetName}.tsx`
  const files = listSrcFiles()
  const refs = []
  for (const f of files) {
    if (f.rel.endsWith(selfFile)) continue
    // 仅匹配 import / 引用，避免误命中注释；这里宽松匹配 widgetName 字符串
    // 优化：先粗筛（包含 widgetName 字符串）再精读
    try {
      const content = fs.readFileSync(f.abs, 'utf-8')
      if (!content.includes(widgetName)) continue
      // 进一步确认是 import / JSX 引用，而非注释
      const lines = content.split('\n')
      const hasRealRef = lines.some((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false
        return line.includes(widgetName)
      })
      if (hasRealRef) refs.push(f.rel)
    } catch (_) {
      // ignore read errors
    }
  }
  return refs
}

/**
 * 执行跨注册表交叉验证
 * 输出 Widget 分类（A=死代码 / B=漏注册 / C=有意不注册 / D=正常）
 */
function crossValidateRegistries() {
  const issues = []
  const warnings = []
  const orphanReport = []

  // 1. Widget ID → 组件文件存在性
  if (!fs.existsSync(WIDGET_REGISTRY_PATH)) {
    return {
      issues: [{ level: 'P0', msg: `widgetRegistry.ts 不存在: ${WIDGET_REGISTRY_PATH}` }],
      warnings: [],
      orphanReport,
      widgetCount: 0,
      consumerRefCount: 0,
    }
  }
  if (!fs.existsSync(COMPONENT_REGISTRY_PATH)) {
    return {
      issues: [{ level: 'P0', msg: `organismRegistry.ts 不存在: ${COMPONENT_REGISTRY_PATH}` }],
      warnings: [],
      orphanReport,
      widgetCount: 0,
      consumerRefCount: 0,
    }
  }

  const widgetIds = extractWidgetIds()
  const importMap = extractWidgetImportMap()
  const consumerRefs = extractWidgetConsumers()
  const migratedMap = extractMigratedWidgets()
  const diskWidgets = listWidgetFiles()

  // 建立已注册的磁盘文件名集合（基于 import 路径，而非 widgetId）
  // 例如 signalQuality → import('@/cockpit/widgets/SignalQualityDashboardWidget')
  // 注册文件名为 'SignalQualityDashboardWidget'，与磁盘文件 stem 匹配
  const registeredFileNames = new Set()
  for (const importPath of importMap.values()) {
    const rel = importPath.replace(/^@\//, '')
    const base = path.basename(rel)
    registeredFileNames.add(base)
  }

  // 2. 检查每个已注册 Widget 的组件文件存在性
  for (const id of widgetIds) {
    const importPath = importMap.get(id)
    if (importPath) {
      const exists = checkWidgetFile(importPath)
      if (!exists) {
        issues.push({ level: 'P0', msg: `Widget "${id}" 的组件文件不存在: ${importPath}` })
      }
    } else {
      const expectedName = id.charAt(0).toUpperCase() + id.slice(1) + 'Widget'
      const expectedPath = path.join(WIDGETS_DIR, `${expectedName}.tsx`)
      if (!fs.existsSync(expectedPath)) {
        issues.push({
          level: 'P0',
          msg: `Widget "${id}" 的组件文件不存在（推测路径）: ${expectedPath}`,
        })
      }
    }
  }

  // 3. 磁盘 Widget 文件分类（A/B/C/D）
  for (const w of diskWidgets) {
    const isRegistered = registeredFileNames.has(w.baseName)
    if (isRegistered) {
      orphanReport.push({ type: 'D', name: w.baseName, file: w.fileName, note: '正常注册到 widgetRegistry' })
      continue
    }
    const refs = searchWidgetReferences(w.baseName)
    const isReferenced = refs.length > 0
    // 迁移声明按 stem 的小写匹配（constants 注释中的 key 通常是 camelCase，如 engineStatus）
    const migratedLine = migratedMap.get(w.stem.toLowerCase()) || migratedMap.get(w.baseName)
    if (!isReferenced) {
      // A: 死代码（无人引用且未注册）
      orphanReport.push({
        type: 'A',
        name: w.baseName,
        file: w.fileName,
        note: '死代码候选：磁盘存在但无任何 import 引用、未注册到 widgetRegistry',
      })
      issues.push({
        level: 'P1',
        msg: `孤儿 Widget [A 类-死代码] ${w.baseName}：无引用、未注册，建议删除文件`,
      })
    } else if (migratedLine) {
      // C: 有意不注册（constants 注释明确声明已迁移）
      orphanReport.push({
        type: 'C',
        name: w.baseName,
        file: w.fileName,
        refs: refs.length,
        refFiles: refs.slice(0, 3),
        note: `有意不注册：cockpit.constants.ts 声明「${migratedLine}」`,
      })
      warnings.push({
        level: 'P2',
        msg: `Widget [C 类-有意不注册] ${w.baseName}：被 ${refs.length} 处直接 import，constants 已声明迁移，运行时机制不可用`,
      })
    } else {
      // B: 漏注册（被引用但既未注册、也无迁移声明）
      orphanReport.push({
        type: 'B',
        name: w.baseName,
        file: w.fileName,
        refs: refs.length,
        refFiles: refs.slice(0, 3),
        note: '疑似漏注册：被 import 但未在 widgetRegistry 注册、constants 也无迁移声明',
      })
      issues.push({
        level: 'P1',
        msg: `孤儿 Widget [B 类-漏注册] ${w.baseName}：被 ${refs.length} 处直接 import 但未在 widgetRegistry 注册（${refs.slice(0, 2).join(', ')}）`,
      })
    }
  }

  // 4. 双向检查：widgetRegistry 中的 Widget 是否在 componentRegistry 中有消费方引用
  for (const id of widgetIds) {
    const idLower = id.toLowerCase()
    const found = consumerRefs.some((ref) =>
      ref.widgetRefs.some((wr) => wr.toLowerCase().includes(idLower) || wr.toLowerCase().includes('widgetregistry')),
    )
    if (!found) {
      warnings.push({
        level: 'P2',
        msg: `Widget "${id}" 未在 componentRegistry (organismRegistry) 的 consumers 中被引用`,
      })
    }
  }

  // 5. 检查 componentRegistry 中引用的 Widget 是否有效
  const knownWidgets = new Set([
    ...widgetIds.map((w) => w.toLowerCase()),
    ...diskWidgets.map((w) => w.stem.toLowerCase()),
    'widgetshell',
    'widgeterrorboundary',
    'cockpitlayout',
    'cockpitshell',
    'widgetregistry',
    '全 cockpit widget',
  ])
  for (const ref of consumerRefs) {
    for (const wr of ref.widgetRefs) {
      const wrLower = wr.toLowerCase()
      const isKnown = [...knownWidgets].some((kw) => wrLower.includes(kw))
      if (isKnown) continue
      issues.push({
        level: 'P0',
        msg: `componentRegistry 中 "${ref.name}" 引用的 "${wr}" 无法匹配到任何 Widget（既不在 widgetRegistry 中，也无对应文件）`,
      })
    }
  }

  return {
    issues,
    warnings,
    orphanReport,
    widgetCount: widgetIds.length,
    consumerRefCount: consumerRefs.length,
    diskWidgetCount: diskWidgets.length,
  }
}

// ============================================================
// Store / Service 注册表双向一致性
// ============================================================

function extractRegistryEntries(filePath) {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries = []
  const entryRegex = /\{\s*id:\s*'([^']+)'[^}]*?filePath:\s*'([^']+)'[^}]*?(?:status:\s*'([^']+)'[^}]*?)?\}/g
  let m
  while ((m = entryRegex.exec(content)) !== null) {
    entries.push({ id: m[1], filePath: m[2], status: m[3] || 'unknown' })
  }
  return entries
}

function resolveRegistryFile(filePath) {
  let p = path.join(ROOT, filePath)
  for (const ext of ['.ts', '.tsx']) {
    if (fs.existsSync(p + ext)) return p + ext
  }
  if (fs.existsSync(p)) return p
  return null
}

function listStoreFilesOnDisk() {
  if (!fs.existsSync(STORE_DIR)) return []
  return fs
    .readdirSync(STORE_DIR)
    .filter((f) => /^[a-zA-Z].*Store\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !/\.d\.ts$/.test(f))
    .map((f) => ({ fileName: f, baseName: f.replace(/\.(ts|tsx)$/, '') }))
}

function listServiceFilesOnDisk() {
  if (!fs.existsSync(SERVICES_DIR)) return []
  const result = []
  const walk = (dir, base = '') => {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const full = path.join(dir, item)
      const rel = base ? `${base}/${item}` : item
      if (fs.statSync(full).isDirectory()) {
        walk(full, rel)
      } else if (/^[a-zA-Z].*Service\.(ts|tsx)$/.test(item) && !/\.test\./.test(item) && !/\.d\.ts$/.test(item)) {
        result.push({ fileName: item, baseName: item.replace(/\.(ts|tsx)$/, ''), relPath: `src/services/${rel}` })
      }
    }
  }
  walk(SERVICES_DIR)
  return result
}

function validateStoreRegistry() {
  const issues = []
  const warnings = []
  if (!fs.existsSync(STORE_REGISTRY_PATH)) {
    return { issues: [{ level: 'P1', msg: 'storeRegistry.ts 不存在' }], warnings, entries: 0, diskCount: 0 }
  }
  const entries = extractRegistryEntries(STORE_REGISTRY_PATH)
  const diskFiles = listStoreFilesOnDisk()

  // 正向：每个 registry 条目指向的文件是否存在
  for (const e of entries) {
    const resolved = resolveRegistryFile(e.filePath)
    if (!resolved) {
      issues.push({ level: 'P1', msg: `STORE_REGISTRY 条目 "${e.id}" 指向的文件不存在: ${e.filePath}` })
    }
  }

  // 反向：磁盘上的 Store 文件是否都已登记
  const registeredIds = new Set(entries.map((e) => e.id.toLowerCase()))
  for (const f of diskFiles) {
    if (!registeredIds.has(f.baseName.toLowerCase())) {
      warnings.push({
        level: 'P2',
        msg: `Store 文件 ${f.fileName} 在磁盘上存在但未登记到 storeRegistry.ts`,
      })
    }
  }

  return { issues, warnings, entries: entries.length, diskCount: diskFiles.length }
}

function validateServiceRegistry() {
  const issues = []
  const warnings = []
  if (!fs.existsSync(SERVICE_REGISTRY_PATH)) {
    return { issues: [{ level: 'P1', msg: 'serviceRegistry.ts 不存在' }], warnings, entries: 0, diskCount: 0 }
  }
  const entries = extractRegistryEntries(SERVICE_REGISTRY_PATH)
  const diskFiles = listServiceFilesOnDisk()

  // 正向
  for (const e of entries) {
    const resolved = resolveRegistryFile(e.filePath)
    if (!resolved) {
      issues.push({ level: 'P1', msg: `SERVICE_REGISTRY 条目 "${e.id}" 指向的文件不存在: ${e.filePath}` })
    }
  }

  // 反向
  const registeredIds = new Set(entries.map((e) => e.id.toLowerCase()))
  for (const f of diskFiles) {
    if (!registeredIds.has(f.baseName.toLowerCase())) {
      warnings.push({
        level: 'P2',
        msg: `Service 文件 ${f.relPath} 在磁盘上存在但未登记到 serviceRegistry.ts`,
      })
    }
  }

  return { issues, warnings, entries: entries.length, diskCount: diskFiles.length }
}

// ============================================================
// 门禁执行器
// ============================================================

function runGate(gate) {
  const start = Date.now()
  try {
    execFileSync(NPM, ['run', gate.npm], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 180000,
      encoding: 'utf-8',
      shell: true,
    })
    return { ...gate, passed: true, duration: Date.now() - start, error: null }
  } catch (e) {
    const msg = e.stderr
      ? e.stderr.toString().split('\n').slice(-3).join('\n')
      : e.message || 'unknown'
    return { ...gate, passed: false, duration: Date.now() - start, error: msg }
  }
}

// ============================================================
// 报告渲染
// ============================================================

function icon(ok) {
  return ok ? '\u2705' : '\uD83D\uDD34'
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function renderReport(results, crossResult, storeResult, serviceResult, mode, jsonMode) {
  const allResults = [
    ...results.p0.map((r) => ({ ...r, group: 'P0' })),
    ...(mode !== 'quick' ? results.p1.map((r) => ({ ...r, group: 'P1' })) : []),
    ...(mode === 'full' ? results.p2.map((r) => ({ ...r, group: 'P2' })) : []),
  ]

  const p0Failed = results.p0.filter((r) => !r.passed)
  const p1Failed = results.p1.filter((r) => !r.passed)
  const p2Failed = results.p2.filter((r) => !r.passed)
  const crossP0Failed = crossResult.issues.filter((i) => i.level === 'P0')
  const crossP1Failed = crossResult.issues.filter((i) => i.level === 'P1')

  const totalPassed = allResults.filter((r) => r.passed).length
  const total = allResults.length

  if (jsonMode) {
    return {
      timestamp: new Date().toISOString(),
      mode,
      summary: {
        overall: p0Failed.length === 0 && crossP0Failed.length === 0 ? 'PASS' : 'FAIL',
        p0: { passed: results.p0.length - p0Failed.length, total: results.p0.length, failed: p0Failed.length },
        p1: { passed: results.p1.length - p1Failed.length, total: results.p1.length, failed: p1Failed.length },
        p2: { passed: results.p2.length - p2Failed.length, total: results.p2.length, failed: p2Failed.length },
        cross: {
          issues: crossResult.issues.length,
          warnings: crossResult.warnings.length,
          widgetCount: crossResult.widgetCount || 0,
          diskWidgetCount: crossResult.diskWidgetCount || 0,
        },
        store: {
          issues: storeResult.issues.length,
          warnings: storeResult.warnings.length,
          entries: storeResult.entries,
          diskCount: storeResult.diskCount,
        },
        service: {
          issues: serviceResult.issues.length,
          warnings: serviceResult.warnings.length,
          entries: serviceResult.entries,
          diskCount: serviceResult.diskCount,
        },
      },
      gates: allResults.map((r) => ({
        id: r.id,
        group: r.group,
        desc: r.desc,
        passed: r.passed,
        duration: r.duration,
        error: r.error || null,
      })),
      crossValidation: {
        issues: crossResult.issues,
        warnings: crossResult.warnings,
        widgetCount: crossResult.widgetCount || 0,
        diskWidgetCount: crossResult.diskWidgetCount || 0,
        consumerRefCount: crossResult.consumerRefCount || 0,
        orphanReport: crossResult.orphanReport || [],
      },
      storeValidation: storeResult,
      serviceValidation: serviceResult,
    }
  }

  const lines = []

  lines.push('')
  lines.push('\u2554\u2550'.repeat(55) + '\u2557')
  lines.push('\u2551  \u3010 组件/Widget 注册表同步验证 \u3011'.padEnd(56) + '\u2551')
  lines.push('\u255a\u2550'.repeat(55) + '\u255d')
  lines.push('')

  // P0 关键门禁
  lines.push('  \u001b[1mP0 关键门禁\u001b[0m')
  lines.push('  ' + '\u2500'.repeat(50))
  for (const r of results.p0) {
    lines.push(`  ${icon(r.passed)} ${r.id.padEnd(18)} ${r.desc.padEnd(22)} ${formatDuration(r.duration)}`)
    if (!r.passed && r.error) {
      lines.push(`     \u2514\u2500 \u001b[31m${r.error.split('\n')[0].slice(0, 70)}\u001b[0m`)
    }
  }

  if (mode !== 'quick') {
    lines.push('')
    lines.push('  \u001b[1mP1 重要检查\u001b[0m')
    lines.push('  ' + '\u2500'.repeat(50))
    for (const r of results.p1) {
      lines.push(`  ${icon(r.passed)} ${r.id.padEnd(18)} ${r.desc.padEnd(22)} ${formatDuration(r.duration)}`)
      if (!r.passed && r.error) {
        lines.push(`     \u2514\u2500 \u001b[33m${r.error.split('\n')[0].slice(0, 70)}\u001b[0m`)
      }
    }
  }

  if (mode === 'full') {
    lines.push('')
    lines.push('  \u001b[1mP2 辅助验证\u001b[0m')
    lines.push('  ' + '\u2500'.repeat(50))
    for (const r of results.p2) {
      lines.push(`  ${icon(r.passed)} ${r.id.padEnd(18)} ${r.desc.padEnd(22)} ${formatDuration(r.duration)}`)
      if (!r.passed && r.error) {
        lines.push(`     \u2514\u2500 \u001b[36m${r.error.split('\n')[0].slice(0, 70)}\u001b[0m`)
      }
    }
  }

  // 跨注册表验证
  lines.push('')
  lines.push('  \u001b[1m跨注册表交叉验证 (widgetRegistry \u2194 componentRegistry)\u001b[0m')
  lines.push('  ' + '\u2500'.repeat(50))
  lines.push(`  \u2139  已注册 Widget 数量: ${crossResult.widgetCount || 0}  |  磁盘 Widget 文件: ${crossResult.diskWidgetCount || 0}`)
  lines.push(`  \u2139  componentRegistry Widget 引用数: ${crossResult.consumerRefCount || 0}`)

  // 孤儿 Widget 分类报告
  const orphanReport = crossResult.orphanReport || []
  const typeA = orphanReport.filter((o) => o.type === 'A')
  const typeB = orphanReport.filter((o) => o.type === 'B')
  const typeC = orphanReport.filter((o) => o.type === 'C')
  const typeD = orphanReport.filter((o) => o.type === 'D')

  lines.push('')
  lines.push(`  \u001b[1mWidget 孤儿诊断\u001b[0m`)
  lines.push(`  \u2139  D 类（正常注册）: ${typeD.length}  |  C 类（有意不注册）: ${typeC.length}  |  B 类（漏注册）: ${typeB.length}  |  A 类（死代码）: ${typeA.length}`)

  if (typeA.length > 0) {
    lines.push(`  \u274c [A 类-死代码] 建议删除文件:`)
    for (const o of typeA) {
      lines.push(`     - ${o.name}  (${o.file})`)
    }
  }
  if (typeB.length > 0) {
    lines.push(`  \u26a0\ufe0f [B 类-漏注册] 需补齐 widgetRegistry 三件套:`)
    for (const o of typeB) {
      lines.push(`     - ${o.name}  (refs=${o.refs}, ${o.refFiles.join(', ')})`)
    }
  }
  if (typeC.length > 0) {
    lines.push(`  \u2139\ufe0f [C 类-有意不注册] 已在 constants 声明迁移:`)
    for (const o of typeC) {
      lines.push(`     - ${o.name}  (refs=${o.refs}, ${o.note})`)
    }
  }

  if (crossResult.issues.length === 0 && crossResult.warnings.length === 0) {
    lines.push('  \u2705 无跨注册表同步问题')
  } else {
    for (const issue of crossResult.issues) {
      if (issue.msg.startsWith('孤儿 Widget [')) continue
      const tag = issue.level === 'P0' ? '\u274c' : '\u26a0\ufe0f'
      const color = issue.level === 'P0' ? '31' : '33'
      lines.push(`  ${tag} [${issue.level}] \u001b[${color}m${issue.msg}\u001b[0m`)
    }
    for (const w of crossResult.warnings) {
      if (w.msg.startsWith('Widget [C 类')) continue
      lines.push(`  \u26a0\ufe0f [${w.level}] \u001b[36m${w.msg}\u001b[0m`)
    }
  }

  // Store 注册表验证
  if (mode !== 'quick' && mode !== 'widget') {
    lines.push('')
    lines.push('  \u001b[1mStore 注册表双向一致性\u001b[0m')
    lines.push('  ' + '\u2500'.repeat(50))
    lines.push(`  \u2139  条目数: ${storeResult.entries}  |  磁盘 Store 文件: ${storeResult.diskCount}`)
    if (storeResult.issues.length === 0 && storeResult.warnings.length === 0) {
      lines.push('  \u2705 Store 注册表一致')
    } else {
      for (const issue of storeResult.issues) {
        lines.push(`  \u26a0\ufe0f [${issue.level}] \u001b[33m${issue.msg}\u001b[0m`)
      }
      for (const w of storeResult.warnings) {
        lines.push(`  \u2139\ufe0f [${w.level}] \u001b[36m${w.msg}\u001b[0m`)
      }
    }

    lines.push('')
    lines.push('  \u001b[1mService 注册表双向一致性\u001b[0m')
    lines.push('  ' + '\u2500'.repeat(50))
    lines.push(`  \u2139  条目数: ${serviceResult.entries}  |  磁盘 Service 文件: ${serviceResult.diskCount}`)
    if (serviceResult.issues.length === 0 && serviceResult.warnings.length === 0) {
      lines.push('  \u2705 Service 注册表一致')
    } else {
      for (const issue of serviceResult.issues) {
        lines.push(`  \u26a0\ufe0f [${issue.level}] \u001b[33m${issue.msg}\u001b[0m`)
      }
      for (const w of serviceResult.warnings) {
        lines.push(`  \u2139\ufe0f [${w.level}] \u001b[36m${w.msg}\u001b[0m`)
      }
    }
  }

  // 汇总结论
  lines.push('')
  lines.push('  ' + '\u2500'.repeat(50))
  const overall = p0Failed.length === 0 && crossP0Failed.length === 0
  const crossIssueCount = (crossResult.issues || []).length + (crossResult.warnings || []).length
  const storeIssueCount = (storeResult.issues || []).length + (storeResult.warnings || []).length
  const serviceIssueCount = (serviceResult.issues || []).length + (serviceResult.warnings || []).length
  lines.push(`  \u001b[1m总结\u001b[0m: ${totalPassed}/${total} 通过  |  P0 失败 ${p0Failed.length}  |  Widget 问题 ${crossIssueCount}  |  Store 问题 ${storeIssueCount}  |  Service 问题 ${serviceIssueCount}`)
  lines.push(`  \u001b[1m结论\u001b[0m: ${overall ? '\u2705 PASS (\u53ef\u63d0\u4ea4)' : '\u274c FAIL (\u5b58\u5728\u963b\u65ad\u9879)'}`)
  lines.push('')

  return lines.join('\n')
}

// ============================================================
// 主入口
// ============================================================

function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const widgetOnly = args.includes('--widget')
  const quickMode = args.includes('--quick')
  const storeOnly = args.includes('--store')
  const orphanOnly = args.includes('--orphan')
  const mode = orphanOnly ? 'orphan' : widgetOnly ? 'widget' : storeOnly ? 'store' : quickMode ? 'quick' : 'full'

  if (jsonMode) {
    process.stderr.write('Running verification...\n')
  }

  // --orphan 模式：仅运行跨注册表孤儿诊断（最快的诊断模式）
  if (mode === 'orphan') {
    const crossResult = crossValidateRegistries()
    const summary = {
      mode: 'orphan',
      widgetCount: crossResult.widgetCount,
      diskWidgetCount: crossResult.diskWidgetCount,
      orphanReport: crossResult.orphanReport,
      issues: crossResult.issues,
      warnings: crossResult.warnings,
    }
    if (jsonMode) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
    } else {
      const orphanReport = crossResult.orphanReport || []
      const typeA = orphanReport.filter((o) => o.type === 'A')
      const typeB = orphanReport.filter((o) => o.type === 'B')
      const typeC = orphanReport.filter((o) => o.type === 'C')
      const typeD = orphanReport.filter((o) => o.type === 'D')
      console.log('')
      console.log('  Widget 孤儿诊断（仅诊断，不跑门禁）')
      console.log('  ' + '\u2500'.repeat(50))
      console.log(`  已注册: ${crossResult.widgetCount}  |  磁盘文件: ${crossResult.diskWidgetCount}`)
      console.log(`  D 类（正常）: ${typeD.length}  |  C 类（有意不注册）: ${typeC.length}  |  B 类（漏注册）: ${typeB.length}  |  A 类（死代码）: ${typeA.length}`)
      if (typeA.length > 0) {
        console.log('\n  A 类-死代码（建议删除）:')
        for (const o of typeA) console.log(`    - ${o.name}  (${o.file})`)
      }
      if (typeB.length > 0) {
        console.log('\n  B 类-漏注册（需补齐 widgetRegistry 三件套）:')
        for (const o of typeB) console.log(`    - ${o.name}  refs=${o.refs}  ${o.refFiles.join(', ')}`)
      }
      if (typeC.length > 0) {
        console.log('\n  C 类-有意不注册（已在 constants 声明迁移）:')
        for (const o of typeC) console.log(`    - ${o.name}  refs=${o.refs}  ${o.note}`)
      }
      console.log('')
    }
    const hasP1 = (crossResult.issues || []).some((i) => i.level === 'P1' || i.level === 'P0')
    process.exit(hasP1 ? 1 : 0)
  }

  // 选择门禁集
  let p0Gates = GATE_P0
  let p1Gates = GATE_P1
  let p2Gates = GATE_P2

  if (mode === 'widget') {
    p0Gates = GATE_P0.filter((g) => ['tsc:prod', 'widget-registry', 'atomic'].includes(g.id))
    p1Gates = GATE_P1.filter((g) => ['registry', 'hardcode'].includes(g.id))
    p2Gates = []
  } else if (mode === 'store') {
    // --store 模式：跑 Store/Service 验证 + 注册表完整性强相关门禁
    p0Gates = GATE_P0.filter((g) => ['tsc:prod'].includes(g.id))
    p1Gates = GATE_P1.filter((g) => ['registry'].includes(g.id))
    p2Gates = []
  } else if (mode === 'quick') {
    p1Gates = []
    p2Gates = []
  }

  // 执行
  const p0Results = p0Gates.map(runGate)
  const p1Results = p1Gates.map(runGate)
  const p2Results = p2Gates.map(runGate)

  // 跨注册表验证（widget + constants）
  const crossResult = crossValidateRegistries()

  // Store / Service 注册表验证（除非 widget-only 模式）
  const storeResult = mode === 'widget' ? { issues: [], warnings: [], entries: 0, diskCount: 0 } : validateStoreRegistry()
  const serviceResult = mode === 'widget' ? { issues: [], warnings: [], entries: 0, diskCount: 0 } : validateServiceRegistry()

  const results = {
    p0: p0Results,
    p1: p1Results,
    p2: p2Results,
  }

  const output = renderReport(results, crossResult, storeResult, serviceResult, mode, jsonMode)

  if (jsonMode) {
    process.stdout.write(JSON.stringify(output, null, 2) + '\n')
  } else {
    // eslint-disable-next-line no-console
    console.log(output)
  }

  // 退出码：仅 P0 阻断，P1/P2 失败不影响退出码
  const p0Failed = p0Results.filter((r) => !r.passed)
  const crossP0Failed = (crossResult.issues || []).filter((i) => i.level === 'P0')
  const hasP0 = p0Failed.length > 0 || crossP0Failed.length > 0

  process.exit(hasP0 ? 1 : 0)
}

main()