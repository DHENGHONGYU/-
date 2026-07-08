#!/usr/bin/env tsx
/**
 * 数据一致性校验脚本
 *
 * 校验 TypeScript 类型定义与 IndexedDB Store Schema 的一致性。
 *
 * 校验内容：
 * 1. STORE_NAME 常量数量 vs 实际创建的 Store 数量
 * 2. 每个 Store 是否有对应的数据实体类型定义
 * 3. Store 主键字段是否存在于对应类型中
 * 4. 索引字段是否存在于对应类型中
 *
 * 退出码：0=全部通过，1=有错误，2=有警告
 *
 * 用法：
 *   npx tsx scripts/validate-data-consistency.ts
 *   npx tsx scripts/validate-data-consistency.ts /path/to/project
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// ============================================================
// 路径解析：支持命令行参数指定项目根，或自动向上查找 package.json
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveProjectRoot(): string {
  // 优先使用命令行参数
  const arg = process.argv[2]
  if (arg) {
    const resolved = path.resolve(arg)
    if (fs.existsSync(path.join(resolved, 'package.json'))) {
      return resolved
    }
    console.warn(color(`⚠️  指定路径 "${arg}" 下未找到 package.json，尝试自动检测...`, COLORS.yellow))
  }

  // 从脚本所在目录向上查找 package.json
  let current = __dirname
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current
    }
    current = path.dirname(current)
  }

  // 兜底：脚本目录的上级
  return path.resolve(__dirname, '..')
}

const PROJECT_ROOT = resolveProjectRoot()
const TYPES_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'types.ts')
const DB_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'db.ts')
const DB_CONFIG_FILE = path.join(PROJECT_ROOT, 'src', 'config', 'dbConfig.ts')

// ============================================================
// 颜色工具
// ============================================================

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function color(text: string, colorCode: string): string {
  return `${colorCode}${text}${COLORS.reset}`
}

// ============================================================
// 数据结构定义
// ============================================================

interface InterfaceInfo {
  name: string
  fields: string[]
}

interface StoreSchema {
  storeName: string          // 实际 store 名称（如 'stocks'）
  configKey: string          // STORE_NAME 中的键（如 'stocks'）
  keyPath: string            // 主键字段
  autoIncrement: boolean
  indexes: IndexInfo[]
}

interface IndexInfo {
  name: string
  keyPath: string | string[]
  unique: boolean
}

interface ValidationResult {
  pass: number
  warnings: string[]
  errors: string[]
  infos: string[]
}

// ============================================================
// 解析器：types.ts —— 提取 interface 名称和字段
// ============================================================

function parseInterfaces(filePath: string): InterfaceInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const interfaces: InterfaceInfo[] = []

  // 匹配 export interface Name { ... }
  // 支持一层嵌套大括号（处理对象类型中的嵌套对象）
  const interfaceRegex = /export\s+interface\s+(\w+)\s*\{/g
  let match: RegExpExecArray | null

  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1]
    const startIndex = match.index + match[0].length

    // 找到匹配的闭合大括号（支持一层嵌套）
    const body = extractBalancedBody(content, startIndex)
    if (body === null) continue

    const fields = extractFields(body)
    interfaces.push({ name, fields })
  }

  return interfaces
}

/**
 * 从指定位置开始提取平衡的大括号体。
 * 支持多层嵌套大括号匹配。
 */
function extractBalancedBody(content: string, startIndex: number): string | null {
  let depth = 1
  let i = startIndex

  while (i < content.length && depth > 0) {
    const char = content[i]
    if (char === '{') depth++
    else if (char === '}') depth--
    i++
  }

  if (depth !== 0) return null
  return content.slice(startIndex, i - 1)
}

