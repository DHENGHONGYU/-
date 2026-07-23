/**
 * @test_id V9-TEST-UT-006
 * @covers_docs []
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchEastMoneyHolderNumber,
  fetchEastMoneyAnnouncements,
  fetchEastMoneyIndustry,
  fetchEastMoneyResearch,
} from '@/services/data-collector/crawlerProvider'

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const globalFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()

beforeEach(() => {
  vi.stubGlobal('fetch', globalFetch)
  // 兜底：Node 21+ 的 globalThis.fetch 为不可配置 getter，vi.stubGlobal 静默失效，
  // 真实 undici fetch 会校验 AbortSignal 而抛错。用 defineProperty 强制覆盖。
  try {
    Object.defineProperty(globalThis, 'fetch', {
      value: globalFetch,
      configurable: true,
      writable: true,
    })
  } catch {
    /* 已是 stubGlobal 生效 */
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('crawlerProvider', () => {
  it('fetchEastMoneyHolderNumber 应解析股东户数', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          // 对齐 crawlerProvider 解析（curl 验证的真实东财 F10 形状：gdrs / HOLDER_TOTAL_NUM / END_DATE）
          gdrs: [{ END_DATE: '2026-12-31', HOLDER_TOTAL_NUM: 120000, TOTAL_NUM_RATIO: 2, AVG_FREE_SHARES: 5000, HOLD_FOCUS: '较集中' }],
        }),
        { status: 200 },
      ),
    )

    const chip = await fetchEastMoneyHolderNumber('600519.SH')
    expect(chip).not.toBeNull()
    expect(chip?.shareholderCount).toBe(120000)
    expect(chip?.date).toBe('2026-12-31')
  })

  it('fetchEastMoneyAnnouncements 应解析公告列表', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          // 对齐解析：success===1 且 data.list 含 art_code / title / notice_date
          success: 1,
          data: {
            list: [{ art_code: 'A1', title: '年报公告', notice_date: '2026-01-01 10:00' }],
          },
        }),
        { status: 200 },
      ),
    )

    const news = await fetchEastMoneyAnnouncements('600519.SH')
    expect(news).toHaveLength(1)
    expect(news[0].title).toBe('年报公告')
    expect(news[0].category).toBe('announcement')
  })

  it('fetchEastMoneyIndustry 端点禁用（反爬）时应返回空数组', async () => {
    // EASTMONEY_INDUSTRY_API_UNAVAILABLE=true：curl 验证 push2 反爬拦截，函数早退返回 []
    const competitors = await fetchEastMoneyIndustry('600519.SH')
    expect(competitors).toHaveLength(0)
  })

  it('fetchEastMoneyResearch 端点禁用（stockCode 过滤无效）时应返回空数组', async () => {
    // EASTMONEY_RESEARCH_API_UNAVAILABLE=true：研报端点无法按股票筛选，函数早退返回 []
    const reports = await fetchEastMoneyResearch('600519.SH')
    expect(reports).toHaveLength(0)
  })

  it('fetch 失败时应返回空数组/null', async () => {
    globalFetch.mockResolvedValue(null as unknown as Response)
    const news = await fetchEastMoneyAnnouncements('600519.SH')
    expect(news).toHaveLength(0)
  })
})
