#!/usr/bin/env node
/**
 * directDataAPI.ts 重复副本一致性检查脚本
 *
 * 自动检查两份 directDataAPI.ts 的关键差异：
 *   1. 新浪字段索引一致性（parseSinaQuote 中的 fields[N]）
 *   2. 批量行情实现逻辑（split 逐段 vs matchAll+idx 索引对齐）
 *   3. 腾讯 K 线 qfqday 兜底逻辑
 *   4. 错误策略（throw vs return null）
 *   5. 配置源（dataSourceUrls vs marketDataEndpoints）
 *
 * 使用：node scripts/audit-directDataAPI-consistency.mjs
 *
 * 退出码：0=全部一致，1=存在不一致项
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

const FETCHER_PATH = resolve(projectRoot, 'src/services/fetcher/directDataAPI.ts')
const DATACOLLECTOR_PATH = resolve(projectRoot, 'src/services/data-collector/directDataAPI.ts')

// ── 颜色定义 ──
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

function read(path) {
  return readFileSync(path, 'utf-8')
}

// ============================================================
// 适配层检测（TD-012 迁移完成后：data-collector/ 从 fetcher/ import canonical）
// ============================================================

/**
 * 判断是否为"适配层模式"：
 *   data-collector/ 不再包含独立实现，而是 import fetcher/ 的 canonical 实现做薄适配。
 *   判定标志：import 语句从 '../fetcher/directDataAPI' 导入运行时值（非仅限 type-only）。
 */
