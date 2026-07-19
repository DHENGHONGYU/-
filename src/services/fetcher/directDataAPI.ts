/**
 * 直连数据源 API（腾讯 / 新浪 / 网易）— CANONICAL 实现
 *
 * 提供 StockQuote 与 KlineItem 直连采集能力，绕过 Python AKShare 后端，
 * 用于数据采集四层降级编排（腾讯 → 新浪 → AKShare → Mock / 网易 → 腾讯 → AKShare → Mock）。
 *
 * ⚠️ **收敛说明**：此文件为 canonical 实现。
 * `src/services/data-collector/directDataAPI.ts` 为独立副本（类型/签名/错误策略均不兼容）。
 *
 * **阶段 1（2026-07-19）**: 代码格式化函数已提取至 `src/core/stockCodeUtils.ts`。
 * data-collector 副本新增 `tencentKline()`（腾讯 web.ifzq.gtimg.cn 日 K线）。
 *
 * **阶段 2（计划中）**: 统一迁移到此版本。迁移时需处理：
 *   - 类型映射：RealtimeQuote → StockQuote, KlineBar → KlineItem
 *   - 错误策略：null/空数组 → throw DirectDataAPIError
 *   - 适配函数：quoteToStock/klinesToDailyQuotes 保留在 data-collector 层作为 wrapper
 *
 * 注意：
 * - 浏览器跨域 (CORS) 限制可能导致这些请求在开发环境直接失败，
 *   调用方应捕获异常并按降级链切换到下一个源。
 * - 所有网络请求均使用 AbortController(30s) 超时控制。
 * - 严格遵守项目硬约束：核心分支均打印 logger.info，全部 try-catch。
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { getLogger } from '@/lib/logger'
import {
  TENCENT_QUOTE_API,
  TENCENT_KLINE_API,
  SINA_QUOTE_API,
  NETEASE_HISTORY_API,
} from '@/config/dataSourceUrls'
import { WAN_TO_YUAN_MULTIPLIER } from '@/constants/math.constants'

const logger = getLogger()

/** 单请求默认超时（30s） */
const REQUEST_TIMEOUT_MS = 30000

// ============================================================
// 公共类型定义
// ============================================================

export interface StockQuote {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
  timestamp: number
  source: 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock'
}

export interface KlineItem {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
  /** 数据来源标记（'tencent' | 'netease' | 'akshare' | 'mock'），用于 Mock 检测 */
  source?: string
}

// ============================================================
// 内部工具
// ============================================================

class DirectDataAPIError extends Error {
  constructor(
    message: string,
    public readonly source: 'tencent' | 'sina' | 'netease',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DirectDataAPIError'
  }
}

/** 根据股票代码推断交易所前缀：沪市 sh，深市 sz */
function getMarketPrefix(code: string): 'sh' | 'sz' {
  const c = code.trim()
  // 6/5/11/13 开头归沪市（600/601/603/605/510/511/513/113 等），其余归深市
  if (c.startsWith('6') || c.startsWith('5') || c.startsWith('11') || c.startsWith('13')) {
    return 'sh'
  }
  return 'sz'
}

/** 网易历史接口代码前缀：0=沪，1=深 */
function getNeteaseCode(code: string): string {
  return getMarketPrefix(code) === 'sh' ? `0${code}` : `1${code}`
}

/** 安全数字解析：非法/空值返回 fallback */
function safeNumber(val: string | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback
  const trimmed = String(val).trim()
  if (trimmed === '') return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

/** fetch + AbortController 超时控制 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    logger.info('[directDataAPI] fetch start', { url, timeoutMs })
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, application/json, */*' },
    })
    logger.info('[directDataAPI] fetch response', { url, status: response.status })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
}

// ============================================================
// B-1: 腾讯财经直连 API
// ============================================================

/**
 * 腾讯实时行情
 * URL: https://qt.gtimg.cn/q=sh600519
 * 响应: v_sh600519="1~贵州茅台~600519~1800.00~1798.00~...";
 */
export async function tencentQuote(code: string): Promise<StockQuote> {
  const startTs = Date.now()
  const prefix = getMarketPrefix(code)
  const url = `${TENCENT_QUOTE_API}=${prefix}${code}`
  logger.info('[directDataAPI] tencentQuote start', { code, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'tencent')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] tencentQuote', { code, latency })

    const quote = parseTencentQuote(text, code)
    if (!quote) {
      throw new DirectDataAPIError('解析腾讯行情失败', 'tencent')
    }
    return quote
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentQuote failed', {
      code,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '腾讯请求超时' : '腾讯请求失败', 'tencent', err)
  }
}

