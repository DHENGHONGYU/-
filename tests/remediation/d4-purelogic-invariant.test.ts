/**
 * D4 深度嵌套平铺整改 — 纯逻辑行为不变量回归测试
 *
 * 覆盖范围（38 文件逻辑嵌套清单中无既有测试、且平铺最易引入行为偏差的纯逻辑模块）：
 *  - src/services/news/sentimentAnalyzer.ts   （D12 情感判定 helper 提取）
 *  - src/services/input/batchImportParsers.ts   （D9  解析 helper 提取）
 *  - src/services/trading/tradeErrorDetectors.ts（D15 判定 helper 提取）
 *
 * 目的：锁定「深层嵌套 → 卫语句/helper 平铺」后，导出纯函数的输入/输出语义不变。
 * 这些函数无 DB / 无副作用，断言确定性、可复现。
 */
import { describe, it, expect } from 'vitest'
import type { Order } from '@/data/types'
import {
  analyzeText,
  classifySentiment,
  analyzeNewsArticle,
  hashContent,
} from '@/services/news/sentimentAnalyzer'
import {
  detectExchange,
  parseBulkInput,
  parseCsvText,
} from '@/services/input/batchImportParsers'
import {
  detectHeavyGambling,
  detectPlanViolation,
  detectAgainstTrendAdding,
  detectRevengeTrading,
  detectHesitationMiss,
  detectOvertrading,
  detectChaseHighSellLow,
} from '@/services/trading/tradeErrorDetectors'
import { TradeErrorType } from '@/services/trading/tradeErrorDefinitions'

// ============================================================
// 辅助：构造最小合法 Order
// ============================================================
function makeOrder(p: Partial<Order> & Pick<Order, 'id' | 'symbol' | 'direction' | 'price' | 'createdAt'> & { amount?: number }): Order {
  return {
    quantity: 100,
    status: 'filled',
    accountType: 'paper',
    amount: 100,
    ...p,
  } as Order
}

// ============================================================
// 1. sentimentAnalyzer —— D12 情感判定 helper 提取
// ============================================================
describe('D4 纯逻辑不变量 · sentimentAnalyzer', () => {
  it('classifySentiment 边界：正/负/中性三态 + 自定义阈值', () => {
    expect(classifySentiment(0.5)).toBe('positive')
    expect(classifySentiment(-0.5)).toBe('negative')
    expect(classifySentiment(0)).toBe('neutral')
    expect(classifySentiment(0.05)).toBe('neutral') // 默认阈值 0.1
    expect(classifySentiment(0.05, 0.02)).toBe('positive') // 放宽阈值后越过
  })

  it('analyzeText 单文本情感方向正确（词典命中即判定）', () => {
    expect(analyzeText('大涨 利好 涨停').sentiment).toBe('positive')
    expect(analyzeText('暴跌 亏损 利空').sentiment).toBe('negative')
    expect(analyzeText('今日天气晴朗').sentiment).toBe('neutral')
    // 否定词反转：含正面词但被否定 → 不应为 positive
    expect(analyzeText('并未大涨').sentiment).not.toBe('positive')
  })

  it('analyzeNewsArticle 标题/正文权重融合，空输入为中性', () => {
    const titleOnly = analyzeNewsArticle({ title: '大涨', content: '' })
    expect(titleOnly.sentiment).toBe('positive')
    expect(titleOnly.score).toBeGreaterThan(0)

    const empty = analyzeNewsArticle({ title: '', content: '' })
    expect(empty.sentiment).toBe('neutral')
    expect(empty.score).toBe(0)
  })

  it('hashContent 稳定可复现，不同输入不同哈希', () => {
    const a = hashContent('贵州茅台 600519')
    const b = hashContent('贵州茅台 600519')
    const c = hashContent('五粮液 000858')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
  })
})

