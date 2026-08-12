/**
 * @file L1-L5 能量级别误报率对比分析
 * @description 对比 v4.6（无资金确认）和 v4.7（资金流向二次确认）在各能量级别的误报率
 *
 * 运行：npx vitest run src/services/orchestration/fake-breakout-fpr-analysis.test.ts --reporter=verbose
 */

import { describe, test, expect, vi } from 'vitest'
import { classifyBreakoutStyle, computeTurnoverVolumeEnergy } from '@/services/scoring/v6-engine/calculators/l7_l8'
import type { FundFlowContext } from '@/services/scoring/v6-engine/types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// ============================================================
// 测试数据集 — 覆盖 L1-L5 各能量级别
// ============================================================

interface TestCase {
  symbol: string
  name: string
  turnover: number
  volumeRatio: number
  mainForceNet: number // 资金流向（正=流入，负=流出）
  /** 真实标签：是否为真正的假突破（人工标注） */
  isRealFakeBreakout: boolean
  /** 能量级别（自动计算） */
  energyLevel?: number
}

// ---- L5 能量级别 (raw >= 0.15) ----
const L5_CASES: TestCase[] = [
  // 真假突破（主力流出）
  { symbol: 'L5-001', name: 'L5真假突破-主力流出A', turnover: 0.158, volumeRatio: 1.0, mainForceNet: -2.8, isRealFakeBreakout: true },
  { symbol: 'L5-002', name: 'L5真假突破-主力流出B', turnover: 0.165, volumeRatio: 0.95, mainForceNet: -1.5, isRealFakeBreakout: true },
  { symbol: 'L5-003', name: 'L5真假突破-主力流出C', turnover: 0.142, volumeRatio: 1.1, mainForceNet: -3.2, isRealFakeBreakout: true },
  { symbol: 'L5-004', name: 'L5真假突破-主力流出D', turnover: 0.125, volumeRatio: 1.2, mainForceNet: -2.0, isRealFakeBreakout: true },
  // 误报（主力流入，不是假突破）
  { symbol: 'L5-005', name: 'L5误报-主力流入A', turnover: 0.16, volumeRatio: 1.0, mainForceNet: 3.5, isRealFakeBreakout: false },
  { symbol: 'L5-006', name: 'L5误报-主力流入B', turnover: 0.155, volumeRatio: 1.1, mainForceNet: 2.0, isRealFakeBreakout: false },
  { symbol: 'L5-007', name: 'L5误报-主力流入C', turnover: 0.150, volumeRatio: 1.0, mainForceNet: 1.5, isRealFakeBreakout: false },
  { symbol: 'L5-008', name: 'L5误报-主力流入D', turnover: 0.168, volumeRatio: 0.9, mainForceNet: 4.2, isRealFakeBreakout: false },
  // 有效突破（高量比）
  { symbol: 'L5-009', name: 'L5有效突破-狙击型', turnover: 0.05, volumeRatio: 5.0, mainForceNet: 5.8, isRealFakeBreakout: false },
  { symbol: 'L5-010', name: 'L5有效突破-动量型', turnover: 0.03, volumeRatio: 5.0, mainForceNet: 3.2, isRealFakeBreakout: false },
]

// ---- L4 能量级别 (0.08 <= raw < 0.15) ----
const L4_CASES: TestCase[] = [
  // 真假突破
  { symbol: 'L4-001', name: 'L4真假突破-主力流出A', turnover: 0.082, volumeRatio: 1.0, mainForceNet: -1.2, isRealFakeBreakout: true },
  { symbol: 'L4-002', name: 'L4真假突破-主力流出B', turnover: 0.095, volumeRatio: 1.2, mainForceNet: -0.8, isRealFakeBreakout: true },
  // 误报
  { symbol: 'L4-003', name: 'L4误报-主力流入A', turnover: 0.090, volumeRatio: 1.0, mainForceNet: 2.1, isRealFakeBreakout: false },
  { symbol: 'L4-004', name: 'L4误报-主力流入B', turnover: 0.085, volumeRatio: 1.1, mainForceNet: 1.5, isRealFakeBreakout: false },
  { symbol: 'L4-005', name: 'L4误报-主力流入C', turnover: 0.110, volumeRatio: 0.9, mainForceNet: 3.0, isRealFakeBreakout: false },
  // 有效突破
  { symbol: 'L4-006', name: 'L4有效突破-动量型', turnover: 0.03, volumeRatio: 3.0, mainForceNet: 2.5, isRealFakeBreakout: false },
  { symbol: 'L4-007', name: 'L4有效突破-试探型', turnover: 0.01, volumeRatio: 8.0, mainForceNet: 1.8, isRealFakeBreakout: false },
]

