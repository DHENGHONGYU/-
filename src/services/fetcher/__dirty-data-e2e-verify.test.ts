/* eslint-disable no-console */
/**
 * A 类根治方案端到端验证
 *
 * 本测试模拟 6 种真实 API 脏数据场景，验证 adaptToHotSector 和 normalizeHotSectorInput
 * 是否能正确补全缺失字段、转换非法类型，确保脏数据不流入下游 UI。
 *
 * 运行命令：
 *   npm test -- --run src/services/fetcher/__dirty-data-e2e-verify.test.ts
 */
import { describe, test, expect } from 'vitest'
import {
  adaptToHotSector,
  normalizeHotSectorInput,
  type TencentSectorFlowRaw,
} from './strategyDataAdapter'

// 完整正常数据作为基准
const BASE_NORMAL: TencentSectorFlowRaw = {
  code: 'BK_AI',
  name: 'AI 算力',
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
  rsi: 65,
  aboveMA20: true,
  aboveMA60: false,
  pe: 55,
  pbPercentile: 65,
  mktCap: 5000,
  divYield: 0.8,
  trend: 'bull',
  risk: 'low',
}

// ============================================================
// 场景 1: 用户报告的真实场景（sentiment 部分字段缺失）
// API 返回 {"sentiment": {"sentimentRank": 10, "retailSentiment": 0.4}}
// ============================================================

describe('场景 1: 用户报告场景 - sentiment 缺 institutionBuyCount/limitUpCount', () => {
  test('adaptToHotSector 应补全缺失字段为 0', () => {
    const dirty: TencentSectorFlowRaw = {
      ...BASE_NORMAL,
      instBuyCount: undefined as unknown as number,
      limitUpCount: undefined as unknown as number,
    }
    const result = adaptToHotSector(dirty)

    console.log('[场景1] 输入脏数据:', JSON.stringify({ sentiment: { sentimentRank: dirty.heatRank, retailSentiment: dirty.retailIndex } }, null, 2))
    console.log('[场景1] 输出规范化数据:', JSON.stringify(result.sentiment, null, 2))

    // 已有字段保持原值
    expect(result.sentiment.sentimentRank).toBe(3)
    expect(result.sentiment.retailSentiment).toBe(0.7)
    // 缺失字段补全为 0（关键断言）
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.sentiment.limitUpCount).toBe(0)
    // 类型安全：所有字段都是 number
    expect(typeof result.sentiment.sentimentRank).toBe('number')
    expect(typeof result.sentiment.institutionBuyCount).toBe('number')
  })

  test('normalizeHotSectorInput 也应处理用户报告场景', () => {
    const dirtyApiJson = {
      symbol: 'BK_AI',
      sectorName: 'AI 算力',
      momentum: { sectorStrengthScore: 4, priceChangeRank: 3, volumeExpansion: 1.5, consecutiveInflow: 5, relativeStrength: 72 },
      sentiment: { sentimentRank: 10, retailSentiment: 0.4 }, // 用户报告：只有这两个字段
      breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 65, priceAboveMA20: true, priceAboveMA60: false },
      valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
      marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
    }
    const result = normalizeHotSectorInput(dirtyApiJson)

    console.log('[场景1-normalize] 输入:', JSON.stringify(dirtyApiJson.sentiment, null, 2))
    console.log('[场景1-normalize] 输出:', JSON.stringify(result.sentiment, null, 2))

    expect(result.sentiment.sentimentRank).toBe(10)
    expect(result.sentiment.retailSentiment).toBe(0.4)
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.sentiment.limitUpCount).toBe(0)
  })
})

// ============================================================
// 场景 2: 多个字段为 null
// ============================================================

