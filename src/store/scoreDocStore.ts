/**
 * @module scoreDocStore
 * @lifecycle @Global
 * @description 评分文档版本库页面状态管理。管理股票代码选择、股票列表、
 * 评分文档版本列表，提供加载、刷新、清空、导出等操作。
 *
 * @see @/pages/analysis/ScoreDocPage.tsx - 消费此 Store 的评分文档页面
 *
 * @compliance
 * - 所有数据请求经 Store Action 分发
 * - 核心分支包含 logger.info 打印
 * - 遵循现有 Zustand Store 风格
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { ScoreDocVersion, Stock } from '@/data/types'
import { buildReportMarkdown, getRecentVersions, exportSymbolMd } from '@/services/analysis/scoreDocService'
import { listStocks } from '@/services/stockpool/stockpoolService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { dataLayer } from '@/data/dataLayer'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface ScoreDocState {
  /** 当前选中的股票代码 */
  symbol: string
  /** 股票列表（用于下拉选择） */
  stocks: Stock[]
  /** 评分文档版本列表 */
  versions: ScoreDocVersion[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null

  // Actions
  /** 设置当前股票代码 */
  setSymbol: (symbol: string) => void
  /** 加载股票列表 */
  loadStocks: () => Promise<void>
  /** 加载当前股票的评分文档版本 */
  loadVersions: () => Promise<void>
  /** 刷新当前股票的评分文档版本 */
  refresh: () => Promise<void>
  /** 清空当前选择及结果（保留股票列表） */
  clear: () => void
  /** 导出当前股票全部 Markdown */
  exportAll: () => Promise<void>
  /** 加载股票代码列表（供下拉选择，封装 dataLayer.stocks.list） */
  loadStockSymbols: () => Promise<string[]>
  /** 生成研究报告 Markdown（封装 buildReportMarkdown + getRecentVersions） */
  generateReport: (symbol: string) => Promise<{ symbol: string; version: number; markdown: string; generatedAt: string }>
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  symbol: '',
  stocks: [] as Stock[],
  versions: [] as ScoreDocVersion[],
  loading: false,
  error: null as string | null,
}

// ============================================================
// Store
// ============================================================

