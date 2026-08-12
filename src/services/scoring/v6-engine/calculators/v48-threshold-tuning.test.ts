/**
 * @file v4.8 能量级别差异化阈值调优测试
 * @description 验证 L2-L4 差异化资金流向降级阈值对召回率/精确率的平衡改善
 *
 * 核心验证点：
 * - L5/L4：保持严格 >0 阈值，精确率不降（v4.7→v4.8 无回归）
 * - L3：>0.5 阈值，微幅流入（+0.3亿）不再降级，召回率提升
 * - L2：>1.0 阈值，中等流入（+0.8亿）不再降级，召回率提升
 *
 * 运行：npx vitest run src/services/scoring/v6-engine/calculators/v48-threshold-tuning.test.ts --reporter=verbose
 */

import { describe, test, expect, vi } from 'vitest'
import { classifyBreakoutStyle, computeTurnoverVolumeEnergy } from './l7_l8'
import type { FundFlowContext } from '../types'
import { V6_CALCULATOR_THRESHOLDS as T } from '@/config/thresholds'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// ============================================================
// 辅助函数
// ============================================================

function classify(turnover: number, volumeRatio: number, mainForceNet?: number) {
  const energy = computeTurnoverVolumeEnergy(turnover, volumeRatio)
  const fundFlow: FundFlowContext | undefined = mainForceNet !== undefined
    ? { mainForceNet }
    : undefined
  return { style: classifyBreakoutStyle(turnover, volumeRatio, energy, fundFlow), energy }
}

// ============================================================
// 测试
// ============================================================

