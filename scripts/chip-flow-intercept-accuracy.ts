/**
 * 低流动性拦截准确性验证脚本 ★ v4.5.4
 *
 * 验证目标：
 * 1. 量比阈值 0.7（由 0.8 收紧）→ 误杀率应降至 0%
 * 2. 日成交金额 > 3 亿元豁免 → 蓝筹股放行，僵尸股拦截
 * 3. ON/OFF 双模式对比 → 量化信号差异
 *
 * 运行：npx tsx scripts/chip-flow-intercept-accuracy.ts
 */

import { detectMainForceChipFlow } from '../src/services/scoring/v6-engine/calculators/l7_l8'
import type { LayerInput, LowLiquidityInterceptMeta } from '../src/services/scoring/v6-engine/types'

// ============================================================
// 样本库：30 只典型股票（含 6 只低流动性 + 4 只蓝筹低换手）
// ============================================================

interface StockSpec {
  symbol: string
  name: string
  category: 'active' | 'low_liq_zombie' | 'blue_chip_low_turnover' | 'borderline'
  turnover: number       // 20日平均换手率（小数）
  volumeRatio: number    // 量比
  dailyAmount: number    // 日成交金额（元）
  return60d: number      // 60日收益率
  latestReturn1d: number // 最近一日涨跌幅
  turnover20dStd: number // 20日换手率标准差
  expectIntercepted: boolean  // 期望：是否应被拦截
  expectBypassed: boolean     // 期望：是否应被蓝筹豁免放行
}

