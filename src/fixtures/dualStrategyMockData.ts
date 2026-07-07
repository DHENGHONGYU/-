/**
 * 双策略信号池 Mock 数据
 *
 * 提供 hotSectorAnalyzer、valuePitAnalyzer、rotationSignalDetector 的默认样本数据，
 * 用于股票池为空时的回退数据，保持页面与测试可用。
 *
 * @module src/fixtures/dualStrategyMockData
 */

import type { HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import type { ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import type { RotationSignalInput } from '@/services/scoring/rotationSignalDetector'

export const HOT_SECTOR_DEFAULT_SAMPLES: HotSectorAnalyzerInput[] = [
  {
    symbol: 'AI_算力',
    sectorName: 'AI 算力',
    momentum: { sectorStrengthScore: 4.5, priceChangeRank: 1, volumeExpansion: 2.5, consecutiveInflow: 8, relativeStrength: 85 },
    sentiment: { sentimentRank: 1, retailSentiment: 0.85, institutionBuyCount: 12, limitUpCount: 5 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 65, priceAboveMA20: true, priceAboveMA60: true },
    valuationRisk: { pe: 65, pbPercentile: 80, marketCap: 8000, dividendYield: 0.5 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '半导体',
    sectorName: '半导体',
    momentum: { sectorStrengthScore: 4.0, priceChangeRank: 3, volumeExpansion: 1.8, consecutiveInflow: 5, relativeStrength: 72 },
    sentiment: { sentimentRank: 4, retailSentiment: 0.7, institutionBuyCount: 8, limitUpCount: 3 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 58, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '新能源',
    sectorName: '新能源',
    momentum: { sectorStrengthScore: 2.5, priceChangeRank: 8, volumeExpansion: 0.8, consecutiveInflow: 1, relativeStrength: 45 },
    sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'bearish', rsi: 35, priceAboveMA20: false, priceAboveMA60: false },
    valuationRisk: { pe: 18, pbPercentile: 20, marketCap: 2000, dividendYield: 2.0 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
  {
    symbol: '银行',
    sectorName: '银行',
    momentum: { sectorStrengthScore: 3.2, priceChangeRank: 5, volumeExpansion: 1.2, consecutiveInflow: 3, relativeStrength: 58 },
    sentiment: { sentimentRank: 6, retailSentiment: 0.55, institutionBuyCount: 5, limitUpCount: 1 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'neutral', rsi: 48, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 5, pbPercentile: 15, marketCap: 3000, dividendYield: 5.0 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
]

export const VALUE_PIT_DEFAULT_SAMPLES: ValuePitAnalyzerInput[] = [
  {
    symbol: '银行',
    sectorName: '银行',
    catalyst: { policyCatalyst: 4.0, cycleTurningPoint: 3.5, techBreakthrough: 2.0, orderSurge: 2.5 },
    valuationMargin: { pePercentile: 5, pbPercentile: 8, dividendYield: 4.5, peg: 0.6 },
    chipStructure: { northBoundChange: 2.5, fundPositionChange: 3.0, shareholderChange: -1.5 },
    rotationPosition: { sectorVolumePercentile: 15, capitalInflowStrength: 4.0, hasGoldenCross: true },
    liquidity: { avgDailyAmount: 80000, turnoverRate: 1.5, marketCap: 1500 },
  },
  {
    symbol: '钢铁',
    sectorName: '钢铁',
    catalyst: { policyCatalyst: 3.0, cycleTurningPoint: 3.0, techBreakthrough: 2.0, orderSurge: 2.0 },
    valuationMargin: { pePercentile: 15, pbPercentile: 20, dividendYield: 3.0, peg: 0.8 },
    chipStructure: { northBoundChange: 1.0, fundPositionChange: 1.5, shareholderChange: -0.5 },
    rotationPosition: { sectorVolumePercentile: 40, capitalInflowStrength: 3.0, hasGoldenCross: false },
    liquidity: { avgDailyAmount: 30000, turnoverRate: 2.5, marketCap: 500 },
  },
  {
    symbol: '煤炭',
    sectorName: '煤炭',
    catalyst: { policyCatalyst: 2.5, cycleTurningPoint: 2.0, techBreakthrough: 1.5, orderSurge: 1.5 },
    valuationMargin: { pePercentile: 10, pbPercentile: 12, dividendYield: 5.0, peg: 0.5 },
    chipStructure: { northBoundChange: -0.5, fundPositionChange: 0.5, shareholderChange: 2.0 },
    rotationPosition: { sectorVolumePercentile: 55, capitalInflowStrength: 2.0, hasGoldenCross: false },
    liquidity: { avgDailyAmount: 15000, turnoverRate: 1.0, marketCap: 300 },
  },
]

export const ROTATION_DEFAULT_SAMPLES: RotationSignalInput[] = [
  {
    sectorId: '银行',
    volume: { history: [...Array(20).fill(60000), 120000, 125000, 130000, 125000, 120000] },
    capitalFlow: { dailyNetFlow: [10, 20, 15, 30, 25] },
    goldenCross: { closes: [...Array(20).fill(105), 100, 100, 100, 100, 130] },
  },
  {
    sectorId: '钢铁',
    volume: { history: [...Array(20).fill(30000), 35000, 32000, 31000, 33000, 34000] },
    capitalFlow: { dailyNetFlow: [5, 3, -2, 8, 2] },
    goldenCross: { closes: [...Array(25).fill(100)] },
  },
  {
    sectorId: '煤炭',
    volume: { history: [...Array(20).fill(15000), 16000, 16000, 16000, 16000, 16000] },
    capitalFlow: { dailyNetFlow: [-3, -5, -2, 1, -1] },
    goldenCross: { closes: Array(25).fill(100).map((v, i) => v - i * 0.5) },
  },
]
