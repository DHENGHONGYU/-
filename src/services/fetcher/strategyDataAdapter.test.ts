import { describe, test, expect } from 'vitest'
import {
  adaptToHotSector,
  adaptToValuePit,
  adaptToRotation,
  adaptBatchToHotSector,
  adaptBatchToValuePit,
  adaptBatchToRotation,
  normalizeHotSectorInput,
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

  // ============================================================
  // A 类根治：脏数据 defaultValue 映射测试
  // ============================================================

  test('A 类根治: sentiment 部分字段缺失时补全为默认值', () => {
    // 模拟用户报告的脏数据：sentiment 只有 sentimentRank 和 retailSentiment
    const dirtyRaw: TencentSectorFlowRaw = {
      ...mockTencentData,
      instBuyCount: undefined as unknown as number,
      limitUpCount: undefined as unknown as number,
    }
    const result = adaptToHotSector(dirtyRaw)
    expect(result.sentiment.sentimentRank).toBe(mockTencentData.heatRank)
    expect(result.sentiment.retailSentiment).toBe(mockTencentData.retailIndex)
    // 缺失字段补全为 0
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.sentiment.limitUpCount).toBe(0)
  })

  test('A 类根治: 字段为字符串数字时正确转换', () => {
    const stringNumRaw: TencentSectorFlowRaw = {
      ...mockTencentData,
      strength: '4.5' as unknown as number,
      rs: '80' as unknown as number,
      rsi: '65' as unknown as number,
    }
    const result = adaptToHotSector(stringNumRaw)
    expect(result.momentum.sectorStrengthScore).toBe(4.5)
    expect(result.momentum.relativeStrength).toBe(80)
    expect(result.breakout.rsi).toBe(65)
  })

  test('A 类根治: 枚举字段为非法值时回退到默认值', () => {
    const invalidEnumRaw: TencentSectorFlowRaw = {
      ...mockTencentData,
      macd: 'invalid' as unknown as 'bullish' | 'bearish' | 'neutral',
      trend: 'unknown' as unknown as 'bull' | 'bear' | 'sideways',
      risk: 'extreme' as unknown as 'low' | 'medium' | 'high',
    }
    const result = adaptToHotSector(invalidEnumRaw)
    expect(result.breakout.rsiSignal).toBe('neutral')
    expect(result.marketEnv.marketTrend).toBe('sideways')
    expect(result.marketEnv.systemicRisk).toBe('medium')
  })

  test('A 类根治: NaN/Infinity 字段回退到默认值', () => {
    const nanRaw: TencentSectorFlowRaw = {
      ...mockTencentData,
      strength: NaN,
      rs: Infinity,
      pe: -Infinity,
    }
    const result = adaptToHotSector(nanRaw)
    expect(result.momentum.sectorStrengthScore).toBe(0)
    expect(result.momentum.relativeStrength).toBe(0)
    expect(result.valuationRisk.pe).toBe(0)
  })
})

// ============================================================
// normalizeHotSectorInput（直接处理 HotSectorAnalyzerInput 形态数据）
// ============================================================

describe('normalizeHotSectorInput', () => {
  test('完整数据保持不变', () => {
    const complete = {
      symbol: 'BK001',
      sectorName: '半导体',
      momentum: { sectorStrengthScore: 4, priceChangeRank: 3, volumeExpansion: 1.5, consecutiveInflow: 5, relativeStrength: 72 },
      sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
      breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish' as const, rsi: 65, priceAboveMA20: true, priceAboveMA60: false },
      valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
      marketEnv: { marketTrend: 'bull' as const, systemicRisk: 'low' as const },
    }
    const result = normalizeHotSectorInput(complete)
    expect(result).toEqual(complete)
  })

  test('用户报告的脏数据: sentiment 缺 institutionBuyCount/limitUpCount', () => {
    // 模拟用户报告的 API 返回: {"sentiment": {"sentimentRank": 10, "retailSentiment": 0.4}}
    const dirty = {
      symbol: 'BK001',
      sectorName: '半导体',
      momentum: { sectorStrengthScore: 4, priceChangeRank: 3, volumeExpansion: 1.5, consecutiveInflow: 5, relativeStrength: 72 },
      sentiment: { sentimentRank: 10, retailSentiment: 0.4 },
      breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish' as const, rsi: 65, priceAboveMA20: true, priceAboveMA60: false },
      valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
      marketEnv: { marketTrend: 'bull' as const, systemicRisk: 'low' as const },
    }
    const result = normalizeHotSectorInput(dirty)
    expect(result.sentiment.sentimentRank).toBe(10)
    expect(result.sentiment.retailSentiment).toBe(0.4)
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.sentiment.limitUpCount).toBe(0)
  })

  test('整个维度缺失时全部补全为默认值', () => {
    const partialMissing = {
      symbol: 'BK001',
      sectorName: '半导体',
      momentum: { sectorStrengthScore: 4, priceChangeRank: 3, volumeExpansion: 1.5, consecutiveInflow: 5, relativeStrength: 72 },
      // sentiment, breakout, valuationRisk, marketEnv 全部缺失
    }
    const result = normalizeHotSectorInput(partialMissing)
    expect(result.sentiment).toEqual({ sentimentRank: 0, retailSentiment: 0, institutionBuyCount: 0, limitUpCount: 0 })
    expect(result.breakout).toEqual({ hasBreakoutPattern: false, rsiSignal: 'neutral', rsi: 50, priceAboveMA20: false, priceAboveMA60: false })
    expect(result.valuationRisk).toEqual({ pe: 0, pbPercentile: 0, marketCap: 0, dividendYield: 0 })
    expect(result.marketEnv).toEqual({ marketTrend: 'sideways', systemicRisk: 'medium' })
  })

  test('null 输入返回完整默认值', () => {
    const result = normalizeHotSectorInput(null)
    expect(result.symbol).toBe('')
    expect(result.sectorName).toBe('')
    expect(result.sentiment).toEqual({ sentimentRank: 0, retailSentiment: 0, institutionBuyCount: 0, limitUpCount: 0 })
    expect(result.momentum).toEqual({ sectorStrengthScore: 0, priceChangeRank: 0, volumeExpansion: 0, consecutiveInflow: 0, relativeStrength: 0 })
  })

  test('undefined 输入返回完整默认值', () => {
    const result = normalizeHotSectorInput(undefined)
    expect(result.symbol).toBe('')
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.breakout.rsi).toBe(50)
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