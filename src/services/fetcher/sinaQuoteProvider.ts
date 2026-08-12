/**
 * @fileoverview 新浪实时行情 Provider（含批量）
 *
 * 从 directDataAPI.ts 拆分：
 * - sinaQuote: 单股实时行情
 * - sinaBatchQuotes: 批量行情
 * - parseSinaQuote / parseSinaHkQuote: A 股 / 港股解析
 */

import {
  SINA_API_BASE,
} from '@/config/marketDataEndpoints'
import {
  PERCENT_MULTIPLIER,
} from '@/constants/stockCode.constants'
import {
  type StockQuote,
  DirectDataAPIError,
  buildSinaCode,
  safeNumber,
  fetchWithTimeout,
  isAbortError,
  logger,
  blog,
} from './directDataAPIError'

/**
 * 新浪实时行情
 * URL: https://hq.sinajs.cn/list=sh600519
 * 字段：[0]name [1]open [2]prevClose [3]price [4]high [5]low
 *       [26]date [27]time [29]volume(股) [30]amount(元)
 */
export async function sinaQuote(code: string): Promise<StockQuote> {
  const startTs = Date.now()
  const sinaCode = buildSinaCode(code)
  const url = `${SINA_API_BASE}${sinaCode}`
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
    const market = code.endsWith('.HK') ? '港股' : 'A 股'
    blog.branchSwitch('sinaQuote', market, { code, name: quote.name, price: quote.price }, 'info')
    return quote
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] sinaQuote failed', {
      code, latency, aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '新浪请求超时' : '新浪请求失败', 'sina', err)
  }
}

export function parseSinaQuote(text: string, code: string): StockQuote | null {
  try {
    const match = text.match(/hq_str_(\w+)="([^"]*)"/)
    if (!match || match.length < 3 || match[2] === undefined) {
      logger.warn('[directDataAPI] parseSinaQuote: no match', { code })
      return null
    }
    const prefix = match[1] ?? ''
    const fields = match[2].split(',')

    if (prefix.startsWith('rt_hk')) {
      blog.branchSwitch('parseSinaQuote', '港股', { code, prefix, fieldCount: fields.length })
      return parseSinaHkQuote(fields, code)
    }
    blog.branchSwitch('parseSinaQuote', 'A 股', { code, prefix, fieldCount: fields.length })

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
    const volume = safeNumber(fields[29])
    const amount = safeNumber(fields[30])
    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * PERCENT_MULTIPLIER : 0
    const timestamp = parseSinaTimestamp(fields[26] ?? '', fields[27] ?? '')

    return { code, name, price, change, changePercent, open, high, low, prevClose, volume, amount, timestamp, source: 'sina' }
  } catch (err) {
    logger.warn('[directDataAPI] parseSinaQuote exception', {
      code, error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/** 解析新浪港股行情（字段顺序与 A 股不同） */
export function parseSinaHkQuote(fields: string[], code: string): StockQuote | null {
  if (fields.length < 7) {
    logger.warn('[directDataAPI] parseSinaHkQuote: insufficient fields', { code, count: fields.length })
    return null
  }
  const name = fields[1] ?? fields[0] ?? code
  const open = safeNumber(fields[2])
  const prevClose = safeNumber(fields[3])
  const high = safeNumber(fields[4])
  const low = safeNumber(fields[5])
  const price = safeNumber(fields[6])
  const change = safeNumber(fields[7], price - prevClose)
  const changePercent = safeNumber(fields[8], prevClose > 0 ? (change / prevClose) * PERCENT_MULTIPLIER : 0)
  const amount = safeNumber(fields[11])
  const volume = safeNumber(fields[12])
  const dateStr = (fields[17] ?? '').replace(/\//g, '-')
  const timestamp = parseSinaTimestamp(dateStr, fields[18] ?? '')

  return { code, name, price, change, changePercent, open, high, low, prevClose, volume, amount, timestamp, source: 'sina' }
}

export function parseSinaTimestamp(dateStr: string, timeStr: string): number {
  try {
    if (!dateStr) return Date.now()
    const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr
    const ts = new Date(combined).getTime()
    return Number.isFinite(ts) ? ts : Date.now()
  } catch (err) {
    logger.warn('[directDataAPI] parseSinaTimestamp exception', {
      error: err instanceof Error ? err.message : String(err),
    })
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
  const codeMap = new Map<string, string>()
  for (const c of codes) {
    codeMap.set(buildSinaCode(c), c)
  }
  const query = codes.map(buildSinaCode).join(',')
  const url = `${SINA_API_BASE}${query}`
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
      if (!match || match.length < 3 || match[1] === undefined || match[1] === '') continue
      const fullCode = match[1]
      const code = codeMap.get(fullCode) ?? fullCode.replace(/^(sh|sz|bj|rt_hk)/, '')
      if (!codeMap.has(fullCode)) {
        blog.fallback('sinaBatchQuotes codeMap', fullCode, code)
      }
      if (!code) continue
      const quote = parseSinaQuote(line, code)
      if (quote) results.push(quote)
    }
    logger.info('[directDataAPI] sinaBatchQuotes done', { requested: codes.length, parsed: results.length })
    return results
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] sinaBatchQuotes failed', {
      count: codes.length, latency, aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '新浪批量请求超时' : '新浪批量请求失败', 'sina', err)
  }
}