/**
 * 解析腾讯行情响应。
 * 字段（以 ~ 分割，已知索引）：
 *  [1] name  [2] code  [3] price  [4] prevClose  [5] open
 *  [6] volume(手)  [30] date(YYYYMMDD)  [31] time(HH:MM:SS)
 *  [33] high  [34] low  [37] amount(万元)
 */
function parseTencentQuote(text: string, code: string): StockQuote | null {
  try {
    const match = text.match(/v_\w+="([^"]+)"/)
    if (!match || match.length < 2 || !match[1]) {
      logger.warn('[directDataAPI] parseTencentQuote: no match', { code })
      return null
    }
    const fields = match[1].split('~')
    if (fields.length < 10) {
      logger.warn('[directDataAPI] parseTencentQuote: insufficient fields', { code, count: fields.length })
      return null
    }

    const name = fields[1] ?? code
    const price = safeNumber(fields[3])
    const prevClose = safeNumber(fields[4])
    const open = safeNumber(fields[5])
    const volume = safeNumber(fields[6]) * 100 // 手 → 股
    const high = safeNumber(fields[33])
    const low = safeNumber(fields[34])
    const amount = safeNumber(fields[37]) * WAN_TO_YUAN_MULTIPLIER // 万元 → 元
    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0
    const dateStr = fields[30] ?? ''
    const timeStr = fields[31] ?? ''
    const timestamp = parseTencentTimestamp(dateStr, timeStr)

    return {
      code,
      name,
      price,
      change,
      changePercent,
      open,
      high,
      low,
      prevClose,
      volume,
      amount,
      timestamp,
      source: 'tencent',
    }
  } catch (err) {
    logger.warn('[directDataAPI] parseTencentQuote exception', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function parseTencentTimestamp(dateStr: string, timeStr: string): number {
  try {
    if (!dateStr || dateStr.length < 8) return Date.now()
    const y = Number(dateStr.slice(0, 4))
    const m = Number(dateStr.slice(4, 6))
    const d = Number(dateStr.slice(6, 8))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return Date.now()
    const timePart = timeStr && timeStr.includes(':') ? timeStr : '00:00:00'
    const parts = timePart.split(':')
    const h = Number(parts[0] ?? 0)
    const mi = Number(parts[1] ?? 0)
    const s = Number(parts[2] ?? 0)
    const ts = new Date(y, m - 1, d, h, mi, s).getTime()
    return Number.isFinite(ts) ? ts : Date.now()
  } catch (err) { console.warn('[directDataAPI.ts]', err);
    return Date.now()
  }
}

/**
 * 腾讯批量行情
 * URL: https://qt.gtimg.cn/q=sh600519,sz000001
 */
export async function tencentBatchQuotes(codes: string[]): Promise<StockQuote[]> {
  const startTs = Date.now()
  if (codes.length === 0) {
    logger.info('[directDataAPI] tencentBatchQuotes empty input')
    return []
  }
  const query = codes.map((c) => `${getMarketPrefix(c)}${c}`).join(',')
  const url = `${TENCENT_QUOTE_API}=${query}`
  logger.info('[directDataAPI] tencentBatchQuotes start', { count: codes.length, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'tencent')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] tencentBatchQuotes parsed', { count: codes.length, latency })

    const results: StockQuote[] = []
    const segments = text.split(';').map((s) => s.trim()).filter(Boolean)
    for (const segment of segments) {
      const match = segment.match(/v_\w+="([^"]+)"/)
      if (!match || match.length < 2 || !match[1]) continue
      const fields = match[1].split('~')
      const segCode = fields[2] ?? ''
      if (!segCode) continue
      const quote = parseTencentQuote(segment, segCode)
      if (quote) results.push(quote)
    }
    logger.info('[directDataAPI] tencentBatchQuotes done', { requested: codes.length, parsed: results.length })
    return results
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentBatchQuotes failed', {
      count: codes.length,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '腾讯批量请求超时' : '腾讯批量请求失败', 'tencent', err)
  }
}

/**
 * 腾讯 K 线
 * URL: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,30,qfq
 * 响应 JSON: { data: { sh600519: { qfqday: [[date,open,close,high,low,vol,amount], ...] } } }
 */
export async function tencentKline(code: string, period = 'day', count: number): Promise<KlineItem[]> {
  const startTs = Date.now()
  const prefix = getMarketPrefix(code)
  const url = `${TENCENT_KLINE_API}?param=${prefix}${code},${period},,,${count},qfq`
  logger.info('[directDataAPI] tencentKline start', { code, period, count, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'tencent')
    }
    const json = (await response.json()) as Record<string, unknown>
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] tencentKline parsed', { code, latency })

    return parseTencentKline(json, code)
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentKline failed', {
      code,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '腾讯K线请求超时' : '腾讯K线请求失败', 'tencent', err)
  }
}

