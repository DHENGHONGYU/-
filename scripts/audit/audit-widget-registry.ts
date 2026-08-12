/**
 * @module audit-widget-registry
 * @description 驾驶舱 Widget 三处注册一致性审计
 *
 * 自动校验 Widget 注册体系的一致性，消除"靠人记忆同步三处"的高成本与高出错率：
 * - 第一处：`src/cockpit/core/widgetRegistry.ts` 的 `registerDefaultWidgets()` 注册列表
 * - 第二处：`src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG` 配置 keys
 * - 第三处：`src/constants/cockpit.constants.ts` 的 `WIDGET_DEFAULT_DATA_SOURCE` 数据源 keys
 *
 * 校验维度：
 * 1. 三处 key 集合一致性（registry ↔ config ↔ dataSource）
 * 2. 组件文件存在性（registry id → `src/cockpit/widgets/XxxWidget.tsx`）
 * 3. 默认布局覆盖性（registry id → `defaultLayout` 是否包含）
 *
 * 退出码：0=通过，1=有 P0 违规
 *
 * @example
 * ```bash
 * npm run audit:widget-registry
 * node ./node_modules/tsx/dist/cli.mjs scripts/audit-widget-registry.ts
 * ```
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const REGISTRY_FILE = path.join(ROOT, 'src', 'cockpit', 'core', 'widgetRegistry.ts')
const CONSTANTS_FILE = path.join(ROOT, 'src', 'constants', 'cockpit.constants.ts')
const WIDGETS_DIR = path.join(ROOT, 'src', 'cockpit', 'widgets')
const SRC_DIR = path.join(ROOT, 'src')

// ============================================================
// 类型
// ============================================================

interface Violation {
  level: 'P0' | 'P1'
  widgetId: string
  message: string
  details: string[]
}

interface AuditResult {
  registryIds: string[]
  configKeys: string[]
  dataSourceKeys: string[]
  layoutIds: string[]
  violations: Violation[]
  widgetFilesChecked: number
  widgetFilesMissing: number
}

// ============================================================
// 解析函数
// ============================================================

/**
 * 从 widgetRegistry.ts 提取所有已注册的 Widget id
 * 匹配模式：`id: 'xxx'`（在 registerDefaultWidgets 数组中）
 */
function extractRegistryIds(content: string): string[] {
  const regex = /id:\s*'([^']+)'/g
  const ids: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

/**
 * 从 widgetRegistry.ts 提取 defaultLayout 中的 widgetId
 * 匹配模式：`widgetId: 'xxx'`（在 createDefaultInstances 中）
 */
function extractDefaultLayoutIds(content: string): string[] {
  const regex = /widgetId:\s*'([^']+)'/g
  const ids: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

/**
 * 转义正则特殊字符（用于把对象名安全地拼进正则）
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 从 cockpit.constants.ts 提取指定对象的顶层 key 列表
 *
 * ⚠️ 兼容性修复（2026-07-24）：旧实现用字面量 `objName = {` 经 `indexOf` 定位对象起点，
 * 但当声明带 TypeScript 类型注解（如 `export const WIDGET_DEFAULT_DATA_SOURCE: Record<string, DataSourceConfig> = {`）
 * 时，字面量 `WIDGET_DEFAULT_DATA_SOURCE = {` 在源码中并不存在，`indexOf` 返回 -1，导致解析为空数组，
 * 进而误报全部 21 个 widget「已注册但 WIDGET_DEFAULT_DATA_SOURCE 中缺少数据源配置」等 P0（共 42 假阳性）。
 * 现改为正则匹配 `objName` 后接「可选类型注解」再接 `= {`，兼容两种声明形式。
 */
function extractTopLevelKeys(content: string, objName: string): string[] {
  const startRegex = new RegExp(`${escapeRegExp(objName)}(?:\\s*:\\s*[^=]*?)?\\s*=\\s*\\{`)
  const startMatch = startRegex.exec(content)
  if (!startMatch) return []

  const afterMarker = content.slice(startMatch.index + startMatch[0].length)
  const endMatch = afterMarker.match(/\n\}/)
  if (!endMatch || endMatch.index === undefined) return []

  const objBody = afterMarker.slice(0, endMatch.index)
  const keyRegex = /^  (\w+):\s*\{/gm
  const keys: string[] = []
  let match: RegExpExecArray | null
  while ((match = keyRegex.exec(objBody)) !== null) {
    keys.push(match[1])
  }
  return keys
}

