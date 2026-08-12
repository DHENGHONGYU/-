/**
 * @fileoverview 腾讯实时行情 Provider
 *
 * 从 directDataAPI.ts 拆分，封装腾讯财经实时行情获取与解析：
 * - tencentQuote: 单股实时行情
 * - parseTencentQuote: A 股响应解析
 * - parseTencentHkQuote: 港股响应解析
 * - parseTencentTimestamp: 时间戳解析
 */

import {
  TENCENT_API_BASE,
} from '@/config/marketDataEndpoints'
import {
  WAN_TO_YUAN_MULTIPLIER,
} from '@/constants/math.constants'
import {
  SHOU_TO_GU_MULTIPLIER,
  PERCENT_MULTIPLIER,
} from '@/constants/stockCode.constants'
import {
  type StockQuote,
  DirectDataAPIError,
  buildTencentCode,
  safeNumber,
  fetchWithTimeout,
  isAbortError,
  logger,
  blog,
} from './directDataAPIError'

/**
 * 腾讯实时行情
 * URL: https://qt.gtimg.cn/q=sh600519
 * 响应: v_sh600519="1~贵州茅台~600519~1800.00~1798.00~...";
 */
export async function tencentQuote(code: string): Promise<StockQuote> {
  const startTs = Date.now()
  const tencentCode = buildTencentCode(code)
  const url = `${TENCENT_API_BASE}${tencentCode}`
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
    const market = code.endsWith('.HK') ? '港股' : 'A 股'
    blog.branchSwitch('tencentQuote', market, { code, name: quote.name, price: quote.price }, 'info')
    return quote
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentQuote failed', {
      code, latency, aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '腾讯请求超时' : '腾讯请求失败', 'tencent', err)
  }
}

/**
 * 解析腾讯行情响应。
 * A 股字段（以 ~ 分割，38+ 字段）：
 *  [1] name  [2] code  [3] price  [4] prevClose  [5] open
 *  [6] volume(手)  [30] date  [31] time  [33] high  [34] low  [37] amount(万元)
 * 港股字段（仅 ~10 字段，字段顺序不同）
 */
export function parseTencentQuote(text: string, code: string): StockQuote | null {
  try {
    const match = text.match(/v_(\w+)="([^"]+)"/)
    if (!match || match.length < 3 || match[2] === undefined || match[2] === '') {
      logger.warn('[directDataAPI] parseTencentQuote: no match', { code })
      return null
    }
    const prefix = match[1] ?? ''
    const fields = match[2].split('~')

    if (prefix.startsWith('s_hk')) {
      blog.branchSwitch('parseTencentQuote', '港股', { code, prefix, fieldCount: fields.length })
      return parseTencentHkQuote(fields, code)
    }
    blog.branchSwitch('parseTencentQuote', 'A 股', { code, prefix, fieldCount: fields.length })

    if (fields.length < 10) {
      logger.warn('[directDataAPI] parseTencentQuote: insufficient fields', { code, count: fields.length })
      return null
    }

    const name = fields[1] ?? code
    const price = safeNumber(fields[3])
    const prevClose = safeNumber(fields[4])
    const open = safeNumber(fields[5])
    const volume = safeNumber(fields[6]) * SHOU_TO_GU_MULTIPLIER
    const high = safeNumber(fields[33])
    const low = safeNumber(fields[34])
    const amount = safeNumber(fields[37]) * WAN_TO_YUAN_MULTIPLIER
    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * PERCENT_MULTIPLIER : 0
    const timestamp = parseTencentTimestamp(fields[30] ?? '', fields[31] ?? '')

    return { code, name, price, change, changePercent, open, high, low, prevClose, volume, amount, timestamp, source: 'tencent' }
  } catch (err) {
    logger.warn('[directDataAPI] parseTencentQuote exception', {
      code, error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/** 解析腾讯港股行情（字段顺序与 A 股不同） */
export function parseTencentHkQuote(fields: string[], code: string): StockQuote | null {
  if (fields.length < 7) {
    logger.warn('[directDataAPI] parseTencentHkQuote: insufficient fields', { code, count: fields.length })
    return null
  }
  const name = fields[1] ?? code
  const price = safeNumber(fields[3])
  const change = safeNumber(fields[4])
  const changePercent = safeNumber(fields[5])
  const volume = safeNumber(fields[6])
  const amount = safeNumber(fields[7])
  const prevClose = change !== 0 ? price - change : price

  return {
    code, name, price, change, changePercent,
    open: 0, high: 0, low: 0, // 腾讯港股不提供
    prevClose, volume, amount,
    timestamp: Date.now(), source: 'tencent',
  }
}

export function parseTencentTimestamp(dateStr: string, timeStr: string): number {
  try {
    if (!dateStr || dateStr.length < 8) return Date.now()
    const y = Number(dateStr.slice(0, 4))
    const m = Number(dateStr.slice(4, 6))
    const d = Number(dateStr.slice(6, 8))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return Date.now()
    const timePart = timeStr.length > 0 && timeStr.includes(':') ? timeStr : '00:00:00'
    const parts = timePart.split(':')
    const ts = new Date(y, m - 1, d, Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)).getTime()
    return Number.isFinite(ts) ? ts : Date.now()
  } catch (err) {
    logger.warn('[directDataAPI] parseTencentTimestamp exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return Date.now()
  }
}
