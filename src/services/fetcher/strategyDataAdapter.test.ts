import { describe, test, expect } from 'vitest'
import {
  adaptToHotSector,
  adaptToValuePit,
  adaptToRotation,
  adaptBatchToHotSector,
  adaptBatchToValuePit,
  adaptBatchToRotation,
  type TencentSectorFlowRaw,
  type EastMoneyValuationRaw,
  type PriceVolumeRaw,
} from './strategyDataAdapter'

// ============================================================
// Mock 数据
// ============================================================

const mockTencentData: TencentSectorFlowRaw = {
  code: 'AI_SECTOR',
  name: 'AI 算力板块',
  strength: 4.5,
  changeRank: 2,
  volumeRatio: 2.0,
  mainInflowDays: 5,
  rs: 80,
  heatRank: 3,
  retailIndex: 0.7,
  instBuyCount: 8,
  limitUpCount: 5,
  breakout: true,
  macd: 'bullish',
  rsi: 62,
  aboveMA20: true,
  aboveMA60: true,
  pe: 45,
  pbPercentile: 70,
  mktCap: 5000,
  divYield: 0.8,
  trend: 'bull',
  risk: 'low',
}

const mockEastMoneyData: EastMoneyValuationRaw = {
  code: 'BANK_001',
  name: '银行板块',
  policyScore: 4.0,
  cycleScore: 3.5,
  techScore: 2.0,
  orderScore: 2.5,
  pePct: 5,
  pbPct: 8,
  divYield: 4.5,
  peg: 0.6,
  northChange: 2.5,
  fundChange: 3.0,
  holderChange: -8.0,
  sectorVolPct: 15,
  inflowStrength: 4.0,
  goldenCross: true,
  avgAmount: 80000,
  turnover: 1.5,
  mktCap: 1500,
}

const mockPriceVolumeData: PriceVolumeRaw = {
  id: 'BANK',
  volumes: [...Array(50).fill(60000), 100000, 110000, 120000, 115000, 105000],
  netFlows: [10, 20, 15, 30, 25],
  closes: [...Array(20).fill(105), 100, 100, 100, 100, 130],
}

// ============================================================
// adaptToHotSector
// ============================================================

describe('adaptToHotSector', () => {
  test('将腾讯API数据正确映射为 HotSectorAnalyzerInput', () => {
    const result = adaptToHotSector(mockTencentData)

    expect(result.symbol).toBe('AI_SECTOR')
    expect(result.sectorName).toBe('AI 算力板块')

    // 动量维度
    expect(result.momentum.sectorStrengthScore).toBe(4.5)
    expect(result.momentum.priceChangeRank).toBe(2)
    expect(result.momentum.volumeExpansion).toBe(2.0)
    expect(result.momentum.consecutiveInflow).toBe(5)
    expect(result.momentum.relativeStrength).toBe(80)

    // 情绪维度
    expect(result.sentiment.sentimentRank).toBe(3)
    expect(result.sentiment.retailSentiment).toBe(0.7)
    expect(result.sentiment.institutionBuyCount).toBe(8)
    expect(result.sentiment.limitUpCount).toBe(5)

    // 技术突破维度
    expect(result.breakout.hasBreakoutPattern).toBe(true)
    expect(result.breakout.rsiSignal).toBe('bullish')
    expect(result.breakout.rsi).toBe(62)
    expect(result.breakout.priceAboveMA20).toBe(true)
    expect(result.breakout.priceAboveMA60).toBe(true)

    // 估值风险维度
    expect(result.valuationRisk.pe).toBe(45)
    expect(result.valuationRisk.pbPercentile).toBe(70)
    expect(result.valuationRisk.marketCap).toBe(5000)
    expect(result.valuationRisk.dividendYield).toBe(0.8)

    // 大盘环境维度
    expect(result.marketEnv.marketTrend).toBe('bull')
    expect(result.marketEnv.systemicRisk).toBe('low')
  })

  test('处理极端值：零值输入', () => {
    const zeroData: TencentSectorFlowRaw = {
      ...mockTencentData,
      code: 'ZERO',
      name: '零值测试',
      strength: 0,
      changeRank: 100,
      volumeRatio: 0,
      mainInflowDays: 0,
      rs: 0,
      heatRank: 100,
      retailIndex: 0,
      instBuyCount: 0,
      limitUpCount: 0,
      breakout: false,
      macd: 'bearish',
      rsi: 20,
      aboveMA20: false,
      aboveMA60: false,
      pe: 0,
      pbPercentile: 0,
      mktCap: 0,
      divYield: 0,
      trend: 'bear',
      risk: 'high',
    }

    const result = adaptToHotSector(zeroData)
    expect(result.symbol).toBe('ZERO')
    expect(result.momentum.sectorStrengthScore).toBe(0)
    expect(result.breakout.rsiSignal).toBe('bearish')
    expect(result.marketEnv.marketTrend).toBe('bear')
    expect(result.marketEnv.systemicRisk).toBe('high')
  })
})