const HOT_STOCKS: StockSpec[] = [
  // ---- 活跃股（不应被拦截） ----
  { symbol: '600519.SH', name: '贵州茅台', category: 'active', turnover: 0.008, volumeRatio: 1.2, dailyAmount: 15_0000_0000, return60d: 0.05, latestReturn1d: 0.01, turnover20dStd: 0.002, expectIntercepted: false, expectBypassed: false },
  { symbol: '000001.SZ', name: '平安银行', category: 'active', turnover: 0.015, volumeRatio: 1.5, dailyAmount: 8_0000_0000, return60d: 0.02, latestReturn1d: 0.005, turnover20dStd: 0.003, expectIntercepted: false, expectBypassed: false },
  { symbol: '300750.SZ', name: '宁德时代', category: 'active', turnover: 0.020, volumeRatio: 2.0, dailyAmount: 20_0000_0000, return60d: 0.10, latestReturn1d: 0.02, turnover20dStd: 0.004, expectIntercepted: false, expectBypassed: false },
  { symbol: '002594.SZ', name: '比亚迪', category: 'active', turnover: 0.018, volumeRatio: 1.8, dailyAmount: 12_0000_0000, return60d: 0.08, latestReturn1d: 0.015, turnover20dStd: 0.0035, expectIntercepted: false, expectBypassed: false },
  { symbol: '600036.SH', name: '招商银行', category: 'active', turnover: 0.006, volumeRatio: 0.9, dailyAmount: 5_0000_0000, return60d: 0.03, latestReturn1d: 0.002, turnover20dStd: 0.001, expectIntercepted: false, expectBypassed: false },

  // ---- 僵尸股（应被拦截，低换手+低量比+低成交额） ----
  { symbol: '600001.SH', name: '僵尸股A', category: 'low_liq_zombie', turnover: 0.003, volumeRatio: 0.5, dailyAmount: 5000_0000, return60d: -0.02, latestReturn1d: -0.001, turnover20dStd: 0.0008, expectIntercepted: true, expectBypassed: false },
  { symbol: '600002.SH', name: '僵尸股B', category: 'low_liq_zombie', turnover: 0.002, volumeRatio: 0.4, dailyAmount: 3000_0000, return60d: -0.05, latestReturn1d: -0.002, turnover20dStd: 0.0005, expectIntercepted: true, expectBypassed: false },
  { symbol: '600003.SH', name: '僵尸股C', category: 'low_liq_zombie', turnover: 0.004, volumeRatio: 0.6, dailyAmount: 8000_0000, return60d: 0.01, latestReturn1d: 0.001, turnover20dStd: 0.001, expectIntercepted: true, expectBypassed: false },
  { symbol: '600004.SH', name: '僵尸股D', category: 'low_liq_zombie', turnover: 0.001, volumeRatio: 0.3, dailyAmount: 1000_0000, return60d: -0.08, latestReturn1d: -0.003, turnover20dStd: 0.0003, expectIntercepted: true, expectBypassed: false },
  { symbol: '600005.SH', name: '僵尸股E', category: 'low_liq_zombie', turnover: 0.0025, volumeRatio: 0.45, dailyAmount: 4000_0000, return60d: -0.03, latestReturn1d: 0, turnover20dStd: 0.0006, expectIntercepted: true, expectBypassed: false },
  { symbol: '600006.SH', name: '僵尸股F', category: 'low_liq_zombie', turnover: 0.0035, volumeRatio: 0.55, dailyAmount: 6000_0000, return60d: -0.01, latestReturn1d: 0.001, turnover20dStd: 0.0009, expectIntercepted: true, expectBypassed: false },

  // ---- 蓝筹股低换手高成交额（应被豁免放行，不拦截） ----
  { symbol: '601398.SH', name: '工商银行', category: 'blue_chip_low_turnover', turnover: 0.0015, volumeRatio: 0.6, dailyAmount: 4_0000_0000, return60d: 0.02, latestReturn1d: 0.001, turnover20dStd: 0.0003, expectIntercepted: false, expectBypassed: true },
  { symbol: '601939.SH', name: '建设银行', category: 'blue_chip_low_turnover', turnover: 0.0012, volumeRatio: 0.5, dailyAmount: 3_5000_0000, return60d: 0.015, latestReturn1d: 0, turnover20dStd: 0.0002, expectIntercepted: false, expectBypassed: true },
  { symbol: '601288.SH', name: '农业银行', category: 'blue_chip_low_turnover', turnover: 0.001, volumeRatio: 0.45, dailyAmount: 5_0000_0000, return60d: 0.025, latestReturn1d: 0.001, turnover20dStd: 0.0002, expectIntercepted: false, expectBypassed: true },
  { symbol: '601857.SH', name: '中国石油', category: 'blue_chip_low_turnover', turnover: 0.0008, volumeRatio: 0.4, dailyAmount: 3_2000_0000, return60d: 0.01, latestReturn1d: 0, turnover20dStd: 0.0001, expectIntercepted: false, expectBypassed: true },

  // ---- 边界用例（验证 0.7 阈值精确性） ----
  { symbol: 'BD-001.SZ', name: '边界-量比0.69拦截', category: 'borderline', turnover: 0.004, volumeRatio: 0.69, dailyAmount: 5000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: true, expectBypassed: false },
  { symbol: 'BD-002.SZ', name: '边界-量比0.70放行', category: 'borderline', turnover: 0.004, volumeRatio: 0.70, dailyAmount: 5000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: false, expectBypassed: false },
  { symbol: 'BD-003.SZ', name: '边界-量比0.75放行', category: 'borderline', turnover: 0.004, volumeRatio: 0.75, dailyAmount: 5000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: false, expectBypassed: false },
  { symbol: 'BD-004.SZ', name: '边界-换手0.5%放行', category: 'borderline', turnover: 0.005, volumeRatio: 0.5, dailyAmount: 5000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: false, expectBypassed: false },
  { symbol: 'BD-005.SZ', name: '边界-换手0.49%拦截', category: 'borderline', turnover: 0.0049, volumeRatio: 0.5, dailyAmount: 5000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: true, expectBypassed: false },
  { symbol: 'BD-006.SZ', name: '边界-3亿整不豁免', category: 'borderline', turnover: 0.003, volumeRatio: 0.5, dailyAmount: 3_0000_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: true, expectBypassed: false },
  { symbol: 'BD-007.SZ', name: '边界-3.01亿豁免', category: 'borderline', turnover: 0.003, volumeRatio: 0.5, dailyAmount: 3_0100_0000, return60d: 0, latestReturn1d: 0, turnover20dStd: 0.001, expectIntercepted: false, expectBypassed: true },
]

// ============================================================
// 构造 LayerInput
// ============================================================

