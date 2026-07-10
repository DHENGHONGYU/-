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
import type { ScoreComparisonMode, ScoreComparisonResult, ScoreComparisonTimelineItem } from '@/types/modules/score.types'
import {
  buildReportMarkdown,
  getRecentVersions,
  exportSymbolMd,
  listScoreDocsBySymbol,
  buildScoreDocDiff,
  type ScoreDocDiff,
  compareTwoVersions,
  compareTwoStocksLatest,
  getScoreTimeline,
} from '@/services/analysis/scoreDocService'
import { listStocks } from '@/services/stockpool/stockpoolService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

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
  /** 历史文档列表（供 ScoreHistoryPanel 使用） */
  historyDocs: ScoreDocVersion[]
  /** 历史文档差异（最新版本 vs 上一版本） */
  historyDiff: ScoreDocDiff | null
  /** 历史文档加载状态 */
  historyLoading: boolean
  /** 历史文档错误信息 */
  historyError: string | null
  /** 比对模式 */
  comparisonMode: ScoreComparisonMode
  /** 比对左侧版本号（同股票模式）或股票代码（跨股票模式） */
  comparisonLeft: string
  /** 比对右侧版本号（同股票模式）或股票代码（跨股票模式） */
  comparisonRight: string
  /** 比对结果 */
  comparisonResult: ScoreComparisonResult | null
  /** 比对加载状态 */
  comparisonLoading: boolean
  /** 比对错误信息 */
  comparisonError: string | null
  /** 评分时间轴数据 */
  timelineData: ScoreComparisonTimelineItem[]
  /** 时间轴加载状态 */
  timelineLoading: boolean

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
  /** 加载股票代码列表（供下拉选择，封装 DataBridge.query(queryList)）） */
  loadStockSymbols: () => Promise<string[]>
  /** 生成研究报告 Markdown（封装 buildReportMarkdown + getRecentVersions） */
  generateReport: (symbol: string) => Promise<{ symbol: string; version: number; markdown: string; generatedAt: string }>
  /** 加载历史文档列表并计算差异（供 ScoreHistoryPanel 使用） */
  loadHistoryDocs: (symbol: string) => Promise<void>
  /** 设置比对模式 */
  setComparisonMode: (mode: ScoreComparisonMode) => void
  /** 设置比对左侧值 */
  setComparisonLeft: (value: string) => void
  /** 设置比对右侧值 */
  setComparisonRight: (value: string) => void
  /** 执行版本比对（同股票模式） */
  runVersionComparison: (symbol: string, leftVersion: number, rightVersion: number) => Promise<void>
  /** 执行股票比对（跨股票模式） */
  runStockComparison: (leftSymbol: string, rightSymbol: string) => Promise<void>
  /** 加载评分时间轴 */
  loadTimeline: (symbol: string) => Promise<void>
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
  historyDocs: [] as ScoreDocVersion[],
  historyDiff: null as ScoreDocDiff | null,
  historyLoading: false,
  historyError: null as string | null,
  comparisonMode: 'same-stock-versions' as ScoreComparisonMode,
  comparisonLeft: '',
  comparisonRight: '',
  comparisonResult: null as ScoreComparisonResult | null,
  comparisonLoading: false,
  comparisonError: null as string | null,
  timelineData: [] as ScoreComparisonTimelineItem[],
  timelineLoading: false,
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

  loadHistoryDocs: async (symbol) => {
    if (!symbol) {
      logger.info('[scoreDocStore] loadHistoryDocs 跳过: symbol 为空')
      set({ historyDocs: [], historyDiff: null, historyError: null, historyLoading: false })
      return
    }

    logger.info(`[scoreDocStore] loadHistoryDocs 开始: ${symbol}`)
    set({ historyLoading: true, historyError: null })

    try {
      const result = await listScoreDocsBySymbol(symbol)
      if (result.success) {
        const list = result.data ?? []
        let diff: ScoreDocDiff | null = null
        if (list.length >= 2) {
          const latest = list[0]!
          const previous = list[1]!
          diff = buildScoreDocDiff(latest, previous)
        }
        set({ historyDocs: list, historyDiff: diff, historyLoading: false })
        logger.info(`[scoreDocStore] loadHistoryDocs 完成: ${symbol}, ${list.length} 个版本`)
      } else {
        const message = result.error ?? '加载失败'
        logger.error(`[scoreDocStore] loadHistoryDocs 失败: ${symbol}, ${message}`)
        set({ historyError: message, historyLoading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] loadHistoryDocs 异常: ${symbol}, ${message}`)
      set({ historyError: `加载失败：${message}`, historyLoading: false })
    }
  },

  loadStockSymbols: async () => {
    logger.info('[scoreDocStore] loadStockSymbols 开始')
    try {
      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.analyzer,
      })

      if (!result.success) {
        const errorMessage = result.error ?? '查询股票列表失败'
        logger.error(`[scoreDocStore] loadStockSymbols 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const stocks = result.data ?? []
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

  setComparisonMode: (mode: ScoreComparisonMode) => {
    logger.info(`[scoreDocStore] setComparisonMode: ${mode}`)
    set({ comparisonMode: mode, comparisonLeft: '', comparisonRight: '', comparisonResult: null, comparisonError: null })
  },

  setComparisonLeft: (value: string) => {
    set({ comparisonLeft: value })
  },

  setComparisonRight: (value: string) => {
    set({ comparisonRight: value })
  },

  runVersionComparison: async (symbol: string, leftVersion: number, rightVersion: number) => {
    logger.info(`[scoreDocStore] runVersionComparison 开始: ${symbol} V${leftVersion} vs V${rightVersion}`)
    set({ comparisonLoading: true, comparisonError: null })

    try {
      const result = await compareTwoVersions(symbol, leftVersion, rightVersion)
      if (result.success && result.data) {
        set({ comparisonResult: result.data, comparisonLoading: false })
        logger.info(`[scoreDocStore] runVersionComparison 完成: ${symbol} V${leftVersion} vs V${rightVersion}`)
      } else {
        const message = result.error ?? '版本比对失败'
        logger.error(`[scoreDocStore] runVersionComparison 失败: ${message}`)
        set({ comparisonError: message, comparisonLoading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] runVersionComparison 异常: ${message}`)
      set({ comparisonError: `比对失败：${message}`, comparisonLoading: false })
    }
  },

  runStockComparison: async (leftSymbol: string, rightSymbol: string) => {
    logger.info(`[scoreDocStore] runStockComparison 开始: ${leftSymbol} vs ${rightSymbol}`)
    set({ comparisonLoading: true, comparisonError: null })

    try {
      const result = await compareTwoStocksLatest(leftSymbol, rightSymbol)
      if (result.success && result.data) {
        set({ comparisonResult: result.data, comparisonLoading: false })
        logger.info(`[scoreDocStore] runStockComparison 完成: ${leftSymbol} vs ${rightSymbol}`)
      } else {
        const message = result.error ?? '股票比对失败'
        logger.error(`[scoreDocStore] runStockComparison 失败: ${message}`)
        set({ comparisonError: message, comparisonLoading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] runStockComparison 异常: ${message}`)
      set({ comparisonError: `比对失败：${message}`, comparisonLoading: false })
    }
  },

  loadTimeline: async (symbol: string) => {
    if (!symbol) {
      logger.info('[scoreDocStore] loadTimeline 跳过: symbol 为空')
      set({ timelineData: [], timelineLoading: false })
      return
    }

    logger.info(`[scoreDocStore] loadTimeline 开始: ${symbol}`)
    set({ timelineLoading: true })

    try {
      const result = await getScoreTimeline(symbol)
      if (result.success && result.data) {
        set({ timelineData: result.data, timelineLoading: false })
        logger.info(`[scoreDocStore] loadTimeline 完成: ${symbol}, ${result.data.length} 个版本`)
      } else {
        const message = result.error ?? '加载时间轴失败'
        logger.error(`[scoreDocStore] loadTimeline 失败: ${message}`)
        set({ timelineData: [], timelineLoading: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[scoreDocStore] loadTimeline 异常: ${message}`)
      set({ timelineData: [], timelineLoading: false })
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
