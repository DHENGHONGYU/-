/**
 * @file 每日扫描脚本 — 假突破信号检测
 * @description 使用 V6 引擎 L8 计算器对多只股票进行假突破检测扫描
 * 
 * 运行方式：
 *   npx vitest run src/services/scoring/v6-engine/calculators/daily-fake-breakout-scan.test.ts
 * 
 * 或者使用 ts-node：
 *   npx ts-node --project tsconfig.json src/services/scoring/v6-engine/calculators/daily-fake-breakout-scan.script.ts
 */

import { describe, test, expect, vi } from 'vitest'
import { detectMainForceChipFlow, computeTurnoverVolumeEnergy, classifyBreakoutStyle } from './l7_l8'
import type { LayerInput } from '../types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

interface ScanStock {
  symbol: string
  name: string
  sector?: string
  price?: number
  input: {
    turnover: number
    volumeRatio: number
    latestReturn1d: number
    return60d: number
    turnover20dStd: number
  }
  meta?: {
    marketCap?: number
    pe?: number
    // 模拟 K 线数据
    kline?: {
      open: number
      close: number
      high: number
      low: number
      volume: number
      turnover: number
    }
    // 模拟资金流向
    fundFlow?: {
      mainForceNet: number   // 主力净流入（亿元）
      northboundNet: number  // 北向净流入（亿元）
      retailNet: number      // 散户净流入（亿元）
      marginBalanceChange: number  // 融资余额变动（亿元）
    }
  }
}

