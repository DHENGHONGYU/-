#!/usr/bin/env tsx
/**
 * 批量迁移脚本：本地 vi.mock('@/cockpit/providers/MarketDataProvider') → 全局工具函数
 *
 * 背景：
 *   全局 vitest.setup.ts 已统一 Mock MarketDataProvider，避免测试套件中的 Mock 隔离问题。
 *   仍有 9+1 个测试文件使用本地 vi.mock，与全局声明冲突，需逐个迁移。
 *
 * 使用方式：
 *   npx tsx scripts/migrate/migrate-local-mock-to-global.ts                  # dry-run 预览
 *   npx tsx scripts/migrate/migrate-local-mock-to-global.ts --apply          # 实际写入
 *   npx tsx scripts/migrate/migrate-local-mock-to-global.ts --include-extra  # 包含额外目标
 *
 * 支持的 Mock 模式：
 *   1. hoisted-fn        : const mockUseMarketData = vi.hoisted(() => vi.fn())
 *   2. hoisted-object    : const { mockUseMarketData } = vi.hoisted(() => ({ mockUseMarketData: vi.fn() }))
 *   3. mocked-import     : const { useMarketData } = await import(...); const mockUseMarketData = vi.mocked(useMarketData)
 *   4. direct-fn         : const mockUseMarketData = vi.fn()
 *
 * 迁移策略（最小化机械变换）：
 *   - 替换本地 vi.hoisted / vi.fn / vi.mocked 声明为 getMarketDataMock() / getOptionalMarketDataMock()
 *   - 移除本地 vi.mock('@/cockpit/providers/MarketDataProvider', ...) 整段
 *   - 添加 import { resetMarketDataMock, getMarketDataMock } from '<rel>/vitest.setup'
 *   - 在 beforeEach 的 vi.clearAllMocks() 后添加 resetMarketDataMock()
 *
 * 保留 mockUseMarketData.mockReturnValue(...) 调用不变，最大化兼容现有测试逻辑。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ============================================================
// 迁移目标配置
// ============================================================

interface MigrationTarget {
  /** 相对项目根目录的文件路径 */
  filePath: string
  /** 默认 instanceId（用于推断，目前仅记录，不参与变换） */
  instanceId?: string
  /** 是否同时 mock useOptionalMarketData（ValuePitWidget 特有） */
  useOptional?: boolean
  /** Mock 变量名（默认 mockUseMarketData，useOptional 时为 mockUseOptionalMarketData） */
  varName?: string
}

/** 主迁移清单（9 个，对应治理总结报告 §5.1） */
const TARGETS: MigrationTarget[] = [
  // P0 - vi.hoisted 模式
  { filePath: 'src/cockpit/widgets/MarketIndicesWidget.test.tsx', instanceId: 'market-indices-1' },
  { filePath: 'src/cockpit/widgets/ModelCompareWidget.test.tsx', instanceId: 'model-compare-1' },
  {
    filePath: 'src/cockpit/widgets/ValuePitWidget.test.tsx',
    instanceId: 'widget-value-pit-1',
    useOptional: true,
    varName: 'mockUseOptionalMarketData',
  },
  // P1 - vi.hoisted({}) 对象解构
  { filePath: 'src/cockpit/widgets/KaiScoreWidget.test.tsx', instanceId: 'kai-score-1' },
  // P1 - vi.mocked 模式
  { filePath: 'src/cockpit/widgets/WatchlistWidget.test.tsx', instanceId: 'watchlist-1' },
  // P1 - vi.hoisted + JSX MarketDataProvider
  { filePath: 'src/cockpit/CockpitShell.test.tsx', instanceId: 'cockpit-shell' },
  // P2 - 直接 vi.fn() 模式
  { filePath: 'tests/color-remediation.widgets.test.tsx', instanceId: 'test-widget-1' },
  { filePath: 'tests/SectorHeatmapWidget.test.tsx', instanceId: 'sector-heatmap-1' },
  { filePath: 'tests/CockpitShell.panel.test.tsx', instanceId: 'cockpit-shell-panel' },
]

