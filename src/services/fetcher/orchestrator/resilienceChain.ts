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
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { getLogger } from '@/lib/logger'
import { createBranchLogger } from '@/lib/logHelpers'
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
import { RESILIENCE_BACKOFF_BASE_MS, RESILIENCE_BACKOFF_MAX_MS } from '@/config/timeouts'

const logger = getLogger()
const blog = createBranchLogger(logger, 'ResilienceChain')

/** 判断是否为 AbortController 超时错误 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
}

/**
 * 计算降级链退避延迟（指数退避 + ±20% jitter）。
 *
 * 复用 fetcherInterceptor.calculateBackoff 的设计模式：
 *   delay = min(base * 2^attempt, max) ± 20% jitter
 *
 * 降级链 attempt 0→1→2 对应 200ms→400ms→800ms（上限 2000ms）。
 * jitter 避免 thundering herd：高并发下多个请求同时降级时分散请求。
 */
function calculateBackoff(attempt: number): number {
  const delay = Math.min(
    RESILIENCE_BACKOFF_BASE_MS * Math.pow(2, attempt),
    RESILIENCE_BACKOFF_MAX_MS,
  )
  const jitter = delay * 0.2 * (Math.random() - 0.5)
  return Math.floor(delay + jitter)
}

/** 延迟工具函数 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
        // 降级前指数退避 + jitter，避免高并发 thundering herd
        const backoff = calculateBackoff(i)
        logger.debug(`[ResilienceChain] ${operation} 退避`, { from: current, to: next, backoffMs: backoff })
        await delay(backoff)
        blog.fallback(`${operation} 降级链`, current, next, { reason: lastReason, backoffMs: backoff }, 'warn')
      } else {
        blog.guardWarn(`${operation} 降级链末端`, `from=${current} reason=${lastReason}`, {})
      }
    }

    blog.guardWarn(`${operation} 降级链耗尽`, `返回 Mock, lastReason=${lastReason}`, { code })
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