/**
 * camelCase 转 PascalCase
 * @example toPascalCase('marketIndices') → 'MarketIndices'
 */
function toPascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * 检查 Widget 组件文件是否存在
 * 命名规则：`src/cockpit/widgets/{PascalCase}Widget.tsx`
 */
function checkWidgetFileExists(widgetId: string): { exists: boolean; fileName: string; filePath: string } {
  const fileName = `${toPascalCase(widgetId)}Widget.tsx`
  const filePath = path.join(WIDGETS_DIR, fileName)
  return { exists: fs.existsSync(filePath), fileName, filePath }
}

/**
 * 从 widgetRegistry.ts 提取 id → component import 路径 的映射。
 *
 * 用于精确校验组件文件存在性：避免按 id 猜测文件名（{PascalCase}Widget.tsx）
 * 导致的误报。例如 id='signalQuality' 实际对应文件 SignalQualityDashboardWidget.tsx，
 * 但 registry 中通过 `component: () => import('@/cockpit/widgets/SignalQualityDashboardWidget')`
 * 显式声明了真实路径，应以该路径为准。
 *
 * 解析策略：对每个 `id: 'X'`，取其后方最近的 `import('...')` 路径（同一模板对象内）。
 */
function extractIdImportMap(content: string): Map<string, string> {
  const idRegex = /id:\s*'([^']+)'/g
  const importRegex = /import\(\s*'([^']+)'\s*\)/g
  const ids: { id: string; pos: number }[] = []
  let m: RegExpExecArray | null
  while ((m = idRegex.exec(content)) !== null) {
    ids.push({ id: m[1], pos: m.index })
  }
  const imports: { importPath: string; pos: number }[] = []
  while ((m = importRegex.exec(content)) !== null) {
    imports.push({ importPath: m[1], pos: m.index })
  }
  const map = new Map<string, string>()
  for (const idEntry of ids) {
    let best: string | null = null
    let bestPos = Infinity
    for (const imp of imports) {
      if (imp.pos > idEntry.pos && imp.pos < bestPos) {
        best = imp.importPath
        bestPos = imp.pos
      }
    }
    if (best) map.set(idEntry.id, best)
  }
  return map
}

/**
 * 将 registry 中的 import 路径（如 '@/cockpit/widgets/XxxWidget'）解析为磁盘绝对路径。
 * '@/' 别名映射到项目根 src/ 目录。
 */