describe('场景 2: 字段为 null', () => {
  test('null 字段应转换为默认值', () => {
    const dirty: TencentSectorFlowRaw = {
      ...BASE_NORMAL,
      strength: null as unknown as number,
      heatRank: null as unknown as number,
      instBuyCount: null as unknown as number,
      rsi: null as unknown as number,
      pe: null as unknown as number,
    }
    const result = adaptToHotSector(dirty)

    console.log('[场景2] momentum.sectorStrengthScore:', result.momentum.sectorStrengthScore)
    console.log('[场景2] sentiment.sentimentRank:', result.sentiment.sentimentRank)
    console.log('[场景2] breakout.rsi:', result.breakout.rsi)
    console.log('[场景2] valuationRisk.pe:', result.valuationRisk.pe)

    expect(result.momentum.sectorStrengthScore).toBe(0)
    expect(result.sentiment.sentimentRank).toBe(0)
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.breakout.rsi).toBe(50) // RSI 默认中值
    expect(result.valuationRisk.pe).toBe(0)
  })
})

// ============================================================
// 场景 3: 数值字段为字符串（合法字符串 + 非法字符串）
// ============================================================

describe('场景 3: 字段为字符串数字/非法字符串', () => {
  test('合法字符串数字应转换为 number，非法字符串应转换为 0', () => {
    const dirty: TencentSectorFlowRaw = {
      ...BASE_NORMAL,
      strength: '4.5' as unknown as number,        // 合法
      rs: '80' as unknown as number,                // 合法
      rsi: 'abc' as unknown as number,              // 非法
      pe: '' as unknown as number,                  // 空字符串
      pbPercentile: 'NaN' as unknown as number,     // 非法
    }
    const result = adaptToHotSector(dirty)

    console.log('[场景3] strength "4.5" →', result.momentum.sectorStrengthScore)
    console.log('[场景3] rs "80" →', result.momentum.relativeStrength)
    console.log('[场景3] rsi "abc" →', result.breakout.rsi)
    console.log('[场景3] pe "" →', result.valuationRisk.pe)
    console.log('[场景3] pbPercentile "NaN" →', result.valuationRisk.pbPercentile)

    expect(result.momentum.sectorStrengthScore).toBe(4.5)
    expect(result.momentum.relativeStrength).toBe(80)
    expect(result.breakout.rsi).toBe(50) // 非法字符串回退到默认
    expect(result.valuationRisk.pe).toBe(0)
    expect(result.valuationRisk.pbPercentile).toBe(0)
  })
})

// ============================================================
// 场景 4: 枚举字段为非法值
// ============================================================

describe('场景 4: 枚举字段非法值', () => {
  test('非法枚举应回退到默认值', () => {
    const dirty: TencentSectorFlowRaw = {
      ...BASE_NORMAL,
      macd: 'invalid_signal' as unknown as 'bullish' | 'bearish' | 'neutral',
      trend: 'unknown_trend' as unknown as 'bull' | 'bear' | 'sideways',
      risk: 'extreme' as unknown as 'low' | 'medium' | 'high',
    }
    const result = adaptToHotSector(dirty)

    console.log('[场景4] macd "invalid_signal" →', result.breakout.rsiSignal)
    console.log('[场景4] trend "unknown_trend" →', result.marketEnv.marketTrend)
    console.log('[场景4] risk "extreme" →', result.marketEnv.systemicRisk)

    expect(result.breakout.rsiSignal).toBe('neutral')
    expect(result.marketEnv.marketTrend).toBe('sideways')
    expect(result.marketEnv.systemicRisk).toBe('medium')
  })
})

// ============================================================
// 场景 5: NaN / Infinity
// ============================================================