export const useScoreDocStore = create<ScoreDocState>((set, get) => ({
  ...initialState,

  setSymbol: (symbol: string) => {
    logger.info(`[scoreDocStore] setSymbol: ${symbol}`)
    set({ symbol })
  },

  loadStocks: async () => {
    logger.info('[scoreDocStore] loadStocks 开始')
    set({ loading: true, error: null })

    try {
      const result = await listStocks()
      if (result.success && result.data) {
        set({ stocks: result.data, loading: false })
        logger.info(`[scoreDocStore] loadStocks 完成: ${result.data.length} 只股票`)
      } else {
        const message = result.error ?? '加载股票列表失败'
        logger.error(`[scoreDocStore] loadStocks 失败: ${message}`)
        set({ error: message, loading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] loadStocks 异常: ${message}`)
      set({ error: `加载失败：${message}`, loading: false })
    }
  },

  loadVersions: async () => {
    const { symbol } = get()
    if (!symbol) {
      logger.info('[scoreDocStore] loadVersions 跳过: symbol 为空')
      set({ versions: [], error: null })
      return
    }

    logger.info(`[scoreDocStore] loadVersions 开始: ${symbol}`)
    set({ loading: true, error: null })

    try {
      const result = await getRecentVersions(symbol)
      if (result.success && result.data) {
        set({ versions: result.data, loading: false })
        logger.info(`[scoreDocStore] loadVersions 完成: ${symbol}, ${result.data.length} 个版本`)
      } else {
        const message = result.error ?? '加载评分文档版本失败'
        logger.error(`[scoreDocStore] loadVersions 失败: ${symbol}, ${message}`)
        set({ error: message, loading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] loadVersions 异常: ${symbol}, ${message}`)
      set({ error: `加载失败：${message}`, loading: false })
    }
  },

  refresh: async () => {
    const { symbol } = get()
    if (!symbol) {
      logger.info('[scoreDocStore] refresh 跳过: symbol 为空')
      return
    }

    logger.info(`[scoreDocStore] refresh 开始: ${symbol}`)
    set({ loading: true, error: null })

    try {
      const result = await getRecentVersions(symbol)
      if (result.success && result.data) {
        set({ versions: result.data, loading: false })
        logger.info(`[scoreDocStore] refresh 完成: ${symbol}, ${result.data.length} 个版本`)
      } else {
        const message = result.error ?? '加载评分文档版本失败'
        logger.error(`[scoreDocStore] refresh 失败: ${symbol}, ${message}`)
        set({ error: message, loading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] refresh 异常: ${symbol}, ${message}`)
      set({ error: `加载失败：${message}`, loading: false })
    }
  },

  clear: () => {
    logger.info('[scoreDocStore] clear')
    set({ symbol: '', versions: [], error: null, loading: false })
    withBroadcast(EVENT_NAMES.SCORE_DOCS_CHANGED, { action: 'clear' })
  },

  exportAll: async () => {
    const { symbol, versions } = get()
    if (!symbol || versions.length === 0) {
      logger.warn('[scoreDocStore] exportAll 跳过: symbol 为空或版本列表为空')
      return
    }

    logger.info(`[scoreDocStore] exportAll 开始: ${symbol}`)

    try {
      const result = await exportSymbolMd(symbol)
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${symbol}_score_docs.md`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        logger.info(`[scoreDocStore] exportAll 完成: ${symbol}`)
      } else {
        const message = result.error ?? '导出失败'
        logger.error(`[scoreDocStore] exportAll 失败: ${symbol}, ${message}`)
        set({ error: message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] exportAll 异常: ${symbol}, ${message}`)
      set({ error: `导出失败：${message}` })
    }
  },

  loadStockSymbols: async () => {
    logger.info('[scoreDocStore] loadStockSymbols 开始')
    try {
      const stocks = await dataLayer.stocks.list()
      const uniqueSymbols = Array.from(new Set(stocks.map(s => s.symbol))).sort()
      logger.info(`[scoreDocStore] loadStockSymbols 完成: ${uniqueSymbols.length} 个代码`)
      return uniqueSymbols
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] loadStockSymbols 异常: ${message}`)
      throw err
    }
  },

  generateReport: async (symbol) => {
    logger.info(`[scoreDocStore] generateReport 开始: ${symbol}`)
    try {
      const recentVersionsResult = await getRecentVersions(symbol, 1)
      if (!recentVersionsResult.success || !recentVersionsResult.data || recentVersionsResult.data.length === 0) {
        throw new Error(`股票 ${symbol} 暂无评分文档，请先生成评分`)
      }
      const latestVersion = recentVersionsResult.data[0]!
      const markdown = buildReportMarkdown(latestVersion)
      const report = {
        symbol,
        version: latestVersion.version,
        markdown,
        generatedAt: new Date().toISOString(),
      }
      logger.info(`[scoreDocStore] generateReport 完成: ${symbol} V${latestVersion.version}`)
      return report
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] generateReport 异常: ${symbol}, ${message}`)
      throw err
    }
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeScoreDocs: (() => void) | undefined

export function initScoreDocStoreSubscriptions(): () => void {
  destroyScoreDocStoreSubscriptions()
  logger.info('[scoreDocStore] 初始化 DataBridge score_docs 频道订阅')

  _unsubscribeScoreDocs = dataBridge.subscribe(
    'score_docs',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveScoreDocs) {
        logger.info('[scoreDocStore] DataBridge event received: saveScoreDocs', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroyScoreDocStoreSubscriptions()
}

export function destroyScoreDocStoreSubscriptions(): void {
  if (_unsubscribeScoreDocs) {
    _unsubscribeScoreDocs()
    _unsubscribeScoreDocs = undefined
  }
}
