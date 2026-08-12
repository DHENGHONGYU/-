#!/usr/bin/env tsx
/**
 * audit-acl-consistency.ts
 * ACL 权限矩阵一致性审计脚本 v1.0
 *
 * 检查目标：
 * 1. ACTION_TO_STORE_MAP 中每个 action 的目标 store，在调用方 module 的 ACL_MATRIX.write 中是否有授权
 * 2. 扫描 src/ 下所有 dataBridge.forward() 调用，提取 (action, source module) 对
 * 3. 对每对 (action, module)，检查 module 是否有该 store 的 write 权限
 * 4. 检查 ENVELOPE_ACTION 中未在 ACTION_TO_STORE_MAP 注册的 action（潜在遗漏）
 * 5. 检查 ACTION_TO_STORE_MAP 中未在 handler 注册表注册的 action（Handler 未注册）
 *
 * 输出：违规列表 + 汇总；退出码 0 表示通过，1 表示发现问题。
 *
 * 使用示例：
 *   npx tsx scripts/audit/audit-acl-consistency.ts
 *   npm run audit:acl-consistency
 *
 * 教训来源：2026-07-18 ACL 权限遗漏导致 03-08 维度采集全部失败（L6）
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

// ============================================================
// 辅助：读取文件内容
// ============================================================

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function scanTsFiles(dir: string): string[] {
  const results: string[] = []
  function scan(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
        scan(full)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
        results.push(full)
      }
    }
  }
  scan(dir)
  return results
}

// ============================================================
// 1. 解析 ACTION_TO_STORE_MAP（action → store）
// ============================================================

interface ActionStoreMapping {
  action: string
  store: string
  line: number
}

function parseActionToStoreMap(): ActionStoreMapping[] {
  const databridgePath = path.join(SRC, 'core', 'databridge.ts')
  const content = readFileSafe(databridgePath)
  const mappings: ActionStoreMapping[] = []

  // 匹配 [ENVELOPE_ACTION.xxx]: STORE_NAME.yyy,
  const regex = /\[ENVELOPE_ACTION\.(\w+)\]:\s*STORE_NAME\.(\w+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length
    mappings.push({ action: match[1], store: match[2], line })
  }
  return mappings
}

// ============================================================
// 2. 解析 ACL_MATRIX（module → write stores）
// ============================================================

interface AclEntry {
  module: string
  writeStores: string[]
  line: number
}

function parseAclMatrix(): AclEntry[] {
  const dbConfigPath = path.join(SRC, 'config', 'dbConfig.ts')
  const content = readFileSafe(dbConfigPath)
  const entries: AclEntry[] = []

  // 匹配 [MODULE_ID.xxx]: { ... write: [ STORE_NAME.aaa, STORE_NAME.bbb, ... ] ... }
  // 或 write: Object.values(STORE_NAME)（全 store 授权，如 system 模块）
  // v1.1 修复：使用 [^}]*? 限制在同一个配置块内，避免 [\s\S]*? 跨越模块边界
  // （原正则会导致 write: Object.values(STORE_NAME) 的模块跳过，把下一个模块的 write 列表归到前一个模块名下）
  // v1.2 修复：正则增加 Object.values(...) 分支，匹配动态全权限写法，杜绝 MODULE_NOT_IN_ACL 误报
  const moduleRegex = /\[MODULE_ID\.(\w+)\]:\s*\{[^}]*?write:\s*(?:\[([^\]]*)\]|Object\.values\(\w+\))/g
  let match: RegExpExecArray | null
  while ((match = moduleRegex.exec(content)) !== null) {
    const module = match[1]
    // match[2] 命中 = 数组字面量；未命中 = Object.values(...) 全权限写法（用 '*' 通配标记）
    const isAllStores = match[2] === undefined
    const line = content.slice(0, match.index).split('\n').length
    const stores = isAllStores
      ? ['*']
      : [...match[2].matchAll(/STORE_NAME\.(\w+)/g)].map(m => m[1])
    entries.push({ module, writeStores: stores, line })
  }
  return entries
}

// ============================================================
// 3. 扫描 dataBridge.forward() 调用，提取 (action, source) 对
// ============================================================

interface ForwardCall {
  file: string
  line: number
  action: string
  source: string
}

function scanForwardCalls(): ForwardCall[] {
  const calls: ForwardCall[] = []
  const files = scanTsFiles(SRC)

  for (const file of files) {
    const content = readFileSafe(file)
    const lines = content.split('\n')

    // 找 dataBridge.forward 调用块
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('dataBridge.forward') || lines[i].includes('dataBridge.forward')) {
        // 向下扫描 15 行找 action 和 source
        const block = lines.slice(i, Math.min(i + 20, lines.length)).join('\n')
        const actionMatch = block.match(/action:\s*ENVELOPE_ACTION\.(\w+)/)
        const sourceMatch = block.match(/source:\s*MODULE_ID\.(\w+)/)
        if (actionMatch) {
          calls.push({
            file: path.relative(ROOT, file),
            line: i + 1,
            action: actionMatch[1],
            source: sourceMatch ? sourceMatch[1] : 'unknown',
          })
        }
      }
    }
  }
  return calls
}

// ============================================================
// 4. 检查 handler 注册表
// ============================================================

function parseRegisteredActions(): Set<string> {
  const handlerPath = path.join(SRC, 'core', 'databridgeHandlers.ts')
  const content = readFileSafe(handlerPath)
  const actions = new Set<string>()

  // 匹配 ENVELOPE_ACTION.xxx
  const regex = /ENVELOPE_ACTION\.(\w+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    actions.add(match[1])
  }
  return actions
}

// ============================================================
// 5. 解析 ENVELOPE_ACTION 枚举
// ============================================================

function parseEnvelopeActions(): Set<string> {
  const dbConfigPath = path.join(SRC, 'config', 'dbConfig.ts')
  const content = readFileSafe(dbConfigPath)
  const actions = new Set<string>()

  const regex = /(\w+):\s*'[A-Z_]+'/g
  let match: RegExpExecArray | null
  // 只在 ENVELOPE_ACTION = { ... } 块内匹配
  const startIdx = content.indexOf('export const ENVELOPE_ACTION')
  if (startIdx === -1) return actions
  const endIdx = content.indexOf('}', startIdx + 200)
  const block = content.slice(startIdx, endIdx > 0 ? endIdx : content.length)
  while ((match = regex.exec(block)) !== null) {
    actions.add(match[1])
  }
  return actions
}

// ============================================================
// 主审计逻辑
// ============================================================

interface Violation {
  type: string
  severity: 'ERROR' | 'WARN'
  message: string
  file?: string
  line?: number
}

function main(): void {
  console.log('=== ACL 权限矩阵一致性审计 ===\n')

  const violations: Violation[] = []

  // 解析数据源
  const actionToStore = parseActionToStoreMap()
  const aclMatrix = parseAclMatrix()
  const forwardCalls = scanForwardCalls()
  const registeredActions = parseRegisteredActions()
  const envelopeActions = parseEnvelopeActions()

  console.log(`ACTION_TO_STORE_MAP: ${actionToStore.length} 条映射`)
  console.log(`ACL_MATRIX: ${aclMatrix.length} 个模块`)
  console.log(`dataBridge.forward() 调用: ${forwardCalls.length} 处`)
  console.log(`Handler 注册 action: ${registeredActions.size} 个`)
  console.log(`ENVELOPE_ACTION 枚举: ${envelopeActions.size} 个\n`)

  // 构建查询索引
  const actionToStoreMap = new Map<string, string>()
  actionToStore.forEach(m => actionToStoreMap.set(m.action, m.store))

  const moduleToWriteStores = new Map<string, Set<string>>()
  aclMatrix.forEach(e => moduleToWriteStores.set(e.module, new Set(e.writeStores)))

  // ── 检查 1: forward() 调用的 (action, source) 对是否有 ACL write 权限 ──
  // 排除走非 routeToDB 路由的 action（同检查 2 的 NON_DB_ROUTE_ACTIONS）
  const NON_DB_ROUTE_ACTIONS_CHECK1 = new Set([
    'resetAll', 'importAll', 'exportAll',
    'strategyHotSectorRefresh', 'strategyValuePitRefresh', 'strategyRotationSignalDetect',
    'queryGet', 'queryList', 'queryByIndex',
    'newsArticleLoaded', 'holdingsDataLoaded', 'tradeActionExecuted', 'loadHoldingsData',
    'feedbackIssuesDetected',
  ])
  console.log('--- 检查 1: forward() 调用 ACL 权限 ---')
  let check1Count = 0
  for (const call of forwardCalls) {
    if (NON_DB_ROUTE_ACTIONS_CHECK1.has(call.action)) continue
    const targetStore = actionToStoreMap.get(call.action)
    if (!targetStore) {
      // action 不在 ACTION_TO_STORE_MAP 中，可能是 query/event/strategy action，跳过
      continue
    }
    const writeStores = moduleToWriteStores.get(call.source)
    if (!writeStores) {
      violations.push({
        type: 'MODULE_NOT_IN_ACL',
        severity: 'ERROR',
        message: `模块 "${call.source}" 不在 ACL_MATRIX 中，但调用了 action="${call.action}" → store="${targetStore}"`,
        file: call.file,
        line: call.line,
      })
      check1Count++
      continue
    }
    if (!writeStores.has(targetStore) && !writeStores.has('*')) {
      violations.push({
        type: 'STORE_NOT_IN_WRITE_LIST',
        severity: 'ERROR',
        message: `模块 "${call.source}" 无 write 权限: action="${call.action}" → store="${targetStore}"（ACL write 列表缺此 store）`,
        file: call.file,
        line: call.line,
      })
      check1Count++
    }
  }
  console.log(`  检查 ${forwardCalls.length} 处调用，发现 ${check1Count} 处违规\n`)

  // ── 检查 2: ACTION_TO_STORE_MAP 中的 action 是否都在 handler 注册 ──
  // 排除走非 routeToDB 路由的 action（routeToManager / STRATEGY_ACTIONS / QUERY_ACTIONS / EVENT_ACTIONS）
  // 这些 action 虽在 ACTION_TO_STORE_MAP 中有映射（用于 inferStore），但不经 routeToDB 的 handler 查找
  const NON_DB_ROUTE_ACTIONS = new Set([
    'resetAll', 'importAll', 'exportAll',  // → routeToManager
    'strategyHotSectorRefresh', 'strategyValuePitRefresh', 'strategyRotationSignalDetect',  // → STRATEGY_ACTIONS
    'queryGet', 'queryList', 'queryByIndex',  // → QUERY_ACTIONS
    'newsArticleLoaded', 'holdingsDataLoaded', 'tradeActionExecuted', 'loadHoldingsData',  // → EVENT_ACTIONS / 特殊 handler
    'feedbackIssuesDetected',  // → EVENT_ACTIONS
  ])
  console.log('--- 检查 2: action handler 注册完整性 ---')
  let check2Count = 0
  for (const mapping of actionToStore) {
    if (NON_DB_ROUTE_ACTIONS.has(mapping.action)) continue
    if (!registeredActions.has(mapping.action)) {
      violations.push({
        type: 'ACTION_NOT_REGISTERED',
        severity: 'ERROR',
        message: `action "${mapping.action}" → store "${mapping.store}" 未在 databridgeHandlers.ts 注册（将 fallback 到裸 put）`,
        file: 'src/core/databridge.ts',
        line: mapping.line,
      })
      check2Count++
    }
  }
  console.log(`  检查 ${actionToStore.length} 条映射，发现 ${check2Count} 处未注册\n`)

  // ── 检查 3: ENVELOPE_ACTION 枚举中有写操作语义但未在 ACTION_TO_STORE_MAP 注册的 ──
  // v1.1: 排除保留/未实现的 action（deleteRecord 是通用删除操作预留，store 由 payload 传入，当前无调用方）
  const RESERVED_ACTIONS = new Set(['deleteRecord'])
  console.log('--- 检查 3: ENVELOPE_ACTION 枚举覆盖度 ---')
  let check3Count = 0
  const writeActionPattern = /^(insert|update|delete|save|bulk)/i
  for (const action of envelopeActions) {
    if (RESERVED_ACTIONS.has(action)) continue
    if (writeActionPattern.test(action) && !actionToStoreMap.has(action)) {
      // 检查是否在 handler 注册表（可能通过自定义 handler 处理）
      if (!registeredActions.has(action)) {
        violations.push({
          type: 'WRITE_ACTION_NO_STORE_MAPPING',
          severity: 'WARN',
          message: `写操作 action "${action}" 既不在 ACTION_TO_STORE_MAP 也未在 handler 注册`,
          file: 'src/config/dbConfig.ts',
        })
        check3Count++
      }
    }
  }
  console.log(`  检查 ${envelopeActions.size} 个枚举值，发现 ${check3Count} 处可疑\n`)

  // ── 汇总输出 ──
  console.log('=== 审计汇总 ===')
  const errors = violations.filter(v => v.severity === 'ERROR')
  const warns = violations.filter(v => v.severity === 'WARN')
  console.log(`ERROR: ${errors.length}`)
  console.log(`WARN:  ${warns.length}`)

  if (violations.length > 0) {
    console.log('\n--- 违规详情 ---')
    violations.forEach((v, i) => {
      console.log(`\n[${i + 1}] ${v.severity}: ${v.type}`)
      console.log(`  ${v.message}`)
      if (v.file) console.log(`  文件: ${v.file}${v.line ? `:${v.line}` : ''}`)
    })
    console.log(`\n=== 审计未通过：${errors.length} ERROR, ${warns.length} WARN ===`)
    process.exit(1)
  } else {
    console.log('\n=== 审计通过：0 ERROR, 0 WARN ===')
    process.exit(0)
  }
}

main()