// ============================================================
// 扩展测试股票池 — 模拟全市场扫描
// ============================================================
const SCAN_STOCKS: ScanStock[] = [
  // ---- L5 能量级别假突破案例（重点复盘） ----
  {
    symbol: 'SH-600519', name: '贵州茅台', sector: '白酒', price: 1680,
    input: { turnover: 0.158, volumeRatio: 1.0, latestReturn1d: -0.028, return60d: 0.52, turnover20dStd: 0.048 },
    meta: {
      marketCap: 21000, pe: 28,
      kline: { open: 1728, close: 1680, high: 1735, low: 1672, volume: 68500, turnover: 115 },
      fundFlow: { mainForceNet: -2.8, northboundNet: -1.2, retailNet: 4.0, marginBalanceChange: -0.5 }
    }
  },
  {
    symbol: 'SZ-000858', name: '五粮液', sector: '白酒', price: 148,
    input: { turnover: 0.165, volumeRatio: 0.95, latestReturn1d: -0.031, return60d: 0.58, turnover20dStd: 0.052 },
    meta: {
      marketCap: 5800, pe: 22,
      kline: { open: 153, close: 148, high: 155, low: 147, volume: 325000, turnover: 48 },
      fundFlow: { mainForceNet: -1.5, northboundNet: -0.8, retailNet: 2.3, marginBalanceChange: -0.3 }
    }
  },
  {
    symbol: 'SZ-300750', name: '宁德时代', sector: '新能源', price: 215,
    input: { turnover: 0.142, volumeRatio: 1.1, latestReturn1d: -0.025, return60d: 0.48, turnover20dStd: 0.045 },
    meta: {
      marketCap: 9500, pe: 35,
      kline: { open: 222, close: 215, high: 224, low: 213, volume: 425000, turnover: 92 },
      fundFlow: { mainForceNet: -3.2, northboundNet: -1.5, retailNet: 4.7, marginBalanceChange: -0.8 }
    }
  },
  {
    symbol: 'SH-601318', name: '中国平安', sector: '保险', price: 48,
    input: { turnover: 0.125, volumeRatio: 1.2, latestReturn1d: -0.022, return60d: 0.35, turnover20dStd: 0.038 },
    meta: {
      marketCap: 8800, pe: 10,
      kline: { open: 49.5, close: 48, high: 50, low: 47.5, volume: 1850000, turnover: 88 },
      fundFlow: { mainForceNet: -2.0, northboundNet: -1.0, retailNet: 3.0, marginBalanceChange: -0.4 }
    }
  },
  // ---- L4 能量级别假突破案例 ----
  {
    symbol: 'SH-600036', name: '招商银行', sector: '银行', price: 38,
    input: { turnover: 0.082, volumeRatio: 1.0, latestReturn1d: 0.005, return60d: 0.12, turnover20dStd: 0.022 },
    meta: {
      marketCap: 9500, pe: 6,
      kline: { open: 38.5, close: 38, high: 38.8, low: 37.8, volume: 2250000, turnover: 85 },
      fundFlow: { mainForceNet: -1.2, northboundNet: -0.5, retailNet: 1.7, marginBalanceChange: 0.1 }
    }
  },
  // ---- 有效突破对照案例 ----
  {
    symbol: 'SZ-002594', name: '比亚迪', sector: '新能源', price: 245,
    input: { turnover: 0.048, volumeRatio: 5.2, latestReturn1d: 0.098, return60d: 0.08, turnover20dStd: 0.018 },
    meta: {
      marketCap: 7100, pe: 25,
      kline: { open: 228, close: 245, high: 247, low: 227, volume: 185000, turnover: 45 },
      fundFlow: { mainForceNet: 5.8, northboundNet: 2.5, retailNet: -8.3, marginBalanceChange: 1.2 }
    }
  },
  {
    symbol: 'SH-688981', name: '中芯国际', sector: '半导体', price: 98,
    input: { turnover: 0.032, volumeRatio: 3.5, latestReturn1d: 0.068, return60d: 0.18, turnover20dStd: 0.014 },
    meta: {
      marketCap: 7800, pe: 45,
      kline: { open: 92, close: 98, high: 99, low: 91.5, volume: 325000, turnover: 32 },
      fundFlow: { mainForceNet: 3.5, northboundNet: 1.8, retailNet: -5.3, marginBalanceChange: 0.6 }
    }
  },
  // ---- 边界测试案例 ----
  {
    symbol: 'SZ-000001', name: '平安银行', sector: '银行', price: 11.5,
    input: { turnover: 0.08, volumeRatio: 1.5, latestReturn1d: 0.003, return60d: 0.05, turnover20dStd: 0.02 },
    meta: {
      marketCap: 2200, pe: 5,
      kline: { open: 11.5, close: 11.5, high: 11.6, low: 11.4, volume: 8500000, turnover: 98 },
      fundFlow: { mainForceNet: -0.2, northboundNet: 0.1, retailNet: 0.1, marginBalanceChange: 0 }
    }
  },
  // ---- v4.7 误报降低验证：高换手+低量比但主力净流入 → 不应判为假突破 ----
  {
    symbol: 'SH-600276', name: '恒瑞医药', sector: '医药', price: 52,
    input: { turnover: 0.095, volumeRatio: 1.2, latestReturn1d: 0.015, return60d: 0.22, turnover20dStd: 0.028 },
    meta: {
      marketCap: 3300, pe: 38,
      kline: { open: 51, close: 52, high: 52.5, low: 50.8, volume: 625000, turnover: 32 },
      fundFlow: { mainForceNet: 3.2, northboundNet: 1.5, retailNet: -4.7, marginBalanceChange: 0.8 }
    }
  },
  {
    symbol: 'SZ-002714', name: '牧原股份', sector: '农业', price: 45,
    input: { turnover: 0.11, volumeRatio: 0.9, latestReturn1d: -0.008, return60d: 0.15, turnover20dStd: 0.035 },
    meta: {
      marketCap: 2400, pe: 15,
      kline: { open: 45.5, close: 45, high: 46, low: 44.5, volume: 525000, turnover: 24 },
      fundFlow: { mainForceNet: 1.8, northboundNet: 0.6, retailNet: -2.4, marginBalanceChange: 0.3 }
    }
  },
]