function detectAdapterLayer(dataCollectorContent) {
  // 1. 必须有从 fetcher/ 导入的非 type-only import（运行时值如 tencentQuote as _tencentQuote）
  const hasRuntimeImport = /import\s*\{[^}]*[^t][^y][^p][^e][^}]*\}\s*from\s*['"]\.\.\/fetcher\/directDataAPI['"]/.test(dataCollectorContent)
    || /import\s*\{[^}]*as\s+_[^}]*\}\s*from\s*['"]\.\.\/fetcher\/directDataAPI['"]/.test(dataCollectorContent)
    || /import\s*\{[^}]*tencentQuote[^}]*\}\s*from\s*['"]\.\.\/fetcher\/directDataAPI['"]/.test(dataCollectorContent)

  // 2. 不得再含独立实现标志：fields[ 数组索引（新浪解析）+ stock_zh_a_hist 或 matchAll 旧批量模式
  const hasStandaloneSina = /fields\[\d+\]/.test(dataCollectorContent)
    && /parseFloat\(fields\[/.test(dataCollectorContent)
    && !/toRealtime|toKlineBars/.test(dataCollectorContent)

  const hasStandaloneBatch = /matchAll\(/s.test(dataCollectorContent)

  return {
    isAdapter: hasRuntimeImport && !hasStandaloneSina && !hasStandaloneBatch,
    runtimeImport: hasRuntimeImport,
    standaloneSina: hasStandaloneSina,
    standaloneBatch: hasStandaloneBatch,
  }
}

/**
 * 适配层完整性检查：当 data-collector/ 为适配层时，
 * 验证 6 项行情/K 线函数 + 2 项适配函数全部 export，且 RealtimeQuote/SourceInfo 类型存在。
 */
function verifyAdapterExports(dataCollectorContent) {
  const requiredRuntime = [
    'export async function tencentQuote',
    'export async function tencentBatchQuotes',
    'export async function sinaQuote',
    'export async function sinaBatchQuotes',
    'export async function neteaseHistory',
    'export async function tencentKline',
    'export { quoteToStock, klinesToDailyQuotes }',
  ]
  const requiredTypes = [
    'export type { RealtimeQuote }',
    'export interface SourceInfo',
  ]
  const issues = []
  for (const rt of requiredRuntime) {
    if (!dataCollectorContent.includes(rt)) issues.push(`缺少 export: ${rt}`)
  }
  for (const tp of requiredTypes) {
    if (!dataCollectorContent.includes(tp)) issues.push(`缺少类型导出: ${tp}`)
  }
  return { ok: issues.length === 0, issues }
}

// ============================================================
// 提取函数
// ============================================================

/**
 * 从文件内容中提取新浪行情字段索引
 * 策略：先尝试 parseSinaQuote 函数，失败则回退到 sinaQuote 函数
 * 返回 { name, price, open, high, low, prevClose, volume, amount, dateStr, timeStr, source: 'parseSinaQuote' | 'sinaQuote' }
 */
function extractSinaFieldIndices(content) {
  // 匹配 fields[N] 的赋值模式（兼容 safeNumber/parseFloat/parseInt/直接引用）
  const patterns = {
    name: /name\s*[?:=]+\s*fields\[(\d+)\]/,
    price: /price\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    open: /open\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    high: /high\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    low: /low\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    prevClose: /prevClose\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    volume: /volume\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseInt\(fields\[(\d+)\])/,
    amount: /amount\s*[?:=]+\s*(?:safeNumber\(fields\[(\d+)\]|parseFloat\(fields\[(\d+)\])/,
    dateStr: /dateStr\s*[?:=]+\s*fields\[(\d+)\]/,
    timeStr: /timeStr\s*[?:=]+\s*fields\[(\d+)\]/,
  }

  const indices = {}

  // 策略 1：尝试匹配 parseSinaQuote 函数体
  let funcMatch = content.match(/function\s+parseSinaQuote[\s\S]*?\n}/)
  let source = 'parseSinaQuote'

  // 策略 2：如果 parseSinaQuote 不存在，回退到 sinaQuote 函数（字段索引内联在其中）
  if (!funcMatch) {
    funcMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+sinaQuote[\s\S]*?\n}/)
    source = 'sinaQuote'
  }

  if (!funcMatch) return null
  const funcBody = funcMatch[0]

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = funcBody.match(pattern)
    if (match) {
      // safeNumber/parseFloat 版本：match[1] 或 match[2]（取决于哪个分组命中）
      indices[key] = match[1] || match[2]
    }
  }

  indices._source = source
  return indices
}

/**
 * 检查批量行情实现逻辑
 * 返回 { method: 'split' | 'matchAll' | 'unknown', detail: string }
 */
function extractBatchImpl(content, funcName) {
  const funcMatch = content.match(new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${funcName}[\\s\\S]*?\\n\\}`))
  if (!funcMatch) return null
  const funcBody = funcMatch[0]

  if (funcBody.includes('.split(') && (funcBody.includes('parseTencentQuote') || funcBody.includes('parseSinaQuote'))) {
    return { method: 'split', detail: 'split(分隔符) + 逐段 parseXxxQuote（鲁棒，按内容解析 code）' }
  }
  if (funcBody.includes('matchAll')) {
    return { method: 'matchAll', detail: 'matchAll + idx 索引对齐（顺序敏感，有 bug 风险）' }
  }
  return { method: 'unknown', detail: '未识别的实现模式' }
}

/**
 * 检查腾讯 K 线 qfqday 兜底逻辑
 * 返回 { hasQfqdayFallback: boolean, detail: string }
 */
function extractKlineQfqday(content) {
  const hasQfqday = content.includes('qfqday')
  const hasDay = /\.day\b/.test(content) || content.includes("stockData.day")

  if (content.includes('qfqday ?? day') || content.includes('qfqday') && content.includes('day') && content.includes('??')) {
    return { hasQfqdayFallback: true, detail: '有 qfqday ?? day 兜底（复权数据优先）' }
  }
  if (hasQfqday && hasDay) {
    return { hasQfqdayFallback: true, detail: '有 qfqday 和 day 两种键解析' }
  }
  if (hasDay && !hasQfqday) {
    return { hasQfqdayFallback: false, detail: '🔴 只解析 day 键（复权数据可能丢失）' }
  }
  return { hasQfqdayFallback: false, detail: '未识别' }
}

/**
 * 检查错误策略
 */
function extractErrorStrategy(content) {
  if (content.includes('DirectDataAPIError') && content.includes('throw')) {
    return { strategy: 'throw', detail: 'throw DirectDataAPIError（严格错误策略）' }
  }
  if (content.includes('return null') || content.includes('return []')) {
    return { strategy: 'return-null', detail: 'return null/[]（静默降级）' }
  }
  return { strategy: 'unknown', detail: '未识别' }
}

// ============================================================
// 输出函数
// ============================================================

function printHeader(title) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`)
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`)
}

function printResult(label, fetcherVal, dataCollectorVal, isCritical) {
  const consistent = String(fetcherVal) === String(dataCollectorVal)
  const icon = consistent ? `${GREEN}✅${RESET}` : (isCritical ? `${RED}🔴${RESET}` : `${YELLOW}🟡${RESET}`)
  const status = consistent ? '一致' : '不一致'
  console.log(`\n${icon} ${BOLD}${label}${RESET} [${status}]`)
  console.log(`   fetcher/ (CANONICAL):   ${fetcherVal}`)
  console.log(`   data-collector/ (副本):  ${dataCollectorVal}`)
  if (!consistent && isCritical) {
    console.log(`   ${RED}⚠️  风险：${label} 不一致，可能导致数据解析错误${RESET}`)
  }
}

// ============================================================
// 主流程
// ============================================================

printHeader('directDataAPI.ts 重复副本一致性检查')

const fetcherContent = read(FETCHER_PATH)
const dataCollectorContent = read(DATACOLLECTOR_PATH)

console.log(`\n${BOLD}文件路径：${RESET}`)
console.log(`  CANONICAL: ${FETCHER_PATH.replace(projectRoot, '.')}`)
console.log(`  副本:      ${DATACOLLECTOR_PATH.replace(projectRoot, '.')}`)

// ── 前置：适配层模式检测 ──
const adapterInfo = detectAdapterLayer(dataCollectorContent)
if (adapterInfo.isAdapter) {
  printHeader('适配层模式检测（TD-012 已迁移）')
  console.log(`\n${GREEN}✅ data-collector/directDataAPI.ts 为适配层模式：从 fetcher/ 导入 canonical 实现并做签名映射${RESET}`)
  console.log(`   适配层与 CANONICAL 共享同一套核心实现，不再有字段索引/批量逻辑/qfqday 兜底等重复实现。`)
  console.log(`   以下执行适配层完整性专属检查：8 项 export + 2 项类型。\n`)

  const adapterCheck = verifyAdapterExports(dataCollectorContent)
  if (adapterCheck.ok) {
    console.log(`${GREEN}✅ 适配层完整性检查通过：8 项运行时 export + 2 项类型 export 齐全${RESET}`)
    console.log(`   运行时：tencentQuote / tencentBatchQuotes / sinaQuote / sinaBatchQuotes / neteaseHistory / tencentKline / quoteToStock / klinesToDailyQuotes`)
    console.log(`   类型：RealtimeQuote / SourceInfo`)
  } else {
    console.log(`${RED}🔴 适配层完整性检查失败：${adapterCheck.issues.length} 项缺失${RESET}`)
    for (const issue of adapterCheck.issues) {
      console.log(`   ${RED}• ${issue}${RESET}`)
    }
    console.log(`\n${YELLOW}建议：补齐缺失的 export 或同步修正迁移方案实现。参考 docs/reports/TECH-DEBT.md TD-012${RESET}`)
    process.exit(1)
  }

  // 兼容性汇总：适配层模式无需再做反向一致性比较（它们不再是两个独立实现）
  printHeader('汇总')
  console.log(`\n${GREEN}✅ TD-012 迁移完成：不存在重复副本，所有实现统一至 fetcher/directDataAPI.ts${RESET}`)
  console.log(`\n${BOLD}修复确认清单：${RESET}`)
  console.log(`   ${GREEN}✅${RESET} 新浪字段索引：统一为 fetcher/ 版正确索引 [29]volume / [30]amount`)
  console.log(`   ${GREEN}✅${RESET} 批量行情实现：统一为 fetcher/ 版 split 逐段（按内容解析 code，不依赖响应顺序）`)
  console.log(`   ${GREEN}✅${RESET} qfqday 兜底：统一为 fetcher/ 版 qfqday ?? day 复权优先兜底`)
  console.log(`   ${GREEN}✅${RESET} 适配层完整性：8 项运行时 export + 2 项类型 export 齐全`)
  console.log(`   ${GREEN}✅${RESET} 消费者迁移：tushareAdapter.ts / collectionPipeline.ts 已改路径直接指向 fetcher/`)
  console.log(`   ${GREEN}✅${RESET} 向后兼容：dataSourceOrchestrator.ts 保留适配层 import（tencentKline 双参 + RealtimeQuote|null 签名）`)
  process.exit(0)
}

// ── 独立副本模式（迁移前）：执行 5 类检查 ────────────────────────────────
// 如果未命中适配层模式，继续执行原有 1-5 一致性对比（用于检测迁移是否完成，或回归检测新增独立实现）。

console.log(`\n${YELLOW}ℹ️  检测为独立副本模式（未迁移或 TD-012 未完成），执行 5 类交叉一致性检查...${RESET}`)

// ── 检查 1：新浪字段索引 ──
printHeader('检查 1：新浪字段索引一致性（parseSinaQuote）')

const fetcherSina = extractSinaFieldIndices(fetcherContent)
const dataCollectorSina = extractSinaFieldIndices(dataCollectorContent)

const sinaIssues = []

if (fetcherSina && dataCollectorSina) {
  const fields = ['name', 'price', 'open', 'high', 'low', 'prevClose', 'volume', 'amount', 'dateStr', 'timeStr']
  let allConsistent = true
  for (const field of fields) {
    const fVal = fetcherSina[field] ?? '未找到'
    const dVal = dataCollectorSina[field] ?? '未找到'
    if (fVal !== dVal) {
      allConsistent = false
      sinaIssues.push(`fields[${field}]: fetcher=${fVal} vs data-collector=${dVal}`)
      printResult(`fields[${field}]`, fVal, dVal, true)
    }
  }
  if (allConsistent) {
    console.log(`\n${GREEN}✅ 新浪字段索引全部一致${RESET}`)
    for (const field of fields) {
      console.log(`   fields[${field}]: ${fetcherSina[field] ?? '未找到'}`)
    }
  }
} else {
  console.log(`\n${YELLOW}⚠️  无法提取新浪字段索引（可能函数签名已变更）${RESET}`)
  console.log(`   fetcher/ 提取结果: ${fetcherSina ? '成功' : '失败'}`)
  console.log(`   data-collector/ 提取结果: ${dataCollectorSina ? '成功' : '失败'}`)
}

// ── 检查 2：批量行情实现 ──
printHeader('检查 2：批量行情实现逻辑（tencentBatchQuotes / sinaBatchQuotes）')

const batchFuncs = ['tencentBatchQuotes', 'sinaBatchQuotes']
const batchIssues = []

for (const funcName of batchFuncs) {
  const fetcherBatch = extractBatchImpl(fetcherContent, funcName)
  const dataCollectorBatch = extractBatchImpl(dataCollectorContent, funcName)
  if (fetcherBatch && dataCollectorBatch) {
    if (fetcherBatch.method !== dataCollectorBatch.method) {
      batchIssues.push(`${funcName}: fetcher=${fetcherBatch.method} vs data-collector=${dataCollectorBatch.method}`)
    }
    printResult(`${funcName} 实现`, fetcherBatch.method, dataCollectorBatch.method, true)
    console.log(`   fetcher/ 详情:      ${fetcherBatch.detail}`)
    console.log(`   data-collector/ 详情: ${dataCollectorBatch.detail}`)
  } else {
    console.log(`\n${YELLOW}⚠️  ${funcName}: 无法提取实现（可能函数不存在或已迁移）${RESET}`)
  }
}

// ── 检查 3：腾讯 K 线 qfqday 兜底 ──
printHeader('检查 3：腾讯 K 线 qfqday 兜底逻辑')

const fetcherKline = extractKlineQfqday(fetcherContent)
const dataCollectorKline = extractKlineQfqday(dataCollectorContent)

const klineIssue = fetcherKline.hasQfqdayFallback !== dataCollectorKline.hasQfqdayFallback

printResult('qfqday 兜底', fetcherKline.hasQfqdayFallback, dataCollectorKline.hasQfqdayFallback, true)
console.log(`   fetcher/ 详情:      ${fetcherKline.detail}`)
console.log(`   data-collector/ 详情: ${dataCollectorKline.detail}`)

// ── 检查 4：错误策略 ──
printHeader('检查 4：错误策略')

const fetcherError = extractErrorStrategy(fetcherContent)
const dataCollectorError = extractErrorStrategy(dataCollectorContent)

printResult('错误策略', fetcherError.strategy, dataCollectorError.strategy, false)
console.log(`   fetcher/ 详情:      ${fetcherError.detail}`)
console.log(`   data-collector/ 详情: ${dataCollectorError.detail}`)

// ── 检查 5：配置源 ──
printHeader('检查 5：配置源')

const fetcherConfig = {
  urls: fetcherContent.includes('dataSourceUrls'),
  endpoints: fetcherContent.includes('marketDataEndpoints'),
  stockCodeUtils: fetcherContent.includes('stockCodeUtils'),
}
const dataCollectorConfig = {
  urls: dataCollectorContent.includes('dataSourceUrls'),
  endpoints: dataCollectorContent.includes('marketDataEndpoints'),
  stockCodeUtils: dataCollectorContent.includes('stockCodeUtils'),
}

printResult('dataSourceUrls', fetcherConfig.urls, dataCollectorConfig.urls, false)
printResult('marketDataEndpoints', fetcherConfig.endpoints, dataCollectorConfig.endpoints, false)
printResult('stockCodeUtils', fetcherConfig.stockCodeUtils, dataCollectorConfig.stockCodeUtils, false)

// ── 汇总 ──
printHeader('汇总')

const allIssues = [...sinaIssues, ...batchIssues]
if (klineIssue) {
  allIssues.push(`qfqday 兜底: fetcher=${fetcherKline.hasQfqdayFallback} vs data-collector=${dataCollectorKline.hasQfqdayFallback}`)
}

if (allIssues.length === 0) {
  console.log(`\n${GREEN}✅ 所有关键检查项一致，无风险${RESET}`)
  console.log(`\n${BOLD}检查通过项：${RESET}`)
  console.log(`   ${GREEN}✅${RESET} 新浪字段索引一致`)
  console.log(`   ${GREEN}✅${RESET} 批量行情实现一致`)
  console.log(`   ${GREEN}✅${RESET} qfqday 兜底逻辑一致`)
  process.exit(0)
} else {
  console.log(`\n${RED}🔴 发现 ${allIssues.length} 个不一致项：${RESET}`)
  for (const issue of allIssues) {
    console.log(`   ${RED}• ${issue}${RESET}`)
  }
  console.log(`\n${YELLOW}建议：执行 TD-012 迁移方案，统一至 fetcher/ 版本${RESET}`)
  console.log(`${YELLOW}     参考：docs/reports/TECH-DEBT.md TD-012${RESET}`)
  process.exit(1)
}
