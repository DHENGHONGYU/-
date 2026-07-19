/**
 * @doc [V9-DOC-BACK-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-BACK-006, V9-DOC-DATA-021]
 */
import type { HotSectorScore, ValuePitScore } from '@/data/types'

export type {
  HotSectorScore,
  HotSectorDimensionScores,
  ValuePitScore,
  ValuePitDimensionScores,
} from '@/data/types'

export interface RotationSignal {
  sectorId: string
  triggered: boolean
  conditions: {
    volumeBreakthrough: boolean
    capitalInflow: boolean
    goldenCross: boolean
  }
  strength: 'weak' | 'medium' | 'strong'
  detectedAt: number
}

export interface StrategyAnalyzers {
  analyzeHotSector: (input: HotSectorAnalyzerInput) => HotSectorScore
  detectRotation: (input: RotationSignalInput) => RotationSignal
  analyzeValuePit: (input: ValuePitAnalyzerInput) => ValuePitScore
}

export interface HotSectorAnalyzerInput {
  symbol: string
  sectorName: string
  momentum: MomentumInput
  sentiment: SentimentInput
  breakout: BreakoutInput
  valuationRisk: ValuationRiskInput
  marketEnv: MarketEnvInput
}

export interface MomentumInput {
  sectorStrengthScore: number
  priceChangeRank: number
  volumeExpansion: number
  consecutiveInflow: number
  relativeStrength: number
}

export interface SentimentInput {
  sentimentRank: number
  retailSentiment: number
  institutionBuyCount: number
  limitUpCount: number
}

export interface BreakoutInput {
  hasBreakoutPattern: boolean
  rsiSignal: 'bullish' | 'bearish' | 'neutral'
  rsi: number
  priceAboveMA20: boolean
  priceAboveMA60: boolean
}

export interface ValuationRiskInput {
  pe: number
  pbPercentile: number
  marketCap: number
  dividendYield: number
}

export interface MarketEnvInput {
  marketTrend: 'bull' | 'bear' | 'sideways'
  systemicRisk: 'low' | 'medium' | 'high'
}

export interface RotationSignalInput {
  sectorId: string
  volume: {
    history: number[]
    averageVolume: number
  }
  capitalFlow: {
    dailyNetFlow: number[]
  }
  goldenCross: {
    closes: number[]
    shortMa: number[]
    longMa: number[]
  }
}

export interface ValuePitAnalyzerInput {
  symbol: string
  sectorName: string
  catalyst: CatalystInput
  valuationMargin: ValuationMarginInput
  chipStructure: ChipStructureInput
  rotationPosition: RotationPositionInput
  liquidity: LiquidityInput
}

export interface CatalystInput {
  policyCatalyst: number
  cycleTurningPoint: number
  techBreakthrough: number
  orderSurge: number
}

export interface ValuationMarginInput {
  pePercentile: number
  pbPercentile: number
  dividendYield: number
  peg: number
}

export interface ChipStructureInput {
  northBoundChange: number
  fundPositionChange: number
  shareholderChange: number
}

export interface RotationPositionInput {
  sectorVolumePercentile: number
  capitalInflowStrength: number
  hasGoldenCross: boolean
}

export interface LiquidityInput {
  avgDailyAmount: number
  turnoverRate: number
  marketCap: number
}
