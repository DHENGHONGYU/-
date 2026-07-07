/**
 * Store 派生查询测试 Mock 数据
 *
 * 为 5 个 Store 提供完整的 mock 状态数据，覆盖：
 *   1. 正常场景（多元素、多种状态）
 *   2. 边界场景（空数组、单元素）
 *   3. 极端场景（大量数据）
 *
 * 用于单元测试和本地验证派生逻辑正确性。
 *
 * @module tests/fixtures/store-mock-data
 */

import type { Stock, V6Score } from '@/data/types'
import type { RotationSignal } from '@/services/scoring/rotationSignalDetector'
import type { RiskVerdict, RiskTriState, CircuitState } from '@/store/riskStore'
import type { SignalQualityMetrics, SignalReviewRecord } from '@/store/signalQualityStore'
import type { ChatMessage } from '@/store/chatStore'
import type { ScoreTrendData } from '@/services/analysis/scoreTrendService'

// ═══════════════════════════════════════════════════════════════
// analysisStore Mock 数据
// ═══════════════════════════════════════════════════════════════

export const mockStocks: Stock[] = [
  {
    symbol: '000001',
    name: '平安银行',
    price: 12.5,
    pe: 5.2,
    pb: 0.6,
    roe: 12.5,
    marketCap: 243000000000,
    researchStatus: 'researched' as never,
    source: 'manual' as never,
    dataVersion: 1,
    sector: '银行',
    industryCode: 'SW801780',
  },
  {
    symbol: '000002',
    name: '万科A',
    price: 8.3,
    pe: 8.1,
    pb: 0.5,
    roe: 9.2,
    marketCap: 99000000000,
    researchStatus: 'researched' as never,
    source: 'manual' as never,
    dataVersion: 1,
    sector: '房地产',
    industryCode: 'SW801750',
  },
  {
    symbol: '600519',
    name: '贵州茅台',
    price: 1689.0,
    pe: 28.5,
    pb: 9.5,
    roe: 32.5,
    marketCap: 2120000000000,
    researchStatus: 'researched' as never,
    source: 'manual' as never,
    dataVersion: 1,
    sector: '白酒',
    industryCode: 'SW801130',
  },
]

export const mockScores: V6Score[] = [
  {
    symbol: '000001',
    score: 85,
    factors: { momentum: 0.8, value: 0.7 },
    algorithmVersion: 'v6.0',
    calculatedAt: Date.now() - 86400000,
    dataVersion: 1,
    rating: 'strong_buy',
  },
  {
    symbol: '000002',
    score: 65,
    factors: { momentum: 0.5, value: 0.8 },
    algorithmVersion: 'v6.0',
    calculatedAt: Date.now() - 86400000,
    dataVersion: 1,
    rating: 'buy',
  },
  {
    symbol: '600519',
    score: 92,
    factors: { momentum: 0.9, value: 0.6 },
    algorithmVersion: 'v6.0',
    calculatedAt: Date.now() - 86400000,
    dataVersion: 1,
    rating: 'strong_buy',
  },
]

export const mockTrendData: ScoreTrendData = {
  entityId: '000001',
  entityType: 'stock',
  period: 'month',
  points: [
    { period: '2026-01', composite: 70, count: 5, dimensions: { momentum: 0.6 } },
    { period: '2026-02', composite: 75, count: 6, dimensions: { momentum: 0.7 } },
    { period: '2026-03', composite: 80, count: 7, dimensions: { momentum: 0.8 } },
    { period: '2026-04', composite: 78, count: 6, dimensions: { momentum: 0.75 } },
    { period: '2026-05', composite: 85, count: 8, dimensions: { momentum: 0.85 } },
    { period: '2026-06', composite: 88, count: 9, dimensions: { momentum: 0.9 } },
  ],
}

export const emptyTrendData: ScoreTrendData = {
  entityId: '',
  entityType: 'stock',
  period: 'month',
  points: [],
}

export const singlePointTrendData: ScoreTrendData = {
  entityId: '000001',
  entityType: 'stock',
  period: 'month',
  points: [
    { period: '2026-06', composite: 80, count: 1, dimensions: {} },
  ],
}

// ═══════════════════════════════════════════════════════════════
// rotationSignalStore Mock 数据
// ═══════════════════════════════════════════════════════════════