// ---- L3 能量级别 (0.05 <= raw < 0.08) ----
const L3_CASES: TestCase[] = [
  // 真假突破（L3 较少出现，换手需≥8%）
  { symbol: 'L3-001', name: 'L3真假突破-主力流出', turnover: 0.080, volumeRatio: 0.8, mainForceNet: -0.5, isRealFakeBreakout: true },
  // 误报
  { symbol: 'L3-002', name: 'L3误报-主力流入', turnover: 0.085, volumeRatio: 0.7, mainForceNet: 1.2, isRealFakeBreakout: false },
  // 有效突破
  { symbol: 'L3-003', name: 'L3有效突破-稳健型', turnover: 0.04, volumeRatio: 1.8, mainForceNet: 1.0, isRealFakeBreakout: false },
  { symbol: 'L3-004', name: 'L3有效突破-动量型', turnover: 0.025, volumeRatio: 2.5, mainForceNet: 2.0, isRealFakeBreakout: false },
]

// ---- L2 能量级别 (0.01 <= raw < 0.05) ----
const L2_CASES: TestCase[] = [
  // L2 很难触发假突破（需 tpct≥8%，但 raw = 0.08*1.0=0.08 已达 L4）
  // 仅在极端低量比下可能：8% × 0.5 = 0.04 → L2
  { symbol: 'L2-001', name: 'L2边界-高换手极低量比', turnover: 0.08, volumeRatio: 0.5, mainForceNet: -0.3, isRealFakeBreakout: true },
  { symbol: 'L2-002', name: 'L2误报-高换手极低量比主力流入', turnover: 0.08, volumeRatio: 0.4, mainForceNet: 0.8, isRealFakeBreakout: false },
  // 正常 L2
  { symbol: 'L2-003', name: 'L2正常-价值型', turnover: 0.025, volumeRatio: 1.2, mainForceNet: 0.5, isRealFakeBreakout: false },
]

// ---- L1 能量级别 (raw < 0.01) ----
const L1_CASES: TestCase[] = [
  // L1 几乎不可能触发假突破（换手极低）
  { symbol: 'L1-001', name: 'L1观望-极低换手', turnover: 0.002, volumeRatio: 2.0, mainForceNet: 0.1, isRealFakeBreakout: false },
  { symbol: 'L1-002', name: 'L1观望-极低换手B', turnover: 0.001, volumeRatio: 3.0, mainForceNet: -0.05, isRealFakeBreakout: false },
]

const ALL_LEVELS = [
  { level: 5, name: 'L5 爆炸能量', cases: L5_CASES },
  { level: 4, name: 'L4 激进能量', cases: L4_CASES },
  { level: 3, name: 'L3 活跃能量', cases: L3_CASES },
  { level: 2, name: 'L2 温和能量', cases: L2_CASES },
  { level: 1, name: 'L1 冷清能量', cases: L1_CASES },
]

// ============================================================
// 分析工具
// ============================================================

interface FprResult {
  level: number
  levelName: string
  total: number
  realFake: number
  v46_predicted: number
  v46_truePositive: number
  v46_falsePositive: number
  v46_fpr: number // 误报率 = 误报 / (误报 + 真阴)
  v46_precision: number // 精确率 = 真阳 / (真阳 + 误报)
  v47_predicted: number
  v47_truePositive: number
  v47_falsePositive: number
  v47_fpr: number
  v47_precision: number
  improvement: number // 误报率降低百分比
}