function extractFields(body: string): string[] {
  const fields: string[] = []
  const lines = body.split('\n')
  let nestedBraceDepth = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // 跳过空行
    if (!trimmed) continue

    // 跳过注释行
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('*')) continue
    if (trimmed.startsWith('/*')) continue

    // 跟踪嵌套深度（用于跳过嵌套对象内部的字段）
    const openBraces = (trimmed.match(/\{/g)?.length) ?? 0
    const closeBraces = (trimmed.match(/\}/g)?.length) ?? 0
    const prevDepth = nestedBraceDepth
    nestedBraceDepth += openBraces - closeBraces

    // 如果在顶层（深度为 0）且这一行有字段定义
    // 注意：进入嵌套对象的那一行本身可能也有字段名（如 sourceSnapshot: {）
    // 这种情况下我们只提取字段名，不深入嵌套内部字段
    if (prevDepth === 0 && nestedBraceDepth >= 0) {
      const fieldMatch = trimmed.match(/^(\w+)\s*[?:]/)
      if (fieldMatch) {
        fields.push(fieldMatch[1] ?? '')
      }
    }
  }

  return fields
}

// ============================================================
// 解析器：dbConfig.ts —— 提取 STORE_NAME 常量
// ============================================================

function parseStoreNames(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const storeNames: Record<string, string> = {}

  // 找到 STORE_NAME 对象定义块（支持 `as const` 语法）
  const storeNameBlockMatch = content.match(
    /export\s+const\s+STORE_NAME\s*=\s*\{([\s\S]*?)\n\}\s+as\s+const/,
  )
  let block: string
  if (storeNameBlockMatch) {
    block = storeNameBlockMatch[1]
  } else {
    // 回退：简单匹配（不带 as const）
    const fallbackMatch = content.match(/export\s+const\s+STORE_NAME\s*=\s*\{([^}]+)\}/)
    if (!fallbackMatch) {
      throw new Error('未能找到 STORE_NAME 常量定义')
    }
    block = fallbackMatch[1]
  }
  const entryRegex = /^\s*(\w+)\s*:\s*['"]([^'"]+)['"]\s*,?\s*$/gm
  let match: RegExpExecArray | null

  while ((match = entryRegex.exec(block)) !== null) {
    const key = match[1]
    const value = match[2]
    storeNames[key] = value
  }

  return storeNames
}

// ============================================================
// 解析器：db.ts —— 提取 createObjectStore 和 createIndex
// ============================================================

function parseStoreSchemas(
  filePath: string,
  storeNameMap: Record<string, string>,
): StoreSchema[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const stores: StoreSchema[] = []

  // 匹配所有 createObjectStore 调用（使用 STORE_NAME.xxx 的形式
  // 捕获组 1: config key, 捕获组 2: options 对象内容
  const createStoreRegex =
    /createObjectStore\(\s*STORE_NAME\.(\w+)\s*,\s*\{([^}]+)\}\s*\)/g
  let match: RegExpExecArray | null

  // 收集所有 store 的位置信息，用于确定每个 store 的索引范围
  const storePositions: Array<{
    configKey: string
    optionsStr: string
    startPos: number
    endPos: number
  }> = []

  while ((match = createStoreRegex.exec(content)) !== null) {
    storePositions.push({
      configKey: match[1],
      optionsStr: match[2],
      startPos: match.index,
      endPos: match.index + match[0].length,
    })
  }

  for (let i = 0; i < storePositions.length; i++) {
    const sp = storePositions[i]
    const storeName = storeNameMap[sp?.configKey]

    if (!storeName) {
      console.warn(
        color(
          `⚠️  db.ts 中引用了 STORE_NAME.${sp?.configKey}，但在 dbConfig.ts 中未找到`,
          COLORS.yellow,
        ),
      )
      continue
    }

    // 解析 keyPath
    const keyPathMatch = sp?.optionsStr.match(/keyPath\s*:\s*['"]([^'"]+)['"]/)
    const keyPath = keyPathMatch ? keyPathMatch[1] : ''

    // 解析 autoIncrement
    const autoIncrement = /autoIncrement\s*:\s*true/.test(sp?.optionsStr ?? '')

    // 确定索引搜索范围：从当前 store 结束位置 到 下一个 store 开始位置
    const searchStart = sp?.endPos
    const searchEnd =
      i < storePositions.length - 1
        ? storePositions[i + 1].startPos
        : content.length

    const storeContext = content.slice(searchStart, searchEnd)

    // 提取该 store 的所有索引（按名称去重，因为迁移代码中可能重复定义）
    const rawIndexes = parseIndexesInContext(storeContext)
    const seenIndexNames = new Set<string>()
    const indexes: IndexInfo[] = []
    for (const idx of rawIndexes) {
      if (!seenIndexNames.has(idx.name)) {
        seenIndexNames.add(idx.name)
        indexes.push(idx)
      }
    }

    stores.push({
      storeName,
      configKey: sp?.configKey,
      keyPath,
      autoIncrement,
      indexes,
    })
  }

  return stores
}

