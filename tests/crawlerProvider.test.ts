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
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('crawlerProvider', () => {
  it('fetchEastMoneyHolderNumber 应解析股东户数', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ result: [{ endDate: '2026-12-31', holderNum: 120000, avgSharesPerHolder: 5000 }] }),
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
          data: {
            data: [
              { title: '年报公告', noticeDate: '2026-01-01 10:00', url: 'http://a.com' },
            ],
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

  it('fetchEastMoneyIndustry 应解析行业竞品', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { code: '600519', name: '贵州茅台', pe: 30, pb: 8 },
          ],
        }),
        { status: 200 },
      ),
    )

    const competitors = await fetchEastMoneyIndustry('600519.SH')
    expect(competitors).toHaveLength(1)
    expect(competitors[0].symbol).toBe('600519')
  })

  it('fetchEastMoneyResearch 应解析研报列表', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { title: '买入评级', author: '张三', orgName: '券商A', ratingName: '买入', publishDate: '2026-01-01', summary: '摘要' },
          ],
        }),
        { status: 200 },
      ),
    )

    const reports = await fetchEastMoneyResearch('600519.SH')
    expect(reports).toHaveLength(1)
    expect(reports[0].rating).toBe('买入')
  })

  it('fetch 失败时应返回空数组/null', async () => {
    globalFetch.mockResolvedValue(null as unknown as Response)
    const news = await fetchEastMoneyAnnouncements('600519.SH')
    expect(news).toHaveLength(0)
  })
})
