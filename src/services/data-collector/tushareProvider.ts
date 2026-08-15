/**
 * @fileoverview Tushare Pro 数据提供层
 *
 * 职责：
 * - 封装 Tushare Pro HTTP API 调用（POST http://api.tushare.pro）
 * - 统一 Token 读取、超时、重试、错误分类
 * - 返回原始 snake_case 数据，由 tushareAdapter 转换为业务类型
 *
 * 注意：Tushare Token 不直接暴露到前端 bundle，优先通过后端/Vite proxy 持有。
 * 开发环境可在 .env 中配置 VITE_TUSHARE_TOKEN 进行本地测试。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
// 配置源分工说明（TD-015 已治理）：
//   TUSHARE_API_BASE（/api/proxy/tushare/）→ 浏览器走 Vite 代理
//   TUSHARE_DIRECT_URL（https://api.tushare.pro）→ Node/Electron 主进程直连
//   本模块在浏览器与 Node 双环境运行，通过 resolveTushareUrl() 在运行时自动选择配置源。
import { TUSHARE_API_BASE } from '@/config/marketDataEndpoints'
import { TUSHARE_DIRECT_URL } from '@/config/dataSourceUrls'
import { DATA_COLLECTION_TIMEOUT_MS } from '@/config/timeouts'
import { safeFetch as _safeFetch } from '@/services/shared/safeFetch'

const logger = getLogger()

/** Tushare API 请求体 */
export interface TushareRequest {
  api_name: string
  token: string
  params: Record<string, string | number | string[]>
  fields?: string
}

/** Tushare API 通用响应 */
export interface TushareResponse {
  request_id: string
  code: number
  msg: string
  data: {
    fields: string[]
    items: unknown[]
  } | null
}

/** Tushare 错误分类 */
export type TushareErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'QUOTA_EXCEEDED'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'

export class TushareProviderError extends Error {
  constructor(
    message: string,
    public readonly code: TushareErrorCode,
    public readonly apiName?: string,
    public readonly original?: unknown,
  ) {
    super(message)
    this.name = 'TushareProviderError'
  }
}

/** 内部 safeFetch — 委托至共享实现，保持原有签名不变 */
async function safeFetch(
  input: string,
  init?: RequestInit,
  timeoutMs = DATA_COLLECTION_TIMEOUT_MS,
): Promise<Response | null> {
  return _safeFetch(input, { timeoutMs, init }, '[tushareProvider]')
}

/** 从 items 数组映射为对象数组 */
function mapItemsToRecords(fields: string[], items: unknown[]): Record<string, unknown>[] {
  return items.map((row) => {
    const record: Record<string, unknown> = {}
    if (!Array.isArray(row)) {
      return record
    }
    fields.forEach((field, index) => {
      record[field] = row[index]
    })
    return record
  })
}

/**
 * 解析 Tushare API 请求 URL。
 *
 * 运行时环境检测：
 * - 浏览器环境（存在 window）：使用 Vite proxy 路径（TUSHARE_API_BASE = /api/proxy/tushare/），
 *   经 Vite dev server 代理转发，避免 CORS 限制。
 * - Node / Electron 主进程环境（无 window）：使用绝对 URL（TUSHARE_DIRECT_URL = https://api.tushare.pro），
 *   直连 Tushare Pro API（相对路径在 Node fetch 中无法解析）。
 *
 * @returns 适用于当前环境的 Tushare API 请求基础 URL
 */
function resolveTushareUrl(): string {
  const baseUrl = TUSHARE_API_BASE
  if (typeof window === 'undefined' && typeof baseUrl === 'string' && baseUrl.startsWith('/')) {
    return TUSHARE_DIRECT_URL
  }
  return baseUrl
}

declare global {
   
  var __TUSHARE_TOKEN__: string | undefined
}

/** 读取 Tushare Token（优先环境变量，其次空值） */
function getTushareToken(): string | null {
  if (typeof globalThis.__TUSHARE_TOKEN__ === 'string' && globalThis.__TUSHARE_TOKEN__) {
    return globalThis.__TUSHARE_TOKEN__
  }
  if ((import.meta?.env?.VITE_TUSHARE_TOKEN ?? '') !== '') {
    return import.meta.env.VITE_TUSHARE_TOKEN ?? null
  }
  return null
}

/** 最近一次 Tushare 调用失败信息（供上层在 fallback 时如实标注原因，如接口无权限 code=40203） */
let lastTushareError: { apiName: string; code: number; msg: string } | null = null

/** 读取最近一次 Tushare 调用失败信息；若无失败返回 null */
export function getTushareLastError(): { apiName: string; code: number; msg: string } | null {
  return lastTushareError
}

/**
 * 通用 Tushare API 调用。
 *
 * @param apiName Tushare 接口名，如 'daily'
 * @param params 请求参数
 * @param fields 可选字段过滤
 * @returns 记录数组，snake_case 字段名
 */
