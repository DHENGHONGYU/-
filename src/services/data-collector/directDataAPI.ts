/**
 * @fileoverview 直连数据 API — 腾讯/新浪/网易真实行情接口
 *
 * 职责：
 * - B-1: 腾讯财经直连 API（qt.gtimg.cn）实时行情
 * - B-2: 新浪（hq.sinajs.cn）+ 网易（quotes.163.com）备用 API
 *
 * 注意：浏览器环境可能遇到 CORS 限制，生产环境需配置代理。
 * 所有函数在失败时返回 null，由 dataSourceOrchestrator 负责降级。
 */

import { getLogger } from '@/lib/logger'
import type { Stock, DailyQuotes } from '@/data/types'
import type { KlineBar } from '@/data/types/types.marketData'
import {
  TENCENT_API_BASE,
  TENCENT_REFERER,
  SINA_API_BASE,
  NETEASE_API_BASE,
} from '@/config/marketDataEndpoints'

const logger = getLogger()

// ── API 端点常量 ──
// 已迁移至 src/config/marketDataEndpoints.ts，保持服务层零硬编码 URL。

// ── 类型定义 ──

export interface RealtimeQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  timestamp: number
}

export interface SourceInfo {
  source: 'tencent' | 'sina' | 'netease' | 'mock'
  latency: number
}

// ── 工具函数 ──

/** 将 6 位代码转换为腾讯格式（sh/sz 前缀） */
function toTencentCode(code: string): string {
  if (code.startsWith('6')) return `sh${code}`
  if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`
  if (code.startsWith('8') || code.startsWith('4')) return `bj${code}`
  return `sh${code}`
}

/** 将 6 位代码转换为新浪格式 */
function toSinaCode(code: string): string {
  return toTencentCode(code)
}

/** 将 6 位代码转换为网易格式（0=沪/1=深 前缀） */
function toNeteaseCode(code: string): string {
  if (code.startsWith('6')) return `0${code}`
  return `1${code}`
}

/** 安全 fetch（带超时） */
async function safeFetch(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Referer: TENCENT_REFERER },
    })
    clearTimeout(timer)
    if (!res.ok) {
      logger.warn(`[directDataAPI] HTTP ${res.status}: ${url}`)
      return null
    }
    return await res.text()
  } catch (err) {
    logger.warn(`[directDataAPI] fetch 失败: ${url}`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ── B-1: 腾讯财经直连 API ──

/**
 * 腾讯实时行情（单只）
 * API: https://qt.gtimg.cn/q=sh600519
 */
export async function tencentQuote(code: string): Promise<RealtimeQuote | null> {
  const tencentCode = toTencentCode(code)
  const url = `${TENCENT_API_BASE}${tencentCode}`
  const start = Date.now()

  const text = await safeFetch(url)
  if (!text) return null

  try {
    // 腾讯格式: v_sh600519="1~贵州茅台~600519~1689.00~1685.00~1690.00~..."
    const match = text.match(/v_\w+="([^"]+)"/)
    if (!match?.[1]) return null

    const fields = match[1].split('~')
    if (fields.length < 50) return null

    const quote: RealtimeQuote = {
      symbol: code,
      name: fields[1] || '',
      price: parseFloat(fields[3] || '0') || 0,
      change: parseFloat(fields[31] || '0') || 0,
      changePercent: parseFloat(fields[32] || '0') || 0,
      open: parseFloat(fields[5] || '0') || 0,
      high: parseFloat(fields[33] || '0') || 0,
      low: parseFloat(fields[34] || '0') || 0,
      volume: parseInt(fields[36] || '0') || 0,
      amount: parseFloat(fields[37] || '0') || 0,
      timestamp: Date.now(),
    }

    logger.info(`[directDataAPI] 腾讯行情获取成功: ${code}`, { latency: Date.now() - start })
    return quote
  } catch (err) {
    logger.warn(`[directDataAPI] 腾讯行情解析失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * 腾讯批量行情
 * API: https://qt.gtimg.cn/q=sh600519,sz000001
 */
export async function tencentBatchQuotes(codes: string[]): Promise<RealtimeQuote[]> {
  const tencentCodes = codes.map(toTencentCode).join(',')
  const url = `${TENCENT_API_BASE}${tencentCodes}`
  const text = await safeFetch(url)
  if (!text) return []

  const results: RealtimeQuote[] = []
  const matches = text.matchAll(/v_(\w+)="([^"]+)"/g)
  let idx = 0
  for (const match of matches) {
    const code = codes[idx]
    if (!code || !match[2]) {
      idx++
      continue
    }
    const fields = match[2].split('~')
    if (fields.length >= 50) {
      results.push({
        symbol: code,
        name: fields[1] || '',
        price: parseFloat(fields[3] || '0') || 0,
        change: parseFloat(fields[31] || '0') || 0,
        changePercent: parseFloat(fields[32] || '0') || 0,
        open: parseFloat(fields[5] || '0') || 0,
        high: parseFloat(fields[33] || '0') || 0,
        low: parseFloat(fields[34] || '0') || 0,
        volume: parseInt(fields[36] || '0') || 0,
        amount: parseFloat(fields[37] || '0') || 0,
        timestamp: Date.now(),
      })
    }
    idx++
  }
  return results
}

