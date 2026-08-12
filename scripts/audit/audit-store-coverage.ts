/**
 * Store 测试覆盖率比率审计
 * @description 检测 Store 源文件 action 函数数量与对应测试文件 it()/test() 数量的比率
 *              当比率低于阈值时发出警告，防止"新增功能但未同步补充测试"
 *
 * 规则：
 * - 每个 Store 源文件必须有对应的 .test.ts 文件
 * - 测试用例数量 / action 函数数量 ≥ 0.5（每个 action 至少 0.5 个测试）
 * - 无测试文件的 Store 标记为 P0 错误
 * - 比率 < 0.3 标记为 P1 错误
 * - 比率 < 0.5 标记为 P2 警告
 *
 * @usage tsx scripts/audit/audit-store-coverage.ts
 *        tsx scripts/audit/audit-store-coverage.ts --ci   (CI 模式，有错误时 exit 1)
 */

import { glob } from 'glob'
import { readFile } from 'fs/promises'
import path from 'path'

// ============================================================
// 配置
// ============================================================

/** 最小测试比率（测试数 / action 数），低于此值发出 P2 警告 */
const MIN_RATIO_WARN = 0.5
/** 严重低测试比率，低于此值发出 P1 错误 */
const MIN_RATIO_ERROR = 0.3

/** 排除的文件（非 Store 业务文件） */
const EXCLUDE_FILES = [
  'storeRegistry.ts',
  'helpers/withBroadcast.ts',
  'helpers/withOptimisticUpdate.ts',
  'derived.index.ts',
]

/** 排除的文件后缀模式（Store 子模块，非独立 Store） */
const EXCLUDE_SUFFIXES = [
  '.derived.ts',
  '.subscriptions.ts',
  '.utils.ts',
  '.persistence.ts',
  '.mock.ts',
  'Subscriptions.ts',
]

// ============================================================
// 类型
// ============================================================

interface StoreAuditResult {
  storeFile: string
  storeName: string
  testFile: string | null
  actionCount: number
  testCount: number
  ratio: number
  severity: 'ok' | 'warn' | 'error' | 'critical'
  message: string
}

// ============================================================
// 核心逻辑
// ============================================================

/**
 * 从 Store 源文件中提取 action 函数数量
 * 匹配模式：对象字面量中的函数定义（含箭头函数）
 *   functionName: () => { ... }
 *   functionName: async () => { ... }
 *   functionName(param) { ... }
 */
function extractActionCount(content: string): number {
  const actions = new Set<string>()

  // 模式 1: `functionName: () =>` 或 `functionName: async () =>`
  // 排除注释行
  const arrowPattern = /^\s*(\w+)\s*:\s*(?:async\s*)?\(?[^)]*\)?\s*=>/gm
  let match: RegExpExecArray | null
  while ((match = arrowPattern.exec(content)) !== null) {
    const name = match[1]
    // 排除内部字段（非 action）
    if (!isInternalField(name)) {
      actions.add(name)
    }
  }

  // 模式 2: `functionName(param) {`（方法简写）
  const methodPattern = /^\s*(\w+)\s*\([^)]*\)\s*\{/gm
  while ((match = methodPattern.exec(content)) !== null) {
    const name = match[1]
    if (!isInternalField(name)) {
      actions.add(name)
    }
  }

  return actions.size
}

/**
 * 判断是否为内部字段（非 action 函数）
 */
function isInternalField(name: string): boolean {
  const internalFields = [
    // Zustand 内部
    'getState', 'setState', 'subscribe', 'destroy', 'getInitialState',
    // 常见数据字段
    'loading', 'error', 'data', 'items', 'list', 'isLoading', 'isProcessing',
    'isRefreshing', 'isAdding', 'isSyncing', 'isOpen', 'isMonitoring',
    'lastUpdated', 'lastChecked', 'lastSeen', 'lastAlertAt',
    'snapshot', 'stats', 'logs', 'tasks', 'plans', 'orders',
    'verdicts', 'results', 'history', 'templates', 'versions',
    'configs', 'rules', 'channels', 'cache', 'progress', 'triggerPayload',
    'taskFilter', 'mcpCallHistory', 'feedbacks', 'summaries',
    'monitorLogs', 'recentTasks', 'agentHealthSnapshots', 'agentMetrics',
    'effective', 'hydrated', 'activeModule', 'activeTab', 'activeCabin',
    'dimensionProgress', 'taskStatus', 'taskId', 'traceId',
    'comparisonMode', 'comparisonLeft', 'comparisonRight',
    'rulesVersion', 'isSyncingRules', 'isExporting',
    'previousResult', 'scoreData', 'trendData', 'stockDetail',
    'transparencyConfig', 'progressMessage', 'scoreResult', 'scoreLogs',
    'scoreHistory', 'scoreError', 'isScoring',
    'isFirstLoad', 'pendingRefresh', 'refreshDebounceTimer',
    'unsubscribers', '_unsubscribeFacade', '_debounceTimer',
    '_pendingRefresh', '_refreshDebounceTimer',
    'processingSymbols', 'portfolioInput', 'buildPortfolio',
    'loadPortfolioInput', 'intentionPool', 'positionPool', 'researchPool',
  ]
  return internalFields.includes(name)
}

