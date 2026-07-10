/**
 * 数据采集调度器（简化版）
 *
 * 当前实现仅提供手动触发与事件触发能力；定时调度与时间分层在 P2 阶段逐步补齐。
 */

import { getDefaultFetcherConfig, type FetcherFrequency } from '@/config/fetcherConfig'
import { getLogger } from '@/lib/logger'
import { fetchStockBasic, fetchStockKline } from './fetcherService'

const logger = getLogger()

export interface FetcherSchedulerState {
  isRunning: boolean
  currentSymbol: string | null
  lastRunAt: number | null
}

class FetcherScheduler {
  private state: FetcherSchedulerState = {
    isRunning: false,
    currentSymbol: null,
    lastRunAt: null,
  }

  getState(): FetcherSchedulerState {
    return { ...this.state }
  }

  /**
   * 手动触发单只股票基础数据采集
   */
  async runManual(symbol: string): Promise<void> {
    if (this.state.isRunning) {
      logger.warn('[fetcherScheduler] 已有采集任务执行中，跳过')
      return
    }

    this.state.isRunning = true
    this.state.currentSymbol = symbol

    try {
      const result = await fetchStockBasic(symbol)
      if (!result.success) {
        logger.error('[fetcherScheduler] 手动采集失败', { symbol, error: result.error })
      } else {
        logger.info('[fetcherScheduler] 手动采集成功', { symbol })
      }
    } finally {
      this.state.isRunning = false
      this.state.currentSymbol = null
      this.state.lastRunAt = Date.now()
    }
  }

  /**
   * 手动触发单只股票 K线采集
   */
  async runKline(symbol: string): Promise<void> {
    if (this.state.isRunning) {
      logger.warn('[fetcherScheduler] 已有采集任务执行中，跳过')
      return
    }

    this.state.isRunning = true
    this.state.currentSymbol = symbol

    try {
      const result = await fetchStockKline(symbol)
      if (!result.success) {
        logger.error('[fetcherScheduler] K线采集失败', { symbol, error: result.error })
      } else {
        logger.info('[fetcherScheduler] K线采集成功', { symbol })
      }
    } finally {
      this.state.isRunning = false
      this.state.currentSymbol = null
      this.state.lastRunAt = Date.now()
    }
  }

  /**
   * 事件触发：新增股票后自动拉取基础数据与 K线
   */
  async onSymbolAdded(symbol: string): Promise<void> {
    const config = getDefaultFetcherConfig()
    const basicDim = config.dimensions.find((d) => d.code === '01')
    const klineDim = config.dimensions.find((d) => d.code === '02')

    if (basicDim?.enabled) {
      await this.runManual(symbol)
    }
    if (klineDim?.enabled) {
      await this.runKline(symbol)
    }
  }
}

let globalScheduler: FetcherScheduler | null = null

/**
 * getFetcherScheduler
 * @returns FetcherScheduler
 */
export function getFetcherScheduler(): FetcherScheduler {
  if (!globalScheduler) {
    globalScheduler = new FetcherScheduler()
  }
  return globalScheduler
}

/**
 * resetFetcherScheduler
 * @returns void
 */
export function resetFetcherScheduler(): void {
  globalScheduler = null
}

export type { FetcherFrequency }