function buildInput(spec: StockSpec): LayerInput {
  return {
    stock: { symbol: spec.symbol, name: spec.name },
    financials: {},
    quotes: {
      avgTurnover20d: spec.turnover,
      volumeRatio: spec.volumeRatio,
      dailyTurnoverAmount: spec.dailyAmount,
      return60d: spec.return60d,
      latestReturn1d: spec.latestReturn1d,
      turnover20dStd: spec.turnover20dStd,
    },
    config: {
      weights: { l7: 0.12, l8: 0.10 },
      thresholds: {},
      ipc: {},
      confidence: {},
      industries: [],
      riskWarnings: {},
      offlineMode: false,
      auditEnabled: true,
      llmEnabled: false,
    } as any,
  }
}

// ============================================================
// 单股分析
// ============================================================

interface AnalysisResult {
  symbol: string
  name: string
  category: string
  turnover: number
  volumeRatio: number
  dailyAmount: number
  signalType: string
  marketSession: string
  opportunityScore: number
  intercepted: boolean
  bypassed: boolean
  meta: LowLiquidityInterceptMeta | undefined
  expectIntercepted: boolean
  expectBypassed: boolean
  pass: boolean
}

function analyze(spec: StockSpec, enableIntercept: boolean): AnalysisResult {
  const input = buildInput(spec)
  const signal = detectMainForceChipFlow(input, { enableLowLiquidityIntercept: enableIntercept })

  const intercepted = signal.marketSession === 'low_liquidity'
  const bypassed = !intercepted
    && spec.turnover < 0.005
    && spec.volumeRatio < 0.7
    && spec.dailyAmount > 3_0000_0000
    && enableIntercept

  // 判定逻辑：
  // - 期望拦截 → 实际 intercepted 应为 true
  // - 期望豁免放行 → 实际 intercepted 应为 false 且 bypassed 应为 true
  // - 期望不拦截（活跃股） → 实际 intercepted 应为 false 且 bypassed 应为 false
  let pass: boolean
  if (spec.expectIntercepted) {
    pass = intercepted === true
  } else if (spec.expectBypassed) {
    pass = intercepted === false && bypassed === true
  } else {
    pass = intercepted === false && bypassed === false
  }

  return {
    symbol: spec.symbol,
    name: spec.name,
    category: spec.category,
    turnover: spec.turnover,
    volumeRatio: spec.volumeRatio,
    dailyAmount: spec.dailyAmount,
    signalType: signal.tradeSignal.type,
    marketSession: signal.marketSession,
    opportunityScore: signal.opportunityScore,
    intercepted,
    bypassed,
    meta: signal.lowLiquidityMeta,
    expectIntercepted: spec.expectIntercepted,
    expectBypassed: spec.expectBypassed,
    pass,
  }
}

// ============================================================
// 批量分析
// ============================================================

function analyzeBatch(mode: string, stocks: StockSpec[], enableIntercept: boolean): AnalysisResult[] {
  console.log(`\n${'='.repeat(100)}`)
  console.log(`模式: ${mode} (enableLowLiquidityIntercept=${enableIntercept})`)
  console.log(`${'='.repeat(100)}`)
  console.log(
    `${'Symbol'.padEnd(14)} ${'Name'.padEnd(16)} ${'换手%'.padStart(7)} ${'量比'.padStart(6)} ${'日额(亿)'.padStart(8)} ${'信号'.padEnd(12)} ${'时段'.padEnd(16)} ${'拦截'.padEnd(6)} ${'豁免'.padEnd(6)} ${'期望'.padEnd(8)} ${'结果'.padEnd(6)}`,
  )
  console.log('-'.repeat(100))

  const results = stocks.map((spec) => {
    const r = analyze(spec, enableIntercept)
    const expectStr = r.expectIntercepted ? '拦截' : r.expectBypassed ? '豁免' : '正常'
    const resultStr = r.pass ? 'PASS' : 'FAIL'
    console.log(
      `${r.symbol.padEnd(14)} ${r.name.padEnd(16)} ${(r.turnover * 100).toFixed(2).padStart(7)} ${r.volumeRatio.toFixed(2).padStart(6)} ${(r.dailyAmount / 1e8).toFixed(2).padStart(8)} ${r.signalType.padEnd(12)} ${r.marketSession.padEnd(16)} ${(r.intercepted ? '是' : '否').padEnd(6)} ${(r.bypassed ? '是' : '否').padEnd(6)} ${expectStr.padEnd(8)} ${resultStr.padEnd(6)}`,
    )
    return r
  })

  const passCount = results.filter((r) => r.pass).length
  const failCount = results.length - passCount
  const interceptedCount = results.filter((r) => r.intercepted).length
  const bypassedCount = results.filter((r) => r.bypassed).length

  console.log('-'.repeat(100))
  console.log(`总计: ${results.length} 只 | 通过: ${passCount} | 失败: ${failCount} | 被拦截: ${interceptedCount} | 被豁免: ${bypassedCount}`)

  return results
}