/** 额外迁移清单（报告未列出但同样存在本地 vi.mock 的文件） */
const EXTRA_TARGETS: MigrationTarget[] = [
  {
    filePath: 'src/cockpit/widgets/PortfolioOverviewWidget.kpi-negative.test.tsx',
    instanceId: 'widget-portfolio-neg',
  },
]

// ============================================================
// Mock 模式识别
// ============================================================

type MockPattern =
  | 'hoisted-fn'
  | 'hoisted-object'
  | 'mocked-import'
  | 'direct-fn'
  | 'unknown'

function detectPattern(content: string, varName: string): MockPattern {
  // 模式 1：const mockUseMarketData = vi.hoisted(() => vi.fn())
  const re1 = new RegExp(
    `const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.hoisted\\(\\(\\)\\s*=>\\s*vi\\.fn\\(\\)\\)`,
  )
  if (re1.test(content)) return 'hoisted-fn'

  // 模式 2：const { mockUseMarketData } = vi.hoisted(() => ({ mockUseMarketData: vi.fn() }))
  const re2 = new RegExp(
    `const\\s*{\\s*${escapeRegExp(varName)}\\s*}\\s*=\\s*vi\\.hoisted\\(\\(\\)\\s*=>\\s*\\({[\\s\\S]*?${escapeRegExp(varName)}:\\s*vi\\.fn\\(\\)`,
  )
  if (re2.test(content)) return 'hoisted-object'

  // 模式 3：vi.mocked + await import
  const re3 = new RegExp(
    `const\\s*{\\s*useMarketData\\s*}\\s*=\\s*await\\s+import\\(['"]@/cockpit/providers/MarketDataProvider['"]\\)[\\s\\S]*?const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.mocked\\(useMarketData\\)`,
  )
  if (re3.test(content)) return 'mocked-import'

  // 模式 4：直接 vi.fn()
  const re4 = new RegExp(`const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.fn\\(\\)`)
  if (re4.test(content)) return 'direct-fn'

  return 'unknown'
}

// ============================================================
// 变换规则
// ============================================================

interface TransformResult {
  success: boolean
  transformedContent?: string
  notes: string[]
  warnings: string[]
}