// ============================================================
// 2. batchImportParsers —— D9 解析 helper 提取
// ============================================================
describe('D4 纯逻辑不变量 · batchImportParsers', () => {
  it('detectExchange 按代码规则推断交易所', () => {
    expect(detectExchange('600000')).toBe('SH') // 6 开头
    expect(detectExchange('000001')).toBe('SZ') // 非 6 开头
    expect(detectExchange('12345')).toBe('') // 非 6 位
    expect(detectExchange('abc')).toBe('')
  })

  it('parseBulkInput 多格式解析 + 无效行标记', () => {
    const text = [
      '600519,贵州茅台', // 格式1
      '600519.SH,贵州茅台', // 格式2
      '600519', // 格式4 纯代码
      'abc,foo', // 无效
      '', // 空行被过滤
    ].join('\n')

    const rows = parseBulkInput(text)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ code: '600519', name: '贵州茅台', symbol: '600519.SH', status: 'valid' })
    expect(rows[1]).toMatchObject({ code: '600519', symbol: '600519.SH', status: 'valid' })
    expect(rows[2]).toMatchObject({ code: '600519', symbol: '600519.SH', status: 'valid' })
    expect(rows[3]!.status).toBe('invalid')
  })

  it('parseBulkInput 空文本返回空数组', () => {
    expect(parseBulkInput('   \n  ')).toEqual([])
  })

  it('parseCsvText 自动跳过表头行', () => {
    const csv = '代码,名称\n600519,贵州茅台\n000001,平安银行'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ code: '600519', name: '贵州茅台' })
    expect(rows[1]).toMatchObject({ code: '000001', name: '平安银行' })
  })
})

