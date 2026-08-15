/**
 * @fileoverview tencentNewsMcpSource 单元测试
 *
 * 覆盖维度 04/05 经 MCP(marketdata:tencentnews) 调用腾讯新闻 SKILL 的适配层：
 * - 成功路径：CLI 可读文本 → parseTencentNewsText → NewsItem[]（_source=tencentnews, category=hot_news）
 * - announcement 类：腾讯新闻无个股公告维度 → 直接返回 null 降级
 * - CLI 显式错误（isError）：返回 null 并记 recordSourceResult(false)
 * - 调用异常：捕获后降级返回 null 并记 recordSourceResult(false)
 * - 源熔断（canExecute=false）：直接跳过，不发起调用
 * - 行业检索 fetchIndustryNewsViaTencentNews：按关键词 search → NewsItem[]
 *
 * 注意：腾讯新闻 Server 的 toToolResult 对字符串入参「原样返回」（不做 JSON.stringify），
 *       故 MCP ToolResult.content[0].text 即 CLI 可读文本（含真实换行），本测试据此构造。
 *
 * 运行：npx vitest run src/services/data-collector/tencentNewsMcpSource.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 先 mock 依赖，再 import 被测模块
vi.mock('@/mcp/bridge/mcpBridge', () => ({
  mcpBridge: {
    callTool: vi.fn(),
  },
}))

vi.mock('./adaptiveSourceOrchestrator', () => ({
  canExecute: vi.fn(() => true),
  recordSourceResult: vi.fn(),
}))

import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import {
  fetchNewsViaTencentNews,
  fetchIndustryNewsViaTencentNews,
  parseTencentNewsText,
} from './tencentNewsMcpSource'

const callToolMock = mcpBridge.callTool as unknown as ReturnType<typeof vi.fn>
const canExecuteMock = canExecute as unknown as ReturnType<typeof vi.fn>
const recordMock = recordSourceResult as unknown as ReturnType<typeof vi.fn>

/** 构造字符串文本型 MCP ToolResult（与 Server 对字符串入参原样返回一致） */
function okText(text: string) {
  return { content: [{ type: 'text', text }], isError: false }
}
function errResult(text: string) {
  return { content: [{ type: 'text', text }], isError: true }
}

const HOT_TEXT = `【腾讯新闻 - 热点榜】 2026-08-16 00:03

1. 标题：纪念江泽民同志诞辰100周年大会17日上午在京隆重举行
   摘要: 新华社北京8月15日电 纪念江泽民同志诞辰100周年大会将于8月17日举行。
   来源: 新华社新闻
   发布时间: 2026-08-15 20:00
   链接: https://view.inews.qq.com/a/20260815A0C23G00?scene=news-skill

2. 标题：国防部：日方若一意孤行
   摘要: 国防部新闻发言人蒋斌就日本政要参拜靖国神社答记者问。
   来源: 央视新闻
   发布时间: 2026-08-15 17:39
   链接: https://view.inews.qq.com/a/20260815A0AN8100?scene=news-skill
`

const MORNING_TEXT = `【腾讯新闻 - 早报】 2026-08-16 00:03
每天早上6点30更新

1. 标题：纪念江泽民同志诞辰100周年大会17日上午在京隆重举行
   摘要：纪念江泽民同志诞辰100周年大会将于8月17日上午10时举行。
   链接：https://view.inews.qq.com/a/20260815A0C23G00?scene=news-skill
`

const SEARCH_TEXT = `【腾讯新闻 - 搜索「数据采集」】 2026-08-16 00:04

1. 标题：2026上半年：机器人还没落地，数据采集先赚到钱了
   摘要: 印度班加罗尔，一位家政人员上门服务，她微笑询问屋主。
   来源: 有新Newin
   发布时间: 2026-08-06 10:37:01
   链接: https://view.inews.qq.com/a/20260806A04VGR00?scene=news-skill
`

beforeEach(() => {
  callToolMock.mockReset()
  canExecuteMock.mockReset().mockReturnValue(true)
  recordMock.mockReset()
})

