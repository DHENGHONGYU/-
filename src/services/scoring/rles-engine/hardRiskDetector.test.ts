import { describe, it, expect, vi, afterEach } from 'vitest'
import { matchForbidden, detectHardRisks, FORBIDDEN_STOCKS, fetchStockRiskFlagsLive } from './hardRiskDetector'

const SAMPLE_LIST = {
  '600000': { reason: '已公告终止上市', category: 'delisting' as const },
  '000001': { reason: '被实施其他风险警示', category: 'st' as const },
}

describe('hardRiskDetector（三条禁令）', () => {
  it('命中返回 category:reason 标签', () => {
    expect(matchForbidden('600000', SAMPLE_LIST)).toEqual(['delisting:已公告终止上市'])
  })

  it('未命中返回空数组', () => {
    expect(matchForbidden('300750', SAMPLE_LIST)).toEqual([])
  })

  it('detectHardRisks 基于 FORBIDDEN_STOCKS（当前为空占位，不误伤）', () => {
    expect(detectHardRisks('600000')).toEqual([])
    expect(Object.keys(FORBIDDEN_STOCKS).length).toBe(0)
  })
})

describe('fetchStockRiskFlagsLive（后端 /api/collect/risk 真实源）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功响应映射为 flags 数组', async () => {
    const fake = { success: true, data: { flags: ['st:名称含ST风险警示'] } }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => fake }) as Response))
    const r = await fetchStockRiskFlagsLive('600001')
    expect(r).toEqual(['st:名称含ST风险警示'])
  })

  it('HTTP 非 2xx → 返回 null（触发 resilient 回退）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response))
    expect(await fetchStockRiskFlagsLive('600001')).toBeNull()
  })

  it('后端无 flags 字段 → 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: {} }) }) as Response))
    expect(await fetchStockRiskFlagsLive('600001')).toBeNull()
  })

  it('网络异常 → 返回 null（安全降级）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await fetchStockRiskFlagsLive('600001')).toBeNull()
  })
})