/** 从腾讯 K 线响应中取出目标股票的 data 节点（含前缀兜底），无有效节点返回 null */
function resolveStockData(json: Record<string, unknown>, code: string): Record<string, unknown> | null {
  const data = json.data as Record<string, unknown> | undefined
  if (!data) {
    logger.warn('[directDataAPI] parseTencentKline: no data field', { code })
    return null
  }
  const stockData = data[code] as Record<string, unknown> | undefined
  if (stockData) return stockData
  // 兜底：部分响应以带前缀的 key 返回
  const prefix = getMarketPrefix(code)
  const prefixed = data[`${prefix}${code}`] as Record<string, unknown> | undefined
  if (!prefixed) {
    logger.warn('[directDataAPI] parseTencentKline: no stock entry', { code })
    return null
  }
  return prefixed
}

function parseTencentKline(json: Record<string, unknown>, code: string): KlineItem[] {
  try {
    const stockData = resolveStockData(json, code)
    if (!stockData) return []
    return extractTencentKlineRows(stockData, code)
  } catch (err) {
    logger.warn('[directDataAPI] parseTencentKline exception', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

function extractTencentKlineRows(stockData: Record<string, unknown>, code: string): KlineItem[] {
  const day = stockData.day as unknown[] | undefined
  const qfqday = stockData.qfqday as unknown[] | undefined
  const klineArr = qfqday ?? day
  if (!Array.isArray(klineArr)) {
    logger.warn('[directDataAPI] extractTencentKlineRows: kline not array', { code })
    return []
  }
  const items: KlineItem[] = []
  for (const row of klineArr) {
    if (!Array.isArray(row)) continue
    const r = row as unknown[]
    // [date, open, close, high, low, volume, amount]
    items.push({
      date: typeof r[0] === 'string' ? r[0] : JSON.stringify(r[0] ?? ''),
      open: safeNumber(r[1] as string | undefined),
      close: safeNumber(r[2] as string | undefined),
      high: safeNumber(r[3] as string | undefined),
      low: safeNumber(r[4] as string | undefined),
      volume: safeNumber(r[5] as string | undefined),
      amount: safeNumber(r[6] as string | undefined),
      source: 'tencent',
    })
  }
  logger.info('[directDataAPI] extractTencentKlineRows done', { code, count: items.length })
  return items
}

// ============================================================
// B-2: 新浪 + 网易备用 API
// ============================================================

/**
 * 新浪实时行情
 * URL: https://hq.sinajs.cn/list=sh600519
 * 响应: var hq_str_sh600519="贵州茅台,1800.00,1798.00,...";
 *
 * 字段（以 , 分割）：
 *  [0] name  [1] open  [2] prevClose  [3] price  [4] high  [5] low
 *  [26] date(YYYY-MM-DD)  [27] time(HH:MM:SS)  [29] volume(股)  [30] amount(元)
 */
export async function sinaQuote(code: string): Promise<StockQuote> {
  const startTs = Date.now()
  const prefix = getMarketPrefix(code)
  const url = `${SINA_QUOTE_API}=${prefix}${code}`
  logger.info('[directDataAPI] sinaQuote start', { code, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'sina')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] sinaQuote', { code, latency })

    const quote = parseSinaQuote(text, code)
    if (!quote) {
      throw new DirectDataAPIError('解析新浪行情失败', 'sina')
    }
    return quote
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] sinaQuote failed', {
      code,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '新浪请求超时' : '新浪请求失败', 'sina', err)
  }
}