// ============================================================
// ON/OFF 对比差异
// ============================================================

interface DiffRow {
  symbol: string
  name: string
  turnover: number
  volumeRatio: number
  dailyAmount: number
  signalON: string
  signalOFF: string
  sessionON: string
  sessionOFF: string
  oppDiff: number
  interceptedON: boolean
  bypassedON: boolean
}

function compareModes(resultsON: AnalysisResult[], resultsOFF: AnalysisResult[]): DiffRow[] {
  console.log(`\n${'='.repeat(100)}`)
  console.log('ON/OFF 对比：信号差异明细')
  console.log(`${'='.repeat(100)}`)
  console.log(
    `${'Symbol'.padEnd(14)} ${'Name'.padEnd(16)} ${'换手%'.padStart(7)} ${'量比'.padStart(6)} ${'日额(亿)'.padStart(8)} ${'ON信号'.padEnd(12)} ${'OFF信号'.padEnd(12)} ${'ON时段'.padEnd(16)} ${'OFF时段'.padEnd(16)} ${'机会差'.padStart(7)} ${'拦截'.padEnd(6)} ${'豁免'.padEnd(6)}`,
  )
  console.log('-'.repeat(100))

  const diffs: DiffRow[] = []
  for (let i = 0; i < resultsON.length; i++) {
    const on = resultsON[i]!
    const off = resultsOFF[i]!
    const oppDiff = Number((off.opportunityScore - on.opportunityScore).toFixed(2))
    const hasDiff = on.signalType !== off.signalType || on.marketSession !== off.marketSession

    if (hasDiff || on.intercepted || on.bypassed) {
      diffs.push({
        symbol: on.symbol,
        name: on.name,
        turnover: on.turnover,
        volumeRatio: on.volumeRatio,
        dailyAmount: on.dailyAmount,
        signalON: on.signalType,
        signalOFF: off.signalType,
        sessionON: on.marketSession,
        sessionOFF: off.marketSession,
        oppDiff,
        interceptedON: on.intercepted,
        bypassedON: on.bypassed,
      })
      console.log(
        `${on.symbol.padEnd(14)} ${on.name.padEnd(16)} ${(on.turnover * 100).toFixed(2).padStart(7)} ${on.volumeRatio.toFixed(2).padStart(6)} ${(on.dailyAmount / 1e8).toFixed(2).padStart(8)} ${on.signalType.padEnd(12)} ${off.signalType.padEnd(12)} ${on.marketSession.padEnd(16)} ${off.marketSession.padEnd(16)} ${oppDiff.toFixed(2).padStart(7)} ${(on.intercepted ? '是' : '否').padEnd(6)} ${(on.bypassed ? '是' : '否').padEnd(6)}`,
      )
    }
  }

  console.log('-'.repeat(100))
  console.log(`有差异股票数: ${diffs.length} / ${resultsON.length}`)
  return diffs
}

// ============================================================
// 准确率统计
// ============================================================