/**
 * 从测试文件中提取 it()/test() 调用数量
 */
function extractTestCount(content: string): number {
  // 匹配 it('...' 或 test('...' 或 it("..." 或 test("...
  // 排除 it.skip 和 test.skip
  const pattern = /(?:^|\s)(?:it|test)\s*\(/g
  const matches = content.match(pattern)
  return matches ? matches.length : 0
}

/**
 * 查找 Store 对应的测试文件
 */
async function findTestFile(storeFilePath: string): Promise<string | null> {
  const dir = path.dirname(storeFilePath)
  const basename = path.basename(storeFilePath, '.ts')

  // 尝试同目录下的测试文件
  const sameDirTest = path.join(dir, `${basename}.test.ts`)
  // 尝试 __tests__ 子目录
  const testsDirTest = path.join(dir, '__tests__', `${basename}.test.ts`)

  try {
    const { access } = await import('fs/promises')
    try {
      await access(sameDirTest)
      return sameDirTest
    } catch {
      try {
        await access(testsDirTest)
        return testsDirTest
      } catch {
        return null
      }
    }
  } catch {
    return null
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const isCI = process.argv.includes('--ci')

  console.log('🔍 Store 测试覆盖率比率审计')
  console.log('═'.repeat(60))
  console.log(`阈值: P1 错误 < ${MIN_RATIO_ERROR} | P2 警告 < ${MIN_RATIO_WARN}`)
  console.log()

  // 查找所有 Store 源文件
  const allStoreFiles = await glob('src/store/**/*.ts', {
    ignore: ['node_modules/**', 'src/store/**/*.test.ts', 'src/store/**/*.d.ts'],
  })

  // 过滤排除文件
  const storeFiles = allStoreFiles.filter((f) => {
    const relative = path.relative('src/store', f).replace(/\\/g, '/')
    if (EXCLUDE_FILES.some((ex) => relative.includes(ex))) return false
    if (EXCLUDE_SUFFIXES.some((sfx) => relative.endsWith(sfx))) return false
    return true
  })

  console.log(`扫描 ${storeFiles.length} 个 Store 源文件...\n`)

  const results: StoreAuditResult[] = []

  for (const storeFile of storeFiles) {
    const content = await readFile(storeFile, 'utf-8')
    const storeName = path.basename(storeFile, '.ts')
    const testFile = await findTestFile(storeFile)
    const actionCount = extractActionCount(content)
    const testCount = testFile ? extractTestCount(await readFile(testFile, 'utf-8')) : 0
    const ratio = actionCount > 0 ? testCount / actionCount : 1

    let severity: StoreAuditResult['severity'] = 'ok'
    let message = ''

    if (!testFile) {
      severity = 'critical'
      message = `无测试文件（${actionCount} 个 action 未测试）`
    } else if (actionCount === 0) {
      severity = 'ok'
      message = `无 action（数据/配置 Store）`
    } else if (ratio < MIN_RATIO_ERROR) {
      severity = 'error'
      message = `测试比率 ${ratio.toFixed(2)} 严重不足（${testCount}/${actionCount}）`
    } else if (ratio < MIN_RATIO_WARN) {
      severity = 'warn'
      message = `测试比率 ${ratio.toFixed(2)} 偏低（${testCount}/${actionCount}）`
    } else {
      message = `测试比率 ${ratio.toFixed(2)}（${testCount}/${actionCount}）`
    }

    results.push({
      storeFile,
      storeName,
      testFile,
      actionCount,
      testCount,
      ratio,
      severity,
      message,
    })
  }

  // 输出结果
  const critical = results.filter((r) => r.severity === 'critical')
  const errors = results.filter((r) => r.severity === 'error')
  const warnings = results.filter((r) => r.severity === 'warn')
  const oks = results.filter((r) => r.severity === 'ok')

  // 按严重程度排序输出
  const sorted = [...critical, ...errors, ...warnings, ...oks]

  sorted.forEach((r) => {
    const icon =
      r.severity === 'critical' ? '🔴' :
      r.severity === 'error' ? '❌' :
      r.severity === 'warn' ? '⚠️' : '✅'
    const testInfo = r.testFile ? path.relative('.', r.testFile) : '—'
    console.log(`${icon} ${r.storeName.padEnd(35)} actions: ${String(r.actionCount).padStart(3)} | tests: ${String(r.testCount).padStart(3)} | ${r.message}`)
  })

  // 汇总
  console.log()
  console.log('═'.repeat(60))
  console.log(`总计: ${storeFiles.length} Store | ✅ ${oks.length} 通过 | ⚠️ ${warnings.length} 警告 | ❌ ${errors.length} 错误 | 🔴 ${critical.length} 严重`)
  console.log('═'.repeat(60))

  // CI 模式下有错误则退出
  if (isCI && (critical.length > 0 || errors.length > 0)) {
    console.log('\n❌ CI 模式: 存在严重测试覆盖率问题，阻止提交')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('审计脚本执行失败:', err)
  process.exit(1)
})
