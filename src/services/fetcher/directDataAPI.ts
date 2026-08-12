/**
 * 直连数据源 API（腾讯 / 新浪 / 网易）— 统一入口
 *
 * 本文件为拆分后的薄入口模块，仅保留：
 * 1. 兼容类型定义（RealtimeQuote）
 * 2. 适配函数（quoteToStock / klinesToDailyQuotes）
 * 3. 从子模块 re-export 全部公共 API
 *
 * 子模块结构：
 *   - directDataAPIError.ts     → 错误类、共享工具、网络封装
 *   - tencentQuoteProvider.ts   → 腾讯实时行情
 *   - tencentKlineProvider.ts   → 腾讯 K 线 + 批量行情
 *   - sinaQuoteProvider.ts      → 新浪实时行情 + 批量
 *   - neteaseHistoryProvider.ts → 网易历史 K 线
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */

import { getLogger } from '@/lib/logger'
import { checkMarketDataContract } from '@/lib/validation/marketDataContract'
import type { Stock, DailyQuotes } from '@/data/types'

// --- Re-export 公共类型与工具 ---
export {
  type StockQuote,
  type KlineItem,
  DirectDataAPIError,
  getMarketPrefix,
  stripCodeSuffix,
  buildTencentCode,
  buildSinaCode,
  getNeteaseCode,
  safeNumber,
  fetchWithTimeout,
  isAbortError,
} from './directDataAPIError'

// --- Re-export Provider API ---
export { tencentQuote, parseTencentQuote, parseTencentHkQuote, parseTencentTimestamp } from './tencentQuoteProvider'
export { tencentBatchQuotes, tencentKline } from './tencentKlineProvider'
export { sinaQuote, sinaBatchQuotes, parseSinaQuote, parseSinaHkQuote, parseSinaTimestamp } from './sinaQuoteProvider'
export { neteaseHistory, parseNeteaseCsv } from './neteaseHistoryProvider'

// Import for adapter functions
import type { StockQuote, KlineItem } from './directDataAPIError'

const logger = getLogger()

// ============================================================
// 兼容类型
// ============================================================

/**
 * 兼容类型：data-collector 层的 RealtimeQuote（用 symbol 字段）。
 * 与 StockQuote 的差异：无 prevClose/source 字段，用 symbol 而非 code。
 */
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

// ============================================================
// 适配函数
// ============================================================

/** 根据 source 推断 provenance 标识 */
function inferProvenance(source: string | undefined): 'real' | 'mock' | 'unknown' {
  if (source === 'mock') return 'mock'
  if (source === 'tencent' || source === 'sina' || source === 'netease' || source === 'akshare') return 'real'
  return 'unknown'
}

/** 从 quote 对象提取 symbol（兼容 RealtimeQuote.symbol 和 StockQuote.code） */
function resolveSymbol(quote: RealtimeQuote | StockQuote): string {
  return 'symbol' in quote ? quote.symbol : quote.code
}

/**
 * 将行情对象转换为 Stock（部分字段）。
 * 兼容 RealtimeQuote（symbol）和 StockQuote（code）两种入参。
 * 阶段 A-3：warn-only 契约校验。
 */
export function quoteToStock(quote: RealtimeQuote | StockQuote, source?: string): Partial<Stock> {
  const symbol = resolveSymbol(quote)
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
    logger.warn('[quoteToStock] 行情契约校验告警', { symbol, issues: check.issues })
  }
  return {
    symbol,
    name: quote.name,
    price: quote.price,
    pe: undefined,
    pb: undefined,
    updatedAt: quote.timestamp,
    dataSource: source !== undefined && source !== '' ? (source as Stock['dataSource']) : 'unknown',
    dataProvenance: inferProvenance(source),
  }
}

/**
 * 将 K 线数组转换为 DailyQuotes。
 * 兼容 KlineItem（fetcher）和 KlineBar[]（data-collector）。
 * 阶段 A-3：warn-only 契约校验。
 */
export function klinesToDailyQuotes(
  symbol: string,
  klines: KlineItem[] | Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    amount?: number
  }>,
  source?: string,
): DailyQuotes {
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
  const lastKline = klines[klines.length - 1]
  return {
    symbol,
    latest: lastKline
      ? {
          date: lastKline.date,
          open: lastKline.open,
          high: lastKline.high,
          low: lastKline.low,
          close: lastKline.close,
          volume: lastKline.volume,
          amount: lastKline.amount ?? 0,
        }
      : { date: '', open: 0, high: 0, low: 0, close: 0, volume: 0, amount: 0 },
    history: klines.map((k) => ({
      date: k.date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      amount: k.amount ?? 0,
    })),
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
    dataSource: source !== undefined && source !== '' ? (source as DailyQuotes['dataSource']) : 'unknown',
    dataProvenance: inferProvenance(source),
  }
}
