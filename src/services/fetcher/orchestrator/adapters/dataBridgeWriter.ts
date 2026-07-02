/**
 * DataBridge 写入适配器（Infrastructure Adapter）
 *
 * 实现 IDataBridgeWriter 端口，将采集结果写入 IndexedDB。
 * 复用现有基础设施：dataBridge.forward + EnvelopeFactory + EventBus。
 *
 * 职责单一：只负责"将数据持久化到存储"。
 * 重试/限流策略封装在此层，对编排核心透明。
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import type { DailyQuotes, Stock } from '@/data/types'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import type { KlineItem, StockQuote } from '../../directDataAPI'
import type { IDataBridgeWriter } from '../ports'

const logger = getLogger()

/** 写入失败最大重试次数 */
const WRITE_MAX_RETRIES = 3

/** 重试基础延迟（毫秒），指数退避：200ms, 400ms, 600ms */
const RETRY_BASE_DELAY_MS = 200

/** traceId 随机部分长度 */
const TRACE_ID_RANDOM_LENGTH = 7

/** toString 基数（36 = 0-9 + a-z） */
const RADIX_BASE36 = 36

/** 生成 traceId（用于关联一次写入的所有日志） */
function createTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(RADIX_BASE36).slice(2, TRACE_ID_RANDOM_LENGTH)}`
}

/** 指数退避 sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class DataBridgeWriter implements IDataBridgeWriter {
  /**
   * 将行情写入 IndexedDB（通过 DataBridge.forward）。
   * - 更新 Stock 的 dataQuality 标记
   * - 触发 EventBus 事件通知 UI 刷新
   * - 写入失败重试 3 次，仍失败则 emit('COLLECT_WRITE_FAILED')
   */
  async writeQuote(quote: StockQuote): Promise<void> {
    const isMock = quote.source === 'mock'
    const quality = isMock ? 'stale' : 'fresh'
    logger.info('[DataBridgeWriter] writeQuote', {
      code: quote.code,
      source: quote.source,
      quality,
    })

    const traceId = createTraceId('orch')
    const payload: Partial<Stock> & { symbol: string } = {
      symbol: quote.code,
      name: quote.name,
      price: quote.price,
      dataQuality: {
        basic: !isMock,
        kline: false,
        finance: false,
        lastChecked: Date.now(),
      },
      updatedAt: Date.now(),
    }

    let lastErr: unknown = null
    for (let attempt = 1; attempt <= WRITE_MAX_RETRIES; attempt++) {
      try {
        const envelope = EnvelopeFactory.create(
          {
            source: MODULE_ID.fetcher,
            target: ENVELOPE_TARGET.db,
            action: ENVELOPE_ACTION.updateStock,
            traceId: `${traceId}-${attempt}`,
          },
          payload,
        )
        await dataBridge.forward(envelope)
        logger.info('[DataBridgeWriter] writeQuote 成功', {
          code: quote.code,
          source: quote.source,
          attempt,
        })
        eventBus.emit('COLLECT_QUOTE_UPDATED', {
          code: quote.code,
          source: quote.source,
          quality,
        })
        return
      } catch (err) {
        lastErr = err
        logger.warn('[DataBridgeWriter] writeQuote 失败, 重试', {
          code: quote.code,
          attempt,
          maxRetries: WRITE_MAX_RETRIES,
          error: err instanceof Error ? err.message : String(err),
        })
        if (attempt < WRITE_MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * attempt)
        }
      }
    }

    // 写入失败 3 次后触发事件
    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
    logger.error('[DataBridgeWriter] writeQuote 彻底失败', {
      code: quote.code,
      error: errMsg,
    })
    eventBus.emit('COLLECT_WRITE_FAILED', {
      code: quote.code,
      dimension: '01_basic',
      error: errMsg,
    })
  }

  /**
   * 将 K 线写入 IndexedDB（通过 DataBridge.forward）。
   * - 写入失败重试 3 次，仍失败则 emit('COLLECT_WRITE_FAILED')
   */
  async writeKline(code: string, items: KlineItem[]): Promise<void> {
    logger.info('[DataBridgeWriter] writeKline', { code, count: items.length })

    if (items.length === 0) {
      logger.warn('[DataBridgeWriter] writeKline 跳过: 空数据', { code })
      return
    }

    const latest = items[items.length - 1]!
    const traceId = createTraceId('orch-k')
    const payload: DailyQuotes = {
      symbol: code,
      latest: {
        date: latest.date,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        volume: latest.volume,
        amount: latest.amount,
      },
      history: items.map((it) => ({
        date: it.date,
        open: it.open,
        high: it.high,
        low: it.low,
        close: it.close,
        volume: it.volume,
        amount: it.amount,
      })),
      period: 'daily',
      adjust: 'qfq',
      updatedAt: Date.now(),
    }

    let lastErr: unknown = null
    for (let attempt = 1; attempt <= WRITE_MAX_RETRIES; attempt++) {
      try {
        const envelope = EnvelopeFactory.create(
          {
            source: MODULE_ID.fetcher,
            target: ENVELOPE_TARGET.db,
            action: ENVELOPE_ACTION.saveDailyQuotes,
            traceId: `${traceId}-${attempt}`,
          },
          payload,
        )
        await dataBridge.forward(envelope)
        logger.info('[DataBridgeWriter] writeKline 成功', { code, attempt })
        eventBus.emit('COLLECT_KLINE_UPDATED', { code, count: items.length })
        return
      } catch (err) {
        lastErr = err
        logger.warn('[DataBridgeWriter] writeKline 失败, 重试', {
          code,
          attempt,
          maxRetries: WRITE_MAX_RETRIES,
          error: err instanceof Error ? err.message : String(err),
        })
        if (attempt < WRITE_MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * attempt)
        }
      }
    }

    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
    logger.error('[DataBridgeWriter] writeKline 彻底失败', { code, error: errMsg })
    eventBus.emit('COLLECT_WRITE_FAILED', {
      code,
      dimension: '02_kline',
      error: errMsg,
    })
  }
}