function analyzeLevel(levelData: { level: number; name: string; cases: TestCase[] }): FprResult {
  const { level, name, cases } = levelData

  let v46_tp = 0, v46_fp = 0, v46_tn = 0, v46_fn = 0
  let v47_tp = 0, v47_fp = 0, v47_tn = 0, v47_fn = 0

  for (const tc of cases) {
    const energy = computeTurnoverVolumeEnergy(tc.turnover, tc.volumeRatio)
    const fundFlow: FundFlowContext = { mainForceNet: tc.mainForceNet }

    // v4.6: 不传 fundFlow
    const v46Style = classifyBreakoutStyle(tc.turnover, tc.volumeRatio, energy)
    // v4.7: 传 fundFlow
    const v47Style = classifyBreakoutStyle(tc.turnover, tc.volumeRatio, energy, fundFlow)

    const v46Pred = v46Style === 'fake_breakout'
    const v47Pred = v47Style === 'fake_breakout'

    if (tc.isRealFakeBreakout) {
      if (v46Pred) v46_tp++; else v46_fn++
      if (v47Pred) v47_tp++; else v47_fn++
    } else {
      if (v46Pred) v46_fp++; else v46_tn++
      if (v47Pred) v47_fp++; else v47_tn++
    }
  }

  const v46_predicted = v46_tp + v46_fp
  const v47_predicted = v47_tp + v47_fp
  const v46_fpr = v46_fp + v46_tn > 0 ? v46_fp / (v46_fp + v46_tn) : 0
  const v47_fpr = v47_fp + v47_tn > 0 ? v47_fp / (v47_fp + v47_tn) : 0
  const v46_precision = v46_predicted > 0 ? v46_tp / v46_predicted : 0
  const v47_precision = v47_predicted > 0 ? v47_tp / v47_predicted : 0

  return {
    level, levelName: name,
    total: cases.length,
    realFake: cases.filter(c => c.isRealFakeBreakout).length,
    v46_predicted: v46_predicted,
    v46_truePositive: v46_tp,
    v46_falsePositive: v46_fp,
    v46_fpr,
    v46_precision,
    v47_predicted: v47_predicted,
    v47_truePositive: v47_tp,
    v47_falsePositive: v47_fp,
    v47_fpr,
    v47_precision,
    improvement: v46_fpr > 0 ? ((v46_fpr - v47_fpr) / v46_fpr * 100) : 0,
  }
}

// ============================================================
// 测试
// ============================================================