describe('v4.8 能量级别差异化阈值调优', () => {

  // ============================================================
  // 1. L5/L4 精确率不降 — 严格 >0 阈值保持
  // ============================================================
  describe('L5/L4 精确率保持（严格阈值 >0）', () => {
    test('L5: 主力微幅流入 +0.1亿 → 降级 no_breakout（精确率不降）', () => {
      // 15% × 1.0 = 0.15 → L5
      const { style, energy } = classify(0.15, 1.0, 0.1)
      expect(energy.level).toBe(5)
      expect(style).toBe('no_breakout') // +0.1 > 0 → 降级
    })

    test('L5: 主力净流出 -2.8亿 → fake_breakout', () => {
      const { style, energy } = classify(0.15, 1.0, -2.8)
      expect(energy.level).toBe(5)
      expect(style).toBe('fake_breakout')
    })

    test('L4: 主力微幅流入 +0.1亿 → 降级 no_breakout（精确率不降）', () => {
      // 10% × 1.0 = 0.10 → L4
      const { style, energy } = classify(0.10, 1.0, 0.1)
      expect(energy.level).toBe(4)
      expect(style).toBe('no_breakout')
    })

    test('L4: 主力净流出 -1.2亿 → fake_breakout', () => {
      const { style, energy } = classify(0.10, 1.0, -1.2)
      expect(energy.level).toBe(4)
      expect(style).toBe('fake_breakout')
    })
  })

  // ============================================================
  // 2. L3 召回率提升 — >0.5 阈值
  // ============================================================
  describe('L3 召回率提升（放宽阈值 >0.5）', () => {
    test('L3: 主力微幅流入 +0.3亿 → fake_breakout（v4.7误降级，v4.8正确保留）', () => {
      // 8% × 0.6 = 0.048 → L3 (0.03 <= 0.048 < 0.08)
      const { style, energy } = classify(0.08, 0.6, 0.3)
      expect(energy.level).toBe(3)
      // v4.8: 0.3 < 0.5 阈值 → 不降级 → 保留 fake_breakout
      expect(style).toBe('fake_breakout')
    })

    test('L3: 主力中等流入 +0.6亿 → 降级 no_breakout（超过0.5阈值）', () => {
      const { style, energy } = classify(0.08, 0.6, 0.6)
      expect(energy.level).toBe(3)
      expect(style).toBe('no_breakout')
    })

    test('L3: 主力净流出 -0.5亿 → fake_breakout', () => {
      const { style, energy } = classify(0.08, 0.6, -0.5)
      expect(energy.level).toBe(3)
      expect(style).toBe('fake_breakout')
    })

    test('L3: 无资金数据 → fake_breakout（向后兼容）', () => {
      const { style, energy } = classify(0.08, 0.6)
      expect(energy.level).toBe(3)
      expect(style).toBe('fake_breakout')
    })
  })

  // ============================================================
  // 3. L2 召回率提升 — >1.0 阈值
  // ============================================================
  describe('L2 召回率提升（放宽阈值 >1.0）', () => {
    test('L2: 主力微幅流入 +0.3亿 → fake_breakout（v4.7误降级，v4.8正确保留）', () => {
      // 8% × 0.3 = 0.024 → L2 (0.005 <= 0.024 < 0.03)
      const { style, energy } = classify(0.08, 0.3, 0.3)
      expect(energy.level).toBe(2)
      // v4.8: 0.3 < 1.0 阈值 → 不降级 → 保留 fake_breakout
      expect(style).toBe('fake_breakout')
    })

    test('L2: 主力中等流入 +0.8亿 → fake_breakout（v4.7误降级，v4.8正确保留）', () => {
      const { style, energy } = classify(0.08, 0.3, 0.8)
      expect(energy.level).toBe(2)
      // v4.8: 0.8 < 1.0 阈值 → 不降级 → 保留 fake_breakout
      expect(style).toBe('fake_breakout')
    })

    test('L2: 主力显著流入 +1.2亿 → 降级 no_breakout（超过1.0阈值）', () => {
      const { style, energy } = classify(0.08, 0.3, 1.2)
      expect(energy.level).toBe(2)
      expect(style).toBe('no_breakout')
    })

    test('L2: 主力净流出 -0.3亿 → fake_breakout', () => {
      const { style, energy } = classify(0.08, 0.3, -0.3)
      expect(energy.level).toBe(2)
      expect(style).toBe('fake_breakout')
    })
  })

  // ============================================================
  // 4. 阈值边界值验证
  // ============================================================
  describe('阈值边界值验证', () => {
    test('L3 边界: mainForceNet = 0.5 → fake_breakout（不大于阈值）', () => {
      const { style } = classify(0.08, 0.6, 0.5)
      expect(style).toBe('fake_breakout')
    })

    test('L3 边界: mainForceNet = 0.51 → no_breakout（大于阈值）', () => {
      const { style } = classify(0.08, 0.6, 0.51)
      expect(style).toBe('no_breakout')
    })

    test('L2 边界: mainForceNet = 1.0 → fake_breakout（不大于阈值）', () => {
      const { style } = classify(0.08, 0.3, 1.0)
      expect(style).toBe('fake_breakout')
    })

    test('L2 边界: mainForceNet = 1.01 → no_breakout（大于阈值）', () => {
      const { style } = classify(0.08, 0.3, 1.01)
      expect(style).toBe('no_breakout')
    })
  })

  // ============================================================
  // 5. v4.7→v4.8 召回率改善对比
  // ============================================================
  test('v4.7→v4.8 召回率改善对比', () => {
    console.log('\n========== v4.7 → v4.8 召回率改善对比 ==========')

    // v4.7 误降级、v4.8 正确保留的案例
    const recallImprovedCases = [
      { level: 'L3', turnover: 0.08, vr: 0.6, mf: 0.3, desc: 'L3 主力+0.3亿（机构噪音）' },
      { level: 'L3', turnover: 0.08, vr: 0.6, mf: 0.4, desc: 'L3 主力+0.4亿（机构噪音）' },
      { level: 'L2', turnover: 0.08, vr: 0.3, mf: 0.3, desc: 'L2 主力+0.3亿（微幅流入）' },
      { level: 'L2', turnover: 0.08, vr: 0.3, mf: 0.8, desc: 'L2 主力+0.8亿（中等流入）' },
    ]

    console.log('\n--- v4.7 误降级 → v4.8 正确保留（召回率提升）---')
    for (const c of recallImprovedCases) {
      const { style, energy } = classify(c.turnover, c.vr, c.mf)
      console.log(`  ${c.level} ${c.desc}`)
      console.log(`    v4.7: no_breakout (误降级) ❌ → v4.8: ${style} ${style === 'fake_breakout' ? '✅' : '⚠️'}`)
      expect(style).toBe('fake_breakout')
    }

    // v4.7 正确降级、v4.8 仍正确降级的案例（精确率不降）
    const precisionKeptCases = [
      { level: 'L5', turnover: 0.15, vr: 1.0, mf: 0.1, desc: 'L5 主力+0.1亿' },
      { level: 'L5', turnover: 0.15, vr: 1.0, mf: 3.5, desc: 'L5 主力+3.5亿' },
      { level: 'L4', turnover: 0.10, vr: 1.0, mf: 0.1, desc: 'L4 主力+0.1亿' },
      { level: 'L4', turnover: 0.10, vr: 1.0, mf: 2.1, desc: 'L4 主力+2.1亿' },
    ]

    console.log('\n--- v4.7 正确降级 → v4.8 保持降级（精确率不降）---')
    for (const c of precisionKeptCases) {
      const { style } = classify(c.turnover, c.vr, c.mf)
      console.log(`  ${c.level} ${c.desc}`)
      console.log(`    v4.7: no_breakout ✅ → v4.8: ${style} ${style === 'no_breakout' ? '✅' : '❌'}`)
      expect(style).toBe('no_breakout')
    }

    // L3/L2 仍正确降级的案例
    const stillDowngradeCases = [
      { level: 'L3', turnover: 0.08, vr: 0.6, mf: 0.6, desc: 'L3 主力+0.6亿（超过0.5阈值）' },
      { level: 'L2', turnover: 0.08, vr: 0.3, mf: 1.2, desc: 'L2 主力+1.2亿（超过1.0阈值）' },
    ]

    console.log('\n--- L3/L2 仍正确降级（超过差异化阈值）---')
    for (const c of stillDowngradeCases) {
      const { style } = classify(c.turnover, c.vr, c.mf)
      console.log(`  ${c.desc} → ${style} ${style === 'no_breakout' ? '✅' : '❌'}`)
      expect(style).toBe('no_breakout')
    }

    console.log('\n========== 召回率改善统计 ==========')
    console.log(`v4.7 误降级案例: ${recallImprovedCases.length} 例（v4.8 全部修正）`)
    console.log(`v4.7 正确降级案例: ${precisionKeptCases.length} 例（v4.8 全部保持）`)
    console.log(`L3/L2 仍正确降级: ${stillDowngradeCases.length} 例`)
    console.log(`L5/L4 精确率: 无回归 ✅`)
  })

  // ============================================================
  // 6. 阈值配置验证
  // ============================================================
  test('v4.8 阈值配置正确性', () => {
    console.log('\n========== v4.8 阈值配置 ==========')
    console.log(`L4 降级阈值: ${T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L4} 亿（精度优先）`)
    console.log(`L3 降级阈值: ${T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L3} 亿（平衡召回）`)
    console.log(`L2 降级阈值: ${T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L2} 亿（召回优先）`)

    expect(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L4).toBe(0)
    expect(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L3).toBe(0.5)
    expect(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L2).toBe(1.0)

    // 阈值递增：L4 < L3 < L2（低能量级别更宽松）
    expect(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L4).toBeLessThan(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L3)
    expect(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L3).toBeLessThan(T.L8_FAKE_BREAKOUT_MAINFLOW_DOWNGRADE_L2)
  })
})
