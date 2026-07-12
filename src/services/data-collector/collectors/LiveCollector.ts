/**
 * @fileoverview LiveCollector — 通过 dataSourceOrchestrator 获取真实行情数据
 *
 * 职责：
 * - 当 VITE_DATA_SOURCE_TYPE=rest 时被 TaskScheduler 实例化
 * - 对 indices / watchlist 维度调用 getBatchQuotes 获取腾讯/新浪真实行情
 * - 对其他维度：记录警告，留待后续逐个实现
 *
 * @remarks 2026-07-13 新增，作为 #7 接真实数据源的 Phase 1/2 核心交付
 */

import { getLogger } from '@/lib/logger'
import { BaseCollector } from './BaseCollector'
import type { RawMarketData, DataSourceConfig } from '@/types/modules/widget.types'
import { getBatchQuotes } from '../dataSourceOrchestrator'

const logger = getLogger()

/** 已知指数代码（原生 6 位数字，toTencentCode 自动判定 sh/sz 前缀） */
const INDEX_CODES = ['000001', '399001', '399006', '000688', '000300']

/** 指数代码 → 中文名称（覆盖接口 GBK 编码乱名） */
const INDEX_NAMES: Record<string, string> = {
  '000001': '上证指数',
  '399001': '深证成指',
  '399006': '创业板指',
  '000688': '科创50',
  '000300': '沪深300',
}

/** 自选股代码列表（与 mockWatchlist 保持一致） */
const WATCHLIST_CODES = ['000858', '600276', '002594', '300750', '000001', '002371', '600519', '688981']

/** 自选股代码 → 中文名称（覆盖接口 GBK 编码乱名） */
const WATCHLIST_NAMES: Record<string, string> = {
  '000858': '五粮液',
  '600276': '恒瑞医药',
  '002594': '比亚迪',
  '300750': '宁德时代',
  '000001': '平安银行',
  '002371': '北方华创',
  '600519': '贵州茅台',
  '688981': '中芯国际',
}

/**
 * LiveCollector — 真实行情采集器
 */
export class LiveCollector extends BaseCollector {
  /**
   * 执行实时数据采集
   * @param dataSource 数据源配置（endpoint 决定采集维度）
   */
  async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
    const { endpoint = '' } = dataSource

    // 使用 includes 匹配（与 MockCollector 一致），endpoint 传的是全路径如 '/market/indices'
    if (endpoint.includes('indices')) {
      return this.collectIndices()
    }
    if (endpoint.includes('watchlist')) {
      return this.collectWatchlist()
    }

    throw new Error(`[LiveCollector] 维度 ${endpoint} 暂未接入真实数据源`)
  }

  /**
   * 采集指数实时行情
   * getBatchQuotes → RealtimeQuote[] → wrapData('indices', ...)
   * MarketDataAdapter.adaptIndices 自动映射 symbol→code, price→price
   */
  private async collectIndices(): Promise<RawMarketData> {
    logger.info('[LiveCollector] 开始采集指数行情', { codes: INDEX_CODES })

    const result = await getBatchQuotes(INDEX_CODES)

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error('[LiveCollector] 指数行情采集失败（全部数据源不可用）')
    }

    const quotes = result.data.map((q) => ({
      ...q,
      name: INDEX_NAMES[q.symbol] ?? q.name,
    }))

    logger.info(`[LiveCollector] 指数行情采集成功 ${quotes.length} 条`, {
      source: result.source,
      latency: result.latency,
    })

    return this.wrapData('indices', quotes, result.source)
  }

  /**
   * 采集自选股实时行情
   * getBatchQuotes → RealtimeQuote[] → wrapData('watchlist', ...)
   * MarketDataAdapter.adaptWatchlist 自动映射 symbol→code, price→price
   */
  private async collectWatchlist(): Promise<RawMarketData> {
    logger.info('[LiveCollector] 开始采集自选股行情', { codes: WATCHLIST_CODES })

    const result = await getBatchQuotes(WATCHLIST_CODES)

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error('[LiveCollector] 自选股行情采集失败（全部数据源不可用）')
    }

    // 覆盖接口返回的 GBK 乱码名
    const quotes = result.data.map((q) => ({
      ...q,
      name: WATCHLIST_NAMES[q.symbol] ?? q.name,
    }))

    logger.info(`[LiveCollector] 自选股行情采集成功 ${quotes.length} 条`, {
      source: result.source,
      latency: result.latency,
    })

    return this.wrapData('watchlist', quotes, result.source)
  }
}