// ── B-2: 新浪备用 API ──

/**
 * 新浪实时行情
 * API: https://hq.sinajs.cn/list=sh600519
 */
export async function sinaQuote(code: string): Promise<RealtimeQuote | null> {
  const sinaCode = toSinaCode(code)
  const url = `${SINA_API_BASE}${sinaCode}`
  const start = Date.now()

  const text = await safeFetch(url)
  if (!text) return null

  try {
    // 新浪格式: var hq_str_sh600519="贵州茅台,1685.00,1690.00,..."
    const match = text.match(/hq_str_\w+="([^"]+)"/)
    if (!match?.[1]) return null

    const fields = match[1].split(',')
    if (fields.length < 10) return null

    const quote: RealtimeQuote = {
      symbol: code,
      name: fields[0] || '',
      price: parseFloat(fields[3] || '0') || 0,
      change: (parseFloat(fields[3] || '0') || 0) - (parseFloat(fields[2] || '0') || 0),
      changePercent: parseFloat(fields[2] || '0') > 0 ? ((parseFloat(fields[3] || '0') - parseFloat(fields[2] || '0')) / parseFloat(fields[2] || '0')) * 100 : 0,
      open: parseFloat(fields[1] || '0') || 0,
      high: parseFloat(fields[4] || '0') || 0,
      low: parseFloat(fields[5] || '0') || 0,
      volume: parseInt(fields[8] || '0') || 0,
      amount: parseFloat(fields[9] || '0') || 0,
      timestamp: Date.now(),
    }

    logger.info(`[directDataAPI] 新浪行情获取成功: ${code}`, { latency: Date.now() - start })
    return quote
  } catch (err) {
    logger.warn(`[directDataAPI] 新浪行情解析失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * 新浪批量行情
 */
export async function sinaBatchQuotes(codes: string[]): Promise<RealtimeQuote[]> {
  const sinaCodes = codes.map(toSinaCode).join(',')
  const url = `${SINA_API_BASE}${sinaCodes}`
  const text = await safeFetch(url)
  if (!text) return []

  const results: RealtimeQuote[] = []
  const matches = text.matchAll(/hq_str_(\w+)="([^"]+)"/g)
  let idx = 0
  for (const match of matches) {
    const code = codes[idx]
    if (!code || !match[2]) {
      idx++
      continue
    }
    const fields = match[2].split(',')
    if (fields.length >= 10) {
      results.push({
        symbol: code,
        name: fields[0] || '',
        price: parseFloat(fields[3] || '0') || 0,
        change: (parseFloat(fields[3] || '0') || 0) - (parseFloat(fields[2] || '0') || 0),
        changePercent: parseFloat(fields[2] || '0') > 0 ? ((parseFloat(fields[3] || '0') - parseFloat(fields[2] || '0')) / parseFloat(fields[2] || '0')) * 100 : 0,
        open: parseFloat(fields[1] || '0') || 0,
        high: parseFloat(fields[4] || '0') || 0,
        low: parseFloat(fields[5] || '0') || 0,
        volume: parseInt(fields[8] || '0') || 0,
        amount: parseFloat(fields[9] || '0') || 0,
        timestamp: Date.now(),
      })
    }
    idx++
  }
  return results
}

// ── B-2: 网易历史 K 线 API ──

/**
 * 网易历史 K 线数据
 * API: https://quotes.163.com/service/chddata.html?code=0600519&start=20260101&end=20260708&fields=TCLOSE;HIGH;LOW;TOPEN;LCLOSE;CHG;PCHG;TURNOVER;VOTURNOVER;VATURNOVER
 */
export async function neteaseHistory(
  code: string,
  startDate: string,
  endDate: string,
): Promise<KlineBar[]> {
  const neteaseCode = toNeteaseCode(code)
  const fields = 'TCLOSE;HIGH;LOW;TOPEN;LCLOSE;CHG;PCHG;TURNOVER;VOTURNOVER;VATURNOVER'
  const url = `${NETEASE_API_BASE}?code=${neteaseCode}&start=${startDate}&end=${endDate}&fields=${fields}`
  const start = Date.now()

  const text = await safeFetch(url, 10000)
  if (!text) return []

  try {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    // 网易 CSV 格式: 日期,股票代码,名称,收盘价,最高价,最低价,开盘价,前收盘,涨跌额,涨跌幅,换手率,成交量,成交金额
    const klines = parseNeteaseLines(lines)
    klines.reverse() // 网易返回的是倒序（最新在前），反转为正序
    logger.info(`[directDataAPI] 网易K线获取成功: ${code}, ${klines.length} 条`, { latency: Date.now() - start })
    return klines
  } catch (err) {
    logger.warn(`[directDataAPI] 网易K线解析失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

/** 解析单条网易 CSV 行为 KlineBar（非法行返回 null） */
function parseNeteaseLine(line: string | undefined): KlineBar | null {
  if (!line) return null
  const cols = line.split(',')
  if (cols.length < 13) return null

  const date = (cols[0] || '').trim()
  const close = parseFloat(cols[3] || '0') || 0
  const high = parseFloat(cols[4] || '0') || 0
  const low = parseFloat(cols[5] || '0') || 0
  const open = parseFloat(cols[6] || '0') || 0
  const volume = parseInt(cols[11] || '0') || 0
  const amount = parseFloat(cols[12] || '0') || 0

  if (!date || close <= 0) return null
  return { date, open, high, low, close, volume, amount }
}

/** 解析网易 CSV 历史 K 线文本为多根 KlineBar（正序） */
function parseNeteaseLines(lines: string[]): KlineBar[] {
  const klines: KlineBar[] = []
  for (let i = 1; i < lines.length; i++) {
    const kline = parseNeteaseLine(lines[i])
    if (kline) klines.push(kline)
  }
  return klines
}

// ── 类型转换工具 ──

/** RealtimeQuote → Stock（部分字段） */
export function quoteToStock(quote: RealtimeQuote): Partial<Stock> {
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    pe: undefined,
    pb: undefined,
    updatedAt: quote.timestamp,
  }
}

/** KlineBar[] → DailyQuotes */
export function klinesToDailyQuotes(symbol: string, klines: KlineBar[]): DailyQuotes {
  return {
    symbol,
    latest: klines[klines.length - 1] ?? { date: '', open: 0, high: 0, low: 0, close: 0, volume: 0, amount: 0 },
    history: klines,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}
