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
  type QuoteSource,
  type KlineSource,
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
    return this.runFallbackChain(
      'fetchQuote',
      code,
      QUOTE_FALLBACK_CHAIN,
      (source) => this.fetcher.fetchQuoteBySource(source as QuoteSource, code),
      () => mockQuote(code),
    )
  }

  /**
   * 获取个股 K 线，按降级链依次尝试：
   * 网易 → 腾讯 → AKShare → Mock
   */
  async fetchKline(code: string, days: number): Promise<KlineItem[]> {
    return this.runFallbackChain(
      'fetchKline',
      code,
      KLINE_FALLBACK_CHAIN,
      (source) => this.fetcher.fetchKlineBySource(source as KlineSource, code, days),
      () => mockKline(code, days),
      { days },
    )
  }

  /**
   * 按降级链依次尝试各数据源，成功则返回，失败则降级，
   * 全部失败时返回 fallback 兜底值。
   */
  private async runFallbackChain<T>(
    operation: 'fetchQuote' | 'fetchKline',
    code: string,
    chain: readonly string[],
    fetchBySource: (source: string) => Promise<T | null>,
    fallback: () => T,
    extra?: { days?: number },
  ): Promise<T> {
    const startTs = Date.now()
    logger.info(`[ResilienceChain] ${operation} start`, {
      code,
      ...extra,
      chain: chain.join('→'),
    })

    let lastReason = ''
    for (let i = 0; i < chain.length; i++) {
      const current = chain[i]!
      const next = chain[i + 1]
      const attempt = await this.trySource(current, code, operation, startTs, fetchBySource, extra)

      if (attempt.kind === 'success') {
        return attempt.value
      }

      lastReason = attempt.reason
      if (next) {
        logger.warn('[ResilienceChain] 降级', {
          from: current,
          to: next,
          reason: lastReason,
        })
      } else {
        logger.warn('[ResilienceChain] 降级链末端失败', {
          from: current,
          reason: lastReason,
        })
      }
    }

    logger.warn(`[ResilienceChain] ${operation} 降级链耗尽, 返回 Mock`, {
      code,
      lastReason,
    })
    return fallback()
  }

  /**
   * 尝试单个数据源。
   */
  private async trySource<T>(
    source: string,
    code: string,
    operation: 'fetchQuote' | 'fetchKline',
    startTs: number,
    fetchBySource: (source: string) => Promise<T | null>,
    extra?: { days?: number },
  ): Promise<{ kind: 'success'; value: T; reason: '' } | { kind: 'empty' | 'error'; reason: string }> {
    try {
      const value = await fetchBySource(source)

      if (Array.isArray(value) && value.length > 0) {
        const latency = Date.now() - startTs
        logger.info(`[ResilienceChain] ${operation} success`, {
          code,
          source,
          latency,
          ...extra,
          count: value.length,
        })
        return { kind: 'success', value: value as T, reason: '' }
      }

      if (!Array.isArray(value) && value !== null) {
        const latency = Date.now() - startTs
        logger.info(`[ResilienceChain] ${operation} success`, {
          code,
          source,
          latency,
          ...extra,
        })
        return { kind: 'success', value: value as T, reason: '' }
      }

      return { kind: 'empty', reason: `${source} returned empty` }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const aborted = isAbortError(err)
      return { kind: 'error', reason: aborted ? 'timeout' : reason }
    }
  }
}
