/**
 * DataBridge 写入适配器（Infrastructure Adapter）
 *
 * 实现 IDataBridgeWriter 端口，将采集结果写入 IndexedDB。
 * 复用现有基础设施：dataBridge.forward + EnvelopeFactory + EventBus。
 *
 * 阶段 A-3 增强：
 * - 写入 payload 携带 `dataProvenance: 'real' | 'mock' | 'unknown'` 元数据字段
 * - 同时携带 `dataSource: 'tencent' | 'sina' | 'akshare' | 'mock' | 'unknown'` 源标识
 * - 字段存于 payload 顶层，不会破坏 stock 主表结构；
 *   UI 侧（StockAnalysisPage / 股票池列表）可读 `stock.dataProvenance` 显示降级徽章。
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import type { StockQuote, KlineItem } from '../../directDataAPI'
import type { IDataBridgeWriter } from '../ports'

const logger = getLogger()

/** 阶段 A-3：根据 source 推断 provenance 标识 */
function inferProvenance(source: StockQuote['source'] | string | undefined): 'real' | 'mock' | 'unknown' {
  if (source === 'mock') return 'mock'
  if (source === 'tencent' || source === 'sina' || source === 'netease' || source === 'akshare') return 'real'
  return 'unknown'
}

/**
 * DataBridge 写入适配器实现
 *
 * 通过 DataBridge 的信封协议将行情和 K 线数据写入 IndexedDB。
 * 遵循项目的数据写入规范：所有写操作必须通过 dataBridge.forward() 走信封协议。
 */
export class DataBridgeWriter implements IDataBridgeWriter {
  /**
   * 将行情数据写入存储
   *
   * @param quote 行情数据（StockQuote）
   * @throws 写入失败时抛出异常（由调用方处理）
   */
  async writeQuote(quote: StockQuote): Promise<void> {
    try {
      // 阶段 A-3：附带数据血缘元数据，供 UI 显示降级徽章
      const dataProvenance = inferProvenance(quote.source)
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: this.createTraceId(quote.code),
        },
        {
          symbol: quote.code,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          prevClose: quote.prevClose,
          volume: quote.volume,
          amount: quote.amount,
          timestamp: quote.timestamp,
          // 阶段 A-3 新增字段：数据血缘
          dataSource: quote.source ?? 'unknown',
          dataProvenance,
        },
      )

      logger.info('[DataBridgeWriter] writeQuote 开始', {
        symbol: quote.code,
        price: quote.price,
        dataProvenance,
        dataSource: quote.source,
      })

      await dataBridge.forward(envelope)

      logger.info('[DataBridgeWriter] writeQuote 成功', { symbol: quote.code })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DataBridgeWriter] writeQuote 失败', {
        symbol: quote.code,
        error: message
      })
      throw err
    }
  }

  /**
   * 将 K 线数据写入存储
   *
   * @param code 股票代码
   * @param items K 线数据数组（KlineItem[]）
   * @throws 写入失败时抛出异常（由调用方处理）
   */
  async writeKline(code: string, items: KlineItem[]): Promise<void> {
    if (items.length === 0) {
      logger.warn('[DataBridgeWriter] writeKline 跳过：items 为空', { code })
      return
    }

    // 阶段 A-3：K 线数据整体 provenance 取决于第一条的 source
    const dataProvenance = inferProvenance(items[0]?.source)

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.fetcher,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveDailyQuotes,
          traceId: this.createTraceId(code),
        },
        {
          symbol: code,
          dailyQuotes: items,
          // 阶段 A-3 新增字段
          dataSource: items[0]?.source ?? 'unknown',
          dataProvenance,
        },
      )

      logger.info('[DataBridgeWriter] writeKline 开始', {
        symbol: code,
        count: items.length,
        dataProvenance,
        dataSource: items[0]?.source,
      })

      await dataBridge.forward(envelope)

      logger.info('[DataBridgeWriter] writeKline 成功', {
        symbol: code,
        count: items.length
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[DataBridgeWriter] writeKline 失败', {
        symbol: code,
        count: items.length,
        error: message
      })
      throw err
    }
  }

  /**
   * 生成唯一的 traceId（用于数据血缘追踪）
   */
  private createTraceId(symbol: string): string {
    return `fetcher-${Date.now()}-${symbol}-${Math.random().toString(36).slice(2, 7)}`
  }
}