function parseIndexesInContext(context: string): IndexInfo[] {
  const indexes: IndexInfo[] = []

  // 匹配 createIndex 调用
  // 形式1: createIndex('name', 'field', { unique: false })
  // 形式2: createIndex('name', ['f1', 'f2'], { unique: true })
  const indexRegex = /createIndex\(\s*['"]([^'"]+)['"]\s*,\s*(.+?)\s*(?:,\s*\{([^}]*)\}\s*)?\)/g
  let match: RegExpExecArray | null

  while ((match = indexRegex.exec(context)) !== null) {
    const indexName = match[1]
    const keyPathRaw = match[2]!.trim()
    const optionsStr = match[3] || ''

    let keyPath: string | string[]

    if (keyPathRaw.startsWith('[') && keyPathRaw.endsWith(']')) {
      // 数组形式
      const fields: string[] = []
      const fieldRegex = /['"]([^'"]+)['"]/g
      let fieldMatch: RegExpExecArray | null
      while ((fieldMatch = fieldRegex.exec(keyPathRaw)) !== null) {
        fields.push(fieldMatch[1] ?? '')
      }
      keyPath = fields
    } else {
      // 单字段形式
      const singleMatch = keyPathRaw.match(/['"]([^'"]+)['"]/)
      keyPath = singleMatch ? singleMatch[1] : keyPathRaw
    }

    const unique = /unique\s*:\s*true/.test(optionsStr)

    indexes.push({
      name: indexName,
      keyPath,
      unique,
    })
  }

  return indexes
}

// ============================================================
// Store 名称 → 类型名称 映射规则
// ============================================================

/**
 * 根据 store 名称推断对应的 TypeScript interface 名称。
 * 规则：
 * 1. 优先使用内置映射表（处理不规则命名）
 * 2. 回退到启发式：snake_case → PascalCase 单复数转换
 */
const STORE_TO_TYPE_MAP: Record<string, string> = {
  stocks: 'Stock',
  v6_scores: 'V6Score',
  intelligent_scores: 'IntelligentScore',
  industry_scores: 'IndustryScore',
  orders: 'Order',
  watchlists: 'Watchlist',
  signals: 'Signal',
  research_logs: 'ResearchLog',
  daily_quotes: 'DailyQuotes',
  rotation_scores: 'RotationSectorScore',
  sector_scores: 'SectorScoreRecord',
  score_docs: 'ScoreDocVersion',
  strategy_snapshots: 'StrategySnapshot',
  local_docs: 'LocalDoc',
  news: 'NewsArticle',
  news_stock_map: 'NewsStockMap',
  sentiment_cache: 'SentimentCache',
  news_bookmarks: '', // 预留：如果有类型可以补充
  hot_sector_scores: 'HotSectorScore',
  value_pit_scores: 'ValuePitScore',
}

function inferTypeName(storeName: string): string {
  if (STORE_TO_TYPE_MAP[storeName] !== undefined) {
    return STORE_TO_TYPE_MAP[storeName]
  }

  // 启发式：snake_case 转 PascalCase
  const pascal = storeName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

  // 尝试去掉末尾的 's'（单数化）
  if (pascal.endsWith('s')) {
    return pascal.slice(0, -1)
  }

  return pascal
}

