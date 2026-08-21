/**
 * @module mcp/servers/marketdata/westockServer
 * @description 腾讯自选股 MCP Server —— 通过 WestockCliBridge 封装腾讯自选股 SKILL（westock-data-skillhub）
 *              作为数据采集舱的一等实采数据源（技术方案 §3 / §4 / §5.2）。
 *
 * 对应 SKILL 命令 → MCP Tool 映射见技术方案 §4.2。本 Server 仅负责「如何取数」
 * （调用 CLI、结果规整、错误转 isError），「取哪个 / 失败如何降级」由采集舱编排。
 *
 * 注意：CLI 参数 schema 已依据 `westock-data-skillhub@1.0.5` 官方命令表（references/commands.md）校准：
 *       - 复合子命令（fund flow / report list / macro indicator / sector constituent 等）由 WestockCliBridge 自动拆分 argv；
 *       - kline 复权为 --fq(qfq/hfq/bfq)，technical 指标枚举已补全，notice list 支持 --type，macro 为位置参数短名 + --year/--date/--region；
 *       - flag 不匹配时 CLI 返回错误 → 采集舱降级（§5.4）。
 *
 * @doc [V9-DOC-AI-007, V9-DOC-AI-005, 技术方案-MCP-SKILL-腾讯自选股-数据采集舱改造方案]
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ToolResult, ResourceTemplate } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { westockCliBridge, type CliError } from './WestockCliBridge'

const logger = getLogger()

/** 单个 Tool 的命令与参数构造定义 */
interface WestockToolDef {
  name: string
  description: string
  inputSchema: ToolDescriptor['inputSchema']
  /** SKILL 子命令（可能含空格，如 'fund flow'） */
  command: string
  /** 从 Tool 入参构造 CLI 参数串 */
  buildArgs: (args: Record<string, unknown>) => string
}

/** 把 CLI 调用结果包装为 ToolResult（成功→JSON 文本；失败→isError） */
function toToolResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    isError: false,
  }
}

function toErrorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
  return { content: [{ type: 'text', text: msg }], isError: true }
}

/**
 * 维度 04/05/08 等薄弱维度直接受益的 13 个 Tool 定义。
 * 批量能力通过 codes 逗号分隔参数保留（与 SKILL 铁律一致，见 §4.2）。
 */
