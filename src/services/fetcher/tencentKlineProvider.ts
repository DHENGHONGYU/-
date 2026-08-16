/**
 * @fileoverview 腾讯 K 线 + 批量行情 Provider
 *
 * 从 directDataAPI.ts 拆分：
 * - tencentKline: K 线数据获取
 * - tencentBatchQuotes: 批量实时行情
 */

import {
  TENCENT_API_BASE,
  TENCENT_KLINE_API_BASE,
} from '@/config/marketDataEndpoints'
import {
  type StockQuote,
  type KlineItem,
  DirectDataAPIError,
  buildTencentCode,
  buildTencentKlineCode,
  safeNumber,
  fetchWithTimeout,
  isAbortError,
  logger,
  blog,
} from './directDataAPIError'
import { parseTencentQuote } from './tencentQuoteProvider'

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
  const codeMap = new Map<string, string>()
  for (const c of codes) {
    codeMap.set(buildTencentCode(c), c)
  }
  const query = codes.map(buildTencentCode).join(',')
  const url = `${TENCENT_API_BASE}${query}`
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
      const match = segment.match(/v_(\w+)="([^"]+)"/)
      if (!match || match.length < 3 || match[2] === undefined || match[2] === '') continue
      const tencentCode = match[1] ?? ''
      const fields = match[2].split('~')
      const code = codeMap.get(tencentCode) ?? fields[2] ?? ''
      if (!codeMap.has(tencentCode)) {
        blog.fallback('tencentBatchQuotes codeMap', tencentCode, code)
      }
      if (!code) continue
      const quote = parseTencentQuote(segment, code)
      if (quote) results.push(quote)
    }
    logger.info('[directDataAPI] tencentBatchQuotes done', { requested: codes.length, parsed: results.length })
    return results
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentBatchQuotes failed', {
      count: codes.length, latency, aborted,
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
 */
export async function tencentKline(code: string, period = 'day', count: number): Promise<KlineItem[]> {
  const startTs = Date.now()
  // 注意：K 线接口港股代码为 hk00700（无 s_ 前缀），必须用 buildTencentKlineCode
  const klineCode = buildTencentKlineCode(code)
  const url = `${TENCENT_KLINE_API_BASE}appstock/app/fqkline/get?param=${klineCode},${period},,,${count},qfq`
  logger.info('[directDataAPI] tencentKline start', { code, period, count, url })

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new DirectDataAPIError(`HTTP ${response.status}`, 'tencent')
    }
    const json = (await response.json()) as Record<string, unknown>
    const latency = Date.now() - startTs
    logger.info('[directDataAPI] tencentKline parsed', { code, latency })
    return parseTencentKline(json, klineCode)
  } catch (err) {
    const latency = Date.now() - startTs
    const aborted = isAbortError(err)
    logger.warn('[directDataAPI] tencentKline failed', {
      code, latency, aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err instanceof DirectDataAPIError
      ? err
      : new DirectDataAPIError(aborted ? '腾讯K线请求超时' : '腾讯K线请求失败', 'tencent', err)
  }
}

function resolveStockData(json: Record<string, unknown>, code: string): Record<string, unknown> | null {
  const data = json.data as Record<string, unknown> | undefined
  if (!data) {
    logger.warn('[directDataAPI] parseTencentKline: no data field', { code })
    return null
  }
  // code 已是 buildTencentKlineCode 推导的腾讯 K 线代码（A 股 sh600519 / 港股 hk00700）
  const stockData = data[code] as Record<string, unknown> | undefined
  if (stockData) return stockData
  logger.warn('[directDataAPI] parseTencentKline: no stock entry', { code })
  return null
}

function parseTencentKline(json: Record<string, unknown>, code: string): KlineItem[] {
  try {
    const stockData = resolveStockData(json, code)
    if (!stockData) return []
    return extractTencentKlineRows(stockData, code)
  } catch (err) {
    logger.warn('[directDataAPI] parseTencentKline exception', {
      code, error: err instanceof Error ? err.message : String(err),
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
