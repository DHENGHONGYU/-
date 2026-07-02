/**
 * 降级链装饰器（Resilience Decorator）
 *
 * 以装饰器模式包裹 IMarketDataFetcher，实现四层降级链：
 *   行情 (Quote): 腾讯 → 新浪 → AKShare → Mock
 *   K线 (Kline):  网易 → 腾讯 → AKShare → Mock
 *
 * 设计原则：
 *   - 降级是横切关注点，不应侵入编排核心
 *   - 编排核心只看到 IMarketDataFetcher 接口，不知道降级的存在
 *   - 每个源超时/异常后自动切换到下一个源
 *   - 降级链耗尽时返回 Mock 数据并标记 source='mock'
 */

import { getLogger } from '@/lib/logger'
import { mockKline, mockQuote } from '../mockProvider'
import {
  KLINE_FALLBACK_CHAIN,
  QUOTE_FALLBACK_CHAIN,
} from './ports'
import type { IMarketDataFetcher } from './ports'
import type { KlineItem, StockQuote } from '../directDataAPI'
import { MarketDataFetcher } from './adapters/marketDataFetcher'

const logger = getLogger()

/** 判断是否为 AbortController 超时错误 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
}

/**
 * 降级链装饰器：实现 IMarketDataFetcher，内部按降级链依次尝试各数据源。
 *
 * @example
 * const fetcher = new ResilienceChain(new MarketDataFetcher())
 * // 编排核心只看到 IMarketDataFetcher，不知道降级链的存在
 * const quote = await fetcher.fetchQuote('600519')
 */
export class ResilienceChain implements IMarketDataFetcher {
  constructor(private readonly fetcher: MarketDataFetcher) {}

  /**
   * 获取个股实时行情，按降级链依次尝试：
   * 腾讯 → 新浪 → AKShare → Mock
   * 每个源超时/异常后自动切换，所有源失败时返回 Mock 数据。
   */
  async fetchQuote(code: string): Promise<StockQuote> {
    const startTs = Date.now()
    logger.info('[ResilienceChain] fetchQuote start', {
      code,
      chain: QUOTE_FALLBACK_CHAIN.join('→'),
    })

    let lastReason = ''
    for (let i = 0; i < QUOTE_FALLBACK_CHAIN.length; i++) {
      const current = QUOTE_FALLBACK_CHAIN[i]!
      const next = QUOTE_FALLBACK_CHAIN[i + 1]
      try {
        const quote = await this.fetcher.fetchQuoteBySource(current, code)
        if (quote !== null) {
          const latency = Date.now() - startTs
          logger.info('[ResilienceChain] fetchQuote success', {
            code,
            source: current,
            latency,
          })
          return quote
        }
        // 格式错误：返回空 → 跳过该字段 + 切换
        lastReason = `${current} returned empty`
        if (next) {
          logger.warn('[ResilienceChain] 降级', {
            from: current,
            to: next,
            reason: lastReason,
          })
        }
      } catch (err) {
        lastReason = err instanceof Error ? err.message : String(err)
        const aborted = isAbortError(err)
        // 网络超时 → 切换备用源
        if (next) {
          logger.warn('[ResilienceChain] 降级', {
            from: current,
            to: next,
            reason: aborted ? 'timeout' : lastReason,
          })
        } else {
          logger.warn('[ResilienceChain] 降级链末端失败', {
            from: current,
            reason: lastReason,
          })
        }
      }
    }

    // 降级链耗尽 → 返回 Mock + 标记 stale
    logger.warn('[ResilienceChain] fetchQuote 降级链耗尽, 返回 Mock', {
      code,
      lastReason,
    })
    return mockQuote(code)
  }

  /**
   * 获取个股 K 线，按降级链依次尝试：
   * 网易 → 腾讯 → AKShare → Mock
   */
  async fetchKline(code: string, days: number): Promise<KlineItem[]> {
    const startTs = Date.now()
    logger.info('[ResilienceChain] fetchKline start', {
      code,
      days,
      chain: KLINE_FALLBACK_CHAIN.join('→'),
    })

    let lastReason = ''
    for (let i = 0; i < KLINE_FALLBACK_CHAIN.length; i++) {
      const current = KLINE_FALLBACK_CHAIN[i]!
      const next = KLINE_FALLBACK_CHAIN[i + 1]
      try {
        const kline = await this.fetcher.fetchKlineBySource(current, code, days)
        if (kline.length > 0) {
          const latency = Date.now() - startTs
          logger.info('[ResilienceChain] fetchKline success', {
            code,
            source: current,
            latency,
            count: kline.length,
          })
          return kline
        }
        lastReason = `${current} returned empty`
        if (next) {
          logger.warn('[ResilienceChain] 降级', {
            from: current,
            to: next,
            reason: lastReason,
          })
        }
      } catch (err) {
        lastReason = err instanceof Error ? err.message : String(err)
        const aborted = isAbortError(err)
        if (next) {
          logger.warn('[ResilienceChain] 降级', {
            from: current,
            to: next,
            reason: aborted ? 'timeout' : lastReason,
          })
        } else {
          logger.warn('[ResilienceChain] 降级链末端失败', {
            from: current,
            reason: lastReason,
          })
        }
      }
    }

    // 降级链耗尽 → 返回 Mock + 标记 stale
    logger.warn('[ResilienceChain] fetchKline 降级链耗尽, 返回 Mock', {
      code,
      days,
      lastReason,
    })
    return mockKline(code, days)
  }
}