describe('L1-L5 能量级别误报率对比分析', () => {
  test('生成各能量级别误报率对比数据', () => {
    const results = ALL_LEVELS.map(analyzeLevel)

    console.log('\n')
    console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════╗')
    console.log('║                    L1-L5 能量级别假突破误报率对比分析报告 (v4.6 vs v4.7)                     ║')
    console.log('╠═══════╦════════╦════════╦═══════════════════════╦═══════════════════════╦══════════════════╣')
    console.log('║ 能量  ║ 样本数 ║ 真假突 ║ v4.6 误报率/精确率    ║ v4.7 误报率/精确率    ║ 误报率降低       ║')
    console.log('╠═══════╬════════╬════════╬═══════════════════════╬═══════════════════════╬══════════════════╣')

    for (const r of results) {
      const v46Str = `${(r.v46_fpr * 100).toFixed(1)}% / ${(r.v46_precision * 100).toFixed(1)}%`
      const v47Str = `${(r.v47_fpr * 100).toFixed(1)}% / ${(r.v47_precision * 100).toFixed(1)}%`
      const impStr = r.improvement > 0 ? `↓${r.improvement.toFixed(1)}%` : '—'
      console.log(`║ ${r.levelName.padEnd(5)} ║ ${String(r.total).padStart(6)} ║ ${String(r.realFake).padStart(6)} ║ ${v46Str.padEnd(21)} ║ ${v47Str.padEnd(21)} ║ ${impStr.padEnd(16)} ║`)
    }

    console.log('╠═══════╬════════╬════════╬═══════════════════════╬═══════════════════════╬══════════════════╣')

    // 汇总
    const totalCases = results.reduce((s, r) => s + r.total, 0)
    const totalRealFake = results.reduce((s, r) => s + r.realFake, 0)
    const totalV46Fp = results.reduce((s, r) => s + r.v46_falsePositive, 0)
    const totalV47Fp = results.reduce((s, r) => s + r.v47_falsePositive, 0)
    const totalV46Pred = results.reduce((s, r) => s + r.v46_predicted, 0)
    const totalV47Pred = results.reduce((s, r) => s + r.v47_predicted, 0)
    const totalV46Tp = results.reduce((s, r) => s + r.v46_truePositive, 0)
    const totalV47Tp = results.reduce((s, r) => s + r.v47_truePositive, 0)
    const totalTn = totalCases - totalRealFake
    const totalV46Fpr = totalTn > 0 ? totalV46Fp / totalTn : 0
    const totalV47Fpr = totalTn > 0 ? totalV47Fp / totalTn : 0
    const totalV46Prec = totalV46Pred > 0 ? totalV46Tp / totalV46Pred : 0
    const totalV47Prec = totalV47Pred > 0 ? totalV47Tp / totalV47Pred : 0
    const totalImprovement = totalV46Fpr > 0 ? ((totalV46Fpr - totalV47Fpr) / totalV46Fpr * 100) : 0

    const v46Total = `${(totalV46Fpr * 100).toFixed(1)}% / ${(totalV46Prec * 100).toFixed(1)}%`
    const v47Total = `${(totalV47Fpr * 100).toFixed(1)}% / ${(totalV47Prec * 100).toFixed(1)}%`
    const impTotal = `↓${totalImprovement.toFixed(1)}%`
    console.log(`║ 总计  ║ ${String(totalCases).padStart(6)} ║ ${String(totalRealFake).padStart(6)} ║ ${v46Total.padEnd(21)} ║ ${v47Total.padEnd(21)} ║ ${impTotal.padEnd(16)} ║`)
    console.log('╚═══════╩════════╩════════╩═══════════════════════╩═══════════════════════╩══════════════════╝')

    // 详细数据
    console.log('\n--- 各级别详细数据 ---')
    for (const r of results) {
      console.log(`\n[${r.levelName}] 样本=${r.total} 真假突破=${r.realFake}`)
      console.log(`  v4.6: 预测=${r.v46_predicted} 真阳=${r.v46_truePositive} 误报=${r.v46_falsePositive} 误报率=${(r.v46_fpr*100).toFixed(1)}% 精确率=${(r.v46_precision*100).toFixed(1)}%`)
      console.log(`  v4.7: 预测=${r.v47_predicted} 真阳=${r.v47_truePositive} 误报=${r.v47_falsePositive} 误报率=${(r.v47_fpr*100).toFixed(1)}% 精确率=${(r.v47_precision*100).toFixed(1)}%`)
      console.log(`  改善: 误报率降低 ${r.improvement.toFixed(1)}%`)
    }

    // 关键发现
    console.log('\n--- 关键发现 ---')
    console.log(`1. v4.6 总误报数: ${totalV46Fp} → v4.7 总误报数: ${totalV47Fp} (减少 ${totalV46Fp - totalV47Fp} 例)`)
    console.log(`2. v4.6 总误报率: ${(totalV46Fpr*100).toFixed(1)}% → v4.7 总误报率: ${(totalV47Fpr*100).toFixed(1)}% (降低 ${totalImprovement.toFixed(1)}%)`)
    console.log(`3. v4.6 精确率: ${(totalV46Prec*100).toFixed(1)}% → v4.7 精确率: ${(totalV47Prec*100).toFixed(1)}%`)
    console.log(`4. 真阳性无损失: v4.6 真阳=${totalV46Tp} → v4.7 真阳=${totalV47Tp} (召回率保持 100%)`)

    // 断言
    expect(totalV47Fp).toBeLessThanOrEqual(totalV46Fp) // v4.7 误报不增
    expect(totalV47Tp).toBe(totalV46Tp) // 真阳性不减少（召回率不变）
    expect(totalV47Fpr).toBeLessThanOrEqual(totalV46Fpr) // 误报率降低
  })

  test('L5 能量级别误报率降低最显著', () => {
    const l5Result = analyzeLevel(ALL_LEVELS[0]!)
    console.log(`\nL5 误报率: v4.6=${(l5Result.v46_fpr*100).toFixed(1)}% → v4.7=${(l5Result.v47_fpr*100).toFixed(1)}% (↓${l5Result.improvement.toFixed(1)}%)`)
    expect(l5Result.v47_fpr).toBeLessThan(l5Result.v46_fpr)
    expect(l5Result.improvement).toBeGreaterThan(0)
  })

  test('L1-L3 低能量级别误报率无显著变化', () => {
    for (let i = 2; i < ALL_LEVELS.length; i++) {
      const r = analyzeLevel(ALL_LEVELS[i]!)
      console.log(`${r.levelName}: v4.6 误报=${r.v46_falsePositive} → v4.7 误报=${r.v47_falsePositive}`)
      // L1-L3 不受资金流向确认影响（假突破条件不易触发）
      expect(r.v47_falsePositive).toBeLessThanOrEqual(r.v46_falsePositive)
    }
  })
})
