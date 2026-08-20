#!/usr/bin/env tsx
/**
 * 数据库定义交叉引用审计脚本
 *
 * 目标：在 DB_VERSION 升级或新增 Store 后，自动化核对以下一致性：
 * 1. STORE_NAME 每个值都在 db-schema.ts 或 migrations/*.ts 中有创建逻辑
 * 2. ENVELOPE_ACTION 无重复值，且 ACTION_TO_STORE_MAP 覆盖所有写操作
 * 3. ACTION_TO_STORE_MAP 的 key 属于 ENVELOPE_ACTION，value 属于 STORE_NAME
 * 4. ACL_MATRIX 的 key 属于 MODULE_ID；read/write 数组中的 store 属于 STORE_NAME
 * 5. 全仓库硬编码数据库名（V6ProDB）与 store 名字符串扫描
 * 6. dataLayer.ts 暴露的 store 与 STORE_NAME 对齐（列出未暴露项）
 *
 * 退出码：0=无错误，1=存在不一致，2=仅警告
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const PATHS = {
  dbConfig: path.join(ROOT, 'src', 'config', 'dbConfig.ts'),
  dbSchema: path.join(ROOT, 'src', 'data', 'db-schema.ts'),
  rbacMigration: path.join(ROOT, 'src', 'data', 'migrations', 'rbacMigrationV24.ts'),
  databridge: path.join(ROOT, 'src', 'core', 'databridge.ts'),
  dataLayer: path.join(ROOT, 'src', 'data', 'dataLayer.ts'),
  src: path.join(ROOT, 'src'),
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function color(text: string, c: string): string {
  return `${c}${text}${COLORS.reset}`
}

function readFile(relOrAbs: string): string {
  return fs.readFileSync(relOrAbs, 'utf-8')
}

// ============================================================
// 解析器
// ============================================================

/** 从对象常量中提取 key->value 映射，如 STORE_NAME = { stocks: 'stocks' } */
function parseConstObject(content: string, name: string): Record<string, string> {
  const regex = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s+as\\s+const`)
  const match = content.match(regex)
  if (!match) throw new Error(`未能找到 ${name} 常量定义`)
  const block = match[1]
  const result: Record<string, string> = {}
  const entryRegex = /^\s*(\w+)\s*:\s*['"]([^'"]+)['"]\s*,?\s*$/gm
  let em: RegExpExecArray | null
  while ((em = entryRegex.exec(block)) !== null) {
    result[em[1]] = em[2]
  }
  return result
}

function parseStoreNames(content: string): Record<string, string> {
  return parseConstObject(content, 'STORE_NAME')
}

function parseEnvelopeActions(content: string): Record<string, string> {
  return parseConstObject(content, 'ENVELOPE_ACTION')
}

function parseModuleIds(content: string): Record<string, string> {
  return parseConstObject(content, 'MODULE_ID')
}

/** 解析 db-schema.ts 中 ensureStore/createObjectStore 实际创建的 store 名集合 */
function parseCreatedStores(schemaContent: string, migrationContent: string): Set<string> {
  const created = new Set<string>()
  // ensureStore(db, STORE_NAME.xxx, ...)
  const ensureRegex = /ensureStore\(\s*db\s*,\s*STORE_NAME\.(\w+)\s*,/g
  let m: RegExpExecArray | null
  while ((m = ensureRegex.exec(schemaContent)) !== null) {
    created.add(m[1])
  }
  // createObjectStore(STORE_NAME.xxx, ...)
  const createRegex = /createObjectStore\(\s*STORE_NAME\.(\w+)\s*,/g
  const combined = `${schemaContent}\n${migrationContent}`
  while ((m = createRegex.exec(combined)) !== null) {
    created.add(m[1])
  }
  return created
}

/** 解析 ACTION_TO_STORE_MAP */
function parseActionToStoreMap(content: string): Record<string, string> {
  const map: Record<string, string> = {}
  // 匹配 [ENVELOPE_ACTION.xxx]: STORE_NAME.yyy
  const regex = /\[\s*ENVELOPE_ACTION\.(\w+)\s*\]\s*:\s*STORE_NAME\.(\w+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    map[m[1]] = m[2]
  }
  return map
}

/** 解析 DataBridge 中的特殊动作集合 */
function parseActionSet(content: string, setName: string): Set<string> {
  const result = new Set<string>()
  const regex = new RegExp(`const\\s+${setName}\\s*[:=][\\s\\S]*?new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`)
  const match = content.match(regex)
  if (!match) return result
  const itemRegex = /ENVELOPE_ACTION\.(\w+)/g
  let im: RegExpExecArray | null
  while ((im = itemRegex.exec(match[1])) !== null) {
    result.add(im[1])
  }
  return result
}

/** 解析 ACL_MATRIX，返回 moduleId -> { read: Set<configKey>, write: Set<configKey> } */
function parseAclMatrix(content: string): Record<string, { read: Set<string>; write: Set<string> }> {
  const result: Record<string, { read: Set<string>; write: Set<string> }> = {}
  // 定位 ACL_MATRIX 块（支持带类型注解和不带 as const 两种写法）
  const blockMatch = content.match(/export\s+const\s+ACL_MATRIX\s*(?::\s*[^=]+)?\s*=\s*\{([\s\S]*?)\n\}\s*(?:as\s+const)?/)
  if (!blockMatch) throw new Error('未能找到 ACL_MATRIX 定义')
  const block = blockMatch[1]

  // 按 [MODULE_ID.xxx]: { read: [...], write: [...] } 分块
  const moduleRegex = /\[\s*MODULE_ID\.(\w+)\s*\]\s*:\s*\{([\s\S]*?)\n\s*\}/g
  let mm: RegExpExecArray | null
  while ((mm = moduleRegex.exec(block)) !== null) {
    const moduleKey = mm[1]
    const moduleBlock = mm[2]
    const read = new Set<string>()
    const write = new Set<string>()

    for (const kind of ['read', 'write'] as const) {
      const kindRegex = new RegExp(`${kind}:\\s*\\[([\\s\\S]*?)\\]`)
      const kindMatch = moduleBlock.match(kindRegex)
      if (kindMatch) {
        const storeRegex = /STORE_NAME\.(\w+)/g
        let sm: RegExpExecArray | null
        while ((sm = storeRegex.exec(kindMatch[1])) !== null) {
          ;(kind === 'read' ? read : write).add(sm[1])
        }
      }
    }

    result[moduleKey] = { read, write }
  }
  return result
}

/** 解析 dataLayer.ts 暴露的 store config key 集合 */
function parseDataLayerExposedStores(content: string): Set<string> {
  const exposed = new Set<string>()
  // 匹配 dataLayer = { xxx: xxxStore, ... }
  const blockMatch = content.match(/export\s+const\s+dataLayer\s*=\s*\{([\s\S]*?)\n\}\s*$/m)
  if (!blockMatch) return exposed
  const block = blockMatch[1]
  const propRegex = /(\w+)\s*:\s*\w+/g
  let pm: RegExpExecArray | null
  while ((pm = propRegex.exec(block)) !== null) {
    exposed.add(pm[1])
  }
  return exposed
}

// ============================================================
// 全仓库硬编码扫描
// ============================================================

function* walkFiles(dir: string, extensions: string[]): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // 跳过测试、构建产物、依赖
      if (['__tests__', '__mocks__', 'node_modules', 'dist', 'coverage', 'archive'].includes(entry.name)) {
        continue
      }
      yield* walkFiles(full, extensions)
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full
    }
  }
}

function findHardcodedStrings(
  root: string,
  patterns: string[],
  excludePatterns: RegExp[],
): Array<{ file: string; line: number; text: string }> {
  const results: Array<{ file: string; line: number; text: string }> = []
  for (const file of walkFiles(root, ['.ts', '.tsx', '.js', '.mjs', '.cjs'])) {
    const rel = path.relative(ROOT, file)
    if (rel.includes('.test.') || rel.includes('.spec.')) continue
    const content = readFile(file)
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      // 跳过纯注释行
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          if (excludePatterns.some((re) => re.test(line))) return
          results.push({ file: rel, line: idx + 1, text: line.trim() })
        }
      }
    })
  }
  return results
}

/**
 * 扫描直接操作 dataLayer/db 的代码行。
 * 仅标记包含 dataLayer.<store> 或 db.<method>(<store>) 模式的行。
 */
function findDirectDbAccess(root: string, storeValues: string[]): Array<{ file: string; line: number; text: string }> {
  const results: Array<{ file: string; line: number; text: string }> = []
  const dbContextRegex = /\b(dataLayer|db)\s*\.\s*\w+|db\s*\.\s*(?:get|getAll|getAllByIndex|put|delete|clear|reset|export|import|withTransaction)\s*\(/

  for (const file of walkFiles(root, ['.ts', '.tsx'])) {
    const rel = path.relative(ROOT, file)
    if (rel.includes('.test.') || rel.includes('.spec.')) continue
    // 跳过数据层自身、schema、迁移文件（这些被允许直接操作）
    const normalized = rel.replace(/\\/g, '/')
    if (
      normalized.includes('src/data/db') ||
      normalized.includes('src/data/db-schema') ||
      normalized.includes('src/data/migrations/') ||
      normalized.includes('src/data/dataLayer') ||
      normalized.includes('src/data/repository')
    ) {
      continue
    }

    const content = readFile(file)
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      if (!dbContextRegex.test(line)) return
      for (const storeName of storeValues) {
        // 仅匹配字符串字面量形式的 store 名，或 dataLayer.<storeName> 属性访问
        const stringLiteralPattern = new RegExp(`['"]${escapeRegex(storeName)}['"]`)
        const dataLayerPropPattern = new RegExp(`\\bdataLayer\\s*\\.\\s*${escapeRegex(storeNameToPropName(storeName))}\\b`)
        if (stringLiteralPattern.test(line) || dataLayerPropPattern.test(line)) {
          results.push({ file: rel, line: idx + 1, text: line.trim() })
          break
        }
      }
    })
  }
  return results
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 将 store 名（如 'news_stock_map'）映射到可能的 dataLayer 属性名（camelCase） */
function storeNameToPropName(storeName: string): string {
  return storeName
    .split('_')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

// ============================================================
// 审计逻辑
// ============================================================

interface AuditIssue {
  severity: 'error' | 'warning'
  message: string
  detail?: string
}

function audit(): AuditIssue[] {
  const issues: AuditIssue[] = []

  const dbConfig = readFile(PATHS.dbConfig)
  const dbSchema = readFile(PATHS.dbSchema)
  const rbacMigration = readFile(PATHS.rbacMigration)
  const databridge = readFile(PATHS.databridge)
  const dataLayer = readFile(PATHS.dataLayer)

  const storeNameMap = parseStoreNames(dbConfig)
  const actionMap = parseEnvelopeActions(dbConfig)
  const moduleIdMap = parseModuleIds(dbConfig)
  const storeConfigKeys = new Set(Object.keys(storeNameMap))
  const storeValues = new Set(Object.values(storeNameMap))
  const actionKeys = new Set(Object.keys(actionMap))
  const actionValues = new Set(Object.values(actionMap))
  const moduleIdKeys = new Set(Object.keys(moduleIdMap))

  // 1. STORE_NAME 创建覆盖
  const createdConfigKeys = parseCreatedStores(dbSchema, rbacMigration)
  for (const key of storeConfigKeys) {
    if (!createdConfigKeys.has(key)) {
      issues.push({
        severity: 'error',
        message: `STORE_NAME.${key} 在 db-schema.ts / migrations 中无创建逻辑`,
      })
    }
  }
  for (const key of createdConfigKeys) {
    if (!storeConfigKeys.has(key)) {
      issues.push({
        severity: 'error',
        message: `db-schema.ts / migrations 中创建了未在 STORE_NAME 注册的 store: ${key}`,
      })
    }
  }

  // 2. ENVELOPE_ACTION 值唯一性
  const actionValueToKeys = new Map<string, string[]>()
  for (const [k, v] of Object.entries(actionMap)) {
    if (!actionValueToKeys.has(v)) actionValueToKeys.set(v, [])
    actionValueToKeys.get(v)!.push(k)
  }
  for (const [v, keys] of actionValueToKeys.entries()) {
    if (keys.length > 1) {
      issues.push({
        severity: 'error',
        message: `ENVELOPE_ACTION 值 "${v}" 被多个 key 重复定义: ${keys.join(', ')}`,
      })
    }
  }

  // 3. ACTION_TO_STORE_MAP 合法性
  const actionToStore = parseActionToStoreMap(databridge)
  for (const [actionKey, storeKey] of Object.entries(actionToStore)) {
    if (!actionKeys.has(actionKey)) {
      issues.push({
        severity: 'error',
        message: `ACTION_TO_STORE_MAP 引用了非法 ENVELOPE_ACTION key: ${actionKey}`,
      })
    }
    if (!storeConfigKeys.has(storeKey)) {
      issues.push({
        severity: 'error',
        message: `ACTION_TO_STORE_MAP[${actionKey}] 映射到非法 STORE_NAME key: ${storeKey}`,
      })
    }
  }

  // 找出未映射的写动作（query/event/strategy/manager 动作无需映射）
  const queryActions = parseActionSet(databridge, 'QUERY_ACTIONS')
  const eventActions = parseActionSet(databridge, 'EVENT_ACTIONS')
  const strategyActions = parseActionSet(databridge, 'STRATEGY_ACTIONS')
  const managerActions = new Set([
    'resetAll',
    'importAll',
    'exportAll',
    // 通用删除动作：目标 store 由 payload 传入，不绑定单一 store（rolePermissionMapper 已将其纳入权限体系），
    // 语义上等同 manager 级操作，无需在 ACTION_TO_STORE_MAP 中映射。
    'deleteRecord',
  ])
  const mappedActions = new Set(Object.keys(actionToStore))
  for (const actionKey of actionKeys) {
    if (
      !mappedActions.has(actionKey) &&
      !queryActions.has(actionKey) &&
      !eventActions.has(actionKey) &&
      !strategyActions.has(actionKey) &&
      !managerActions.has(actionKey)
    ) {
      issues.push({
        severity: 'warning',
        message: `ENVELOPE_ACTION.${actionKey} 未在 ACTION_TO_STORE_MAP 中映射，也未声明为 query/event/strategy/manager 动作`,
      })
    }
  }

  // 4. ACL_MATRIX 合法性
  const aclMatrix = parseAclMatrix(dbConfig)
  for (const [moduleKey, perms] of Object.entries(aclMatrix)) {
    if (!moduleIdKeys.has(moduleKey)) {
      issues.push({
        severity: 'error',
        message: `ACL_MATRIX 引用了非法 MODULE_ID key: ${moduleKey}`,
      })
    }
    for (const storeKey of perms.read) {
      if (!storeConfigKeys.has(storeKey)) {
        issues.push({
          severity: 'error',
          message: `ACL_MATRIX[${moduleKey}].read 包含非法 STORE_NAME key: ${storeKey}`,
        })
      }
    }
    for (const storeKey of perms.write) {
      if (!storeConfigKeys.has(storeKey)) {
        issues.push({
          severity: 'error',
          message: `ACL_MATRIX[${moduleKey}].write 包含非法 STORE_NAME key: ${storeKey}`,
        })
      }
    }
  }

  // 5. 硬编码扫描
  const hardcodedDbName = findHardcodedStrings(
    PATHS.src,
    ['V6ProDB'],
    [
      /DB_NAME\s*=/,
      /TEST_DB_NAME/,
      /process\.env\.TEST_DB_NAME/,
      /['"]V6ProDB['"]\s*===/,
      /===\s*['"]V6ProDB['"]/,
    ],
  )
  for (const hit of hardcodedDbName) {
    issues.push({
      severity: 'warning',
      message: `硬编码数据库名 V6ProDB: ${hit.file}:${hit.line}`,
      detail: hit.text,
    })
  }

  // 扫描 dataLayer/db 直接访问（排除数据层自身合法引用）
  const storeNameValues = Object.values(storeNameMap)
  const directDbHits = findDirectDbAccess(PATHS.src, storeNameValues)
  for (const hit of directDbHits) {
    issues.push({
      severity: 'warning',
      message: `疑似直接访问 dataLayer/db store: ${hit.file}:${hit.line}`,
      detail: hit.text,
    })
  }

  // 6. dataLayer.ts 暴露对齐
  const exposedConfigKeys = parseDataLayerExposedStores(dataLayer)
  const intentionallyHidden = new Set([
    // 框架内部表：外部不直接操作
    'schemaMigrations',
    // RBAC 内部表：由 rbac 服务通过 DataBridge 专用 action 操作
    'rbacUsers',
    'rbacRoles',
    'rbacPermissions',
    'rbacUserRoles',
    'rbacRolePermissions',
    'rbacPermissionAuditLogs',
  ])
  for (const key of storeConfigKeys) {
    if (!exposedConfigKeys.has(key) && !intentionallyHidden.has(key)) {
      issues.push({
        severity: 'warning',
        message: `dataLayer.ts 未暴露 STORE_NAME.${key}（${storeNameMap[key]}）`,
      })
    }
  }
  for (const key of exposedConfigKeys) {
    if (key === 'manager') continue // dataLayer.manager 是数据管理器，非 store
    if (!storeConfigKeys.has(key)) {
      issues.push({
        severity: 'error',
        message: `dataLayer.ts 暴露了未在 STORE_NAME 注册的属性: ${key}`,
      })
    }
  }

  // 7. RULE_7: 检查非白名单文件 import { db } from '@/data/db'
  const DB_IMPORT_EXEMPT_DIRS = [
    'src/data/db',
    'src/data/db-schema',
    'src/data/migrations/',
    'src/data/dataLayer',
    'src/data/repository',
    'src/data/gateway',  // Gateway 作为数据门面，允许直接操作 db
  ]
  // 当前白名单（已全部迁移完成，清空白名单）
  const DB_IMPORT_WHITELIST = new Set([
    // 所有过渡期文件已完成迁移，白名单已清空
    // 'src/core/databridge.ts' 已迁移，从白名单移除
    // 'src/core/databridgeRouter.ts' 已迁移，从白名单移除
    // 'src/core/databridgeHandlers.ts' 已迁移，从白名单移除
    // 'src/core/cascadeExecutor.ts' 已迁移，从白名单移除
    // 'src/core/transaction.ts' 已迁移，从白名单移除
  ])
  const dbImportRegex = /import\s*\{\s*[^}]*\bdb\b[^}]*\}\s*from\s*['"]@\/data\/db['"]/
  for (const file of walkFiles(ROOT, ['.ts', '.tsx'])) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    if (rel.includes('.test.') || rel.includes('.spec.')) continue
    if (DB_IMPORT_EXEMPT_DIRS.some(dir => rel.startsWith(dir))) continue
    if (DB_IMPORT_WHITELIST.has(rel)) continue
    if (rel.startsWith('scripts/') || rel.startsWith('outputs/')) continue
    
    const content = readFile(file)
    if (dbImportRegex.test(content)) {
      issues.push({
        severity: 'error',
        message: `RULE_7: 非白名单文件直接 import { db } from '@/data/db': ${rel}`,
        detail: '根据 AGENTS.md 规则，仅允许 src/data/ 层自身和特定白名单文件直接操作 db。',
      })
    }
  }

  // 8. RULE_8: 检查 data/ 层之外直接使用 IDBTransaction 进行数据操作
  const TX_USAGE_EXEMPT_DIRS = [
    'src/data/db-connection',
    'src/data/db-schema',
    'src/data/db-migrations',
    'src/data/db.test',
    'src/data/db.ts',  // 数据库实现本身
    'src/data/gateway',  // Gateway 实现需要使用 IDBTransaction
    'src/core/transaction.ts',  // 事务封装本身
    'src/core/idbPreflight.ts',  // 预检工具
  ]
  // 允许的事务回调模式（传递 tx 参数但仅用于读取操作或被 Gateway 封装）
  const allowedTxPatterns = [
    /runInTransaction.*\(.*tx.*=>/,  // Gateway/DataBridge 的事务回调
    /runInTransactionWithContext.*\(.*ctx.*=>/,  // 新的上下文事务回调
  ]
  // 检测实际的代码使用（排除注释和 JSDoc）
  const idbTransactionCodeRegex = /(?<!\*\/)(?<!\/\/)(?<!\s*\*)(?:import|param|type|:)\s*[^;{}\n]*IDBTransaction[^;{}\n]*/
  for (const file of walkFiles(ROOT, ['.ts', '.tsx'])) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    if (rel.includes('.test.') || rel.includes('.spec.')) continue
    if (TX_USAGE_EXEMPT_DIRS.some(dir => rel.startsWith(dir))) continue
    if (rel.startsWith('scripts/') || rel.startsWith('outputs/')) continue
    
    const content = readFile(file)
    // 检查是否包含实际的 IDBTransaction 使用（排除注释行）
    const lines = content.split('\n')
    let hasActualUsage = false
    for (const line of lines) {
      const trimmedLine = line.trim()
      // 跳过注释行
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('* ')) continue
      // 检查是否在代码中使用 IDBTransaction
      if (IDBTransactionCodePattern(line)) {
        hasActualUsage = true
        break
      }
    }
    
    if (hasActualUsage) {
      // 检查是否允许的事务模式
      const isAllowed = allowedTxPatterns.some(pattern => pattern.test(content))
      if (!isAllowed) {
        issues.push({
          severity: 'error',
          message: `RULE_8: 非 data/ 层文件直接使用 IDBTransaction: ${rel}`,
          detail: '根据 AGENTS.md 规则，业务代码应通过 gateway.runInTransactionWithContext() 使用事务上下文，避免直接操作 IDBTransaction。',
        })
      }
    }
  }

  // 辅助函数：检查行中是否包含 IDBTransaction 的实际代码使用
  function IDBTransactionCodePattern(line: string): boolean {
    // 匹配 IDBTransaction 作为类型注解或参数类型
    const pattern = /:\s*IDBTransaction\b|IDBTransaction\s*[>,)]|IDBTransaction\[\]/
    return pattern.test(line)
  }

  return issues
}