function parseSinaQuote(text: string, code: string): StockQuote | null {
  try {
    const match = text.match(/hq_str_\w+="([^"]*)"/)
    if (!match || match.length < 2 || match[1] === undefined) {
      logger.warn('[directDataAPI] parseSinaQuote: no match', { code })
      return null
    }
    const fields = match[1].split(',')
    if (fields.length < 6) {
      logger.warn('[directDataAPI] parseSinaQuote: insufficient fields', { code, count: fields.length })
      return null
    }

    const name = fields[0] ?? code
    const open = safeNumber(fields[1])
    const prevClose = safeNumber(fields[2])
    const price = safeNumber(fields[3])
    const high = safeNumber(fields[4])
    const low = safeNumber(fields[5])
    const dateStr = fields[26] ?? ''
    const timeStr = fields[27] ?? ''
    const volume = safeNumber(fields[29])
    const amount = safeNumber(fields[30])
    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0
    const timestamp = parseSinaTimestamp(dateStr, timeStr)

    return {
      code,
      name,
      price,
      change,
      changePercent,
      open,
      high,
      low,
      prevClose,
      volume,
      amount,
      timestamp,
      source: 'sina',
    }
  } catch (err) {
    logger.warn('[directDataAPI] parseSinaQuote exception', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function parseSinaTimestamp(dateStr: string, timeStr: string): number {
  try {
    if (!dateStr) return Date.now()
    const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr
    const ts = new Date(combined).getTime()
    return Number.isFinite(ts) ? ts : Date.now()
  } catch (err) { console.warn('[directDataAPI.ts]', err);
    return Date.now()
  }
}

/**
 * 新浪批量行情
 * URL: https://hq.sinajs.cn/list=sh600519,sz000001
 */
export async function sinaBatchQuotes(codes: string[]): Promise<StockQuote[]> {
  const startTs = Date.now()
  if (codes.length === 0) {
    logger.info('[directDataAPI] sinaBatchQuotes empty input')
    return []
  }
  const query = codes.map((c) => `${getMarketPrefix(c)}${c}`).join(',')
  const url = `${SINA_QUOTE_API}=${query}`
  logger.info('[directDataAPI] sinaBatchQuotes start', { count: codes.length, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'sina')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] sinaBatchQuotes parsed', { count: codes.length, latency })

    const results: StockQuote[] = []
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="([^"]*)"/)
      if (!match || match.length < 3 || !match[1]) continue
      const fullCode = match[1]
      const segCode = fullCode.replace(/^(sh|sz|bj)/, '')
      if (!segCode) continue
      const quote = parseSinaQuote(line, segCode)
      if (quote) results.push(quote)
    }
    logger.info('[directDataAPI] sinaBatchQuotes done', { requested: codes.length, parsed: results.length })
    return results
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] sinaBatchQuotes failed', {
      count: codes.length,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '新浪批量请求超时' : '新浪批量请求失败', 'sina', err)
  }
}

/**
 * 网易历史 K 线（CSV 格式）
 * URL: https://quotes.163.com/service/chddata.html?code=0600519&start=20240101&end=20240601&fields=TCLOSE;HIGH;LOW;TOPEN;VOTURNOVER;VATURNOVER
 *
 * CSV 列顺序（按请求 fields 顺序）：
 *  [0] 日期  [1] 股票代码  [2] 名称  [3] 收盘价  [4] 最高价  [5] 最低价
 *  [6] 开盘价  [7] 成交量  [8] 成交金额
 *
 * 注意：网易返回 CSV 可能为 GBK 编码，浏览器以 UTF-8 解析时表头中文可能乱码，
 *      故采用固定列索引而非表头匹配，保证解析鲁棒性。
/**
 * neteaseHistory
 * @param code
 * @param start
 * @param end
 * @returns Promise<KlineItem[]>
 */
export async function neteaseHistory(code: string, start: string, end: string): Promise<KlineItem[]> {
  const startTs = Date.now()
  const neteaseCode = getNeteaseCode(code)
  const url = `${NETEASE_HISTORY_API}?code=${neteaseCode}&start=${start}&end=${end}&fields=TCLOSE;HIGH;LOW;TOPEN;VOTURNOVER;VATURNOVER`
  logger.info('[directDataAPI] neteaseHistory start', { code, start, end, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'netease')
    }
    const text = await response.text()
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] neteaseHistory parsed', { code, latency })

    return parseNeteaseCsv(text, code)
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] neteaseHistory failed', {
      code,
      latency,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '网易历史请求超时' : '网易历史请求失败', 'netease', err)
  }
}

function parseNeteaseCsv(text: string, code: string): KlineItem[] {
  try {
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (lines.length < 2) {
      logger.warn('[directDataAPI] parseNeteaseCsv: no data rows', { code, lineCount: lines.length })
      return []
    }
    // 第一行为表头，跳过
    logger.info('[directDataAPI] parseNeteaseCsv header', { code, header: lines[0] })

    const items: KlineItem[] = []
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]!.split(',')
      const dateCell = row[0] ?? ''
      if (!dateCell || dateCell.trim() === '') continue
      const item: KlineItem = {
        date: dateCell.trim(),
        close: safeNumber(row[3]),
        high: safeNumber(row[4]),
        low: safeNumber(row[5]),
        open: safeNumber(row[6]),
        volume: safeNumber(row[7]),
        amount: safeNumber(row[8]),
        source: 'netease',
      }
      items.push(item)
    }
    logger.info('[directDataAPI] parseNeteaseCsv done', { code, count: items.length })
    return items
  } catch (err) {
    logger.warn('[directDataAPI] parseNeteaseCsv exception', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