function buildInput(stock: ScanStock): LayerInput {
  const ff = stock.meta?.fundFlow
  return {
    stock: { symbol: stock.symbol, name: stock.name },
    financials: {},
    quotes: {
      avgTurnover20d: stock.input.turnover,
      volumeRatio: stock.input.volumeRatio,
      latestReturn1d: stock.input.latestReturn1d,
      return60d: stock.input.return60d,
      turnover20dStd: stock.input.turnover20dStd,
      // ★ v4.7 传入资金流向数据，供假突破二次确认使用
      mainForceFlow: ff?.mainForceNet !== undefined ? [ff.mainForceNet] : undefined,
      northboundHoldings: ff?.northboundNet !== undefined ? [0, ff.northboundNet] : undefined,
      marginBalance: ff?.marginBalanceChange !== undefined ? [0, ff.marginBalanceChange] : undefined,
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

describe('每日扫描 — 假突破信号检测', () => {
  // ---- 全市场扫描 ----
  test(`扫描 ${SCAN_STOCKS.length} 只股票，检测假突破信号`, () => {
    const results = SCAN_STOCKS.map(stock => {
      const input = buildInput(stock)
      const signal = detectMainForceChipFlow(input)
      return { stock, signal }
    })

    const fakeBreakouts = results.filter(r => r.signal.breakoutStyle === 'fake_breakout')
    const validBreakouts = results.filter(r => r.signal.breakoutStyle !== 'fake_breakout' && r.signal.breakoutStyle !== 'no_breakout' && r.signal.breakoutStyle !== 'breakout_watch')

    console.log('\n========== 每日扫描结果 ==========')
    console.log(`扫描股票数: ${results.length}`)
    console.log(`假突破警报: ${fakeBreakouts.length}`)
    console.log(`有效突破: ${validBreakouts.length}`)
    console.log(`无信号/观望: ${results.length - fakeBreakouts.length - validBreakouts.length}`)

    if (fakeBreakouts.length > 0) {
      console.log('\n⚠️  假突破警报详情:')
      for (const { stock, signal } of fakeBreakouts) {
        const energy = computeTurnoverVolumeEnergy(stock.input.turnover, stock.input.volumeRatio)
        console.log(`  ${stock.symbol} ${stock.name}`)
        console.log(`    换手率: ${(stock.input.turnover * 100).toFixed(1)}% | 量比: ${stock.input.volumeRatio}`)
        console.log(`    能量: L${energy.level} (${energy.label}) | 能量值: ${energy.raw.toFixed(4)}`)
        console.log(`    交易信号: ${signal.tradeSignal.label} [${signal.tradeSignal.type}]`)
        console.log(`    操作建议: ${signal.tradeSignal.conclusion}`)
        console.log('')
      }
    }

    if (validBreakouts.length > 0) {
      console.log('✅ 有效突破信号:')
      for (const { stock, signal } of validBreakouts) {
        console.log(`  ${stock.symbol} ${stock.name} → ${signal.breakoutStyle} | ${signal.tradeSignal.label}`)
      }
    }

    // 断言：扫描应产生结果
    expect(results.length).toBeGreaterThan(0)
    
    // 贵州茅台、五粮液、宁德时代、中国平安 应被识别为假突破（主力净流出）
    const fakeSymbols = fakeBreakouts.map(r => r.stock.symbol)
    expect(fakeSymbols).toContain('SH-600519')  // 贵州茅台 L5 主力-2.8亿
    expect(fakeSymbols).toContain('SZ-000858')  // 五粮液 L5 主力-1.5亿
    expect(fakeSymbols).toContain('SZ-300750')  // 宁德时代 L5 主力-3.2亿
    expect(fakeSymbols).toContain('SH-601318')  // 中国平安 L5 主力-2.0亿

    // ★ v4.7 恒瑞医药、牧原股份 虽满足技术条件(高换手+低量比)，但主力净流入 → 不应判为假突破
    expect(fakeSymbols).not.toContain('SH-600276')  // 恒瑞医药 主力+3.2亿 → no_breakout
    expect(fakeSymbols).not.toContain('SZ-002714')  // 牧原股份 主力+1.8亿 → no_breakout

    // 比亚迪、中芯国际 应为有效突破
    const validSymbols = validBreakouts.map(r => r.stock.symbol)
    expect(validSymbols).toContain('SZ-002594')  // 比亚迪 狙击型
    expect(validSymbols).toContain('SH-688981')  // 中芯国际 动量型
  })

  // ---- v4.7 误报率降低验证 ----
  test('v4.7 误报率降低: 主力净流入的高换手+低量比股票不被误判为假突破', () => {
    // 恒瑞医药: 9.5%换手 + 1.2量比 → 技术面满足假突破条件，但主力净流入3.2亿
    const hrInput = buildInput(SCAN_STOCKS.find(s => s.symbol === 'SH-600276')!)
    const hrSignal = detectMainForceChipFlow(hrInput)
    expect(hrSignal.breakoutStyle).not.toBe('fake_breakout')
    console.log(`恒瑞医药: 换手9.5% + 量比1.2 + 主力+3.2亿 → ${hrSignal.breakoutStyle} ✅ (降级，非假突破)`)

    // 牧原股份: 11%换手 + 0.9量比 → 技术面满足假突破条件，但主力净流入1.8亿
    const myInput = buildInput(SCAN_STOCKS.find(s => s.symbol === 'SZ-002714')!)
    const mySignal = detectMainForceChipFlow(myInput)
    expect(mySignal.breakoutStyle).not.toBe('fake_breakout')
    console.log(`牧原股份: 换手11% + 量比0.9 + 主力+1.8亿 → ${mySignal.breakoutStyle} ✅ (降级，非假突破)`)
  })

  // ---- L5 能量级别假突破专项检测 ----
  test('L5 能量级别假突破专项检测', () => {
    const l5FakeBreakouts = SCAN_STOCKS.filter(s => {
      const energy = computeTurnoverVolumeEnergy(s.input.turnover, s.input.volumeRatio)
      return energy.level === 5 && classifyBreakoutStyle(s.input.turnover, s.input.volumeRatio, energy) === 'fake_breakout'
    })

    expect(l5FakeBreakouts.length).toBeGreaterThanOrEqual(3)  // 至少有 3 个 L5 假突破

    console.log('\n========== L5 能量级别假突破复盘 ==========')
    for (const stock of l5FakeBreakouts) {
      const energy = computeTurnoverVolumeEnergy(stock.input.turnover, stock.input.volumeRatio)
      const signal = detectMainForceChipFlow(buildInput(stock))
      console.log(`\n📊 ${stock.symbol} ${stock.name}`)
      console.log(`  所属行业: ${stock.sector}`)
      console.log(`  当前价格: ¥${stock.price}`)
      console.log(`  市值: ${stock.meta?.marketCap}亿 | PE: ${stock.meta?.pe}`)
      console.log(`  换手率: ${(stock.input.turnover * 100).toFixed(1)}% | 量比: ${stock.input.volumeRatio}`)
      console.log(`  能量等级: L${energy.level} ${energy.label} (值: ${energy.raw.toFixed(4)})`)
      console.log(`  断线风格: ${signal.breakoutStyle}`)
      console.log(`  交易信号: ${signal.tradeSignal.label}`)
      console.log(`  操作建议: ${signal.tradeSignal.conclusion}`)
      if (stock.meta?.kline) {
        const k = stock.meta.kline
        const change = ((k.close - k.open) / k.open * 100).toFixed(2)
        console.log(`  K线: 开${k.open} → 收${k.close} (${change}%) | 高${k.high} 低${k.low} | 成交${k.volume}万手`)
      }
      if (stock.meta?.fundFlow) {
        const f = stock.meta.fundFlow
        console.log(`  主力: ${f.mainForceNet > 0 ? '+' : ''}${f.mainForceNet}亿 | 北向: ${f.northboundNet > 0 ? '+' : ''}${f.northboundNet}亿 | 融资: ${f.marginBalanceChange > 0 ? '+' : ''}${f.marginBalanceChange}亿`)
        if (f.mainForceNet < 0 && f.northboundNet < 0) {
          console.log(`  ⚠️ 主力+北向双净流出，资金面恶化`)
        }
      }
    }
  })

  // ---- 边界值测试 ----
  test('边界值: 平安银行 tpct=8% + v=1.5 不应触发假突破', () => {
    const stock = SCAN_STOCKS.find(s => s.symbol === 'SZ-000001')!
    const energy = computeTurnoverVolumeEnergy(stock.input.turnover, stock.input.volumeRatio)
    const style = classifyBreakoutStyle(stock.input.turnover, stock.input.volumeRatio, energy)
    // tpct=8, v=1.5: v < 1.5 严格小于，1.5 不触发
    expect(style).not.toBe('fake_breakout')
    console.log(`\n边界验证: ${stock.symbol} tpct=8% v=1.5 → ${style} (不是假突破 ✅)`)
  })

  // ---- 能量 + 风格交叉验证 ----
  test('能量等级与断线风格交叉验证', () => {
    const results: Array<{ symbol: string; energyLevel: number; style: string; isFake: boolean }> = []
    
    for (const stock of SCAN_STOCKS) {
      const energy = computeTurnoverVolumeEnergy(stock.input.turnover, stock.input.volumeRatio)
      const signal = detectMainForceChipFlow(buildInput(stock))
      results.push({
        symbol: stock.symbol,
        energyLevel: energy.level,
        style: signal.breakoutStyle,
        isFake: signal.breakoutStyle === 'fake_breakout',
      })
    }

    console.log('\n========== 能量-风格交叉矩阵 ==========')
    console.log('股票代码 | 能量等级 | 断线风格 | 假突破')
    console.log('---------|---------|---------|------')
    for (const r of results) {
      console.log(`${r.symbol} | L${r.energyLevel} | ${r.style} | ${r.isFake ? '⚠️ 是' : '否'}`)
    }

    // 验证：L5 能量中假突破案例的存在性
    const l5Fake = results.filter(r => r.energyLevel === 5 && r.isFake)
    expect(l5Fake.length).toBeGreaterThan(0)
    
    // 验证：所有假突破的 tpct >= 8% 且 v < 1.5
    for (const r of results) {
      if (r.isFake) {
        const stock = SCAN_STOCKS.find(s => s.symbol === r.symbol)!
        const tpct = stock.input.turnover * 100
        const v = stock.input.volumeRatio
        expect(tpct).toBeGreaterThanOrEqual(8)
        expect(v).toBeLessThan(1.5)
      }
    }
  })
})