// ============================================================
// 报告输出
// ============================================================

function printReport(issues: AuditIssue[]): void {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const totalWidth = 72
  const separator = color('─'.repeat(totalWidth), COLORS.dim)

  console.log()
  console.log(color('╔' + '═'.repeat(totalWidth - 2) + '╗', COLORS.cyan))
  console.log(
    color('║', COLORS.cyan) +
      color(center(' 数据库定义交叉引用审计报告 ', totalWidth - 2), COLORS.bold + COLORS.cyan) +
      color('║', COLORS.cyan),
  )
  console.log(color('╚' + '═'.repeat(totalWidth - 2) + '╝', COLORS.cyan))
  console.log()
  console.log(color(`  项目路径: ${ROOT}`, COLORS.dim))
  console.log()

  console.log(color('  📊 审计概览', COLORS.bold + COLORS.blue))
  console.log(separator)
  console.log(`  总问题数: ${color(String(issues.length), COLORS.white)}`)
  console.log(`  ❌ 错误:   ${color(String(errors.length), COLORS.red)}`)
  console.log(`  ⚠️  警告:  ${color(String(warnings.length), COLORS.yellow)}`)
  console.log()

  if (errors.length > 0) {
    console.log(color('  ❌ 错误', COLORS.bold + COLORS.red))
    console.log(separator)
    for (const issue of errors) {
      console.log(color(`  ✖ ${issue.message}`, COLORS.red))
      if (issue.detail) {
        console.log(color(`    ${issue.detail.slice(0, 120)}`, COLORS.dim))
      }
    }
    console.log()
  }

  if (warnings.length > 0) {
    console.log(color('  ⚠️  警告', COLORS.bold + COLORS.yellow))
    console.log(separator)
    for (const issue of warnings) {
      console.log(color(`  ⚠ ${issue.message}`, COLORS.yellow))
      if (issue.detail) {
        console.log(color(`    ${issue.detail.slice(0, 120)}`, COLORS.dim))
      }
    }
    console.log()
  }

  console.log(separator)
  if (errors.length > 0) {
    console.log(color('  ❌ 审计失败：存在引用不一致，请修复。', COLORS.bold + COLORS.red))
  } else if (warnings.length > 0) {
    console.log(color('  ⚠️  审计通过（有警告）：请关注警告项。', COLORS.bold + COLORS.yellow))
  } else {
    console.log(color('  ✅ 审计全部通过：数据库引用完全一致！', COLORS.bold + COLORS.green))
  }
  console.log()
}

function center(text: string, width: number): string {
  const padding = Math.max(0, width - text.length)
  const leftPad = Math.floor(padding / 2)
  const rightPad = padding - leftPad
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad)
}

function main(): void {
  for (const [label, p] of Object.entries(PATHS)) {
    if (!fs.existsSync(p)) {
      console.error(color(`❌ 找不到文件 (${label}): ${p}`, COLORS.red))
      process.exit(1)
    }
  }

  const issues = audit()
  printReport(issues)

  const errors = issues.filter((i) => i.severity === 'error')
  if (errors.length > 0) {
    process.exit(1)
  }
  process.exit(0)
}

main()