describe('场景 5: NaN/Infinity 数值', () => {
  test('NaN/Infinity 应转换为 0', () => {
    const dirty: TencentSectorFlowRaw = {
      ...BASE_NORMAL,
      strength: NaN,
      rs: Infinity,
      rsi: -Infinity,
      pe: NaN,
      mktCap: Infinity,
    }
    const result = adaptToHotSector(dirty)

    console.log('[场景5] strength NaN →', result.momentum.sectorStrengthScore)
    console.log('[场景5] rs Infinity →', result.momentum.relativeStrength)
    console.log('[场景5] rsi -Infinity →', result.breakout.rsi)
    console.log('[场景5] pe NaN →', result.valuationRisk.pe)
    console.log('[场景5] mktCap Infinity →', result.valuationRisk.marketCap)

    expect(result.momentum.sectorStrengthScore).toBe(0)
    expect(result.momentum.relativeStrength).toBe(0)
    expect(result.breakout.rsi).toBe(50) // rsi 默认 50，不是 0
    expect(result.valuationRisk.pe).toBe(0)
    expect(result.valuationRisk.marketCap).toBe(0)
    expect(Number.isFinite(result.momentum.sectorStrengthScore)).toBe(true)
    expect(Number.isFinite(result.momentum.relativeStrength)).toBe(true)
  })
})

// ============================================================
// 场景 6: 整个对象为 null/undefined（极端场景）
// ============================================================

describe('场景 6: 整个对象为 null/undefined', () => {
  test('null 输入应返回完整默认值', () => {
    const result = normalizeHotSectorInput(null)

    console.log('[场景6-null] symbol:', result.symbol)
    console.log('[场景6-null] sentiment:', JSON.stringify(result.sentiment))
    console.log('[场景6-null] breakout:', JSON.stringify(result.breakout))
    console.log('[场景6-null] marketEnv:', JSON.stringify(result.marketEnv))

    expect(result.symbol).toBe('')
    expect(result.sectorName).toBe('')
    expect(result.sentiment).toEqual({ sentimentRank: 0, retailSentiment: 0, institutionBuyCount: 0, limitUpCount: 0 })
    expect(result.momentum).toEqual({ sectorStrengthScore: 0, priceChangeRank: 0, volumeExpansion: 0, consecutiveInflow: 0, relativeStrength: 0 })
    expect(result.breakout).toEqual({ hasBreakoutPattern: false, rsiSignal: 'neutral', rsi: 50, priceAboveMA20: false, priceAboveMA60: false })
    expect(result.valuationRisk).toEqual({ pe: 0, pbPercentile: 0, marketCap: 0, dividendYield: 0 })
    expect(result.marketEnv).toEqual({ marketTrend: 'sideways', systemicRisk: 'medium' })
  })

  test('undefined 输入应返回完整默认值', () => {
    const result = normalizeHotSectorInput(undefined)

    console.log('[场景6-undefined] symbol:', result.symbol)
    console.log('[场景6-undefined] sentiment.institutionBuyCount:', result.sentiment.institutionBuyCount)
    console.log('[场景6-undefined] breakout.rsi:', result.breakout.rsi)

    expect(result.symbol).toBe('')
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.breakout.rsi).toBe(50)
    expect(result.marketEnv.marketTrend).toBe('sideways')
  })

  test('部分维度缺失的对象应补全所有缺失维度', () => {
    const partialMissing = {
      symbol: 'BK_PARTIAL',
      sectorName: '部分数据板块',
      momentum: { sectorStrengthScore: 4, priceChangeRank: 3, volumeExpansion: 1.5, consecutiveInflow: 5, relativeStrength: 72 },
      // sentiment, breakout, valuationRisk, marketEnv 全部缺失
    }
    const result = normalizeHotSectorInput(partialMissing)

    console.log('[场景6-partial] 已有维度 momentum.sectorStrengthScore:', result.momentum.sectorStrengthScore)
    console.log('[场景6-partial] 缺失维度 sentiment:', JSON.stringify(result.sentiment))
    console.log('[场景6-partial] 缺失维度 breakout:', JSON.stringify(result.breakout))
    console.log('[场景6-partial] 缺失维度 marketEnv:', JSON.stringify(result.marketEnv))

    // 已有维度保留
    expect(result.symbol).toBe('BK_PARTIAL')
    expect(result.momentum.sectorStrengthScore).toBe(4)
    // 缺失维度全部补默认值
    expect(result.sentiment).toEqual({ sentimentRank: 0, retailSentiment: 0, institutionBuyCount: 0, limitUpCount: 0 })
    expect(result.breakout).toEqual({ hasBreakoutPattern: false, rsiSignal: 'neutral', rsi: 50, priceAboveMA20: false, priceAboveMA60: false })
    expect(result.valuationRisk).toEqual({ pe: 0, pbPercentile: 0, marketCap: 0, dividendYield: 0 })
    expect(result.marketEnv).toEqual({ marketTrend: 'sideways', systemicRisk: 'medium' })
  })
})