// ============================================================
// 校验器
// ============================================================

function validate(
  interfaces: InterfaceInfo[],
  storeNames: Record<string, string>,
  storeSchemas: StoreSchema[],
): ValidationResult {
  const result: ValidationResult = {
    pass: 0,
    warnings: [],
    errors: [],
    infos: [],
  }

  const interfaceMap = new Map<string, InterfaceInfo>()
  for (const iface of interfaces) {
    interfaceMap.set(iface.name, iface)
  }

  // ----------------------------------------------------------
  // 校验 1：STORE_NAME 常量数量 vs 实际创建的 Store 数量
  // ----------------------------------------------------------
  const configCount = Object.keys(storeNames).length
  const schemaCount = storeSchemas.length

  if (configCount === schemaCount) {
    result.pass++
    result.infos.push(
      `STORE_NAME 常量数量 (${configCount}) 与实际创建的 Store 数量 (${schemaCount}) 一致`,
    )
  } else {
    result.errors.push(
      `STORE_NAME 常量数量 (${configCount}) 与实际创建的 Store 数量 (${schemaCount}) 不一致`,
    )

    // 找出在 config 中有但 schema 中没有的
    const schemaStoreNames = new Set(storeSchemas.map((s) => s.storeName))
    for (const [key, value] of Object.entries(storeNames)) {
      if (!schemaStoreNames.has(value)) {
        result.errors.push(
          `  - STORE_NAME.${key} ('${value}') 在 db.ts 中未找到对应的 createObjectStore`,
        )
      }
    }

    // 找出在 schema 中有但 config 中没有的
    const configStoreValues = new Set(Object.values(storeNames))
    for (const store of storeSchemas) {
      if (!configStoreValues.has(store.storeName)) {
        result.errors.push(
          `  - db.ts 中创建的 store '${store.storeName}' 在 STORE_NAME 常量中不存在`,
        )
      }
    }
  }

  // ----------------------------------------------------------
  // 校验 2：每个 Store 是否有对应的数据实体类型定义
  // ----------------------------------------------------------
  const storesWithoutType: string[] = []
  const storeTypePairs: Array<{ store: StoreSchema; typeName: string }> = []

  for (const store of storeSchemas) {
    const typeName = inferTypeName(store.storeName)
    if (!typeName) {
      storesWithoutType.push(`${store.storeName} (无映射配置)`)
      continue
    }

    if (interfaceMap.has(typeName)) {
      storeTypePairs.push({ store, typeName })
    } else {
      storesWithoutType.push(`${store.storeName} (推断类型: ${typeName})`)
    }
  }

  if (storesWithoutType.length === 0) {
    result.pass++
    result.infos.push(`所有 ${schemaCount} 个 Store 都找到了对应的数据实体类型定义`)
  } else {
    result.warnings.push(`以下 Store 未找到对应的数据实体类型定义：`)
    for (const name of storesWithoutType) {
      result.warnings.push(`  - ${name}`)
    }
  }

  // ----------------------------------------------------------
  // 校验 3：Store 主键字段是否存在于对应类型中
  // ----------------------------------------------------------
  for (const { store, typeName } of storeTypePairs) {
    const iface = interfaceMap.get(typeName)!
    const keyPath = store.keyPath

    if (!keyPath) {
      result.warnings.push(
        `Store '${store.storeName}' 未定义 keyPath，无法校验主键字段`,
      )
      continue
    }

    const hasKeyPath = iface.fields.includes(keyPath)

    if (hasKeyPath) {
      result.pass++
    } else {
      result.errors.push(
        `Store '${store.storeName}' 的主键字段 '${keyPath}' 在类型 '${typeName}' 中不存在`,
      )
      const sample = iface.fields.slice(0, 8).join(', ')
      const more = iface.fields.length > 8 ? `...(共${iface.fields.length}个)` : ''
      result.errors.push(`  - 类型 ${typeName} 字段: ${sample}${more}`)
    }
  }

  // ----------------------------------------------------------
  // 校验 4：索引字段是否存在于对应类型中
  // ----------------------------------------------------------
  for (const { store, typeName } of storeTypePairs) {
    const iface = interfaceMap.get(typeName)!

    for (const index of store.indexes) {
      const keyPaths = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath]
      let allExist = true
      const missingFields: string[] = []

      for (const field of keyPaths) {
        if (!iface.fields.includes(field)) {
          allExist = false
          missingFields.push(field)
        }
      }

      if (allExist) {
        result.pass++
      } else {
        result.errors.push(
          `Store '${store.storeName}' 的索引 '${index.name}' 引用的字段 [${missingFields.join(', ')}] 在类型 '${typeName}' 中不存在`,
        )
      }
    }
  }

  return result
}