export const mockRotationSignals: RotationSignal[] = [
  {
    sectorId: 'banking',
    triggered: true,
    conditions: { volumeBreakthrough: true, capitalInflow: true, goldenCross: true },
    strength: 'strong',
    detectedAt: Date.now() - 3600000,
  },
  {
    sectorId: 'steel',
    triggered: true,
    conditions: { volumeBreakthrough: true, capitalInflow: false, goldenCross: true },
    strength: 'medium',
    detectedAt: Date.now() - 7200000,
  },
  {
    sectorId: 'coal',
    triggered: true,
    conditions: { volumeBreakthrough: false, capitalInflow: true, goldenCross: false },
    strength: 'weak',
    detectedAt: Date.now() - 10800000,
  },
  {
    sectorId: 'realestate',
    triggered: false,
    conditions: { volumeBreakthrough: false, capitalInflow: false, goldenCross: false },
    strength: 'weak',
    detectedAt: 0,
  },
]

export const emptyRotationSignals: RotationSignal[] = []

export const singleRotationSignal: RotationSignal[] = [mockRotationSignals[0]!]

// ═══════════════════════════════════════════════════════════════
// riskStore Mock 数据
// ═══════════════════════════════════════════════════════════════

const now = Date.now()

export const mockRiskVerdicts: RiskVerdict[] = [
  {
    id: 'verdict-1',
    timestamp: now - 600000,
    symbol: '000001',
    direction: 'buy' as never,
    input: {
      symbol: '000001',
      direction: 'buy' as never,
      quantity: 1000,
      price: 12.5,
      portfolioValue: 1000000,
      source: 'manual',
    },
    result: { ok: true, warnings: [], blocks: [] },
    triState: 'normal',
  },
  {
    id: 'verdict-2',
    timestamp: now - 500000,
    symbol: '000002',
    direction: 'sell' as never,
    input: {
      symbol: '000002',
      direction: 'sell' as never,
      quantity: 500,
      price: 8.3,
      portfolioValue: 1000000,
      source: 'manual',
    },
    result: { ok: false, warnings: ['仓位偏重'], blocks: [] },
    triState: 'warning',
  },
  {
    id: 'verdict-3',
    timestamp: now - 400000,
    symbol: '600519',
    direction: 'buy' as never,
    input: {
      symbol: '600519',
      direction: 'buy' as never,
      quantity: 10,
      price: 1689.0,
      portfolioValue: 1000000,
      source: 'mcp',
    },
    result: { ok: false, warnings: [], blocks: ['单股集中度过高', '超出单笔限额'] },
    triState: 'blocked',
  },
  {
    id: 'verdict-4',
    timestamp: now - 300000,
    symbol: '000001',
    direction: 'buy' as never,
    input: {
      symbol: '000001',
      direction: 'buy' as never,
      quantity: 2000,
      price: 12.5,
      portfolioValue: 1000000,
      source: 'strategy',
    },
    result: { ok: true, warnings: [], blocks: [] },
    triState: 'normal',
  },
]

export const emptyRiskVerdicts: RiskVerdict[] = []

export const allBlockedVerdicts: RiskVerdict[] = Array.from({ length: 5 }, (_, i) => ({
  id: `blocked-${i}`,
  timestamp: now - (5 - i) * 60000,
  symbol: '000001',
  direction: 'buy' as never,
  input: {
    symbol: '000001',
    direction: 'buy' as never,
    quantity: 1000,
    price: 12.5,
    portfolioValue: 1000000,
  },
  result: { ok: false, warnings: [], blocks: ['风控阻断'] },
  triState: 'blocked',
}))

// ═══════════════════════════════════════════════════════════════
// signalQualityStore Mock 数据
// ═══════════════════════════════════════════════════════════════

export const mockSignalReviews: SignalReviewRecord[] = [
  {
    signalId: 'sig-1',
    symbol: '000001',
    direction: 'buy',
    type: 'volume_breakthrough',
    confidence: 0.85,
    issuedAt: now - 86400000 * 10,
    actualReturn: 5.2,
    correct: true,
    holdingDays: 5,
    pnlPercent: 5.2,
  },
  {
    signalId: 'sig-2',
    symbol: '000001',
    direction: 'sell',
    type: 'death_cross',
    confidence: 0.72,
    issuedAt: now - 86400000 * 8,
    actualReturn: -2.1,
    correct: false,
    holdingDays: 3,
    pnlPercent: -2.1,
  },
  {
    signalId: 'sig-3',
    symbol: '000002',
    direction: 'buy',
    type: 'volume_breakthrough',
    confidence: 0.65,
    issuedAt: now - 86400000 * 5,
    actualReturn: 3.5,
    correct: true,
    holdingDays: 4,
    pnlPercent: 3.5,
  },
  {
    signalId: 'sig-4',
    symbol: '600519',
    direction: 'hold',
    type: 'ma_support',
    confidence: 0.9,
    issuedAt: now - 86400000 * 3,
    actualReturn: 1.8,
    correct: true,
    holdingDays: 2,
    pnlPercent: 1.8,
  },
  {
    signalId: 'sig-5',
    symbol: '000002',
    direction: 'watch',
    type: 'pattern_breakout',
    confidence: 0.55,
    issuedAt: now - 86400000 * 2,
    actualReturn: -5.0,
    correct: false,
    holdingDays: 1,
    pnlPercent: -5.0,
  },
]

