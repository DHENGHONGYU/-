/**
 * @module mcp/servers/news/tencentNewsServer
 * @description 腾讯新闻 MCP Server —— 通过 TencentNewsCliBridge 封装腾讯新闻 SKILL（tencent-news）
 *              作为数据采集舱维度 04/05 的泛资讯/行业新闻一等实采数据源（技术方案 §3 / §4 / §5.2）。
 *
 * 对应 SKILL 命令 → MCP Tool 映射见技术方案 §4.1 / §12。本 Server 仅负责「如何取数」
 * （调用 CLI、结果规整、错误转 isError），「取哪个 / 失败如何降级」由采集舱编排。
 *
 * 编码：CLI stdout 实测为 UTF-8（早期 GBK 误判为宿主按 GBK 重定向所致），
 *       TencentNewsCliBridge 已做 UTF-8 自适应解码（严格 UTF-8 → 严格 gb18030 → 宽松 UTF-8）。
 *
 * @doc [V9-DOC-AI-007, 技术方案-MCP-SKILL-腾讯新闻-数据采集舱改造方案]
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ToolResult, ResourceTemplate } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { tencentNewsCliBridge, type CliError } from './TencentNewsCliBridge'

const logger = getLogger()

/** 单个 Tool 的命令与参数构造定义 */
interface TencentNewsToolDef {
  name: string
  description: string
  inputSchema: ToolDescriptor['inputSchema']
  /** SKILL 子命令（可能含空格，如 'jiaozhen'） */
  command: string
  /** 从 Tool 入参构造 CLI 参数串 */
  buildArgs: (args: Record<string, unknown>) => string
  /** 单次 CLI 超时覆盖（ms）；缺省走 Bridge 实例级 20s。用于上游天然缓慢命令（如 jiaozhen 事实核查常态 >20s） */
  timeoutMs?: number
}

/** 把 CLI 调用结果包装为 ToolResult（成功→文本；失败→isError） */
function toToolResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) }],
    isError: false,
  }
}

function toErrorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err)
  return { content: [{ type: 'text', text: msg }], isError: true }
}

/**
 * 维度 04/05 泛资讯/行业新闻受益的 6 个 Tool 定义，外加 check_health。
 * 注：腾讯新闻 CLI 返回可读文本（标题/摘要/来源/时间/链接），非 JSON；
 *     结构化解析由数据适配层（tencentNewsMcpSource）完成。
 */
const TENCENT_NEWS_TOOL_DEFS: TencentNewsToolDef[] = [
  {
    name: 'tencentnews_hot',
    description: '获取腾讯新闻热点榜（维度 04 泛热点资讯）',
    inputSchema: { type: 'object', properties: {} },
    command: 'hot',
    buildArgs: () => '',
  },
  {
    name: 'tencentnews_morning',
    description: '获取今日早报（维度 05 日报类资讯）',
    inputSchema: { type: 'object', properties: {} },
    command: 'morning',
    buildArgs: () => '',
  },
  {
    name: 'tencentnews_evening',
    description: '获取今日晚报（维度 05 日报类资讯；18:00 前返回提示文案）',
    inputSchema: { type: 'object', properties: {} },
    command: 'evening',
    buildArgs: () => '',
  },
  {
    name: 'tencentnews_search',
    description: '按关键词检索行业资讯（维度 04/05 行业新闻核心能力，如「数据采集」「数据要素」「金融科技」）',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '检索关键词' },
        limit: { type: 'number', description: '返回条数（默认 20）' },
      },
      required: ['keyword'],
    },
    command: 'search',
    buildArgs: (a) => {
      const kw = String((a.keyword as string) ?? '')
      const limit = a.limit != null ? ` --limit ${Number(a.limit)}` : ''
      return `${kw}${limit}`.trim()
    },
  },
  {
    name: 'tencentnews_jiaozhen',
    description: '较真事实核查（资讯真实性核验，降低舆情噪声）',
    inputSchema: {
      type: 'object',
      properties: { claim: { type: 'string', description: '待核查的说法' } },
      required: ['claim'],
    },
    command: 'jiaozhen',
    buildArgs: (a) => (typeof a.claim === 'string' ? ` --query=${a.claim}` : ''),
    // 事实核查上游常态 >20s，放宽到 60s，避免被实例级 20s 超时误杀
    timeoutMs: 60_000,
  },
  {
    name: 'tencentnews_weather',
    description: '天气查询（默认当前地区，--adcode 指定；非金融，可忽略或作衍生维度）',
    inputSchema: {
      type: 'object',
      properties: { adcode: { type: 'string', description: '地区 adcode' } },
    },
    command: 'weather',
    buildArgs: (a) => (typeof a.adcode === 'string' ? ` --adcode ${a.adcode}` : ''),
  },
]

/**
 * 腾讯新闻 MCP Server
 *
 * 默认调用方角色 'system'（CLI 拉数为系统级内部调用，ACL 全权；与 westock 一致）。
 */
export class TencentNewsServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'marketdata:tencentnews',
    version: '1.0.0',
    description: '腾讯新闻数据源 —— 热点/早报/晚报/行业检索/事实核查（只读，维度 04/05 泛资讯）',
    dependencies: [],
  }

  constructor() {
    super('system')
  }

  protected getTools(): ToolDescriptor[] {
    const defTools: ToolDescriptor[] = TENCENT_NEWS_TOOL_DEFS.map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const text = await tencentNewsCliBridge.invoke(def.command, def.buildArgs(args), {
            timeoutMs: def.timeoutMs,
          })
          return toToolResult(text)
        } catch (err) {
          // CliError（unavailable/timeout/nonzero/empty/spawn）→ 明确失败，交采集舱降级
          const kind = (err as CliError)?.kind
          if (kind) logger.warn(`[TencentNewsServer] ${def.name} CLI 失败(${kind})`, { error: (err as Error).message })
          return toErrorResult(err)
        }
      },
    }))

    // 健康检查 Tool（供 MCP Server Dashboard 与降级判定）
    const healthTool: ToolDescriptor = {
      name: 'check_health',
      description: '检查腾讯新闻 CLI 桥接可用性',
      inputSchema: { type: 'object', properties: {} },
      handler: async (): Promise<ToolResult> => {
        const ok = await tencentNewsCliBridge.isAvailable()
        return toToolResult({ ok, source: 'tencentnews', server: this.info.name })
      },
    }

    return [...defTools, healthTool]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'marketdata://tencentnews/health',
        name: 'health',
        description: '腾讯新闻源健康状态',
        mimeType: 'application/json',
        resolver: async (uri: string) => {
          const ok = await tencentNewsCliBridge.isAvailable()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ ok, source: 'tencentnews', server: this.info.name }),
          }
        },
      },
    ]
  }
}
