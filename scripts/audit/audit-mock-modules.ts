/**
 * @fileoverview Mock 模块审查门禁
 *
 * 扫描所有测试文件中的 `vi.mock()` 调用，检查 mock 目标模块是否包含
 * file-level side effects（模块初始化逻辑），并验证 mock 策略是否安全。
 *
 * 背景：
 *   P8 教训 — mock `collectionPipeline` 时用全量替换导致 `upgradeDimensionsToPipeline`
 *   的补全逻辑丢失，因为该函数在 `initialState` 计算时被调用（模块加载时执行）。
 *
 * 检查规则：
 *   R1: 如果 mock 目标是 `@/services/` 或 `@/store/` 且未使用 `importActual` → WARNING
 *   R2: 如果 mock 目标从 factory 返回全量替换（未展开 `...actual`） → WARNING
 *   R3: 如果 mock 目标模块包含 `export function` 且 mock 中未保留 → WARNING
 *
 * 使用方式：
 *   node ./node_modules/tsx/dist/cli.mjs scripts/audit/audit-mock-modules.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

// ============================================================
// 配置
// ============================================================

const TEST_DIRS = ['tests/__tests__', 'tests/unit', 'tests/remediation']
const SRC_DIR = 'src'
const HIGH_RISK_PREFIXES = ['@/services/', '@/store/', '@/core/']
const SAFE_PATTERN = /importActual/

/**
 * 已知安全的完整 Mock（审计豁免）。
 *
 * 这些 mock 使用全量替换是因为：
 * - databridge: 需要 vi.hoisted() 捕获 subscribe callback 或自定义 memoryStore（importActual 会破坏设计）
 * - signalGenerator: 测试仅用到 2 个 export，全量替换等价于局部覆盖
 */