// ============================================================
// 报告输出
// ============================================================

function printReport(
  result: ValidationResult,
  interfaces: InterfaceInfo[],
  storeNames: Record<string, string>,
  storeSchemas: StoreSchema[],
): void {
  const totalWidth = 72
  const separator = color('─'.repeat(totalWidth), COLORS.dim)

  console.log()
  console.log(color('╔' + '═'.repeat(totalWidth - 2) + '╗', COLORS.cyan))
  console.log(
    color('║', COLORS.cyan) +
      color(center(' 数据一致性校验报告 ', totalWidth - 2), COLORS.bold + COLORS.cyan) +
      color('║', COLORS.cyan),
  )
  console.log(color('╚' + '═'.repeat(totalWidth - 2) + '╝', COLORS.cyan))
  console.log()
  console.log(color(`  项目路径: ${PROJECT_ROOT}`, COLORS.dim))
  console.log()

  // 概览
  console.log(color('  📊 校验概览', COLORS.bold + COLORS.blue))
  console.log(separator)

  const totalChecks = result.pass + result.warnings.length + result.errors.length
  console.log(`  解析 Interface 数量: ${color(String(interfaces.length), COLORS.cyan)}`)
  console.log(`  STORE_NAME 常量数量: ${color(String(Object.keys(storeNames).length), COLORS.cyan)}`)
  console.log(`  实际 Store 数量:     ${color(String(storeSchemas.length), COLORS.cyan)}`)
  console.log(`  总校验项:           ${color(String(totalChecks), COLORS.white)}`)
  console.log(`  ✅ 通过:             ${color(String(result.pass), COLORS.green)}`)
  console.log(`  ⚠️  警告:             ${color(String(result.warnings.length), COLORS.yellow)}`)
  console.log(`  ❌ 错误:             ${color(String(result.errors.length), COLORS.red)}`)
  console.log()

  // 通过项
  if (result.infos.length > 0) {
    console.log(color('  ✅ 通过项', COLORS.bold + COLORS.green))
    console.log(separator)
    for (const info of result.infos) {
      console.log(color(`  ✔ ${info}`, COLORS.green))
    }
    console.log()
  }

  // 警告
  if (result.warnings.length > 0) {
    console.log(color('  ⚠️  警告', COLORS.bold + COLORS.yellow))
    console.log(separator)
    for (const warning of result.warnings) {
      console.log(color(`  ⚠ ${warning}`, COLORS.yellow))
    }
    console.log()
  }

  // 错误
  if (result.errors.length > 0) {
    console.log(color('  ❌ 错误', COLORS.bold + COLORS.red))
    console.log(separator)
    for (const error of result.errors) {
      console.log(color(`  ✖ ${error}`, COLORS.red))
    }
    console.log()
  }

  // Store 详情列表
  console.log(color('  📋 Store 清单', COLORS.bold + COLORS.blue))
  console.log(separator)

  const typeMap = new Map<string, InterfaceInfo>()
  for (const iface of interfaces) {
    typeMap.set(iface.name, iface)
  }

  for (const store of storeSchemas) {
    const typeName = inferTypeName(store.storeName)
    const hasType = !!typeName && typeMap.has(typeName)
    const typeLabel = hasType
      ? color(typeName, COLORS.green)
      : color(typeName || '未找到', COLORS.yellow)

    const keyLabel = store.keyPath
      ? hasType && typeMap.get(typeName!)?.fields.includes(store.keyPath)
        ? color(store.keyPath, COLORS.green)
        : color(store.keyPath, COLORS.red)
      : color('(无)', COLORS.dim)

    const storeLine =
      `  ${color(store.storeName.padEnd(22), COLORS.cyan)} ` +
      `→ ${typeLabel.padEnd(26)} ` +
      `🔑 ${keyLabel} ` +
      `${store.autoIncrement ? color(' [autoInc]', COLORS.dim) : ''}`

    console.log(storeLine)

    if (store.indexes.length > 0) {
      for (const idx of store.indexes) {
        const keyPathStr = Array.isArray(idx.keyPath)
          ? `[${idx.keyPath.join(', ')}]`
          : idx.keyPath

        let keyColor = COLORS.green
        if (hasType) {
          const fields = Array.isArray(idx.keyPath) ? idx.keyPath : [idx.keyPath]
          const iface = typeMap.get(typeName!)!
          for (const f of fields) {
            if (!iface.fields.includes(f)) {
              keyColor = COLORS.red
              break
            }
          }
        } else {
          keyColor = COLORS.dim
        }

        console.log(
          `     ${color('└─', COLORS.dim)} ${color(idx.name.padEnd(22), COLORS.magenta)} ` +
            `${color(keyPathStr, keyColor)} ` +
            `${idx.unique ? color('[unique]', COLORS.yellow) : ''}`,
        )
      }
    }
  }

  console.log()

  // 结论
  console.log(separator)
  if (result.errors.length > 0) {
    console.log(
      color('  ❌ 校验失败：存在错误，请修复后重试。', COLORS.bold + COLORS.red),
    )
  } else if (result.warnings.length > 0) {
    console.log(
      color('  ⚠️  校验通过（有警告）：请关注警告项。', COLORS.bold + COLORS.yellow),
    )
  } else {
    console.log(
      color('  ✅ 校验全部通过：数据一致性良好！', COLORS.bold + COLORS.green),
    )
  }
  console.log()
}