export const emptySignalReviews: SignalReviewRecord[] = []

export const mockSignalQualityMetrics: SignalQualityMetrics = {
  totalSignals: 5,
  realizedSignals: 5,
  accuracy: 0.6,
  timingScore: 75,
  maxDrawdown: -0.05,
  sharpeRatio: 1.2,
  avgHoldingDays: 3,
  winRate: 0.6,
  profitLossRatio: 1.5,
}

// ═══════════════════════════════════════════════════════════════
// chatStore Mock 数据
// ═══════════════════════════════════════════════════════════════

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: '分析一下平安银行最近的走势',
    timestamp: now - 600000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: '平安银行近期走势分析：...',
    timestamp: now - 590000,
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'V6 评分如何？',
    timestamp: now - 580000,
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: '平安银行 V6 评分 85 分，评级 strong_buy...',
    timestamp: now - 570000,
  },
  {
    id: 'msg-5',
    role: 'system',
    content: '上下文已更新',
    timestamp: now - 560000,
  },
]

export const emptyChatMessages: ChatMessage[] = []

export const streamingChatMessages: ChatMessage[] = [
  ...mockChatMessages,
  {
    id: 'msg-6',
    role: 'assistant',
    content: '正在分析...',  // 部分内容
    timestamp: now,
    isStreaming: true,
  },
]

// ═══════════════════════════════════════════════════════════════
// Store 状态快照（用于测试 setState）
// ═══════════════════════════════════════════════════════════════

/** analysisStore 正常状态 */
export const analysisStoreNormalState = {
  stocks: mockStocks,
  scores: mockScores,
  loading: false,
  error: null,
  trendData: mockTrendData,
  trendLoading: false,
  trendError: null,
  trendPeriod: 'month' as const,
}

/** analysisStore 空状态 */
export const analysisStoreEmptyState = {
  stocks: [] as Stock[],
  scores: [] as V6Score[],
  loading: false,
  error: null,
  trendData: undefined,
  trendLoading: false,
  trendError: null,
  trendPeriod: 'month' as const,
}

/** rotationSignalStore 正常状态 */
export const rotationSignalStoreNormalState = {
  signals: mockRotationSignals,
  loading: false,
  error: null,
  lastUpdated: now,
}

/** riskStore 正常状态（triState: normal, circuitState: closed） */
export const riskStoreNormalState = {
  triState: 'normal' as RiskTriState,
  circuitState: 'closed' as CircuitState,
  verdicts: mockRiskVerdicts,
  loading: false,
  error: null,
  lastChecked: now,
}

/** riskStore 阻塞状态（triState: blocked, circuitState: open） */
export const riskStoreBlockedState = {
  triState: 'blocked' as RiskTriState,
  circuitState: 'open' as CircuitState,
  verdicts: mockRiskVerdicts,
  loading: false,
  error: null,
  lastChecked: now,
}

/** signalQualityStore 正常状态 */
export const signalQualityStoreNormalState = {
  metrics: mockSignalQualityMetrics,
  reviews: mockSignalReviews,
  loading: false,
  error: null,
  lastUpdated: now,
}

/** signalQualityStore 空状态 */
export const signalQualityStoreEmptyState = {
  metrics: null,
  reviews: [] as SignalReviewRecord[],
  loading: false,
  error: null,
  lastUpdated: 0,
}

/** chatStore 正常状态 */
export const chatStoreNormalState = {
  messages: mockChatMessages,
  isStreaming: false,
  error: null,
}

/** chatStore 流式状态 */
export const chatStoreStreamingState = {
  messages: streamingChatMessages,
  isStreaming: true,
  error: null,
}

/** chatStore 空状态 */
export const chatStoreEmptyState = {
  messages: [] as ChatMessage[],
  isStreaming: false,
  error: null,
}