describe('parseTencentNewsText（文本解析）', () => {
  it('解析半角冒号热点文本为结构化条目', () => {
    const items = parseTencentNewsText(HOT_TEXT)
    expect(items.length).toBe(2)
    expect(items[0]!.title).toBe('纪念江泽民同志诞辰100周年大会17日上午在京隆重举行')
    expect(items[0]!.source).toBe('新华社新闻')
    expect(items[0]!.date).toBe('2026-08-15 20:00')
    expect(items[0]!.url).toContain('20260815A0C23G00')
    expect(items[1]!.title).toBe('国防部：日方若一意孤行')
  })

  it('解析全角冒号早报文本（无来源/发布时间）不报错', () => {
    const items = parseTencentNewsText(MORNING_TEXT)
    expect(items.length).toBe(1)
    expect(items[0]!.source).toBe('') // 早报无来源字段
    expect(items[0]!.date).toBe('') // 早报无发布时间字段
    expect(items[0]!.title).toContain('纪念江泽民')
  })

  it('空文本返回空数组', () => {
    expect(parseTencentNewsText('')).toEqual([])
    expect(parseTencentNewsText('没有条目的纯文本')).toEqual([])
  })
})

describe('fetchNewsViaTencentNews（维度 04/05 泛资讯）', () => {
  it('hot_news → 合并 hot+morning 文本为 NewsItem[]，_source=tencentnews', async () => {
    callToolMock.mockImplementation(async (_s: string, tool: string) => {
      if (tool === 'tencentnews_hot') return okText(HOT_TEXT)
      if (tool === 'tencentnews_morning') return okText(MORNING_TEXT)
      return okText('')
    })

    const items = await fetchNewsViaTencentNews('sh600519', 'hot_news')

    expect(items).not.toBeNull()
    expect(items!.length).toBe(3) // 2 from hot + 1 from morning
    expect(items![0]!._source).toBe('tencentnews')
    expect(items![0]!.category).toBe('hot_news')
    expect(items![0]!.source).toBe('新华社新闻')
    // 合并后去重非必须；至少含两条不同标题
    const titles = items!.map((i) => i.title)
    expect(titles).toContain('国防部：日方若一意孤行')
    expect(recordMock).toHaveBeenCalledWith('tencentnews', expect.objectContaining({ success: true }))
  })

  it('announcement → 腾讯新闻无个股公告维度，直接返回 null（不发起调用）', async () => {
    const items = await fetchNewsViaTencentNews('sh600519', 'announcement')
    expect(items).toBeNull()
    expect(callToolMock).not.toHaveBeenCalled()
  })

  it('CLI 显式错误（isError） → 返回 null 并记失败', async () => {
    callToolMock.mockResolvedValue(errResult('CLI 非零退出'))
    const items = await fetchNewsViaTencentNews('sh600519', 'hot_news')
    expect(items).toBeNull()
    expect(recordMock).toHaveBeenCalledWith('tencentnews', expect.objectContaining({ success: false }))
  })

  it('调用抛异常 → 捕获降级返回 null', async () => {
    callToolMock.mockRejectedValue(new Error('bridge down'))
    const items = await fetchNewsViaTencentNews('sh600519', 'hot_news')
    expect(items).toBeNull()
    expect(recordMock).toHaveBeenCalledWith('tencentnews', expect.objectContaining({ success: false }))
  })
})

describe('fetchIndustryNewsViaTencentNews（行业检索）', () => {
  it('按关键词 search → 映射为 NewsItem[]', async () => {
    callToolMock.mockImplementation(async (_s: string, tool: string, args: Record<string, unknown>) => {
      if (tool === 'tencentnews_search' && args.keyword === '数据采集') return okText(SEARCH_TEXT)
      return okText('')
    })

    const items = await fetchIndustryNewsViaTencentNews(['数据采集'])

    expect(items).not.toBeNull()
    expect(items!.length).toBe(1)
    expect(items![0]!.title).toContain('数据采集')
    expect(items![0]!._source).toBe('tencentnews')
  })

  it('空关键词列表 → 返回 null', async () => {
    expect(await fetchIndustryNewsViaTencentNews([])).toBeNull()
    expect(callToolMock).not.toHaveBeenCalled()
  })
})

describe('源熔断门禁（canExecute）', () => {
  it('canExecute=false → 不发起调用直接返回 null', async () => {
    canExecuteMock.mockReturnValue(false)
    const items = await fetchNewsViaTencentNews('sh600519', 'hot_news')
    expect(items).toBeNull()
    expect(callToolMock).not.toHaveBeenCalled()
  })
})
