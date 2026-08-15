/**
 * @fileoverview tsc:prod 遗留类型错误自动修复脚本
 *
 * 覆盖 2026-08-15 tsc:prod 自检发现的 22 处非关键类型不匹配：
 *
 * 1. ScreenSource 类型/字段被重构会话删除但消费方未同步（根因，10 处）：
 *    - types.stock.ts        : 恢复 export type ScreenSource + Stock.screenSource
 *    - pool.types.ts         : IntentionPoolItem.screenSource
 *    - inputService.ts       : AddStockOptions.screenSource
 *    （消费方 analysis.types.ts / AnalysisApp.tsx / hotSectorService.ts /
 *      intentionPoolService.ts / intentionPoolStore.ts / Input* 组件随之自动修复）
 * 2. useFreshData.ts forceRefresh 返回类型 () => void → () => Promise<void>
 *    （修复 useKline.ts / useRealtimeQuote.ts 的 TS2322，2 处）
 * 3. TradeReviewKlineChart.tsx 图例含非法 BuyPointType（'buy_turning'/'buy_divergence'，
 *    非真实买点类型，仅图例展示项，2 处）
 * 4. llmMockResponses.ts 在 noUncheckedIndexedAccess 下索引访问返回 | undefined，
 *    ?? 回退后补非空断言（TS18048，9 处）
 *
 * 用法：
 *   node scripts/fix-tsc-prod-type-errors.mjs
 *
 * 特性：幂等（已应用则跳过）、逐条校验（old 不存在则报错不覆盖）、批量写回。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 单条替换规则：file 为相对根目录路径，old 必须唯一存在 */
