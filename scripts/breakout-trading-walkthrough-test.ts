/**
 * 断线交易穿行测试 — 10 只典型股票验证
 * 
 * 验证目标：
 * 1. buildChipFlowSignal 调用传入 t/v 参数后，能量计算正确
 * 2. 假突破识别逻辑（tpct≥8% + v<1.5）准确触发
 * 3. 8 种风格 × 5 级能量全覆盖
 * 
 * 运行：npx tsx scripts/breakout-trading-walkthrough-test.ts
 */

import { detectMainForceChipFlow } from '../src/services/scoring/v6-engine/calculators/l7_l8'
import type { LayerInput } from '../src/services/scoring/v6-engine/types'

interface TestCase {
  symbol: string
  name: string
  scenario: string
  input: {
    turnover: number
    turnoverPct: number
    volumeRatio: number
    latestReturn1d: number
    return60d: number
    turnover20dStd: number
  }
  expected: {
    style: string
    energyLevel: number
  }
}

const TEST_CASES: TestCase[] = [
  {
    symbol: 'B1-001.SZ',
    name: '狙击型-首板龙一',
    scenario: '5%换手 + 5.0量比 → 能量0.25=L5 → sniper',
    input: { turnover: 0.05, turnoverPct: 5, volumeRatio: 5, latestReturn1d: 0.098, return60d: 0.05, turnover20dStd: 0.015 },
    expected: { style: 'sniper_breakout', energyLevel: 5 },
  },
  {
    symbol: 'B2-002.SZ',
    name: '动量型-连板加速',
    scenario: '3%换手 + 3.0量比 → 能量0.09=L4 → momentum',
    input: { turnover: 0.03, turnoverPct: 3, volumeRatio: 3, latestReturn1d: 0.065, return60d: 0.15, turnover20dStd: 0.012 },
    expected: { style: 'momentum_breakout', energyLevel: 4 },
  },
  {
    symbol: 'B3-003.SH',
    name: '稳健型-慢牛推升',
    scenario: '4%换手 + 1.8量比 → 能量0.072=L3 → steady',
    input: { turnover: 0.04, turnoverPct: 4, volumeRatio: 1.8, latestReturn1d: 0.025, return60d: 0.08, turnover20dStd: 0.008 },
    expected: { style: 'steady_breakout', energyLevel: 3 },
  },
  {
    symbol: 'B4-004.SZ',
    name: '试探型-主力试盘',
    scenario: '1%换手 + 6.0量比 → 能量0.06=L3 → probe',
    input: { turnover: 0.01, turnoverPct: 1, volumeRatio: 6, latestReturn1d: 0.03, return60d: -0.05, turnover20dStd: 0.003 },
    expected: { style: 'probe_breakout', energyLevel: 3 },
  },
  {
    symbol: 'B5-005.SH',
    name: '价值型-机构慢买',
    scenario: '2.5%换手 + 1.2量比 → 能量0.03=L3 → value',
    input: { turnover: 0.025, turnoverPct: 2.5, volumeRatio: 1.2, latestReturn1d: 0.015, return60d: -0.02, turnover20dStd: 0.004 },
    expected: { style: 'value_breakout', energyLevel: 3 },
  },
  {
    symbol: 'R1-006.SZ',
    name: '假突破-对倒诱多',
    scenario: '8%换手 + 1.0量比 → 能量0.08=L4 → fake_breakout',
    input: { turnover: 0.08, turnoverPct: 8, volumeRatio: 1, latestReturn1d: 0.005, return60d: 0.1, turnover20dStd: 0.025 },
    expected: { style: 'fake_breakout', energyLevel: 4 },
  },
  {
    symbol: 'W1-007.SH',
    name: '观望型-抛压枯竭',
    scenario: '0.2%换手 + 2.0量比 → 能量0.004=L1 → breakout_watch',
    input: { turnover: 0.002, turnoverPct: 0.2, volumeRatio: 2, latestReturn1d: 0.001, return60d: -0.08, turnover20dStd: 0.0008 },
    expected: { style: 'breakout_watch', energyLevel: 1 },
  },
  {
    symbol: 'N-008.SZ',
    name: '无特征-正常横盘',
    scenario: '4%换手 + 0.5量比 → 能量0.02=L2 → no_breakout',
    input: { turnover: 0.04, turnoverPct: 4, volumeRatio: 0.5, latestReturn1d: 0.002, return60d: 0.01, turnover20dStd: 0.006 },
    expected: { style: 'no_breakout', energyLevel: 2 },
  },
  {
    symbol: 'BD-009.SH',
    name: '边界-L4L5能量分界',
    scenario: '6%换手 + 2.5量比 → 能量0.15=L5边界 → sniper',
    input: { turnover: 0.06, turnoverPct: 6, volumeRatio: 2.5, latestReturn1d: 0.04, return60d: 0.12, turnover20dStd: 0.018 },
    expected: { style: 'sniper_breakout', energyLevel: 5 },
  },
  {
    symbol: 'BD-010.SZ',
    name: '极端-死亡换手假突破',
    scenario: '16%换手 + 1.0量比 → 能量0.16=L5 → fake_breakout',
    input: { turnover: 0.16, turnoverPct: 16, volumeRatio: 1, latestReturn1d: -0.03, return60d: 0.55, turnover20dStd: 0.05 },
    expected: { style: 'fake_breakout', energyLevel: 5 },
  },
]