// ============================================================
// 3. tradeErrorDetectors —— D15 判定 helper 提取（独立型检测器）
// ============================================================
describe('D4 纯逻辑不变量 · tradeErrorDetectors', () => {
  it('detectHeavyGambling：单标的集中度 > 50% 命中，均衡分布返回 null', () => {
    const concentrated = [
      makeOrder({ id: 'a', symbol: '600519', amount: 100_000, price: 100, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '600519', amount: 100_000, price: 101, direction: 'buy', createdAt: 2 }),
    ]
    const r1 = detectHeavyGambling(concentrated)
    expect(r1?.type).toBe(TradeErrorType.HEAVY_GAMBLING)

    const balanced = [
      makeOrder({ id: 'a', symbol: '600519', amount: 100, price: 100, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '000001', amount: 100, price: 10, direction: 'buy', createdAt: 2 }),
    ]
    expect(detectHeavyGambling(balanced)).toBeNull()
  })

  it('detectPlanViolation：单笔仓位 > 30% 总资金命中，均衡返回 null', () => {
    const violation = [
      makeOrder({ id: 'a', symbol: '600519', amount: 100, price: 100, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '000001', amount: 1000, price: 10, direction: 'buy', createdAt: 2 }),
    ]
    expect(detectPlanViolation(violation)?.type).toBe(TradeErrorType.PLAN_VIOLATION)

    const ok = [
      makeOrder({ id: 'a', symbol: '600519', amount: 100, price: 100, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '000001', amount: 100, price: 10, direction: 'buy', createdAt: 2 }),
      makeOrder({ id: 'c', symbol: '600519', amount: 100, price: 100, direction: 'buy', createdAt: 3 }),
      makeOrder({ id: 'd', symbol: '000001', amount: 100, price: 10, direction: 'buy', createdAt: 4 }),
    ]
    expect(detectPlanViolation(ok)).toBeNull()
  })

  it('detectAgainstTrendAdding：同标的连续 ≥2 次递减加仓命中，递增返回 null', () => {
    const decreasing = [
      makeOrder({ id: 'a', symbol: '600519', price: 100, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '600519', price: 90, direction: 'buy', createdAt: 2 }),
      makeOrder({ id: 'c', symbol: '600519', price: 80, direction: 'buy', createdAt: 3 }),
    ]
    expect(detectAgainstTrendAdding(decreasing)?.type).toBe(TradeErrorType.AGAINST_TREND_ADDING)

    const increasing = [
      makeOrder({ id: 'a', symbol: '600519', price: 80, direction: 'buy', createdAt: 1 }),
      makeOrder({ id: 'b', symbol: '600519', price: 90, direction: 'buy', createdAt: 2 }),
      makeOrder({ id: 'c', symbol: '600519', price: 100, direction: 'buy', createdAt: 3 }),
    ]
    expect(detectAgainstTrendAdding(increasing)).toBeNull()
  })

  it('detectRevengeTrading：30 分钟内 ≥3 笔买入命中，2 笔返回 null', () => {
    const revenge = [
      makeOrder({ id: 'a', symbol: '600519', price: 100, direction: 'buy', createdAt: 0 }),
      makeOrder({ id: 'b', symbol: '600519', price: 100, direction: 'buy', createdAt: 60_000 }),
      makeOrder({ id: 'c', symbol: '600519', price: 100, direction: 'buy', createdAt: 120_000 }),
      makeOrder({ id: 'd', symbol: '600519', price: 100, direction: 'buy', createdAt: 180_000 }),
    ]
    expect(detectRevengeTrading(revenge)?.type).toBe(TradeErrorType.REVENGE_TRADING)

    const calm = [
      makeOrder({ id: 'a', symbol: '600519', price: 100, direction: 'buy', createdAt: 0 }),
      makeOrder({ id: 'b', symbol: '600519', price: 100, direction: 'buy', createdAt: 60_000 }),
    ]
    expect(detectRevengeTrading(calm)).toBeNull()
  })

  it('detectHesitationMiss：交易间隔 > 1 周命中，间隔短返回 null', () => {
    const gap = [
      makeOrder({ id: 'a', symbol: '600519', price: 100, direction: 'buy', createdAt: 0 }),
      makeOrder({ id: 'b', symbol: '600519', price: 100, direction: 'buy', createdAt: 10 * 24 * 60 * 60 * 1000 }),
    ]
    expect(detectHesitationMiss(gap)?.type).toBe(TradeErrorType.HESITATION_MISS)

    const close = [
      makeOrder({ id: 'a', symbol: '600519', price: 100, direction: 'buy', createdAt: 0 }),
      makeOrder({ id: 'b', symbol: '600519', price: 100, direction: 'buy', createdAt: 1 * 24 * 60 * 60 * 1000 }),
    ]
    expect(detectHesitationMiss(close)).toBeNull()
  })

  it('detectOvertrading：单日 > 10 笔命中，≤10 笔返回 null', () => {
    const day = Array.from({ length: 12 }, (_, i) =>
      makeOrder({ id: `d${i}`, symbol: '600519', price: 100, direction: 'buy', createdAt: i * 1000 }),
    )
    const groups = new Map<string, Order[]>([['2026-01-01', day]])
    expect(detectOvertrading(day, groups)?.type).toBe(TradeErrorType.OVERTRADING)

    const few = Array.from({ length: 5 }, (_, i) =>
      makeOrder({ id: `f${i}`, symbol: '600519', price: 100, direction: 'buy', createdAt: i * 1000 }),
    )
    expect(detectOvertrading(few, new Map([['2026-01-01', few]]))).toBeNull()
  })

  it('detectChaseHighSellLow：买入后 1 日内低价卖出（亏损>5%）命中', () => {
    const orders = [
      makeOrder({ id: 'buy1', symbol: '600519', direction: 'buy', price: 100, amount: 1000, createdAt: 0 }),
      makeOrder({ id: 'sell1', symbol: '600519', direction: 'sell', price: 90, amount: 1000, createdAt: 3_600_000 }),
    ]
    expect(detectChaseHighSellLow(orders, new Map())?.type).toBe(TradeErrorType.CHASE_HIGH_SELL_LOW)

    const ok = [
      makeOrder({ id: 'buy1', symbol: '600519', direction: 'buy', price: 100, amount: 1000, createdAt: 0 }),
      makeOrder({ id: 'sell1', symbol: '600519', direction: 'sell', price: 99, amount: 1000, createdAt: 3_600_000 }),
    ]
    expect(detectChaseHighSellLow(ok, new Map())).toBeNull()
  })
})