function accuracyStats(results: AnalysisResult[]): {
  total: number
  pass: number
  fail: number
  trueIntercept: number  // 正确拦截的僵尸股
  falseIntercept: number // 误杀的活跃股
  trueBypass: number     // 正确豁免的蓝筹股
  falseBypass: number    // 错误豁免的僵尸股
  missIntercept: number  // 漏拦截
  interceptPrecision: number
  interceptRecall: number
  bypassPrecision: number
  bypassRecall: number
} {
  const total = results.length
  const pass = results.filter((r) => r.pass).length
  const fail = total - pass

  const trueIntercept = results.filter((r) => r.intercepted && r.expectIntercepted).length
  const falseIntercept = results.filter((r) => r.intercepted && !r.expectIntercepted && !r.expectBypassed).length
  const trueBypass = results.filter((r) => r.bypassed && r.expectBypassed).length
  const falseBypass = results.filter((r) => r.bypassed && !r.expectBypassed).length
  const missIntercept = results.filter((r) => !r.intercepted && !r.bypassed && r.expectIntercepted).length

  const interceptPrecision = trueIntercept + falseIntercept > 0 ? trueIntercept / (trueIntercept + falseIntercept) : 1
  const interceptRecall = trueIntercept + missIntercept > 0 ? trueIntercept / (trueIntercept + missIntercept) : 1
  const bypassPrecision = trueBypass + falseBypass > 0 ? trueBypass / (trueBypass + falseBypass) : 1
  const bypassRecall = trueBypass + (results.filter((r) => !r.bypassed && r.expectBypassed).length) > 0
    ? trueBypass / (trueBypass + results.filter((r) => !r.bypassed && r.expectBypassed).length)
    : 1

  return {
    total, pass, fail,
    trueIntercept, falseIntercept, trueBypass, falseBypass, missIntercept,
    interceptPrecision, interceptRecall, bypassPrecision, bypassRecall,
  }
}

// ============================================================
// 主流程
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗')
console.log('║  低流动性拦截准确性验证 ★ v4.5.4                                                    ║')
console.log('║  阈值: 换手<0.5% 且 量比<0.7 | 豁免: 日成交额>3亿元                                  ║')
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝')

// ON 模式（实盘默认）
const resultsON = analyzeBatch('ON（实盘默认，拦截开启）', HOT_STOCKS, true)

// OFF 模式（回测对比）
const resultsOFF = analyzeBatch('OFF（回测对比，拦截关闭）', HOT_STOCKS, false)

// 对比
compareModes(resultsON, resultsOFF)

// 准确率统计
console.log(`\n${'='.repeat(100)}`)
console.log('准确率统计（ON 模式）')
console.log(`${'='.repeat(100)}`)
const stats = accuracyStats(resultsON)
console.log(`总样本:           ${stats.total}`)
console.log(`通过:             ${stats.pass} / ${stats.total} (${((stats.pass / stats.total) * 100).toFixed(1)}%)`)
console.log(`失败:             ${stats.fail}`)
console.log(`正确拦截(僵尸股):  ${stats.trueIntercept}`)
console.log(`误杀(活跃股):      ${stats.falseIntercept}`)
console.log(`正确豁免(蓝筹股):  ${stats.trueBypass}`)
console.log(`错误豁免(僵尸股):  ${stats.falseBypass}`)
console.log(`漏拦截:           ${stats.missIntercept}`)
console.log(`拦截精确率:        ${(stats.interceptPrecision * 100).toFixed(1)}%`)
console.log(`拦截召回率:        ${(stats.interceptRecall * 100).toFixed(1)}%`)
console.log(`豁免精确率:        ${(stats.bypassPrecision * 100).toFixed(1)}%`)
console.log(`豁免召回率:        ${(stats.bypassRecall * 100).toFixed(1)}%`)

// 失败用例详情
const failures = resultsON.filter((r) => !r.pass)
if (failures.length > 0) {
  console.log(`\n${'='.repeat(100)}`)
  console.log('失败用例详情')
  console.log(`${'='.repeat(100)}`)
  for (const f of failures) {
    console.log(`  ${f.symbol} ${f.name}: 期望拦截=${f.expectIntercepted} 期望豁免=${f.expectBypassed} | 实际拦截=${f.intercepted} 实际豁免=${f.bypassed} | 信号=${f.signalType} 时段=${f.marketSession}`)
  }
} else {
  console.log(`\n✓ 全部 ${stats.total} 个用例通过，v4.5.4 阈值与豁免逻辑验证成功！`)
}

// 退出码
process.exit(failures.length > 0 ? 1 : 0)
