/**
 * @fileoverview westockMcpSource 单元测试
 *
 * 覆盖维度 04/05（公告/新闻）与 08（研报）经 MCP(marketdata:westock) 调用腾讯自选股 SKILL 的适配层：
 * - 成功路径：CLI JSON → 领域对象映射（_source=westock）
 * - CLI 显式错误（isError）：返回 null 并记 recordSourceResult(false)
 * - 调用异常：捕获后降级返回 null 并记 recordSourceResult(false)
 * - 源熔断（canExecute=false）：直接跳过，不发起调用
 *
 * 运行：npx vitest run src/services/data-collector/westockMcpSource.test.ts
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
  fetchResearchReportsViaWestock,
  fetchNewsViaWestock,
} from './westockMcpSource'

const callToolMock = mcpBridge.callTool as unknown as ReturnType<typeof vi.fn>
const canExecuteMock = canExecute as unknown as ReturnType<typeof vi.fn>
const recordMock = recordSourceResult as unknown as ReturnType<typeof vi.fn>

/** 构造 MCP ToolResult（与 mcp.types ToolResult 形态一致） */
function okResult(data: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false }
}
function errResult(text: string) {
  return { content: [{ type: 'text', text }], isError: true }
}

beforeEach(() => {
  callToolMock.mockReset()
  canExecuteMock.mockReset().mockReturnValue(true)
  recordMock.mockReset()
})

describe('fetchResearchReportsViaWestock（维度 08 研报）', () => {
  it('CLI 成功 → 映射为 ResearchReport[] 且 _source=westock', async () => {
    callToolMock.mockResolvedValue(
      okResult({
        data: [
          { id: 'r1', title: '深度报告', institution: '中信', rating: 'Buy', date: '2026-01-01', summary: '正文' },
          { title: '无 id 报告', org: '华泰', grade: 'Overweight' },
        ],
      }),
    )

    const reports = await fetchResearchReportsViaWestock('sh600519')

    expect(reports).not.toBeNull()
    expect(reports!.length).toBe(2)
    expect(reports![0]!._source).toBe('westock')
    expect(reports![0]!.institution).toBe('中信')
    expect(reports![0]!.rating).toBe('Buy')
    // 缺 id 时回退到 `${symbol}-report-${i}`
    expect(reports![1]!.id).toBe('sh600519-report-1')
    expect(reports![1]!.institution).toBe('华泰')
    expect(recordMock).toHaveBeenCalledWith('westock', expect.objectContaining({ success: true }))
  })

  it('真实 --raw 字段（tzpj→rating / title【机构】→institution / time→date）映射正确', async () => {
    // 字段形状取自 westock-data-skillhub@1.0.5 --raw 实测
    callToolMock.mockResolvedValue(
      okResult([
        {
          id: 'res840123140493',
          title: '【中泰证券】贵州茅台(600519)：市场化改革提速 上半年韧性依旧',
          time: '2026-08-15 00:00:00',
          type: '1',
          symbol: 'sh600519',
          src: '',
          summary: '',
          tzpj: '买入',
        },
      ]),
    )

    const reports = await fetchResearchReportsViaWestock('sh600519')

    expect(reports).not.toBeNull()
    expect(reports!.length).toBe(1)
    expect(reports![0]!.rating).toBe('买入') // 来自 tzpj
    expect(reports![0]!.institution).toBe('中泰证券') // 从标题【】提取
    expect(reports![0]!.date).toBe('2026-08-15 00:00:00') // 来自 time
    expect(reports![0]!.title).toContain('贵州茅台')
  })

  it('CLI 返回空数组 → 返回 null（交给上层降级）', async () => {
    callToolMock.mockResolvedValue(okResult({ data: [] }))
    const reports = await fetchResearchReportsViaWestock('sh600519')
    expect(reports).toBeNull()
  })

  it('CLI 显式错误（isError） → 返回 null 并记失败', async () => {
    callToolMock.mockResolvedValue(errResult('CLI 非零退出'))
    const reports = await fetchResearchReportsViaWestock('sh600519')
    expect(reports).toBeNull()
    expect(recordMock).toHaveBeenCalledWith('westock', expect.objectContaining({ success: false }))
  })

  it('调用抛异常 → 捕获降级返回 null', async () => {
    callToolMock.mockRejectedValue(new Error('bridge down'))
    const reports = await fetchResearchReportsViaWestock('sh600519')
    expect(reports).toBeNull()
    expect(recordMock).toHaveBeenCalledWith('westock', expect.objectContaining({ success: false }))
  })
})

describe('fetchNewsViaWestock（维度 04/05 公告/新闻）', () => {
  it('CLI 成功 → 映射为 NewsItem[] 且携带 category', async () => {
    callToolMock.mockResolvedValue(
      okResult({
        list: [
          { id: 'n1', title: '重大事项', content: '详情', source: '上交所', date: '2026-02-01' },
        ],
      }),
    )

    const items = await fetchNewsViaWestock('sh600519', 'announcement')

    expect(items).not.toBeNull()
    expect(items!.length).toBe(1)
    expect(items![0]!._source).toBe('westock')
    expect(items![0]!.category).toBe('announcement')
    expect(items![0]!.source).toBe('上交所')
  })

  it('真实 --raw 字段（time 为日期、url 多为空）映射正确', async () => {
    // 字段形状取自 westock-data-skillhub@1.0.5 --raw 实测（notice list）
    callToolMock.mockResolvedValue(
      okResult([
        {
          id: 'nos1225475868',
          symbol: 'sh600519',
          title: '贵州茅台：贵州茅台2026年半年度报告',
          time: '2026-08-14 20:41:29',
          type: '0',
          url: '',
          update_time: '2026-08-14 20:48:51',
        },
      ]),
    )

    const items = await fetchNewsViaWestock('sh600519', 'announcement')

    expect(items).not.toBeNull()
    expect(items!.length).toBe(1)
    expect(items![0]!.date).toBe('2026-08-14 20:41:29') // 来自 time
    expect(items![0]!.url).toBe('') // url 为空时返回空串（string 类型）
  })

  it('批量逗号代码 → 返回 sections 嵌套结构 → 展平为扁平数组', async () => {
    callToolMock.mockResolvedValue(
      okResult({
        sections: [
          [{ id: 'a1', title: 'A公告', time: '2026-08-14 20:41:29' }],
          [{ id: 'b1', title: 'B公告', time: '2026-08-14 19:19:21' }],
        ],
      }),
    )

    const items = await fetchNewsViaWestock('sh600519,sz000001', 'announcement')

    expect(items).not.toBeNull()
    expect(items!.length).toBe(2) // sections 两层被展平
    expect(items!.map((i) => i.id)).toContain('a1')
    expect(items!.map((i) => i.id)).toContain('b1')
  })

  it('CLI 异常 → 返回 null', async () => {
    callToolMock.mockRejectedValue(new Error('timeout'))
    const items = await fetchNewsViaWestock('sh600519', 'hot_news')
    expect(items).toBeNull()
  })
})

describe('源熔断门禁（canExecute）', () => {
  it('canExecute=false → 不发起调用直接返回 null', async () => {
    canExecuteMock.mockReturnValue(false)
    const reports = await fetchResearchReportsViaWestock('sh600519')
    expect(reports).toBeNull()
    expect(callToolMock).not.toHaveBeenCalled()
  })
})