function resolveImportPath(importPath: string): string {
  const rel = importPath.replace(/^@\//, '')
  let p = path.join(SRC_DIR, rel)
  if (!/\.(tsx?|jsx?)$/.test(p)) p += '.tsx'
  return p
}

// ============================================================
// 校验逻辑
// ============================================================

/**
 * 执行三处注册一致性校验
 */
function runAudit(): AuditResult {
  const registryContent = fs.readFileSync(REGISTRY_FILE, 'utf-8')
  const constantsContent = fs.readFileSync(CONSTANTS_FILE, 'utf-8')

  const registryIds = extractRegistryIds(registryContent)
  const configKeys = extractTopLevelKeys(constantsContent, 'DEFAULT_WIDGET_CONFIG')
  const dataSourceKeys = extractTopLevelKeys(constantsContent, 'WIDGET_DEFAULT_DATA_SOURCE')
  const layoutIds = extractDefaultLayoutIds(registryContent)
  const idImportMap = extractIdImportMap(registryContent)

  const violations: Violation[] = []
  let widgetFilesChecked = 0
  let widgetFilesMissing = 0

  const registrySet = new Set(registryIds)
  const configSet = new Set(configKeys)
  const dataSourceSet = new Set(dataSourceKeys)
  const layoutSet = new Set(layoutIds)

  // 校验 1：registry 中的 id 必须在 config 和 dataSource 中都存在
  for (const id of registryIds) {
    if (!configSet.has(id)) {
      violations.push({
        level: 'P0',
        widgetId: id,
        message: `已注册但 DEFAULT_WIDGET_CONFIG 中缺少配置`,
        details: [
          `widgetRegistry.ts: id='${id}' 已注册`,
          `cockpit.constants.ts: DEFAULT_WIDGET_CONFIG.${id} 不存在`,
          `影响：运行时 meta.name/category/defaultSize 将为 undefined，Widget 标题为空或崩溃`,
        ],
      })
    }
    if (!dataSourceSet.has(id)) {
      violations.push({
        level: 'P0',
        widgetId: id,
        message: `已注册但 WIDGET_DEFAULT_DATA_SOURCE 中缺少数据源配置`,
        details: [
          `widgetRegistry.ts: id='${id}' 已注册`,
          `cockpit.constants.ts: WIDGET_DEFAULT_DATA_SOURCE.${id} 不存在`,
          `影响：运行时 meta.defaultDataSource 将为 undefined，Widget 无法获取数据`,
        ],
      })
    }
  }

  // 校验 2：config 和 dataSource 中的 key 必须在 registry 中注册
  for (const key of configKeys) {
    if (!registrySet.has(key)) {
      violations.push({
        level: 'P0',
        widgetId: key,
        message: `DEFAULT_WIDGET_CONFIG 中有配置但未在 widgetRegistry 中注册组件`,
        details: [
          `cockpit.constants.ts: DEFAULT_WIDGET_CONFIG.${key} 已配置`,
          `widgetRegistry.ts: 未找到 id='${key}' 的注册`,
          `影响：配置存在但 Widget 不会被加载，用户无法使用`,
        ],
      })
    }
  }

  for (const key of dataSourceKeys) {
    if (!registrySet.has(key)) {
      violations.push({
        level: 'P0',
        widgetId: key,
        message: `WIDGET_DEFAULT_DATA_SOURCE 中有数据源但未在 widgetRegistry 中注册组件`,
        details: [
          `cockpit.constants.ts: WIDGET_DEFAULT_DATA_SOURCE.${key} 已配置`,
          `widgetRegistry.ts: 未找到 id='${key}' 的注册`,
          `影响：数据源配置存在但 Widget 不会被加载，配置冗余`,
        ],
      })
    }
  }

  // 校验 3：config 和 dataSource 之间的一致性
  for (const key of configKeys) {
    if (!dataSourceSet.has(key)) {
      violations.push({
        level: 'P0',
        widgetId: key,
        message: `DEFAULT_WIDGET_CONFIG 中有配置但 WIDGET_DEFAULT_DATA_SOURCE 中缺少数据源`,
        details: [
          `DEFAULT_WIDGET_CONFIG.${key}: 已配置`,
          `WIDGET_DEFAULT_DATA_SOURCE.${key}: 不存在`,
          `影响：Widget 标题/尺寸正常但无数据，用户看到空 Widget`,
        ],
      })
    }
  }
  for (const key of dataSourceKeys) {
    if (!configSet.has(key)) {
      violations.push({
        level: 'P0',
        widgetId: key,
        message: `WIDGET_DEFAULT_DATA_SOURCE 中有数据源但 DEFAULT_WIDGET_CONFIG 中缺少配置`,
        details: [
          `WIDGET_DEFAULT_DATA_SOURCE.${key}: 已配置`,
          `DEFAULT_WIDGET_CONFIG.${key}: 不存在`,
          `影响：Widget 有数据但无标题/尺寸，显示异常`,
        ],
      })
    }
  }

  // 校验 4：组件文件存在性（基于 registry 中真实的 import('...') 路径，避免按 id 猜文件名误报）
  for (const id of registryIds) {
    widgetFilesChecked++
    const importPath = idImportMap.get(id)
    const targetPath = importPath ? resolveImportPath(importPath) : checkWidgetFileExists(id).filePath
    if (!fs.existsSync(targetPath)) {
      widgetFilesMissing++
      violations.push({
        level: 'P0',
        widgetId: id,
        message: `组件文件不存在`,
        details: [
          `期望路径: ${targetPath}`,
          importPath ? `registry import: ${importPath}` : `（未找到 import 路径，按命名约定推测文件名）`,
          `影响：dynamic import 将在运行时失败，Widget 加载报错`,
        ],
      })
    }
  }

  // 校验 5：默认布局覆盖性（P1 警告）
  for (const id of registryIds) {
    if (!layoutSet.has(id)) {
      violations.push({
        level: 'P1',
        widgetId: id,
        message: `已注册但未在 defaultLayout 中配置默认布局位置`,
        details: [
          `widgetRegistry.ts: id='${id}' 已注册`,
          `createDefaultInstances() 的 defaultLayout 中未包含此 Widget`,
          `影响：用户首次打开驾驶舱时看不到此 Widget，需手动添加`,
        ],
      })
    }
  }

  return {
    registryIds,
    configKeys,
    dataSourceKeys,
    layoutIds,
    violations,
    widgetFilesChecked,
    widgetFilesMissing,
  }
}

// ============================================================
// 报告输出
// ============================================================

function printReport(result: AuditResult): void {
  const { registryIds, configKeys, dataSourceKeys, layoutIds, violations, widgetFilesChecked, widgetFilesMissing } = result

  console.log('')
  console.log('=== Widget Registry Audit ===')
  console.log('')
  console.log(`  Registered widgets (widgetRegistry.ts)    : ${registryIds.length}`)
  console.log(`  Config keys (DEFAULT_WIDGET_CONFIG)       : ${configKeys.length}`)
  console.log(`  Data source keys (WIDGET_DEFAULT_DATA_SOURCE): ${dataSourceKeys.length}`)
  console.log(`  Default layout entries                    : ${layoutIds.length}`)
  console.log(`  Component files checked                   : ${widgetFilesChecked} (missing: ${widgetFilesMissing})`)
  console.log('')

  const p0Violations = violations.filter((v) => v.level === 'P0')
  const p1Warnings = violations.filter((v) => v.level === 'P1')

  if (p0Violations.length > 0) {
    console.log(`--- P0 Violations (${p0Violations.length}) ---`)
    console.log('')
    for (const v of p0Violations) {
      console.log(`  [P0] ${v.widgetId}: ${v.message}`)
      for (const detail of v.details) {
        console.log(`        ${detail}`)
      }
      console.log('')
    }
  }

  if (p1Warnings.length > 0) {
    console.log(`--- P1 Warnings (${p1Warnings.length}) ---`)
    console.log('')
    for (const v of p1Warnings) {
      console.log(`  [P1] ${v.widgetId}: ${v.message}`)
      for (const detail of v.details) {
        console.log(`        ${detail}`)
      }
      console.log('')
    }
  }

  console.log('--- Summary ---')
  console.log(`  P0 violations : ${p0Violations.length}`)
  console.log(`  P1 warnings   : ${p1Warnings.length}`)
  console.log('')

  if (p0Violations.length > 0) {
    console.log('  Result: FAIL (exit 1)')
    console.log('')
    console.log('  修复指南:')
    console.log('    1. 三处注册必须同步：widgetRegistry.ts + DEFAULT_WIDGET_CONFIG + WIDGET_DEFAULT_DATA_SOURCE')
    console.log('    2. 参考 docs/explanation/design/widget-integration-checklist.md')
    console.log('    3. 或运行 npm run scaffold:widget <widgetId> <title> <category> 一键生成三处注册')
  } else if (p1Warnings.length > 0) {
    console.log('  Result: PASS with warnings (exit 0)')
  } else {
    console.log('  Result: PASS (exit 0)')
  }
  console.log('')
}

// ============================================================
// 主入口
// ============================================================

function main(): void {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`Error: Registry file not found: ${REGISTRY_FILE}`)
    process.exit(2)
  }
  if (!fs.existsSync(CONSTANTS_FILE)) {
    console.error(`Error: Constants file not found: ${CONSTANTS_FILE}`)
    process.exit(2)
  }

  const result = runAudit()
  printReport(result)

  const hasP0 = result.violations.some((v) => v.level === 'P0')
  process.exit(hasP0 ? 1 : 0)
}

main()
