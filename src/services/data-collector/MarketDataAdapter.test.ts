/**
 * MarketDataAdapter 单元测试 — 字段兜底（F04 体检项）
 *
 * 目标：验证"任意字段缺失 / 类型错误 / 极端脏数据"时，适配器始终返回
 * 合法默认值，下游组件读取不抛异常、不出现 undefined 必填字段。
 *
 * 这与 safeCoerce（永不抛异常、脏数据返回默认值）及 merge() 的 getDefault*()
 * 兜底共同构成本项体检的"绝不崩溃"保证。
 */
import { describe, it, expect } from 'vitest'
import { MarketDataAdapter } from '@/services/data-collector/MarketDataAdapter'
import type { RawMarketData } from '@/types/modules/widget.types'

const adapter = new MarketDataAdapter()

function raw(dataType: RawMarketData['dataType'], payload: unknown): RawMarketData {
  return { timestamp: Date.now(), source: 'mock', dataType, payload } as unknown as RawMarketData
}

// 对象类（非数组）数据类型
const OBJECT_TYPES: RawMarketData['dataType'][] = [
  'sentiment',
  'portfolio',
  'tradeReview',
  'analysisScores',
  'modelComparison',
  'poolBoard',
  'chatHistory',
]
// 数组类数据类型
const ARRAY_TYPES: RawMarketData['dataType'][] = [
  'indices',
  'sectors',
  'fundFlow',
  'watchlist',
  'hotSectors',
  'valuePit',
]

describe('MarketDataAdapter 字段兜底 (F04)', () => {
  it('对象类数据：payload 为 null/undefined 时返回合法默认值且不抛错', () => {
    for (const t of OBJECT_TYPES) {
      expect(() => adapter.adapt(raw(t, null))).not.toThrow()
      expect(() => adapter.adapt(raw(t, undefined))).not.toThrow()
      const r = adapter.adapt(raw(t, null))
      expect(r).toBeTypeOf('object')
      // 返回对象应含该类型的唯一键，且值定义良好
      const key = Object.keys(r)[0]
      expect(key).toBeTruthy()
    }
  })

  it('数组类数据：payload 非数组时返回空数组且不抛错', () => {
    for (const t of ARRAY_TYPES) {
      const r = adapter.adapt(raw(t, { not: 'array' }))
      const key = Object.keys(r)[0] as keyof typeof r
      expect(Array.isArray(r[key])).toBe(true)
    }
  })

  it('未知 dataType 返回空对象', () => {
    // 通过类型断言构造一个非法 dataType 以验证 default 分支
    adapter.adapt(raw('indices' as RawMarketData['dataType'], []))
    // 上面是合法值，这里单独验证 default 分支
    const weird = adapter.adapt({ timestamp: 1, source: 'mock', dataType: '__weird__', payload: {} } as unknown as RawMarketData)
    expect(weird).toEqual({})
  })

  it('字段全缺时各适配仍产出合法结构（不崩、必填字段非 undefined）', () => {
    const merged = adapter.merge(
      adapter.adapt(raw('indices', [{}])),
      adapter.adapt(raw('sentiment', {})),
      adapter.adapt(raw('portfolio', {})),
      adapter.adapt(raw('tradeReview', {})),
      adapter.adapt(raw('analysisScores', {})),
      adapter.adapt(raw('poolBoard', {})),
    )
    // 顶层字段齐全
    expect(Array.isArray(merged.indices)).toBe(true)
    expect(merged.sentiment).toBeDefined()
    expect(merged.portfolio).toBeDefined()
    expect(merged.tradeReview).toBeDefined()
    expect(merged.analysisScores).toBeDefined()
    expect(merged.poolBoard).toBeDefined()
    // 嵌套必填字段为安全类型（非 undefined）
    expect(merged.indices.length).toBe(1)
    expect(typeof merged.indices[0]?.price).toBe('number')
    expect(typeof merged.sentiment.fearGreedIndex).toBe('number')
    expect(typeof merged.portfolio.totalAssets).toBe('string')
    expect(typeof merged.tradeReview.winRate).toBe('number')
    expect(merged.analysisScores.kai).toBeDefined()
  })

  it('merge() 无输入返回完整默认值，必填字段均非 undefined', () => {
    const m = adapter.merge()
    expect(m.indices).toEqual([])
    expect(m.sentiment.fearGreedIndex).toBe(50)
    expect(m.sentiment.fearGreedLabel).toBe('中性')
    expect(m.portfolio.totalAssets).toBe('0')
    expect(m.tradeReview.winRate).toBe(0)
    expect(m.analysisScores.kai).toBeDefined()
    expect(m.poolBoard).toBeDefined()
  })

  it('极端脏数据（字段为错误类型/超大数/NaN/Infinity）不抛错', () => {
    const dirty = raw('indices', [
      { code: null, price: 'not-a-number', changePercent: NaN, high: Infinity, volume: {} },
      { price: Number.MAX_VALUE, change: 'abc' },
    ])
    expect(() => adapter.adapt(dirty)).not.toThrow()
    const r = adapter.adapt(dirty)
    const arr = r.indices as unknown[]
    expect(Array.isArray(arr)).toBe(true)
    expect(arr.length).toBe(2)
    // 脏数值被 coerce 为安全数字
    expect(typeof (arr[0] as { price: number }).price).toBe('number')
  })

  it('多片段 merge 中混入 undefined 片段不抛错', () => {
    expect(() =>
      adapter.merge(
        adapter.adapt(raw('sentiment', null)),
        undefined as unknown as Partial<import('@/types/modules/widget.types').MarketData>,
        adapter.adapt(raw('portfolio', {})),
      ),
    ).not.toThrow()
  })
})