// ============================================================
// 综合场景：所有脏数据类型混合
// ============================================================

describe('综合场景: 所有脏数据类型混合', () => {
  test('混合脏数据应全部被正确处理', () => {
    const mixedDirty: TencentSectorFlowRaw = {
      code: 'BK_MIXED',
      name: '混合脏数据板块',
      strength: 'invalid' as unknown as number,     // 非法字符串
      changeRank: null as unknown as number,         // null
      volumeRatio: 1.8,
      mainInflowDays: NaN,                            // NaN
      rs: '75' as unknown as number,                  // 合法字符串
      heatRank: undefined as unknown as number,       // undefined
      retailIndex: 0.6,
      instBuyCount: '' as unknown as number,          // 空字符串
      limitUpCount: 3,
      breakout: 'yes' as unknown as boolean,          // 非法 boolean
      macd: 'INVALID' as unknown as 'bullish',        // 非法枚举
      rsi: Infinity,                                  // Infinity
      aboveMA20: 1 as unknown as boolean,             // 数字 1
      aboveMA60: false,
      pe: '30.5' as unknown as number,                // 合法字符串
      pbPercentile: -Infinity,                        // -Infinity
      mktCap: 8000,
      divYield: null as unknown as number,            // null
      trend: 'bull',
      risk: 'unknown' as unknown as 'low',            // 非法枚举
    }
    const result = adaptToHotSector(mixedDirty)

    console.log('===== 综合场景输入 =====')
    console.log(JSON.stringify(mixedDirty, null, 2))
    console.log('===== 综合场景输出 =====')
    console.log(JSON.stringify(result, null, 2))

    // 验证：所有字段都是合法类型
    expect(typeof result.momentum.sectorStrengthScore).toBe('number')
    expect(Number.isFinite(result.momentum.sectorStrengthScore)).toBe(true)
    expect(Number.isFinite(result.momentum.priceChangeRank)).toBe(true)
    expect(Number.isFinite(result.momentum.consecutiveInflow)).toBe(true)
    expect(Number.isFinite(result.breakout.rsi)).toBe(true)
    expect(Number.isFinite(result.valuationRisk.pbPercentile)).toBe(true)

    // 验证：合法字符串数字被正确转换
    expect(result.momentum.relativeStrength).toBe(75)
    expect(result.valuationRisk.pe).toBe(30.5)

    // 验证：非法值回退到默认
    expect(result.momentum.sectorStrengthScore).toBe(0)
    expect(result.momentum.priceChangeRank).toBe(0)
    expect(result.momentum.consecutiveInflow).toBe(0)
    expect(result.sentiment.sentimentRank).toBe(0)
    expect(result.sentiment.institutionBuyCount).toBe(0)
    expect(result.valuationRisk.pbPercentile).toBe(0)
    expect(result.valuationRisk.dividendYield).toBe(0)

    // 验证：枚举回退
    expect(result.breakout.rsiSignal).toBe('neutral')
    expect(result.marketEnv.systemicRisk).toBe('medium')

    // 验证：保留的有效数据
    expect(result.symbol).toBe('BK_MIXED')
    expect(result.sectorName).toBe('混合脏数据板块')
    expect(result.momentum.volumeExpansion).toBe(1.8)
    expect(result.sentiment.retailSentiment).toBe(0.6)
    expect(result.sentiment.limitUpCount).toBe(3)
    expect(result.marketEnv.marketTrend).toBe('bull')
    expect(result.valuationRisk.marketCap).toBe(8000)
  })
})