const WESTOCK_TOOL_DEFS: WestockToolDef[] = [
  {
    name: 'westock_search',
    description: '搜索股票/ETF/指数/板块代码（先 search 再取数）',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
        type: { type: 'string', description: '类型: stock/etf/index/sector/bond/futures/forex', enum: ['stock', 'etf', 'index', 'sector', 'bond', 'futures', 'forex'] },
      },
      required: ['keyword'],
    },
    command: 'search',
    buildArgs: (a) => {
      const kw = typeof a.keyword === 'string' ? a.keyword : ''
      const type = typeof a.type === 'string' ? ` --type ${a.type}` : ''
      return `${kw}${type}`
    },
  },
  {
    name: 'westock_kline',
    description: '获取 K 线/历史行情（codes 逗号批量；注意 K 线有延迟，非实时）',
    inputSchema: {
      type: 'object',
      properties: {
        codes: { type: 'string', description: '逗号分隔的代码，如 sh600519,sz000001' },
        period: { type: 'string', description: '周期: m1/m5/m15/m30/m60/m250/day/week/month/season/year', enum: ['m1', 'm5', 'm15', 'm30', 'm60', 'm250', 'day', 'week', 'month', 'season', 'year'] },
        limit: { type: 'number', description: '回溯条数（与 start/end 互斥，范围模式仅作上限保护）' },
        fq: { type: 'string', description: '复权: qfq/hfq/bfq', enum: ['qfq', 'hfq', 'bfq'] },
        start: { type: 'string', description: '起始日期 YYYY-MM-DD（优先级高于 limit；期货/外汇不支持）' },
        end: { type: 'string', description: '结束日期 YYYY-MM-DD' },
      },
      required: ['codes'],
    },
    command: 'kline',
    buildArgs: (a) => {
      const codes = typeof a.codes === 'string' ? a.codes : ''
      const period = typeof a.period === 'string' ? ` --period ${a.period}` : ''
      const limit = a.limit != null ? ` --limit ${Number(a.limit)}` : ''
      const fq = typeof a.fq === 'string' ? ` --fq ${a.fq}` : ''
      const start = typeof a.start === 'string' ? ` --start ${a.start}` : ''
      const end = typeof a.end === 'string' ? ` --end ${a.end}` : ''
      return `${codes}${period}${limit}${fq}${start}${end}`
    },
  },
  {
    name: 'westock_finance',
    description: '获取财务三表（codes 逗号批量）',
    inputSchema: {
      type: 'object',
      properties: {
        codes: { type: 'string', description: '逗号分隔的代码' },
        num: { type: 'number', description: '财报期数' },
      },
      required: ['codes'],
    },
    command: 'finance',
    buildArgs: (a) => {
      const codes = typeof a.codes === 'string' ? a.codes : ''
      const num = a.num != null ? ` --num ${Number(a.num)}` : ''
      return `${codes}${num}`
    },
  },
  {
    name: 'westock_technical',
    description: '获取技术指标（codes 逗号批量；indicator 可逗号多选，如 macd,rsi）',
    inputSchema: {
      type: 'object',
      properties: {
        codes: { type: 'string', description: '逗号分隔的代码' },
        indicator: { type: 'string', description: '指标: ma/macd/kdj/rsi/boll/bias/wr/dmi/all（逗号多选）', enum: ['ma', 'macd', 'kdj', 'rsi', 'boll', 'bias', 'wr', 'dmi', 'all'] },
      },
      required: ['codes'],
    },
    command: 'technical',
    buildArgs: (a) => {
      const codes = typeof a.codes === 'string' ? a.codes : ''
      const indicator = typeof a.indicator === 'string' ? ` --indicator ${a.indicator}` : ''
      return `${codes}${indicator}`
    },
  },
  {
    name: 'westock_fund_flow',
    description: '获取个股资金流向',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: '股票代码' } },
      required: ['code'],
    },
    command: 'fund flow',
    buildArgs: (a) => typeof a.code === 'string' ? a.code : '',
  },
  {
    name: 'westock_north_holding',
    description: '获取北向持仓（按 code 或 sectorId）',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '股票代码（与 sectorId 二选一）' },
        sectorId: { type: 'string', description: '板块 ID' },
      },
    },
    command: 'fund north-holding',
    buildArgs: (a) => (typeof a.code === 'string' ? a.code : typeof a.sectorId === 'string' ? a.sectorId : ''),
  },
  {
    name: 'westock_report_list',
    description: '获取研报列表（维度 08；code 逗号批量）',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '股票代码（逗号批量）' },
        limit: { type: 'number', description: '返回条数' },
      },
      required: ['code'],
    },
    command: 'report list',
    buildArgs: (a) => {
      const code = typeof a.code === 'string' ? a.code : ''
      const limit = a.limit != null ? ` --limit ${Number(a.limit)}` : ''
      return `${code}${limit}`
    },
  },
  {
    name: 'westock_notice_list',
    description: '获取公告/新闻列表（维度 04/05；code 逗号批量）',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '股票代码（逗号批量）' },
        limit: { type: 'number', description: '返回条数' },
        type: { type: 'string', description: '公告类型: 0全部/1财务/2配股/3增发/4股权变动/5重大/6风险/7其他' },
      },
      required: ['code'],
    },
    command: 'notice list',
    buildArgs: (a) => {
      const code = typeof a.code === 'string' ? a.code : ''
      const limit = a.limit != null ? ` --limit ${Number(a.limit)}` : ''
      const type = typeof a.type === 'string' && a.type.length > 0 ? ` --type ${a.type}` : ''
      return `${code}${limit}${type}`
    },
  },
  {
    name: 'westock_sector_constituent',
    description: '获取板块成份股',
    inputSchema: {
      type: 'object',
      properties: { sectorId: { type: 'string', description: '板块 ID' } },
      required: ['sectorId'],
    },
    command: 'sector constituent',
    buildArgs: (a) => typeof a.sectorId === 'string' ? a.sectorId : '',
  },
  {
    name: 'westock_sector_valuation',
    description: '获取板块估值',
    inputSchema: {
      type: 'object',
      properties: { sectorId: { type: 'string', description: '板块 ID' } },
      required: ['sectorId'],
    },
    command: 'sector valuation',
    buildArgs: (a) => typeof a.sectorId === 'string' ? a.sectorId : '',
  },
  {
    name: 'westock_index_constituent',
    description: '获取指数成份股',
    inputSchema: {
      type: 'object',
      properties: { indexCode: { type: 'string', description: '指数代码' } },
      required: ['indexCode'],
    },
    command: 'index constituent',
    buildArgs: (a) => typeof a.indexCode === 'string' ? a.indexCode : '',
  },
  {
    name: 'westock_macro',
    description: '获取宏观指标（cn_gdp/cn_core/us_inflation 等，可逗号批量；按 --year 或 --date 查询）',
    inputSchema: {
      type: 'object',
      properties: {
        indicator: { type: 'string', description: '指标短名，如 cn_gdp / cn_core / cn_cpi_ppi,cn_pmi / us_inflation（逗号批量）' },
        year: { type: 'string', description: '按年份查询，如 2025（cn_gdp/cn_cpi_ppi 等绝大多数中国指标）' },
        date: { type: 'string', description: '按日期查询，如 2026-06-09（cn_core/估值类及所有海外主题 us_/hk_/jp_/eu_）' },
        region: { type: 'string', description: '一键拉某 region 全套（与 indicator 二选一）: cn/us/hk/jp/eu' },
      },
    },
    command: 'macro indicator',
    buildArgs: (a) => {
      const indicator = typeof a.indicator === 'string' ? a.indicator : ''
      const year = typeof a.year === 'string' ? ` --year ${a.year}` : ''
      const date = typeof a.date === 'string' ? ` --date ${a.date}` : ''
      const region = typeof a.region === 'string' ? ` --region ${a.region}` : ''
      return `${indicator}${year}${date}${region}`.trim()
    },
  },
  {
    name: 'westock_etf_detail',
    description: '获取 ETF 详情',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'ETF 代码' } },
      required: ['code'],
    },
    command: 'etf detail',
    buildArgs: (a) => typeof a.code === 'string' ? a.code : '',
  },
]