function buildInput(tc: TestCase): LayerInput {
  return {
    stock: { symbol: tc.symbol, name: tc.name },
    financials: {},
    quotes: {
      avgTurnover20d: tc.input.turnover,
      volumeRatio: tc.input.volumeRatio,
      latestReturn1d: tc.input.latestReturn1d,
      return60d: tc.input.return60d,
      turnover20dStd: tc.input.turnover20dStd,
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

function runTest(tc: TestCase): { pass: boolean; actualStyle: string; actualEnergy: number; actualSignal: string; description: string } {
  const input = buildInput(tc)
  const signal = detectMainForceChipFlow(input)
  
  const actualStyle = signal.breakoutStyle
  const actualEnergy = signal.energy.level
  const actualSignal = signal.tradeSignal.type
  const stylePass = actualStyle === tc.expected.style
  const energyPass = actualEnergy === tc.expected.energyLevel
  const pass = stylePass && energyPass
  
  return {
    pass,
    actualStyle,
    actualEnergy,
    actualSignal,
    description: signal.description,
  }
}

// 运行测试
let passCount = 0
let failCount = 0
const results: Array<{ symbol: string; name: string; pass: boolean; expectedStyle: string; actualStyle: string; expectedEnergy: number; actualEnergy: number; signal: string; desc: string }> = []

for (const tc of TEST_CASES) {
  const result = runTest(tc)
  if (result.pass) {
    passCount++
  } else {
    failCount++
  }
  results.push({
    symbol: tc.symbol,
    name: tc.name,
    pass: result.pass,
    expectedStyle: tc.expected.style,
    actualStyle: result.actualStyle,
    expectedEnergy: tc.expected.energyLevel,
    actualEnergy: result.actualEnergy,
    signal: result.actualSignal,
    desc: result.description,
  })
}

// 打印结果
console.log('='.repeat(80))
console.log(`断线交易穿行测试 — 10 只典型股票`)
console.log(`时间: ${new Date().toISOString()}`)
console.log('='.repeat(80))

for (const r of results) {
  const status = r.pass ? '✅' : '❌'
  console.log(`${status} ${r.symbol} ${r.name}`)
  console.log(`   风格: ${r.expectedStyle} → ${r.actualStyle} ${r.pass ? '' : '← 不匹配!'}`)
  console.log(`   能量: L${r.expectedEnergy} → L${r.actualEnergy} ${r.pass ? '' : '← 不匹配!'}`)
  console.log(`   信号: ${r.signal} | ${r.desc}`)
}

console.log('='.repeat(80))
console.log(`结果: ${passCount}/${TEST_CASES.length} 通过, ${failCount}/${TEST_CASES.length} 失败`)
console.log('='.repeat(80))

// 能量分布统计
const energyDist: Record<number, number> = {}
const styleDist: Record<string, number> = {}
for (const r of results) {
  energyDist[r.actualEnergy] = (energyDist[r.actualEnergy] || 0) + 1
  styleDist[r.actualStyle] = (styleDist[r.actualStyle] || 0) + 1
}

console.log('\n能量分布:')
for (const [level, count] of Object.entries(energyDist).sort()) {
  console.log(`  L${level}: ${count} 只`)
}

console.log('\n风格分布:')
for (const [style, count] of Object.entries(styleDist).sort()) {
  console.log(`  ${style}: ${count} 只`)
}

// 关键验证：假突破识别
const fakeBreakoutCases = results.filter(r => r.actualStyle === 'fake_breakout')
console.log(`\n假突破识别: ${fakeBreakoutCases.length} 只`)
for (const r of fakeBreakoutCases) {
  console.log(`  ${r.symbol} ${r.name} → ${r.signal}`)
  if (r.signal !== 'escape') {
    console.log(`    ⚠️  假突破信号应为 escape!`)
  }
}

process.exit(failCount > 0 ? 1 : 0)