function center(text: string, width: number): string {
  const padding = Math.max(0, width - text.length)
  const leftPad = Math.floor(padding / 2)
  const rightPad = padding - leftPad
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad)
}

// ============================================================
// 主函数
// ============================================================

function main(): void {
  console.log(color('🔍 正在读取源文件...', COLORS.dim))

  // 检查文件是否存在
  const filesToCheck: Array<[string, string]> = [
    ['types.ts', TYPES_FILE],
    ['db.ts', DB_FILE],
    ['dbConfig.ts', DB_CONFIG_FILE],
  ]

  for (const [label, filePath] of filesToCheck) {
    if (!fs.existsSync(filePath)) {
      console.error(color(`❌ 找不到文件 (${label}): ${filePath}`, COLORS.red))
      process.exit(1)
    }
  }

  // 解析
  const interfaces = parseInterfaces(TYPES_FILE)
  const storeNames = parseStoreNames(DB_CONFIG_FILE)
  const storeSchemas = parseStoreSchemas(DB_FILE, storeNames)

  // 校验
  const result = validate(interfaces, storeNames, storeSchemas)

  // 输出报告
  printReport(result, interfaces, storeNames, storeSchemas)

  // 退出码：0=全部通过，1=有错误，2=有警告
  if (result.errors.length > 0) {
    process.exit(1)
  } else if (result.warnings.length > 0) {
    process.exit(2)
  } else {
    process.exit(0)
  }
}

main()