function transform(content: string, target: MigrationTarget): TransformResult {
  const notes: string[] = []
  const warnings: string[] = []
  let result = content

  const varName = target.varName ?? (target.useOptional ? 'mockUseOptionalMarketData' : 'mockUseMarketData')
  const setupFn = target.useOptional ? 'getOptionalMarketDataMock' : 'getMarketDataMock'
  const resetFn = target.useOptional ? 'resetOptionalMarketDataMock' : 'resetMarketDataMock'

  // 1. 检测 Mock 模式
  const pattern = detectPattern(content, varName)
  if (pattern === 'unknown') {
    return {
      success: false,
      notes,
      warnings: [`无法识别 Mock 模式（变量名: ${varName}），需人工迁移`],
    }
  }
  notes.push(`识别 Mock 模式: ${pattern}`)

  // 2. 替换变量声明
  if (pattern === 'hoisted-fn') {
    const re = new RegExp(
      `const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.hoisted\\(\\(\\)\\s*=>\\s*vi\\.fn\\(\\)\\)\\s*;?`,
    )
    result = result.replace(re, `const ${varName} = ${setupFn}()`)
    notes.push(`替换 vi.hoisted(() => vi.fn()) → ${setupFn}()`)
  }

  if (pattern === 'hoisted-object') {
    const re = new RegExp(
      `const\\s*{\\s*${escapeRegExp(varName)}\\s*}\\s*=\\s*vi\\.hoisted\\(\\(\\)\\s*=>\\s*\\({[\\s\\S]*?${escapeRegExp(varName)}:\\s*vi\\.fn\\(\\)[\\s\\S]*?}\\)\\)\\s*;?`,
    )
    result = result.replace(re, `const ${varName} = ${setupFn}()`)
    notes.push(`替换 vi.hoisted({...}) 解构 → ${setupFn}()`)
  }

  if (pattern === 'mocked-import') {
    // 移除 const { useMarketData } = await import(...)
    const re1 = new RegExp(
      `const\\s*{\\s*useMarketData\\s*}\\s*=\\s*await\\s+import\\(['"]@/cockpit/providers/MarketDataProvider['"]\\)\\s*;?\\s*\n?`,
    )
    result = result.replace(re1, '')
    // 替换 const mockUseMarketData = vi.mocked(useMarketData)
    const re2 = new RegExp(
      `const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.mocked\\(useMarketData\\)\\s*;?`,
    )
    result = result.replace(re2, `const ${varName} = ${setupFn}()`)
    notes.push(`替换 vi.mocked(useMarketData) → ${setupFn}()`)
  }

  if (pattern === 'direct-fn') {
    const re = new RegExp(`const\\s+${escapeRegExp(varName)}\\s*=\\s*vi\\.fn\\(\\)\\s*;?`)
    result = result.replace(re, `const ${varName} = ${setupFn}()`)
    notes.push(`替换 vi.fn() → ${setupFn}()`)
  }

  // 3. 移除 vi.mock('@/cockpit/providers/MarketDataProvider', ...) 整段
  // 匹配单行和多行（含 JSX）
  const viMockRe =
    /vi\.mock\(['"]@\/cockpit\/providers\/MarketDataProvider['"]\s*,\s*\(\)\s*=>\s*\(\{[\s\S]*?\}\)\)\s*;?\s*\n?/g
  const viMockMatches = result.match(viMockRe)
  if (viMockMatches && viMockMatches.length > 0) {
    result = result.replace(viMockRe, '')
    notes.push(`移除 ${viMockMatches.length} 处 vi.mock('@/cockpit/providers/MarketDataProvider')`)
  } else {
    warnings.push('未找到 vi.mock 声明（可能已被移除或格式不同）')
  }

  // 4. 添加 import
  const fileDir = path.dirname(target.filePath)
  const relPath = path.relative(fileDir, '.').replace(/\\/g, '/')
  const importPath = `${relPath}/vitest.setup`

  const importRe = new RegExp(`from\\s+['"]${escapeRegExp(importPath)}['"]`)
  if (!importRe.test(result)) {
    // 在最后一个 import 语句后添加
    const importLines = result.match(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm)
    if (importLines && importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1]
      const lastImportIdx = result.lastIndexOf(lastImport)
      const insertPos = lastImportIdx + lastImport.length
      const newImport = `\nimport { ${resetFn}, ${setupFn} } from '${importPath}'`
      result = result.slice(0, insertPos) + newImport + result.slice(insertPos)
      notes.push(`添加 import: { ${resetFn}, ${setupFn} } from '${importPath}'`)
    } else {
      const newImport = `import { ${resetFn}, ${setupFn} } from '${importPath}'\n`
      result = newImport + result
      notes.push(`在文件开头添加 import: { ${resetFn}, ${setupFn} } from '${importPath}'`)
    }
  } else {
    notes.push('import 已存在，跳过')
  }

  // 5. 在 beforeEach 中添加 resetFn()
  const beforeEachRe = /(beforeEach\(\(\)\s*=>\s*\{[\s\S]*?vi\.clearAllMocks\(\)\s*;?)/g
  let hasReset = false
  let m: RegExpExecArray | null
  while ((m = beforeEachRe.exec(result)) !== null) {
    // 检查当前 beforeEach 块内是否已有 resetFn
    const blockEnd = findBlockEnd(result, m.index + m[0].length)
    const block = result.slice(m.index, blockEnd)
    if (block.includes(resetFn)) {
      hasReset = true
      break
    }
  }
  if (!hasReset) {
    result = result.replace(
      beforeEachRe,
      `$1\n    ${resetFn}()`,
    )
    notes.push(`在 beforeEach 中添加 ${resetFn}() 调用`)
  } else {
    notes.push(`${resetFn}() 已存在于 beforeEach，跳过`)
  }

  // 6. 清理多余空行（连续 4+ 空行 → 2 空行）
  result = result.replace(/\n{4,}/g, '\n\n\n')

  return {
    success: true,
    transformedContent: result,
    notes,
    warnings,
  }
}

/** 找到 beforeEach(() => { ... }) 的结束位置 */
function findBlockEnd(s: string, start: number): number {
  let depth = 1
  let i = start
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') depth--
    i++
  }
  return i
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================
// 主流程
// ============================================================

function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const includeExtra = args.includes('--include-extra')

  const targets = includeExtra ? [...TARGETS, ...EXTRA_TARGETS] : TARGETS
  const projectRoot = process.cwd()

  console.log('========================================')
  console.log('Mock 本地声明 → 全局工具函数 迁移脚本')
  console.log(`模式: ${apply ? 'apply (实际写入)' : 'dry-run (预览)'}`)
  console.log(`额外目标: ${includeExtra ? '包含' : '不包含'}`)
  console.log(`目标文件: ${targets.length} 个`)
  console.log('========================================\n')

  const report: Array<{
    file: string
    status: 'success' | 'warning' | 'failed'
    notes: string[]
    warnings: string[]
  }> = []

  for (const target of targets) {
    const fullPath = path.resolve(projectRoot, target.filePath)
    console.log(`--- ${target.filePath} ---`)

    if (!fs.existsSync(fullPath)) {
      console.log(`  ✗ 文件不存在`)
      report.push({
        file: target.filePath,
        status: 'failed',
        notes: [],
        warnings: ['文件不存在'],
      })
      continue
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    const result = transform(content, target)

    if (!result.success) {
      console.log(`  ✗ 迁移失败`)
      result.warnings.forEach((w) => console.log(`    ⚠ ${w}`))
      report.push({
        file: target.filePath,
        status: 'failed',
        notes: result.notes,
        warnings: result.warnings,
      })
      continue
    }

    if (apply) {
      fs.writeFileSync(fullPath, result.transformedContent!, 'utf-8')
      console.log(`  ✓ 已写入`)
    } else {
      console.log(`  ✓ 预览（未写入）`)
    }

    result.notes.forEach((n) => console.log(`    • ${n}`))
    result.warnings.forEach((w) => console.log(`    ⚠ ${w}`))

    report.push({
      file: target.filePath,
      status: result.warnings.length > 0 ? 'warning' : 'success',
      notes: result.notes,
      warnings: result.warnings,
    })
    console.log('')
  }

  // 汇总
  console.log('========================================')
  console.log('迁移汇总')
  console.log('========================================')
  const success = report.filter((r) => r.status === 'success').length
  const warning = report.filter((r) => r.status === 'warning').length
  const failed = report.filter((r) => r.status === 'failed').length
  console.log(`成功: ${success}  警告: ${warning}  失败: ${failed}  总计: ${report.length}`)

  if (failed > 0) {
    console.log('\n失败文件（需人工迁移）:')
    report
      .filter((r) => r.status === 'failed')
      .forEach((r) => console.log(`  - ${r.file}: ${r.warnings.join('; ')}`))
  }

  if (!apply) {
    console.log('\n这是 dry-run 预览。如需实际写入，请运行：')
    console.log(`  npx tsx scripts/migrate/migrate-local-mock-to-global.ts --apply`)
    console.log('\n如需同时迁移额外目标（PortfolioOverviewWidget.kpi-negative.test.tsx），请运行：')
    console.log(`  npx tsx scripts/migrate/migrate-local-mock-to-global.ts --apply --include-extra`)
  }

  // 退出码
  process.exit(failed > 0 ? 1 : 0)
}

main()
