/**
 * @test_id V9-TEST-ST-104
 * 断线交易穿行测试 — 10 只典型股票验证
 * 
 * 验证目标：
 * 1. buildChipFlowSignal 调用传入 t/v 参数后，能量计算正确
 * 2. 假突破识别逻辑（tpct≥8% + v<1.5）准确触发
 * 3. 8 种风格 × 5 级能量全覆盖
 * 
 * 运行：npx vitest run src/services/scoring/v6-engine/calculators/breakout-walkthrough.test.ts
 */

import { describe, test, expect, vi } from 'vitest'
import { detectMainForceChipFlow, computeTurnoverVolumeEnergy, classifyBreakoutStyle } from './l7_l8'
import type { LayerInput, FundFlowContext } from '../types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

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
    symbol: 'B1-001.SZ', name: '狙击型-首板龙一',
    scenario: '5%换手 + 5.0量比 → 能量0.25=L5 → sniper',
    input: { turnover: 0.05, turnoverPct: 5, volumeRatio: 5, latestReturn1d: 0.098, return60d: 0.05, turnover20dStd: 0.015 },
    expected: { style: 'sniper_breakout', energyLevel: 5 },
  },
  {
    symbol: 'B2-002.SZ', name: '动量型-连板加速',
    scenario: '3%换手 + 3.0量比 → 能量0.09=L4 → momentum',
    input: { turnover: 0.03, turnoverPct: 3, volumeRatio: 3, latestReturn1d: 0.065, return60d: 0.15, turnover20dStd: 0.012 },
    expected: { style: 'momentum_breakout', energyLevel: 4 },
  },
  {
    symbol: 'B3-003.SH', name: '稳健型-慢牛推升',
    scenario: '4%换手 + 1.8量比 → 能量0.072=L3 → steady',
    input: { turnover: 0.04, turnoverPct: 4, volumeRatio: 1.8, latestReturn1d: 0.025, return60d: 0.08, turnover20dStd: 0.008 },
    expected: { style: 'steady_breakout', energyLevel: 3 },
  },
  {
    symbol: 'B4-004.SZ', name: '试探型-主力试盘',
    scenario: '1%换手 + 6.0量比 → 能量0.06=L3 → probe',
    input: { turnover: 0.01, turnoverPct: 1, volumeRatio: 6, latestReturn1d: 0.03, return60d: -0.05, turnover20dStd: 0.003 },
    expected: { style: 'probe_breakout', energyLevel: 3 },
  },
  {
    symbol: 'B5-005.SH', name: '价值型-机构慢买',
    scenario: '2.5%换手 + 1.2量比 → 能量0.03=L3 → value',
    input: { turnover: 0.025, turnoverPct: 2.5, volumeRatio: 1.2, latestReturn1d: 0.015, return60d: -0.02, turnover20dStd: 0.004 },
    expected: { style: 'value_breakout', energyLevel: 3 },
  },
  {
    symbol: 'R1-006.SZ', name: '假突破-对倒诱多',
    scenario: '8%换手 + 1.0量比 → 能量0.08=L4 → fake_breakout',
    input: { turnover: 0.08, turnoverPct: 8, volumeRatio: 1, latestReturn1d: 0.005, return60d: 0.1, turnover20dStd: 0.025 },
    expected: { style: 'fake_breakout', energyLevel: 4 },
  },
  {
    symbol: 'W1-007.SH', name: '观望型-抛压枯竭',
    scenario: '0.2%换手 + 2.0量比 → 能量0.004=L1 → breakout_watch',
    input: { turnover: 0.002, turnoverPct: 0.2, volumeRatio: 2, latestReturn1d: 0.001, return60d: -0.08, turnover20dStd: 0.0008 },
    expected: { style: 'breakout_watch', energyLevel: 1 },
  },
  {
    symbol: 'N-008.SZ', name: '无特征-正常横盘',
    scenario: '4%换手 + 0.5量比 → 能量0.02=L2 → no_breakout',
    input: { turnover: 0.04, turnoverPct: 4, volumeRatio: 0.5, latestReturn1d: 0.002, return60d: 0.01, turnover20dStd: 0.006 },
    expected: { style: 'no_breakout', energyLevel: 2 },
  },
  {
    symbol: 'BD-009.SH', name: '边界-L4L5能量分界',
    scenario: '6%换手 + 2.5量比 → 能量0.15=L5边界 → sniper',
    input: { turnover: 0.06, turnoverPct: 6, volumeRatio: 2.5, latestReturn1d: 0.04, return60d: 0.12, turnover20dStd: 0.018 },
    expected: { style: 'sniper_breakout', energyLevel: 5 },
  },
  {
    symbol: 'BD-010.SZ', name: '极端-死亡换手假突破',
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

describe('断线交易穿行测试 — 10 只典型股票', () => {
  for (const tc of TEST_CASES) {
    test(`${tc.symbol} ${tc.name}: ${tc.scenario}`, () => {
      const input = buildInput(tc)
      const signal = detectMainForceChipFlow(input)
      
      expect(signal.breakoutStyle).toBe(tc.expected.style)
      expect(signal.energy.level).toBe(tc.expected.energyLevel)
    })
  }

  test('能量计算: computeTurnoverVolumeEnergy 直接调用验证', () => {
    // 5%换手 × 5.0量比 = 0.25 → L5
    const e1 = computeTurnoverVolumeEnergy(0.05, 5.0)
    expect(e1.raw).toBeCloseTo(0.25, 6)
    expect(e1.level).toBe(5)

    // 16%换手 × 1.0量比 = 0.16 → L5
    const e2 = computeTurnoverVolumeEnergy(0.16, 1.0)
    expect(e2.raw).toBeCloseTo(0.16, 6)
    expect(e2.level).toBe(5)

    // 0.2%换手 × 2.0量比 = 0.004 → L1
    const e3 = computeTurnoverVolumeEnergy(0.002, 2.0)
    expect(e3.raw).toBeCloseTo(0.004, 6)
    expect(e3.level).toBe(1)
  })

  test('假突破识别: classifyBreakoutStyle 直接调用验证', () => {
    // tpct=16≥8, v=1<1.5 → fake_breakout
    const e1 = computeTurnoverVolumeEnergy(0.16, 1.0)
    expect(classifyBreakoutStyle(0.16, 1.0, e1)).toBe('fake_breakout')

    // tpct=8≥8, v=1<1.5 → fake_breakout
    const e2 = computeTurnoverVolumeEnergy(0.08, 1.0)
    expect(classifyBreakoutStyle(0.08, 1.0, e2)).toBe('fake_breakout')

    // tpct=5<8, v=2.5≥1.5, energy≥4 → sniper (不是 fake)
    const e3 = computeTurnoverVolumeEnergy(0.05, 5.0)
    expect(classifyBreakoutStyle(0.05, 5.0, e3)).toBe('sniper_breakout')

    // 边界: v=1.5 不应触发 fake (v < 1.5 严格小于)
    const e4 = computeTurnoverVolumeEnergy(0.08, 1.5)
    expect(classifyBreakoutStyle(0.08, 1.5, e4)).not.toBe('fake_breakout')
  })

  test('假突破交易信号: tradeSignal.type 应为 escape', () => {
    // BD-010: 16%换手 + 1.0量比 = L5 但假突破
    const input = buildInput(TEST_CASES[9]!)
    const signal = detectMainForceChipFlow(input)
    expect(signal.breakoutStyle).toBe('fake_breakout')
    expect(signal.tradeSignal.type).toBe('escape')
    expect(signal.type).toBe('fakeup')
  })

  // ★ v4.7 资金流向二次确认测试
  test('v4.7 资金流向二次确认: 主力净流入时假突破降级为 no_breakout', () => {
    // tpct=16≥8, v=1<1.5 → 技术面假突破条件满足
    const e = computeTurnoverVolumeEnergy(0.16, 1.0)

    // 无 fundFlow → 保持原有行为 (fake_breakout)
    expect(classifyBreakoutStyle(0.16, 1.0, e)).toBe('fake_breakout')

    // fundFlow 无 mainForceNet → 保持原有行为 (fake_breakout)
    expect(classifyBreakoutStyle(0.16, 1.0, e, {})).toBe('fake_breakout')

    // 主力净流入 → 降级为 no_breakout（降低误报率）
    const inflow: FundFlowContext = { mainForceNet: 2.5 }
    expect(classifyBreakoutStyle(0.16, 1.0, e, inflow)).toBe('no_breakout')

    // 主力净流入 0.1 亿（刚大于0）→ 降级
    const slightInflow: FundFlowContext = { mainForceNet: 0.1 }
    expect(classifyBreakoutStyle(0.16, 1.0, e, slightInflow)).toBe('no_breakout')

    // 主力净流出 → 确认假突破
    const outflow: FundFlowContext = { mainForceNet: -2.8 }
    expect(classifyBreakoutStyle(0.16, 1.0, e, outflow)).toBe('fake_breakout')

    // 主力净流入 = 0 → 不满足 > 0 条件，保持假突破
    const zero: FundFlowContext = { mainForceNet: 0 }
    expect(classifyBreakoutStyle(0.16, 1.0, e, zero)).toBe('fake_breakout')
  })

  test('v4.7 资金流向确认: 非假突破场景不受 fundFlow 影响', () => {
    // sniper: tpct=5, v=5.0 → 不受 fundFlow 影响
    const e1 = computeTurnoverVolumeEnergy(0.05, 5.0)
    expect(classifyBreakoutStyle(0.05, 5.0, e1, { mainForceNet: -10 })).toBe('sniper_breakout')

    // momentum: tpct=3, v=3.0 → 不受 fundFlow 影响
    const e2 = computeTurnoverVolumeEnergy(0.03, 3.0)
    expect(classifyBreakoutStyle(0.03, 3.0, e2, { mainForceNet: -10 })).toBe('momentum_breakout')

    // breakout_watch: L1 能量 → 不受 fundFlow 影响
    const e3 = computeTurnoverVolumeEnergy(0.002, 2.0)
    expect(classifyBreakoutStyle(0.002, 2.0, e3, { mainForceNet: 10 })).toBe('breakout_watch')
  })

  test('v4.7 detectMainForceChipFlow 集成: 资金流向数据传入后假突破降级', () => {
    // BD-010 原始数据：16%换手 + 1.0量比 → 无资金数据时 fake_breakout
    const baseInput = buildInput(TEST_CASES[9]!)

    // 附加主力净流入数据 → breakoutStyle 降级为 no_breakout
    const inflowInput: LayerInput = {
      ...baseInput,
      quotes: {
        ...baseInput.quotes,
        mainForceFlow: [1.0, 2.5],  // 最新值 2.5 亿净流入
      },
    }
    const inflowSignal = detectMainForceChipFlow(inflowInput)
    expect(inflowSignal.breakoutStyle).toBe('no_breakout')

    // 附加主力净流出数据 → 确认 fake_breakout
    const outflowInput: LayerInput = {
      ...baseInput,
      quotes: {
        ...baseInput.quotes,
        mainForceFlow: [1.0, -2.8],  // 最新值 -2.8 亿净流出
      },
    }
    const outflowSignal = detectMainForceChipFlow(outflowInput)
    expect(outflowSignal.breakoutStyle).toBe('fake_breakout')

    // 无资金流向数据 → 保持原有行为 fake_breakout（向后兼容）
    const noDataSignal = detectMainForceChipFlow(baseInput)
    expect(noDataSignal.breakoutStyle).toBe('fake_breakout')
  })
})