// ============================================================
// adaptToValuePit
// ============================================================

describe('adaptToValuePit', () => {
  test('将东财API数据正确映射为 ValuePitAnalyzerInput', () => {
    const result = adaptToValuePit(mockEastMoneyData)

    expect(result.symbol).toBe('BANK_001')
    expect(result.sectorName).toBe('银行板块')

    // 催化维度
    expect(result.catalyst.policyCatalyst).toBe(4.0)
    expect(result.catalyst.cycleTurningPoint).toBe(3.5)
    expect(result.catalyst.techBreakthrough).toBe(2.0)
    expect(result.catalyst.orderSurge).toBe(2.5)

    // 估值安全垫维度
    expect(result.valuationMargin.pePercentile).toBe(5)
    expect(result.valuationMargin.pbPercentile).toBe(8)
    expect(result.valuationMargin.dividendYield).toBe(4.5)
    expect(result.valuationMargin.peg).toBe(0.6)

    // 筹码结构维度
    expect(result.chipStructure.northBoundChange).toBe(2.5)
    expect(result.chipStructure.fundPositionChange).toBe(3.0)
    expect(result.chipStructure.shareholderChange).toBe(-8.0)

    // 轮动位置维度
    expect(result.rotationPosition.sectorVolumePercentile).toBe(15)
    expect(result.rotationPosition.capitalInflowStrength).toBe(4.0)
    expect(result.rotationPosition.hasGoldenCross).toBe(true)

    // 流动性维度
    expect(result.liquidity.avgDailyAmount).toBe(80000)
    expect(result.liquidity.turnoverRate).toBe(1.5)
    expect(result.liquidity.marketCap).toBe(1500)
  })

  test('处理负值股东户数变化（筹码集中）', () => {
    const concentratedData: EastMoneyValuationRaw = {
      ...mockEastMoneyData,
      holderChange: -15,
    }
    const result = adaptToValuePit(concentratedData)
    expect(result.chipStructure.shareholderChange).toBe(-15)
  })

  test('处理正值股东户数变化（筹码分散）', () => {
    const dispersedData: EastMoneyValuationRaw = {
      ...mockEastMoneyData,
      holderChange: 12,
    }
    const result = adaptToValuePit(dispersedData)
    expect(result.chipStructure.shareholderChange).toBe(12)
  })
})

// ============================================================
// adaptToRotation
// ============================================================

describe('adaptToRotation', () => {
  test('将量价数据正确映射为 RotationSignalInput', () => {
    const result = adaptToRotation(mockPriceVolumeData)

    expect(result.sectorId).toBe('BANK')
    expect(result.volume.history).toHaveLength(55)
    expect(result.volume.history[0]).toBe(60000)
    expect(result.capitalFlow.dailyNetFlow).toEqual([10, 20, 15, 30, 25])
    expect(result.goldenCross.closes).toHaveLength(25)
    expect(result.goldenCross.closes[0]).toBe(105)
  })

  test('处理空数据', () => {
    const emptyData: PriceVolumeRaw = {
      id: 'EMPTY',
      volumes: [],
      netFlows: [],
      closes: [],
    }

    const result = adaptToRotation(emptyData)
    expect(result.sectorId).toBe('EMPTY')
    expect(result.volume.history).toHaveLength(0)
    expect(result.capitalFlow.dailyNetFlow).toHaveLength(0)
    expect(result.goldenCross.closes).toHaveLength(0)
  })
})

// ============================================================
// 批量适配
// ============================================================

describe('批量适配', () => {
  test('adaptBatchToHotSector 批量处理', () => {
    const rawList = [
      { ...mockTencentData, code: 'A', name: '板块A' },
      { ...mockTencentData, code: 'B', name: '板块B' },
      { ...mockTencentData, code: 'C', name: '板块C' },
    ]

    const results = adaptBatchToHotSector(rawList)
    expect(results).toHaveLength(3)
    expect(results[0]!.symbol).toBe('A')
    expect(results[1]!.symbol).toBe('B')
    expect(results[2]!.symbol).toBe('C')
  })

  test('adaptBatchToValuePit 批量处理', () => {
    const rawList = [
      { ...mockEastMoneyData, code: 'X', name: '标的X' },
      { ...mockEastMoneyData, code: 'Y', name: '标的Y' },
    ]

    const results = adaptBatchToValuePit(rawList)
    expect(results).toHaveLength(2)
    expect(results[0]!.symbol).toBe('X')
    expect(results[1]!.symbol).toBe('Y')
  })

  test('adaptBatchToRotation 批量处理', () => {
    const rawList = [
      { ...mockPriceVolumeData, id: 'S1' },
      { ...mockPriceVolumeData, id: 'S2' },
    ]

    const results = adaptBatchToRotation(rawList)
    expect(results).toHaveLength(2)
    expect(results[0]!.sectorId).toBe('S1')
    expect(results[1]!.sectorId).toBe('S2')
    expect(results[0]!.volume.history).toHaveLength(55)
  })
})