const FIXES = [
  // ── 1. types.stock.ts：恢复 ScreenSource 类型定义 ──
  {
    file: 'src/data/types/types.stock.ts',
    old: "import type { PoolStatus, PoolType } from '@/types/modules/pool.types'\n/** 股票数据质量标记 */",
    new:
      "import type { PoolStatus, PoolType } from '@/types/modules/pool.types'\n\n" +
      "/** 股票录入来源：hot-sector=来源一（热门板块核心标的）/ manual=来源二（自定义检索） */\n" +
      "export type ScreenSource = 'hot-sector' | 'manual'\n\n" +
      '/** 股票数据质量标记 */',
  },
  // ── 1. types.stock.ts：Stock 接口补回 screenSource 字段 ──
  {
    file: 'src/data/types/types.stock.ts',
    old: '  source: DataSource\n  dataVersion: number\n  dataQuality?: StockDataQuality',
    new:
      '  source: DataSource\n  dataVersion: number\n' +
      '  /** 录入来源（hot-sector/manual），用于来源溯源与过滤 */\n' +
      '  screenSource?: ScreenSource\n' +
      '  dataQuality?: StockDataQuality',
  },
  // ── 1. pool.types.ts：导入 ScreenSource ──
  {
    file: 'src/types/modules/pool.types.ts',
    old: "import type { StockDataQuality } from '@/data/types/types.stock'",
    new: "import type { ScreenSource, StockDataQuality } from '@/data/types/types.stock'",
  },
  // ── 1. pool.types.ts：IntentionPoolItem 补回 screenSource ──
  {
    file: 'src/types/modules/pool.types.ts',
    old:
      "export interface IntentionPoolItem extends PoolItemBase {\n  pool: 'intention'\n  status: IntentionStatus\n  screenReason?: string\n}",
    new:
      "export interface IntentionPoolItem extends PoolItemBase {\n  pool: 'intention'\n  status: IntentionStatus\n" +
      '  /** 录入来源（hot-sector/manual），用于来源溯源与过滤 */\n' +
      '  screenSource?: ScreenSource\n' +
      '  screenReason?: string\n}',
  },
  // ── 1. inputService.ts：导入 ScreenSource ──
  {
    file: 'src/services/input/inputService.ts',
    old: "import type { DataLayerResult, Stock } from '@/data/types'",
    new:
      "import type { DataLayerResult, Stock } from '@/data/types'\n" +
      "import type { ScreenSource } from '@/data/types/types.stock'",
  },
  // ── 1. inputService.ts：AddStockOptions 补回 screenSource ──
  {
    file: 'src/services/input/inputService.ts',
    old:
      "  fetchKlineAfterAdd?: boolean\n  /**\n   * 目标股票池分组，未指定时使用默认分组\n   */\n  group?: string\n}",
    new:
      "  fetchKlineAfterAdd?: boolean\n  /**\n   * 目标股票池分组，未指定时使用默认分组\n   */\n  group?: string\n" +
      '  /**\n   * 录入来源（hot-sector/manual），用于来源溯源与过滤\n   */\n' +
      '  screenSource?: ScreenSource\n}',
  },
  // ── 2. useFreshData.ts：接口类型 () => void → () => Promise<void> ──
  {
    file: 'src/hooks/useFreshData.ts',
    old: '  /** 强制立即刷新 */\n  forceRefresh: () => void',
    new: '  /** 强制立即刷新 */\n  forceRefresh: () => Promise<void>',
  },
  // ── 2. useFreshData.ts：实现改为 async 返回 Promise ──
  {
    file: 'src/hooks/useFreshData.ts',
    old:
      '  const forceRefresh = useCallback(() => {\n' +
      '    if (isRefreshingRef.current) {\n' +
      "      logger.debug(`[useFreshData:${label}] forceRefresh skipped: already refreshing`)\n" +
      '      return\n' +
      '    }\n' +
      '    isRefreshingRef.current = true\n' +
      "    logger.info(`[useFreshData:${label}] forceRefresh triggered`)\n" +
      '    refresh().catch(() => {}).finally(() => {\n' +
      '      isRefreshingRef.current = false\n' +
      '    })\n' +
      '  }, [refresh, label])',
    new:
      '  const forceRefresh = useCallback(async (): Promise<void> => {\n' +
      '    if (isRefreshingRef.current) {\n' +
      "      logger.debug(`[useFreshData:${label}] forceRefresh skipped: already refreshing`)\n" +
      '      return\n' +
      '    }\n' +
      '    isRefreshingRef.current = true\n' +
      "    logger.info(`[useFreshData:${label}] forceRefresh triggered`)\n" +
      '    try {\n' +
      '      await refresh()\n' +
      '    } catch {\n' +
      '      // 忽略刷新失败，仅复位 in-flight 标记\n' +
      '    } finally {\n' +
      '      isRefreshingRef.current = false\n' +
      '    }\n' +
      '  }, [refresh, label])',
  },
  // ── 3. TradeReviewKlineChart.tsx：移除非法 BuyPointType 图例项 ──
  {
    file: 'src/pages/output/components/TradeReviewKlineChart.tsx',
    old:
      "const BUY_TYPES_ORDER: BuyPointType[] = [\n  'buy_pivot',\n  'buy_breakout',\n  'buy_turning',\n  'buy_dip',\n  'buy_divergence',\n  'buy_safety_margin',\n  'composite_buy',\n]",
    new:
      "const BUY_TYPES_ORDER: BuyPointType[] = [\n  'buy_pivot',\n  'buy_breakout',\n  'buy_dip',\n  'buy_safety_margin',\n  'composite_buy',\n]",
  },
  // ── 4. llmMockResponses.ts：noUncheckedIndexedAccess 下索引访问补非空断言（9 处）──
  {
    file: 'src/services/llm/llmMockResponses.ts',
    old: 'const presetData = MOCK_PRESET_RESPONSES[presetId] ?? MOCK_PRESET_RESPONSES.deepseek',
    new: 'const presetData = (MOCK_PRESET_RESPONSES[presetId] ?? MOCK_PRESET_RESPONSES.deepseek)!',
  },
  {
    file: 'src/services/llm/llmMockResponses.ts',
    old: "const err = ERROR_RESPONSES[mode] ?? ERROR_RESPONSES['error-500']",
    new: "const err = (ERROR_RESPONSES[mode] ?? ERROR_RESPONSES['error-500'])!",
  },
]

/** 按文件分组合并，保证同文件多次替换在内存中累积，最后一次性写回 */
const plan = new Map()
for (const fix of FIXES) {
  if (!plan.has(fix.file)) plan.set(fix.file, [])
  plan.get(fix.file).push(fix)
}

let applied = 0
let skipped = 0
let failed = 0

for (const [relFile, fixes] of plan) {
  const absFile = join(root, relFile)
  let content = readFileSync(absFile, 'utf8')
  let dirty = false
  for (const fix of fixes) {
    if (content.includes(fix.new)) {
      console.log(`[SKIP] ${relFile}: 已应用，跳过 (${countOccurrences(content, fix.new)} 处)`)
      skipped++
      continue
    }
    const occurrences = countOccurrences(content, fix.old)
    if (occurrences !== 1) {
      console.error(`[FAIL] ${relFile}: old 匹配 ${occurrences} 次（应为 1 次），跳过`)
      failed++
      continue
    }
    content = content.replace(fix.old, fix.new)
    dirty = true
    applied++
    console.log(`[OK]   ${relFile}: 应用修复 #${applied}`)
  }
  if (dirty) writeFileSync(absFile, content, 'utf8')
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let index = 0
  for (;;) {
    index = haystack.indexOf(needle, index)
    if (index === -1) break
    count++
    index += needle.length
  }
  return count
}

console.log('\n========================================')
console.log(`修复完成: 应用 ${applied} / 跳过 ${skipped} / 失败 ${failed}`)
console.log('========================================')
console.log('验证命令: npm run tsc:prod')
if (failed > 0) {
  process.exitCode = 1
}
