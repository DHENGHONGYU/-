/**
 * @fileoverview 直连数据 API — 腾讯/新浪/网易真实行情接口
 *
 * ⚠️ **收敛状态**：此文件与 `src/services/fetcher/directDataAPI.ts` 为独立副本，
 * API 签名/类型/错误策略均不兼容。
 *
 * **阶段 1（2026-07-19）**: 代码格式化函数 (toTencentCode/toSinaCode/toNeteaseCode)
 * 已提取至 `src/core/stockCodeUtils.ts` 作为 canonical shared utility。
 *
 * **阶段 2（计划中）**: 统一类型 (RealtimeQuote↔StockQuote, KlineBar↔KlineItem)
 * 与错误策略 (null→return null vs throw DirectDataAPIError)。迁移时需处理：
 *   - 所有消费者 import 路径更新
 *   - quoteToStock/klinesToDailyQuotes adapter wrapper 保留
 *
 * @see src/core/stockCodeUtils.ts — 共享代码格式化函数
 * @see src/services/fetcher/directDataAPI.ts — canonical 实现（待阶段 2 迁移）
 *
 * 职责：
 * - B-1: 腾讯财经直连 API（qt.gtimg.cn）实时行情
 * - B-2: 新浪（hq.sinajs.cn）+ 网易（quotes.163.com）备用 API
 * - B-3: 腾讯历史 K 线（web.ifzq.gtimg.cn）← 2026-07-19 新增
 *
 * 注意：浏览器环境可能遇到 CORS 限制，生产环境需配置代理。
 * 所有函数在失败时返回 null，由 dataSourceOrchestrator 负责降级。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { checkMarketDataContract } from '@/lib/validation/marketDataContract'
import type { Stock, DailyQuotes } from '@/data/types'
import type { KlineBar } from '@/data/types/types.marketData'
import {
  TENCENT_API_BASE,
  TENCENT_KLINE_API_BASE,
  TENCENT_REFERER,
  SINA_API_BASE,
  SINA_REFERER,
  NETEASE_API_BASE,
  NETEASE_REFERER,
} from '@/config/marketDataEndpoints'
import { DEFAULT_REQUEST_TIMEOUT_MS } from '@/config/timeouts'
import { toTencentCode, toSinaCode, toNeteaseCode } from '@/core/stockCodeUtils'

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

/** 安全 fetch（带超时+可配自定义请求头） */
async function safeFetch(url: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Referer': TENCENT_REFERER,
        ...extraHeaders,
      },
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
      name: fields[1] ?? '',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      price: parseFloat(fields[3] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      change: parseFloat(fields[31] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      changePercent: parseFloat(fields[32] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      open: parseFloat(fields[5] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      high: parseFloat(fields[33] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      low: parseFloat(fields[34] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      volume: parseInt(fields[36] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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
        name: fields[1] ?? '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        price: parseFloat(fields[3] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        change: parseFloat(fields[31] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        changePercent: parseFloat(fields[32] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        open: parseFloat(fields[5] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        high: parseFloat(fields[33] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        low: parseFloat(fields[34] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        volume: parseInt(fields[36] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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

  const text = await safeFetch(url, DEFAULT_REQUEST_TIMEOUT_MS, { Referer: SINA_REFERER })
  if (!text) return null

  try {
    // 新浪格式: var hq_str_sh600519="贵州茅台,1685.00,1690.00,..."
    const match = text.match(/hq_str_\w+="([^"]+)"/)
    if (!match?.[1]) return null

    const fields = match[1].split(',')
    if (fields.length < 10) return null

    const quote: RealtimeQuote = {
      symbol: code,
      name: fields[0] ?? '',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      price: parseFloat(fields[3] || '0') || 0,
       
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      change: (parseFloat(fields[3] || '0') || 0) - (parseFloat(fields[2] || '0') || 0),
       
       
       
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      changePercent: parseFloat(fields[2] || '0') > 0 ? ((parseFloat(fields[3] || '0') - parseFloat(fields[2] || '0')) / parseFloat(fields[2] || '0')) * 100 : 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      open: parseFloat(fields[1] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      high: parseFloat(fields[4] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      low: parseFloat(fields[5] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      volume: parseInt(fields[8] || '0') || 0,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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
  const text = await safeFetch(url, DEFAULT_REQUEST_TIMEOUT_MS, { Referer: SINA_REFERER })
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
        name: fields[0] ?? '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        price: parseFloat(fields[3] || '0') || 0,
         
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        change: (parseFloat(fields[3] || '0') || 0) - (parseFloat(fields[2] || '0') || 0),
         
         
         
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        changePercent: parseFloat(fields[2] || '0') > 0 ? ((parseFloat(fields[3] || '0') - parseFloat(fields[2] || '0')) / parseFloat(fields[2] || '0')) * 100 : 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        open: parseFloat(fields[1] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        high: parseFloat(fields[4] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        low: parseFloat(fields[5] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        volume: parseInt(fields[8] || '0') || 0,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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

  const text = await safeFetch(url, DEFAULT_REQUEST_TIMEOUT_MS, { Referer: NETEASE_REFERER })
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

  const date = (cols[0] ?? '').trim()
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const close = parseFloat(cols[3] || '0') || 0
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const high = parseFloat(cols[4] || '0') || 0
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const low = parseFloat(cols[5] || '0') || 0
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const open = parseFloat(cols[6] || '0') || 0
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const turnoverStr = (cols[10] || '0').trim()
  const turnoverRate = turnoverStr && turnoverStr !== '-' ? parseFloat(turnoverStr) : undefined
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const volume = parseInt(cols[11] || '0') || 0
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const amount = parseFloat(cols[12] || '0') || 0

  if (!date || close <= 0) return null
  return { date, open, high, low, close, volume, amount, turnoverRate }
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

// ── B-3: 腾讯历史 K 线 API ──

/**
 * 腾讯历史日 K 线数据（替代已不可用的网易端点）。
 *
 * API: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,60,qfq
 * 返回字段: [date, open, close, high, low, volume]
 * 注意：需通过 Vite proxy（/api/proxy/tencent-kline）解决浏览器 CORS。
 *
 * @param code 6 位代码（如 600519）
 * @param days 获取天数（默认 60）
 */
export async function tencentKline(code: string, days = 60): Promise<KlineBar[]> {
  const tencentCode = toTencentCode(code)
  const url = `${TENCENT_KLINE_API_BASE}appstock/app/fqkline/get?param=${tencentCode},day,,,${days},qfq`
  const start = Date.now()

  const text = await safeFetch(url, DEFAULT_REQUEST_TIMEOUT_MS, { Referer: TENCENT_REFERER })
  if (!text) {
    logger.warn(`[directDataAPI] 腾讯 K 线请求失败: ${code}`)
    return []
  }

  try {
    const parsed = JSON.parse(text) as {
      code: number
      data: Record<string, { day?: string[][] }>
    }
    if (parsed.code !== 0 || !parsed.data) return []

    const stockData = parsed.data[tencentCode]
    if (!stockData?.day || stockData.day.length === 0) return []

    // 腾讯 K 线字段顺序: [date, open, close, high, low, volume]
    const klines: KlineBar[] = stockData.day
      .map((row: string[]) => {
        const date = row[0] ?? ''
        const open = parseFloat(row[1] ?? '0') || 0
        const close = parseFloat(row[2] ?? '0') || 0
        const high = parseFloat(row[3] ?? '0') || 0
        const low = parseFloat(row[4] ?? '0') || 0
        const volume = parseInt(row[5] ?? '0') || 0
        if (!date || close <= 0) return null
        return { date, open, high, low, close, volume }
      })
      .filter((b) => b !== null) as KlineBar[]

    logger.info(`[directDataAPI] 腾讯 K 线获取成功: ${code}, ${klines.length} 条`, { latency: Date.now() - start })
    return klines
  } catch (err) {
    logger.warn(`[directDataAPI] 腾讯 K 线解析失败: ${code}`, { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 类型转换工具 ──

/** 阶段 A-3：根据 source 推断 provenance 标识 */
function inferProvenance(source: string | undefined): 'real' | 'mock' | 'unknown' {
  if (source === 'mock') return 'mock'
  if (source === 'tencent' || source === 'sina' || source === 'netease' || source === 'akshare') return 'real'
  return 'unknown'
}

/** RealtimeQuote → Stock（部分字段） */
export function quoteToStock(quote: RealtimeQuote, source?: string): Partial<Stock> {
  // 阶段 A-3：warn-only 契约校验（不阻断写入，仅记录异常，避免 Mock 掩盖真实源形态缺陷）
  const check = checkMarketDataContract({
    quote: {
      price: quote.price,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      amount: quote.amount,
      timestamp: quote.timestamp,
      changePercent: quote.changePercent,
      source,
    },
  })
  if (!check.ok || check.issues.length > 0) {
    logger.warn('[quoteToStock] 行情契约校验告警', { symbol: quote.symbol, issues: check.issues })
  }
  // 阶段 A-3：透传数据源与血缘，使 UI 降级徽章可区分 Mock 与真实数据
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    pe: undefined,
    pb: undefined,
    updatedAt: quote.timestamp,
    dataSource: source ? (source as Stock['dataSource']) : 'unknown',
    dataProvenance: inferProvenance(source),
  }
}

/** KlineBar[] → DailyQuotes */
export function klinesToDailyQuotes(symbol: string, klines: KlineBar[], source?: string): DailyQuotes {
  const check = checkMarketDataContract({
    klines: klines.map((k) => ({
      date: k.date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      amount: k.amount,
    })),
  })
  if (!check.ok || check.issues.length > 0) {
    logger.warn('[klinesToDailyQuotes] K 线契约校验告警', { symbol, issues: check.issues })
  }
  return {
    symbol,
    latest: klines[klines.length - 1] ?? { date: '', open: 0, high: 0, low: 0, close: 0, volume: 0, amount: 0 },
    history: klines,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
    dataSource: source ? (source as DailyQuotes['dataSource']) : 'unknown',
    dataProvenance: inferProvenance(source),
  }
}
