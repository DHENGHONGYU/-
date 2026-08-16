/**
 * @fileoverview fetchNews 合并逻辑单测（维度 04/05 质量提升）
 *
 * 验证 2026-08-16 修复：hot_news 维度并行取 westock(个股公告/新闻) + 腾讯新闻(泛资讯/行业舆情)，
 * 合并去重取前 10；westock 先 push 保优先级；announcement 维度腾讯新闻不参与（仅 westock）。
 *
 * 运行：npx vitest run src/services/data-collector/multiSourceFetcher.tencentnews.test.ts --pool=threads
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 仅替换两个取数函数，其余导出保持真实（避免破坏 multiSourceFetcher 的其他引用）
vi.mock('./westockMcpSource', async (importActual) => {
  const actual = await importActual<typeof import('./westockMcpSource')>()
  return { ...actual, fetchNewsViaWestock: vi.fn() }
})
vi.mock('./tencentNewsMcpSource', async (importActual) => {
  const actual = await importActual<typeof import('./tencentNewsMcpSource')>()
  return { ...actual, fetchNewsViaTencentNews: vi.fn() }
})

// 降级链守卫：让 Tushare/东财 跳过、新浪 safeFetch 返回 null，使「双源皆空」用例确定性返回 []
vi.mock('./adaptiveSourceOrchestrator', () => ({
  canExecute: vi.fn(() => false),
  recordSourceResult: vi.fn(),
}))
vi.mock('@/services/shared/safeFetch', () => ({
  safeFetch: vi.fn(async () => null),
}))

import { fetchNews } from './multiSourceFetcher'
import { fetchNewsViaWestock } from './westockMcpSource'
import { fetchNewsViaTencentNews } from './tencentNewsMcpSource'

const mk = (title: string, source: 'westock' | 'tencentnews', url?: string): any => ({
  id: url ?? title,
  title,
  content: 'c',
  source: source === 'westock' ? '腾讯自选股' : '腾讯新闻',
  date: '2026-08-16',
  category: 'hot_news',
  url,
  _source: source,
})

const westockMock = fetchNewsViaWestock as unknown as ReturnType<typeof vi.fn>
const tencentMock = fetchNewsViaTencentNews as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  westockMock.mockReset()
  tencentMock.mockReset()
})

describe('fetchNews — westock + 腾讯新闻 合并（维度 05 质量提升）', () => {
  it('hot_news：双源均有数据 → 合并去重取前 10，westock 优先', async () => {
    westockMock.mockResolvedValue([mk('A', 'westock', 'u-a'), mk('B', 'westock', 'u-b')])
    tencentMock.mockResolvedValue([mk('C', 'tencentnews', 'u-c'), mk('D', 'tencentnews', 'u-d')])
    const items = await fetchNews('sh600519', 'hot_news')
    expect(items.length).toBe(4)
    expect(items.map((i: any) => i._source)).toEqual(['westock', 'westock', 'tencentnews', 'tencentnews'])
    expect(new Set(items.map((i: any) => i.title)).size).toBe(4)
  })

  it('hot_news：同标题被去重（保留 westock 优先）', async () => {
    westockMock.mockResolvedValue([mk('X', 'westock', 'u-x')])
    tencentMock.mockResolvedValue([mk('X', 'tencentnews', 'u-x2')]) // 同标题不同 url
    const items = await fetchNews('sh600519', 'hot_news')
    expect(items.length).toBe(1)
    expect(items[0]._source).toBe('westock')
  })

  it('hot_news：westock 为空 → 仅腾讯新闻', async () => {
    westockMock.mockResolvedValue(null)
    tencentMock.mockResolvedValue([mk('C', 'tencentnews', 'u-c'), mk('D', 'tencentnews', 'u-d')])
    const items = await fetchNews('sh600519', 'hot_news')
    expect(items.length).toBe(2)
    expect(items.every((i: any) => i._source === 'tencentnews')).toBe(true)
  })

  it('hot_news：腾讯新闻为空 → 仅 westock', async () => {
    westockMock.mockResolvedValue([mk('A', 'westock', 'u-a')])
    tencentMock.mockResolvedValue(null)
    const items = await fetchNews('sh600519', 'hot_news')
    expect(items.length).toBe(1)
    expect(items[0]._source).toBe('westock')
  })

  it('hot_news：双源超 10 条 → 截断前 10（westock 前 8 优先）', async () => {
    westockMock.mockResolvedValue(Array.from({ length: 8 }, (_, i) => mk(`W${i}`, 'westock', `uw${i}`)))
    tencentMock.mockResolvedValue(Array.from({ length: 8 }, (_, i) => mk(`T${i}`, 'tencentnews', `ut${i}`)))
    const items = await fetchNews('sh600519', 'hot_news')
    expect(items.length).toBe(10)
    expect(items.slice(0, 8).every((i: any) => i._source === 'westock')).toBe(true)
    expect(items.slice(8).every((i: any) => i._source === 'tencentnews')).toBe(true)
  })

  it('announcement：腾讯新闻不参与（仅 westock），语义不变', async () => {
    westockMock.mockResolvedValue([mk('ANN', 'westock', 'u-ann')])
    tencentMock.mockResolvedValue([mk('SHOULD_NOT_APPEAR', 'tencentnews', 'u-bad')])
    const items = await fetchNews('sh600519', 'announcement')
    expect(tencentMock).not.toHaveBeenCalled()
    expect(items.length).toBe(1)
    expect(items[0]._source).toBe('westock')
  })

  it('hot_news：双源均失败/空 → 返回 []（走降级链，不抛）', async () => {
    westockMock.mockRejectedValue(new Error('westock down'))
    tencentMock.mockResolvedValue(null)
    const items = await fetchNews('sh600519', 'hot_news')
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBe(0)
  })
})
