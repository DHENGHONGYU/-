import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeBreadthScore, fetchMarketBreadthLive } from './breadthFactor'

describe('computeBreadthScore (MAS 市场宽度)', () => {
  it('强多头市场（涨多跌少 + 涨停潮）→ 高分', () => {
    const score = computeBreadthScore({
      up: 4000,
      down: 1000,
      totalStocks: 5300,
      limitUp: 120,
      limitDown: 10,
    })
    expect(score).toBeGreaterThan(80)
  })

  it('强空头市场（跌多涨少 + 跌停潮）→ 低分', () => {
    const score = computeBreadthScore({
      up: 800,
      down: 4200,
      totalStocks: 5300,
      limitUp: 10,
      limitDown: 200,
    })
    expect(score).toBeLessThan(30)
  })

  it('涨跌各半、涨跌停均衡 → 接近 50（中性）', () => {
    const score = computeBreadthScore({
      up: 2500,
      down: 2500,
      totalStocks: 5300,
      limitUp: 50,
      limitDown: 50,
    })
    expect(score).toBeGreaterThan(45)
    expect(score).toBeLessThan(55)
  })
})

describe('fetchMarketBreadthLive（后端 /api/collect/breadth 真实源）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功响应映射为 MarketBreadthInput（含 flat 兜底）', async () => {
    const fake = {
      success: true,
      data: { up: 100, down: 50, totalStocks: 155, limitUp: 10, limitDown: 3 },
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => fake }) as Response))
    const r = await fetchMarketBreadthLive()
    expect(r).toEqual({ up: 100, down: 50, flat: 0, totalStocks: 155, limitUp: 10, limitDown: 3 })
  })

  it('HTTP 非 2xx → 返回 null（触发 resilient 回退 mock）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response))
    expect(await fetchMarketBreadthLive()).toBeNull()
  })

  it('后端 success=false 或 totalStocks<=0 → 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: false }) }) as Response))
    expect(await fetchMarketBreadthLive()).toBeNull()
  })

  it('网络异常 → 返回 null（安全降级）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await fetchMarketBreadthLive()).toBeNull()
  })
})