/**
 * 腾讯自选股 MCP Server
 *
 * 默认调用方角色 'system'（CLI 拉数为系统级内部调用，ACL 全权；UI 角色经 mcpAclMatrix 显式授予 westock_* 只读）。
 */
export class WeStockServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'marketdata:westock',
    version: '1.0.0',
    description: '腾讯自选股数据源 —— 研报/公告/新闻/K线/财务/资金流/板块/指数/宏观/ETF（只读）',
    dependencies: [],
  }

  constructor() {
    super('system')
  }

  protected getTools(): ToolDescriptor[] {
    const defTools: ToolDescriptor[] = WESTOCK_TOOL_DEFS.map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const { data } = await westockCliBridge.invoke(def.command, def.buildArgs(args))
          return toToolResult(data)
        } catch (err) {
          // CliError（unavailable/timeout/parse/nonzero/spawn）→ 明确失败，交采集舱降级
          const kind = (err as CliError)?.kind
          if (kind) logger.warn(`[WeStockServer] ${def.name} CLI 失败(${kind})`, { error: (err as Error).message })
          return toErrorResult(err)
        }
      },
    }))

    // 健康检查 Tool（供 MCP Server Dashboard 与降级判定）
    const healthTool: ToolDescriptor = {
      name: 'check_health',
      description: '检查腾讯自选股 CLI 桥接可用性',
      inputSchema: { type: 'object', properties: {} },
      handler: async (): Promise<ToolResult> => {
        const ok = await westockCliBridge.isAvailable()
        return toToolResult({ ok, source: 'westock', server: this.info.name })
      },
    }

    return [...defTools, healthTool]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'marketdata://health',
        name: 'health',
        description: '腾讯自选股源健康状态',
        mimeType: 'application/json',
        resolver: async (uri: string) => {
          const ok = await westockCliBridge.isAvailable()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ ok, source: 'westock', server: this.info.name }),
          }
        },
      },
      {
        uriTemplate: 'marketdata://{code}/kline',
        name: 'kline',
        description: '指定代码的 K 线资源（延迟数据，非实时）',
        mimeType: 'application/json',
        resolver: async (uri: string) => {
          const code = uri.match(/marketdata:\/\/([^/]+)\/kline/)?.[1] ?? ''
          try {
            const { data } = await westockCliBridge.invoke('kline', code)
            return { uri, mimeType: 'application/json', text: JSON.stringify(data) }
          } catch (err) {
            return { uri, mimeType: 'text/plain', text: `K线资源读取失败: ${(err as Error).message}` }
          }
        },
      },
    ]
  }
}