export async function tushareRequest(
  apiName: string,
  params: Record<string, string | number | string[]>,
  fields?: string,
): Promise<Record<string, unknown>[]> {
  lastTushareError = null // 每次调用先清空，确保仅反映本次调用结果
  const token = getTushareToken()
  if ((token ?? '') === '') {
    lastTushareError = { apiName, code: -2, msg: 'Tushare Token 未配置' }
    logger.warn('[tushareProvider] Token 未配置，跳过 Tushare 调用', { apiName })
    throw new TushareProviderError('Tushare Token 未配置', 'TOKEN_MISSING', apiName)
  }

  const body: TushareRequest = { api_name: apiName, token: token ?? '', params, fields }

  // 解析当前环境适用的 Tushare API URL（浏览器走 Vite 代理，Node 直连）
  const url = resolveTushareUrl()

  let resp: Response | null
  try {
    resp = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastTushareError = { apiName, code: -1, msg: `网络异常: ${msg}` }
    logger.warn(`[tushareProvider] 网络异常: ${apiName}`, { error: msg })
    throw new TushareProviderError(`网络异常: ${msg}`, 'NETWORK_ERROR', apiName, err)
  }

  if (!resp) {
    lastTushareError = { apiName, code: -1, msg: 'Tushare 返回空响应' }
    throw new TushareProviderError('Tushare 返回空响应', 'NETWORK_ERROR', apiName)
  }

  let json: TushareResponse
  try {
    json = (await resp.json()) as TushareResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new TushareProviderError(`响应解析失败: ${msg}`, 'PARSE_ERROR', apiName, err)
  }

  if (json.code !== 0) {
    const msg = json.msg || `Tushare 接口错误 (code=${json.code})`
    let code: TushareErrorCode = 'API_ERROR'
    if (msg.includes('token') || msg.includes('Token')) code = 'TOKEN_INVALID'
    if (msg.includes('积分') || msg.includes('quota') || msg.includes('limit')) code = 'QUOTA_EXCEEDED'
    lastTushareError = { apiName, code: json.code, msg }
    logger.warn(`[tushareProvider] ${apiName} 失败: ${msg}`)
    throw new TushareProviderError(msg, code, apiName, json)
  }

  if (!json.data || !Array.isArray(json.data.items) || json.data.items.length === 0) {
    return []
  }

  return mapItemsToRecords(json.data.fields, json.data.items)
}

/**
 * 将 6 位 A 股代码转换为 Tushare ts_code 格式。
 * 示例: 600519 -> 600519.SH, 000001 -> 000001.SZ
 */
export function toTushareCode(symbol: string): string {
  const code = symbol.replace(/\.(SH|SZ|BJ)$/i, '').trim()
  if (code.startsWith('6')) return `${code}.SH`
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return `${code}.SZ`
  if (code.startsWith('8') || code.startsWith('4') || code.startsWith('9')) return `${code}.BJ`
  return `${code}.SH`
}

/** 从 Tushare ts_code 还原为 6 位代码 */
export function fromTushareCode(tsCode: string): string {
  return tsCode.split('.')[0] ?? tsCode
}

// ── 专用 API 封装 ──

/** 01 股票基本信息：stock_basic */
export async function tushareStockBasic(symbol?: string): Promise<Record<string, unknown>[]> {
  const params: Record<string, string | number | string[]> = {}
  const sym = symbol ?? ''
  if (sym !== '') {
    params.ts_code = toTushareCode(sym)
  }
  return tushareRequest('stock_basic', params, 'ts_code,name,industry,list_date,list_status')
}

/** 02 日 K 线：daily */
export async function tushareDaily(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'daily',
    {
      ts_code: toTushareCode(symbol),
      start_date: startDate,
      end_date: endDate,
    },
    'ts_code,trade_date,open,high,low,close,vol,amount,pre_close,change,pct_change',
  )
}

/** 03 股东户数：stk_holdernumber */
export async function tushareHolderNumber(symbol: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'stk_holdernumber',
    { ts_code: toTushareCode(symbol) },
    'ts_code,ann_date,end_date,holder_num,holder_num_change',
  )
}

/**
 * 04 公司公告：Tushare 无统一的免费 'anns' 接口（该名会返回 40101「接口名无效」），
 * 改用有效的 'news' 接口。该接口需积分权限，本 token 权限包未含时返回 40203「无权限」，
 * 将由 multiSourceFetcher 降级到爬虫/Mock，并在报告中如实标注「无权限」原因。
 */
export async function tushareAnnouncements(symbol: string, startDate: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'news',
    {
      ts_code: toTushareCode(symbol),
      start_date: startDate,
    },
    'ts_code,date_time,title,content,src',
  )
}

/** 05 热点新闻：major_news */
export async function tushareNews(symbol: string, startDate: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'major_news',
    {
      ts_code: toTushareCode(symbol),
      start_date: startDate,
    },
    'ts_code,date_time,title,content,src',
  )
}

/** 06 行业分类：stock_basic + industry */
export async function tushareIndustry(symbol: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'stock_basic',
    { ts_code: toTushareCode(symbol) },
    'ts_code,name,industry,market',
  )
}

/** 07 指数日线：index_daily */
export async function tushareIndexDaily(indexCode: string, startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'index_daily',
    {
      ts_code: indexCode,
      start_date: startDate,
      end_date: endDate,
    },
    'ts_code,trade_date,close,open,high,low,vol,amount',
  )
}

/** 08 研报：report_rc */
export async function tushareResearchReports(symbol: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'report_rc',
    { ts_code: toTushareCode(symbol) },
    'ts_code,title,author,org_name,rating_name,pub_date,report_date',
  )
}

/** 复权因子：adj_factor */
export async function tushareAdjFactor(symbol: string): Promise<Record<string, unknown>[]> {
  return tushareRequest(
    'adj_factor',
    { ts_code: toTushareCode(symbol) },
    'ts_code,trade_date,adj_factor',
  )
}
