/**
 * 行情/K线采集适配器（Infrastructure Adapter）
 *
 * 实现 IMarketDataFetcher 的底层支撑：提供按源采集的原子方法。
 * 降级链编排由 ResilienceChain 装饰器负责，本类不关心降级策略。
 *
 * 职责单一：只负责"从指定数据源采集一条数据"。
 * 复用现有基础设施：directDataAPI（直连） + fetcherClient（AKShare 后端）。
 */

import { getLogger } from '@/lib/logger'
import {
  neteaseHistory,
  sinaQuote,
  tencentKline,
  tencentQuote,
  type KlineItem,
  type StockQuote,
} from '../../directDataAPI'
import { collectBasic, collectKline } from '../../fetcherClient'
import { mockKline, mockQuote } from '../../mockProvider'
import type { KlineSource, QuoteSource } from '../ports'

const logger = getLogger()

/** 网易 K 线多取的天数（覆盖非交易日） */
const NETEASE_EXTRA_DAYS = 10

/** 每天小时数 */
const HOURS_PER_DAY = 24

/** 一天的毫秒数 */
const DAY_MS = HOURS_PER_DAY * 60 * 60 * 1000

/**
 * 单源行情采集器。
 * 暴露 fetchQuoteBySource / fetchKlineBySource 供 ResilienceChain 调用。
 */
export class MarketDataFetcher {
  /**
   * 从指定数据源采集实时行情。
   * @returns StockQuote 成功时返回行情数据；数据为空时返回 null（由调用方降级）
   * @throws 当源不可用时抛出异常（由调用方捕获并降级）
   */
  async fetchQuoteBySource(source: QuoteSource, code: string): Promise<StockQuote | null> {
    logger.info('[MarketDataFetcher] fetchQuoteBySource', { source, code })
    switch (source) {
      case 'tencent':
        return await tencentQuote(code)
      case 'sina':
        return await sinaQuote(code)
      case 'akshare':
        return await this.fetchQuoteFromAkshare(code)
      case 'mock':
        return mockQuote(code)
      default:
        logger.warn('[MarketDataFetcher] 未知行情源, 回退 Mock', { source, code })
        return mockQuote(code)
    }
  }

  /**
   * 从指定数据源采集 K 线。
   * @throws 当源不可用或返回空数据时抛出异常（由调用方捕获并降级）
   */
  async fetchKlineBySource(source: KlineSource, code: string, days: number): Promise<KlineItem[]> {
    logger.info('[MarketDataFetcher] fetchKlineBySource', { source, code, days })
    switch (source) {
      case 'netease':
        return await this.fetchKlineFromNetease(code, days)
      case 'tencent':
        return await tencentKline(code, 'day', days)
      case 'akshare':
        return await this.fetchKlineFromAkshare(code, days)
      case 'mock':
        return mockKline(code, days)
      default:
        logger.warn('[MarketDataFetcher] 未知K线源, 回退 Mock', { source, code, days })
        return mockKline(code, days)
    }
  }

  // ============================================================
  // 私有：各源具体采集实现
  // ============================================================

  /** 通过 Python AKShare 后端获取行情（兜底源） */
  private async fetchQuoteFromAkshare(code: string): Promise<StockQuote> {
    const resp = await collectBasic(code)
    if (!resp.success || !resp.data) {
      throw new Error(resp.error ?? 'AKShare 返回空数据')
    }
    const d = resp.data
    const price = d.price ?? 0
    return {
      code,
      name: d.name ?? code,
      price,
      change: 0,
      changePercent: 0,
      open: price,
      high: price,
      low: price,
      prevClose: price,
      volume: 0,
      amount: 0,
      timestamp: Date.now(),
      source: 'akshare',
    }
  }

  /** 网易历史 K 线（CSV 格式，多取 10 天覆盖非交易日） */
  private async fetchKlineFromNetease(code: string, days: number): Promise<KlineItem[]> {
    const end = new Date()
    const start = new Date(end.getTime() - (days + NETEASE_EXTRA_DAYS) * DAY_MS)
    const fmt = (d: Date): string => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}${m}${day}`
    }
    const all = await neteaseHistory(code, fmt(start), fmt(end))
    return all.slice(-days)
  }

  /** 通过 Python AKShare 后端获取 K 线 */
  private async fetchKlineFromAkshare(code: string, days: number): Promise<KlineItem[]> {
    const resp = await collectKline({ symbol: code, period: 'daily' })
    if (!resp.success || !resp.data) {
      throw new Error(resp.error ?? 'AKShare K线返回空数据')
    }
    const history = resp.data.history ?? []
    const items: KlineItem[] = history.map((b) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      amount: b.amount,
      source: 'akshare',
    }))
    return items.slice(-days)
  }
}
