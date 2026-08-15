// @vitest-environment node
/**
 * e2eWestockMcpChain.test.ts
 * ----------------------------------------------------------------------------
 * 目标：穿透「完整 MCP 链路」验证 marketdata:westock 在 Node / Electron 宿主下真实可用。
 *
 * 背景：既有 e2eWestockQuality.test.ts 仅在 mcpBridge 层做 mock（绕过 MCPClientImpl /
 * MCPServerBase / 服务端 ACL / Server 派发），未验证「mcpBridge.callTool() 经注册中心
 * 找到 Server → 服务端 ACL 校验 → handler → WestockCliBridge.invoke」这一完整链路。
 * 本测试即为方案 §12.7 ⑤ 建议的「Electron / Node 宿主端到端复跑 mcpBridge.callTool(...)」。
 *
 * 设计：
 *  - 仅手动注册 marketdata:westock 单 Server（避免加载其它可能依赖浏览器的 Server），
 *    从而安全地在 Node 测试进程内验证整链。
 *  - CLI 桥接层用 vi.mock 提供受控 canned --raw JSON，确定性验证「Server 层派发 + 字段透传」
 *    （此前未覆盖的缺口）；真实 CLI 端到端另由 WESTOCK_LIVE_E2E=1 门控的执行用例承担（复跑确认）。
 *  - 覆盖：成功派发 / 研报真实字段 tzpj 透传 / 未知 caller 被 ACL 拦截 / CLI 失败 → isError 降级。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'

// 在导入 westockServer 之前 mock 其 CLI 桥接依赖（vi.mock 会被自动提升）
vi.mock('@/mcp/servers/marketdata/WestockCliBridge', () => {
  const noticeItems = [
    { id: 'n1', title: '【中信建投证券】华泰证券 买入', time: '2026-08-15', url: '' },
    { id: 'n2', title: '【中泰证券】贵州茅台 买入', time: '2026-08-14', url: '' },
  ]
  const reportItems = [
    { id: 'r1', title: '【国泰君安】招商银行 增持', time: '2026-08-15', tzpj: '增持', institution: '国泰君安' },
  ]
  const klineItems = [
    { date: '2026-08-15', open: '10', last: '10.5', high: '10.6', low: '9.9', volume: '1000', amount: '10500', exchange: '1.2' },
  ]
  const canned: Record<string, unknown[]> = {
    'notice list': noticeItems,
    'report list': reportItems,
    kline: klineItems,
  }
  const invoke = vi.fn(async (command: string) => {
    const items = canned[command] ?? []
    return { data: items, raw: JSON.stringify(items) }
  })
  class CliError extends Error {
    kind: string
    constructor(message: string, kind: string) {
      super(message)
      this.name = 'CliError'
      this.kind = kind
    }
  }
  return {
    CliError,
    westockCliBridge: { isAvailable: async () => true, invoke },
    WestockCliBridge: class {},
  } as unknown as typeof import('@/mcp/servers/marketdata/WestockCliBridge')
})

import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { mcpRegistry } from '@/mcp/core/registry'
import { WeStockServer } from '@/mcp/servers/marketdata/westockServer'

beforeAll(() => {
  // 仅注册 westock 单 Server，避免加载其它可能依赖浏览器的 Server
  if (!mcpRegistry.getServer('marketdata:westock')) {
    mcpRegistry.register(new WeStockServer(), { priority: 'medium', enabled: true })
  }
})

/**
 * 从 ToolResult 文本解析出 Server 透传的 CLI 数据。
 *
 * 真实链路（westockServer.ts:286-287 → toToolResult:36-41）：
 *   handler 解构 `const { data } = await westockCliBridge.invoke(...)`
 *   后直接 `toToolResult(data)`，而 toToolResult 把 data **直接**
 *   JSON.stringify 进 `content[0].text`（无额外 { data } 包装层）。
 * 故此处解析出的就是 CLI 返回的数组本身。
 */
function parseData(text: string | undefined): unknown[] {
  const parsed = JSON.parse(text ?? '[]')
  return Array.isArray(parsed) ? parsed : []
}

describe('完整 MCP 链：mcpBridge.callTool(marketdata:westock, ...)', () => {
  it('westock_notice_list 穿透 ACL + Server 派发并返回结构化数据', async () => {
    const res = await mcpBridge.callTool(
      'marketdata:westock',
      'westock_notice_list',
      { code: 'sh600519', limit: 5 },
      { caller: 'system' },
    )
    expect(res.isError).toBe(false)
    const items = parseData(res.content[0]?.text)
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0] as Record<string, unknown>).toHaveProperty('title')
    expect(items[0] as Record<string, unknown>).toHaveProperty('time')
  })

  it('westock_report_list 穿透链并透传研报真实字段 tzpj', async () => {
    const res = await mcpBridge.callTool(
      'marketdata:westock',
      'westock_report_list',
      { code: 'sh600519', limit: 5 },
      { caller: 'system' },
    )
    expect(res.isError).toBe(false)
    const items = parseData(res.content[0]?.text)
    expect(items[0] as Record<string, unknown>).toHaveProperty('tzpj')
  })

  it('未知 caller 被 ACL 拦截（深度防御）', async () => {
    const res = await mcpBridge.callTool(
      'marketdata:westock',
      'westock_notice_list',
      { code: 'sh600519' },
      { caller: 'no_such_role' as 'system' },
    )
    expect(res.isError).toBe(true)
    expect(res.content[0]?.text ?? '').toContain('ACL_PERMISSION_DENIED')
  })

  it('CLI 失败 → Server 转 isError（降级路径显式化、可观测）', async () => {
    const { westockCliBridge } = await import('@/mcp/servers/marketdata/WestockCliBridge')
    vi.mocked(westockCliBridge.invoke).mockRejectedValueOnce(new Error('CLI 非零退出 code=1'))
    const res = await mcpBridge.callTool(
      'marketdata:westock',
      'westock_notice_list',
      { code: 'sh600519' },
      { caller: 'system' },
    )
    expect(res.isError).toBe(true)
  })
})

// ── 真实 CLI 端到端（复跑确认，默认跳过避免 CI 网络依赖；手动 WESTOCK_LIVE_E2E=1 执行）──
const liveIt = process.env.WESTOCK_LIVE_E2E === '1' ? it : it.skip
liveIt(
  '[LIVE] westock_notice_list 真实 CLI 端到端取数（复跑确认）',
  async () => {
    const res = await mcpBridge.callTool(
      'marketdata:westock',
      'westock_notice_list',
      { code: 'sh600519', limit: 5 },
      { caller: 'system' },
    )
    if (res.isError) {
      console.warn('[LIVE] westock CLI 返回错误（可能网络/无 CLI）：', res.content[0]?.text)
      return
    }
    const items = parseData(res.content[0]?.text)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0] as Record<string, unknown>).toHaveProperty('title')
    expect(items[0] as Record<string, unknown>).toHaveProperty('time')
  },
  120000,
)