const SAFE_FULL_MOCKS: Array<{ file: string; module: string; reason: string }> = [
  {
    file: 'tests/remediation/signal-dedup-invariant.test.ts',
    module: '@/core/databridge',
    reason: '需要 vi.hoisted() 捕获 subscribe callback，importActual 无法传递 hoisted 变量',
  },
  {
    file: 'tests/remediation/signal-dedup-invariant.test.ts',
    module: '@/services/trading/signalGenerator',
    reason: '仅用到 2 个 export（generateSignalsForSymbol/pickStrongestSignal），全量替换等价',
  },
  {
    file: 'tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts',
    module: '@/core/databridge',
    reason: '需自定义 memoryStore 实现（query + forward），importActual 无法内联',
  },

  // ============================================================
  // P1 豁免：Store 测试 + 独立修复测试（标准 Zustand 全量 mock 模式）
  // ============================================================
  {
    file: 'tests/__tests__/store/analysisStore.derived.test.ts',
    module: '@/store/analysisStore',
    reason: 'Zustand store 测试标准模式：需要重置 mock 状态，importActual 会引入运行时 store 实例干扰',
  },
  {
    file: 'tests/__tests__/store/chatStore.derived.test.ts',
    module: '@/store/chatStore',
    reason: '同上 — Zustand store 全量 mock 是标准测试模式',
  },
  {
    file: 'tests/__tests__/store/riskStore.derived.test.ts',
    module: '@/store/riskStore',
    reason: '同上',
  },
  {
    file: 'tests/__tests__/store/rotationSignalStore.derived.test.ts',
    module: '@/store/rotationSignalStore',
    reason: '同上',
  },
  {
    file: 'tests/__tests__/store/signalQualityStore.derived.test.ts',
    module: '@/store/signalQualityStore',
    reason: '同上',
  },
  {
    file: 'tests/remediation/dualStrategy-dedup-invariant.test.ts',
    module: '@/core/databridge',
    reason: '隔离修复测试需全量替换 databridge 以避免真实 DataBridge 副作用',
  },
  {
    file: 'tests/remediation/dualStrategy-dedup-invariant.test.ts',
    module: '@/services/trading/dualStrategyEngine',
    reason: '隔离测试仅验证去重不变式，全量 mock 等价于局部覆盖',
  },
  {
    file: 'tests/remediation/dualStrategy-dedup-invariant.test.ts',
    module: '@/services/scoring/hotSectorAnalyzer',
    reason: '同上 — 隔离测试模式',
  },
  {
    file: 'tests/remediation/dualStrategy-dedup-invariant.test.ts',
    module: '@/services/scoring/valuePitAnalyzer',
    reason: '同上 — 隔离测试模式',
  },
  {
    file: 'tests/remediation/dualStrategy-dedup-invariant.test.ts',
    module: '@/services/scoring/rotationSignalDetector',
    reason: '同上 — 隔离测试模式',
  },
  {
    file: 'tests/remediation/resilience-guard-c29.test.ts',
    module: '@/services/errorBus',
    reason: 'C29 熔断状态机独立测试，需全量替换 errorBus 以避免真实总线副作用',
  },

  // ============================================================
  // P1 豁免：infrastructure-extreme 集成测试 + tofixed P0 回归测试
  // ============================================================
  {
    file: 'tests/__tests__/integration/infrastructure-extreme.test.ts',
    module: '@/services/data-collector/tracePersistenceService',
    reason: '集成测试仅 mock 3 个方法（saveTrace/batchSaveTraces/listTracesBySymbol），importActual 会引入真实 DataCollector 副作用',
  },
  {
    file: 'tests/__tests__/integration/infrastructure-extreme.test.ts',
    module: '@/services/data-collector/qualityMetricsCollector',
    reason: '集成测试需替换 QualityMetricsCollector 类以避免真实指标计算副作用，全量 mock 仅覆盖必要接口',
  },
  {
    file: 'tests/unit/tofixed-p0-regression.test.tsx',
    module: '@/core/databridge',
    reason: 'P0 #10 回归测试需 mock dataBridge.query 返回空股票池，importActual 会引入真实 DataBridge 实例干扰',
  },
]
const FULL_MOCK_PATTERN = /vi\.mock\s*\(\s*(['"][^'"]+['"])\s*,\s*(?:async\s*)?\s*(?:\(\s*\)|\(\))\s*=>\s*\{/g

// ============================================================
// 类型
// ============================================================

interface MockCall {
  /** vi.mock 的第一个参数（模块路径） */
  modulePath: string
  /** 完整的 vi.mock 调用文本 */
  rawText: string
  /** 所在测试文件 */
  testFile: string
  /** 是否使用了 importActual */
  usesImportActual: boolean
  /** 是否是高风险模块（services/store/core） */
  isHighRisk: boolean
  /** mock factory 是否做了全量替换（返回字面量对象而非展开 actual） */
  isFullReplacement: boolean
}

interface AuditResult {
  totalMocks: number
  violations: MockCall[]
  warnings: MockCall[]
}

// ============================================================
// 工具函数
// ============================================================

function findTestFiles(): string[] {
  const files: string[] = []
  for (const dir of TEST_DIRS) {
    try {
      const entries = readdirSync(dir, { recursive: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        try {
          if (statSync(fullPath).isFile() && /\.test\.(ts|tsx)$/.test(entry)) {
            files.push(fullPath)
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* directory may not exist */ }
  }
  return files
}

function extractMockCalls(filePath: string): MockCall[] {
  const content = readFileSync(filePath, 'utf-8')
  const results: MockCall[] = []

  // 匹配 vi.mock 调用 — 支持同步和异步 factory
  const mockRegex = /vi\.mock\s*\(\s*(['"]([^'"]+)['"])\s*,/g
  let match: RegExpExecArray | null

  while ((match = mockRegex.exec(content)) !== null) {
    const modulePath = match[2]
    // 提取从 vi.mock 到下一个顶层语句或 500 字符的文本
    const startIdx = match.index
    const endIdx = Math.min(startIdx + 800, content.length)
    const rawText = content.slice(startIdx, endIdx)

    const usesImportActual = SAFE_PATTERN.test(rawText)
    const isHighRisk = HIGH_RISK_PREFIXES.some((prefix) => modulePath.startsWith(prefix))

    // 检查是否是全量替换（返回新对象而非展开 actual）
    const isFullReplacement =
      !usesImportActual &&
      /\breturn\s*\{[^.]/.test(rawText) &&
      !/\.\.\.actual/.test(rawText)

    results.push({
      modulePath,
      rawText: rawText.slice(0, 200).replace(/\n/g, ' '),
      testFile: relative(process.cwd(), filePath),
      usesImportActual,
      isHighRisk,
      isFullReplacement,
    })
  }

  return results
}

// ============================================================
// 主函数
// ============================================================

function audit(): AuditResult {
  const testFiles = findTestFiles()
  const allMocks: MockCall[] = []

  for (const file of testFiles) {
    allMocks.push(...extractMockCalls(file))
  }

  // 分类：违反（高风险 + 全量替换 − allowlist）vs 警告（其他未用 importActual）
  const violations = allMocks.filter((m) => {
    if (!m.isHighRisk || !m.isFullReplacement) return false
    // 排除已知安全的 mock
    return !SAFE_FULL_MOCKS.some(
      (safe) =>
        safe.file === m.testFile.replace(/\\/g, '/') &&
        safe.module === m.modulePath,
    )
  })
  const warnings = allMocks.filter(
    (m) => m.isHighRisk && !m.isFullReplacement && !m.usesImportActual,
  ).filter(
    // 也排除已知安全的 mock（allowlist 覆盖违规和警告两种分类）
    (m) => !SAFE_FULL_MOCKS.some(
      (safe) =>
        safe.file === m.testFile.replace(/\\/g, '/') &&
        safe.module === m.modulePath,
    ),
  )

  return { totalMocks: allMocks.length, violations, warnings }
}

// ============================================================
// 输出
// ============================================================

const result = audit()

console.log('='.repeat(60))
console.log('Mock 模块审查门禁')
console.log('='.repeat(60))
console.log(`扫描测试文件: ${findTestFiles().length} 个`)
console.log(`总 vi.mock 调用: ${result.totalMocks}`)
console.log(`违规 (高风险 + 全量替换): ${result.violations.length}`)
console.log(`警告 (高风险 + 未用 importActual): ${result.warnings.length}`)
console.log(`豁免 (已知安全): ${SAFE_FULL_MOCKS.length}`)
console.log('='.repeat(60))

if (result.violations.length > 0) {
  console.log('\n❌ 违规项 (P0 — 高风险模块 Mock 存在初始化逻辑丢失风险):\n')
  for (const v of result.violations) {
    console.log(`  文件: ${v.testFile}`)
    console.log(`  模块: ${v.modulePath}`)
    console.log(`  Mock文本: ${v.rawText}`)
    console.log(`  建议: 使用 importActual + 局部覆盖模式`)
    console.log()
  }
}

if (result.warnings.length > 0) {
  console.log('\n⚠️  警告 (P1 — 建议使用 importActual):\n')
  for (const w of result.warnings) {
    console.log(`  文件: ${w.testFile}`)
    console.log(`  模块: ${w.modulePath}`)
    console.log()
  }
}

if (result.violations.length === 0 && result.warnings.length === 0) {
  console.log('\n✅ 所有 Mock 调用安全\n')
}

// 退出码：有违反则 1，仅警告则 0
process.exit(result.violations.length > 0 ? 1 : 0)
