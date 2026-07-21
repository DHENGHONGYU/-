/**
 * @test_id V9-TEST-ST-081-a
 * DataBridge 层 normalize 函数专项单元测试
 *
 * 测试目标：
 * - normalizeSentiment / normalizeMomentum / normalizeBreakout
 *   / normalizeValuationRisk / normalizeMarketEnv 五个维度规范化函数
 *
 * 测试维度：
 * - 正常输入：完整合法数据保持不变
 * - 边界输入：null / undefined / 空字符串 / 0 / false
 * - 非法输入：NaN / Infinity / 非法枚举 / 类型不符
 * - 极端输入：对象为 null / 字段为对象 / 字段为数组
 *
 * 运行命令：
 *   npm test -- --run src/services/fetcher/strategyDataAdapter.normalize.test.ts
 * @covers_docs [V9-DOC-PROJ-092, V9-DOC-BACK-003, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-QA-010]
*/
import { describe, test, expect } from 'vitest'
import {
  normalizeSentiment,
  normalizeMomentum,
  normalizeBreakout,
  normalizeValuationRisk,
  normalizeMarketEnv,
} from './strategyDataAdapter'

// ============================================================
// normalizeSentiment
// ============================================================

describe('normalizeSentiment', () => {
  test('完整数据保持不变', () => {
    const input = {
      sentimentRank: 5,
      retailSentiment: 0.7,
      institutionBuyCount: 3,
      limitUpCount: 2,
    }
    expect(normalizeSentiment(input)).toEqual(input)
  })

  test('用户报告场景：缺 institutionBuyCount 和 limitUpCount', () => {
    const result = normalizeSentiment({
      sentimentRank: 10,
      retailSentiment: 0.4,
    })
    expect(result).toEqual({
      sentimentRank: 10,
      retailSentiment: 0.4,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })

  test('所有字段缺失返回完整默认值', () => {
    expect(normalizeSentiment({})).toEqual({
      sentimentRank: 0,
      retailSentiment: 0,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })

  test('null 返回完整默认值', () => {
    expect(normalizeSentiment(null)).toEqual({
      sentimentRank: 0,
      retailSentiment: 0,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })

  test('undefined 返回完整默认值', () => {
    expect(normalizeSentiment(undefined)).toEqual({
      sentimentRank: 0,
      retailSentiment: 0,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })

  test('字符串数字字段正确转换', () => {
    const result = normalizeSentiment({
      sentimentRank: '5',
      retailSentiment: '0.6',
      institutionBuyCount: '3',
      limitUpCount: '2',
    })
    expect(result).toEqual({
      sentimentRank: 5,
      retailSentiment: 0.6,
      institutionBuyCount: 3,
      limitUpCount: 2,
    })
  })

  test('NaN 字段返回默认值', () => {
    const result = normalizeSentiment({
      sentimentRank: NaN,
      retailSentiment: Infinity,
      institutionBuyCount: -Infinity,
      limitUpCount: 'abc',
    })
    expect(result).toEqual({
      sentimentRank: 0,
      retailSentiment: 0,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })

  test('null 字段返回默认值', () => {
    const result = normalizeSentiment({
      sentimentRank: null,
      retailSentiment: null,
      institutionBuyCount: null,
      limitUpCount: null,
    })
    expect(result).toEqual({
      sentimentRank: 0,
      retailSentiment: 0,
      institutionBuyCount: 0,
      limitUpCount: 0,
    })
  })
})

// ============================================================
// normalizeMomentum
// ============================================================

describe('normalizeMomentum', () => {
  test('完整数据保持不变', () => {
    const input = {
      sectorStrengthScore: 4.5,
      priceChangeRank: 2,
      volumeExpansion: 1.8,
      consecutiveInflow: 5,
      relativeStrength: 75,
    }
    expect(normalizeMomentum(input)).toEqual(input)
  })

  test('所有字段缺失返回完整默认值', () => {
    expect(normalizeMomentum({})).toEqual({
      sectorStrengthScore: 0,
      priceChangeRank: 0,
      volumeExpansion: 0,
      consecutiveInflow: 0,
      relativeStrength: 0,
    })
  })

  test('null 返回完整默认值', () => {
    expect(normalizeMomentum(null)).toEqual({
      sectorStrengthScore: 0,
      priceChangeRank: 0,
      volumeExpansion: 0,
      consecutiveInflow: 0,
      relativeStrength: 0,
    })
  })

  test('部分字段为字符串数字时正确转换', () => {
    const result = normalizeMomentum({
      sectorStrengthScore: '4.5',
      priceChangeRank: 2,
      volumeExpansion: '1.8',
      consecutiveInflow: 5,
      relativeStrength: '75',
    })
    expect(result).toEqual({
      sectorStrengthScore: 4.5,
      priceChangeRank: 2,
      volumeExpansion: 1.8,
      consecutiveInflow: 5,
      relativeStrength: 75,
    })
  })

  test('NaN/Infinity 字段返回默认值', () => {
    const result = normalizeMomentum({
      sectorStrengthScore: NaN,
      priceChangeRank: Infinity,
      volumeExpansion: -Infinity,
      consecutiveInflow: 'abc',
      relativeStrength: null,
    })
    expect(result).toEqual({
      sectorStrengthScore: 0,
      priceChangeRank: 0,
      volumeExpansion: 0,
      consecutiveInflow: 0,
      relativeStrength: 0,
    })
  })
})

// ============================================================
// normalizeBreakout
// ============================================================

describe('normalizeBreakout', () => {
  test('完整数据保持不变', () => {
    const input = {
      hasBreakoutPattern: true,
      rsiSignal: 'bullish' as const,
      rsi: 65,
      priceAboveMA20: true,
      priceAboveMA60: false,
    }
    expect(normalizeBreakout(input)).toEqual(input)
  })

  test('所有字段缺失返回完整默认值', () => {
    expect(normalizeBreakout({})).toEqual({
      hasBreakoutPattern: false,
      rsiSignal: 'neutral',
      rsi: 50,
      priceAboveMA20: false,
      priceAboveMA60: false,
    })
  })

  test('null 返回完整默认值（rsi 默认 50，非 0）', () => {
    const result = normalizeBreakout(null)
    expect(result).toEqual({
      hasBreakoutPattern: false,
      rsiSignal: 'neutral',
      rsi: 50,
      priceAboveMA20: false,
      priceAboveMA60: false,
    })
  })

  test('非法枚举 rsiSignal 回退到 neutral', () => {
    const result = normalizeBreakout({
      hasBreakoutPattern: true,
      rsiSignal: 'invalid_signal',
      rsi: 65,
      priceAboveMA20: true,
      priceAboveMA60: false,
    })
    expect(result.rsiSignal).toBe('neutral')
    expect(result.hasBreakoutPattern).toBe(true)
    expect(result.rsi).toBe(65)
  })

  test('rsi 为 NaN 时回退到默认 50（非 0）', () => {
    const result = normalizeBreakout({
      hasBreakoutPattern: true,
      rsiSignal: 'bullish',
      rsi: NaN,
      priceAboveMA20: true,
      priceAboveMA60: false,
    })
    expect(result.rsi).toBe(50)
  })

  test('hasBreakoutPattern 为数字 1 时转换为 true', () => {
    const result = normalizeBreakout({
      hasBreakoutPattern: 1,
      rsiSignal: 'bullish',
      rsi: 65,
      priceAboveMA20: 1,
      priceAboveMA60: 0,
    })
    expect(result.hasBreakoutPattern).toBe(true)
    expect(result.priceAboveMA20).toBe(true)
    expect(result.priceAboveMA60).toBe(false)
  })

  test('hasBreakoutPattern 为 "yes" 时回退到默认 false', () => {
    const result = normalizeBreakout({
      hasBreakoutPattern: 'yes',
      rsiSignal: 'bullish',
      rsi: 65,
      priceAboveMA20: true,
      priceAboveMA60: false,
    })
    expect(result.hasBreakoutPattern).toBe(false)
  })
})

// ============================================================
// normalizeValuationRisk
// ============================================================

describe('normalizeValuationRisk', () => {
  test('完整数据保持不变', () => {
    const input = {
      pe: 55,
      pbPercentile: 65,
      marketCap: 5000,
      dividendYield: 0.8,
    }
    expect(normalizeValuationRisk(input)).toEqual(input)
  })

  test('所有字段缺失返回完整默认值', () => {
    expect(normalizeValuationRisk({})).toEqual({
      pe: 0,
      pbPercentile: 0,
      marketCap: 0,
      dividendYield: 0,
    })
  })

  test('null 返回完整默认值', () => {
    expect(normalizeValuationRisk(null)).toEqual({
      pe: 0,
      pbPercentile: 0,
      marketCap: 0,
      dividendYield: 0,
    })
  })

  test('字符串数字字段正确转换', () => {
    const result = normalizeValuationRisk({
      pe: '55',
      pbPercentile: '65.5',
      marketCap: '5000',
      dividendYield: '0.8',
    })
    expect(result).toEqual({
      pe: 55,
      pbPercentile: 65.5,
      marketCap: 5000,
      dividendYield: 0.8,
    })
  })

  test('NaN/Infinity 字段返回默认值', () => {
    const result = normalizeValuationRisk({
      pe: NaN,
      pbPercentile: Infinity,
      marketCap: -Infinity,
      dividendYield: 'abc',
    })
    expect(result).toEqual({
      pe: 0,
      pbPercentile: 0,
      marketCap: 0,
      dividendYield: 0,
    })
  })
})

// ============================================================
// normalizeMarketEnv
// ============================================================

describe('normalizeMarketEnv', () => {
  test('完整数据保持不变', () => {
    const input = {
      marketTrend: 'bull' as const,
      systemicRisk: 'low' as const,
    }
    expect(normalizeMarketEnv(input)).toEqual(input)
  })

  test('所有字段缺失返回完整默认值', () => {
    expect(normalizeMarketEnv({})).toEqual({
      marketTrend: 'sideways',
      systemicRisk: 'medium',
    })
  })

  test('null 返回完整默认值', () => {
    expect(normalizeMarketEnv(null)).toEqual({
      marketTrend: 'sideways',
      systemicRisk: 'medium',
    })
  })

  test('非法枚举 marketTrend 回退到 sideways', () => {
    const result = normalizeMarketEnv({
      marketTrend: 'unknown_trend',
      systemicRisk: 'low',
    })
    expect(result.marketTrend).toBe('sideways')
    expect(result.systemicRisk).toBe('low')
  })

  test('非法枚举 systemicRisk 回退到 medium', () => {
    const result = normalizeMarketEnv({
      marketTrend: 'bull',
      systemicRisk: 'extreme',
    })
    expect(result.marketTrend).toBe('bull')
    expect(result.systemicRisk).toBe('medium')
  })

  test('大小写敏感：Bull 不匹配 bull', () => {
    const result = normalizeMarketEnv({
      marketTrend: 'Bull',
      systemicRisk: 'Low',
    })
    expect(result.marketTrend).toBe('sideways')
    expect(result.systemicRisk).toBe('medium')
  })

  test('数字输入返回默认值', () => {
    const result = normalizeMarketEnv({
      marketTrend: 123,
      systemicRisk: 0,
    })
    expect(result.marketTrend).toBe('sideways')
    expect(result.systemicRisk).toBe('medium')
  })

  test('null 字段返回默认值', () => {
    const result = normalizeMarketEnv({
      marketTrend: null,
      systemicRisk: null,
    })
    expect(result.marketTrend).toBe('sideways')
    expect(result.systemicRisk).toBe('medium')
  })
})
