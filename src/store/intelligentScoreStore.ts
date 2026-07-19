/**
 * @module intelligentScoreStore
 * @lifecycle @Global
 * @description V6 个股智能评分页面状态管理。管理股票选择、LLM 配置、
 * 文件上传、评分进度、结果展示及历史记录。
 *
 * @see @/pages/analysis/IntelligentScorePage.tsx - 消费此 Store 的智能评分页面
 * @see @/hooks/cabin/useIntelligentScorePage.ts - @deprecated，已迁移到本 Store
 *
 * @compliance
 * - 所有数据请求经 Store Action 分发
 * - 核心分支包含 logger.info 打印（带 [intelligentScoreStore] 前缀）
 * - 遵循现有 Zustand Store 风格
  * @doc [V9-DOC-BACK-010, V9-DOC-BACK-012, V9-DOC-PROJ-002, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { IntelligentScore, ResearchLog, Stock } from '@/data/types'
import {
  getDefaultLlmTransparencyConfig,
  type LlmTransparencyConfig,
} from '@/config/llmConfig'
import type { LlmConfig } from '@/config/llmConfig'
import {
  runIntelligentScore,
  type RunIntelligentScoreInput,
  type ScoreProgressCallback,
  type ScoreStep,
  type ScoreStepStatus,
} from '@/services/scoring/intelligentScoreService'
import {
  loadAllStocksForScoreSelect,
  loadIntelligentScoreHistory,
  loadResearchLogsForTarget,
} from '@/services/analysis/scorePageService'
import { loadStockScoreTrend, type ScoreTrendData } from '@/services/analysis/scoreTrendService'
import type { ScoreTrendPeriod } from '@/types/modules/score.types'
import { getEnabledStockFactorNames } from '@/config/scoreFactors'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 常量定义
// ============================================================

/**
 * STEP_LABELS
 */
export const STEP_LABELS: Record<ScoreStep, { label: string; description: string }> = {
  fetchBasicData: { label: '读取基础数据', description: '从数据采集层获取标的字段' },
  v6EngineCalculation: { label: 'V6 引擎计算', description: '使用实时因子引擎计算真实评分' },
  readSupplementaryFiles: { label: '解析补充文件', description: '读取本地上传文件内容' },
  prepareReportText: { label: '整理行业报告', description: '汇总用户输入的分析资料' },
  llmAnalysis: { label: '大模型分析', description: '调用最新大模型进行评分推理' },
  parseScore: { label: '解析评分', description: '校验并计算综合分' },
  saveResult: { label: '保存结果', description: '通过 DataBridge 写入数据库' },
}

/**
 * STEP_ORDER
 */
export const STEP_ORDER: ScoreStep[] = [
  'fetchBasicData',
  'v6EngineCalculation',
  'readSupplementaryFiles',
  'prepareReportText',
  'llmAnalysis',
  'parseScore',
  'saveResult',
]

/**
 * DIMENSION_ORDER
 */
export const DIMENSION_ORDER = getEnabledStockFactorNames()

/**
 * formatIntelligentDelta
 * @param current
 * @param previous
 * @returns string
 */
export function formatIntelligentDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

const INITIAL_PROGRESS: Record<ScoreStep, ScoreStepStatus['status']> = {
  fetchBasicData: 'pending',
  v6EngineCalculation: 'pending',
  readSupplementaryFiles: 'pending',
  prepareReportText: 'pending',
  llmAnalysis: 'pending',
  parseScore: 'pending',
  saveResult: 'pending',
}

// ============================================================
// 类型定义
// ============================================================

export interface IntelligentScoreState {
  /** 当前选中的股票代码 */
  symbol: string
  /** 股票列表（用于下拉选择） */
  stocks: Stock[]
  /** 上传的补充文件 */
  files: File[]
  /** 行业分析报告文本 */
  reportText: string
  /** LLM 配置（基础字段） */
  llmConfig: LlmConfig
  /** LLM 透明度配置（包含 enableLlm 和 factorOverrides） */
  transparencyConfig: LlmTransparencyConfig
  /** 是否展开 LLM 配置面板 */
  showConfig: boolean
  /** 评分进度 */
  progress: Record<ScoreStep, ScoreStepStatus['status']>
  /** 进度提示消息 */
  progressMessage: string
  /** 当前评分结果 */
  result: IntelligentScore | undefined
  /** 上一次评分结果 */
  previousResult: IntelligentScore | undefined
  /** 评分历史记录 */
  history: IntelligentScore[]
  /** 研究日志 */
  logs: ResearchLog[]
  /** 错误信息 */
  error: string
  /** 加载状态 */
  loading: boolean
  /** 多周期趋势数据 */
  trendData: ScoreTrendData | undefined
  /** 趋势数据加载状态 */
  trendLoading: boolean
  /** 趋势数据错误信息 */
  trendError: string | null

  // Actions
  /** 设置当前股票代码 */
  setSymbol: (symbol: string) => void
  /** 设置上传文件 */
  setFiles: (files: File[]) => void
  /** 设置报告文本 */
  setReportText: (text: string) => void
  /** 设置 LLM 配置（支持函数式更新） */
  setLlmConfig: (config: LlmConfig | ((prev: LlmConfig) => LlmConfig)) => void
  /** 设置透明度配置（支持函数式更新） */
  setTransparencyConfig: (config: LlmTransparencyConfig | ((prev: LlmTransparencyConfig) => LlmTransparencyConfig)) => void
  /** 切换 LLM 总开关 */
  toggleLlm: () => void
  /** 切换指定因子的 LLM 覆盖开关 */
  toggleFactorOverride: (factorId: string) => void
  /** 设置配置面板展开状态（支持函数式更新） */
  setShowConfig: (show: boolean | ((prev: boolean) => boolean)) => void
  /** 更新指定步骤的进度状态 */
  setProgress: (step: ScoreStep, status: ScoreStepStatus['status']) => void
  /** 设置进度提示消息 */
  setProgressMessage: (message: string) => void
  /** 重置进度为初始状态 */
  resetProgress: () => void
  /** 设置当前结果 */
  setResult: (result: IntelligentScore | undefined) => void
  /** 设置上一次结果 */
  setPreviousResult: (result: IntelligentScore | undefined) => void
  /** 设置历史记录 */
  setHistory: (history: IntelligentScore[]) => void
  /** 设置研究日志 */
  setLogs: (logs: ResearchLog[]) => void
  /** 设置错误信息 */
  setError: (error: string) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 清空错误信息 */
  clearError: () => void

  // 业务 Actions
  /** 加载股票列表 */
  loadStocks: () => Promise<void>
  /** 加载指定股票的历史评分 */
  loadHistory: (symbol: string) => Promise<void>
  /** 加载指定股票的研究日志 */
  loadLogs: (symbol: string) => Promise<void>
  /** 运行智能评分 */
  runScore: (input?: Partial<RunIntelligentScoreInput> & { symbol?: string }) => Promise<void>
  /** 加载多周期评分趋势 */
  loadScoreTrend: (symbol: string, period: ScoreTrendPeriod) => Promise<void>
  /** 重置结果及关联状态 */
  resetResult: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  IntelligentScoreState,
  | 'setSymbol'
  | 'setFiles'
  | 'setReportText'
  | 'setLlmConfig'
  | 'setTransparencyConfig'
  | 'toggleLlm'
  | 'toggleFactorOverride'
  | 'setShowConfig'
  | 'setProgress'
  | 'setProgressMessage'
  | 'resetProgress'
  | 'setResult'
  | 'setPreviousResult'
  | 'setHistory'
  | 'setLogs'
  | 'setError'
  | 'setLoading'
  | 'clearError'
  | 'loadStocks'
  | 'loadHistory'
  | 'loadLogs'
  | 'runScore'
  | 'loadScoreTrend'
  | 'resetResult'
> = {
  symbol: '',
  stocks: [],
  files: [],
  reportText: '',
  llmConfig: getDefaultLlmTransparencyConfig(),
  transparencyConfig: getDefaultLlmTransparencyConfig(),
  showConfig: false,
  progress: { ...INITIAL_PROGRESS },
  progressMessage: '',
  result: undefined,
  previousResult: undefined,
  history: [],
  logs: [],
  error: '',
  loading: false,
  trendData: undefined,
  trendLoading: false,
  trendError: null,
}

// ============================================================
// Computed Selector
// ============================================================

/** 基于 llmConfig 和 transparencyConfig 计算配置是否就绪 */
export function selectConfigReady(state: IntelligentScoreState): boolean {
  if (!state.transparencyConfig.enableLlm) return true
  const { baseURL, apiKey, model } = state.llmConfig
  return baseURL.trim().length > 0 && apiKey.trim().length > 0 && model.trim().length > 0
}

// ============================================================
// Store
// ============================================================

/**
 * useIntelligentScoreStore
 */
export const useIntelligentScoreStore = create<IntelligentScoreState>((set, get) => ({
  ...initialState,

  setSymbol: (symbol) => {
    logger.info(`[intelligentScoreStore] setSymbol: ${symbol}`)
    set({ symbol })
  },

  setFiles: (files) => set({ files }),

  setReportText: (reportText) => set({ reportText }),

  setLlmConfig: (config) => {
    if (typeof config === 'function') {
      set((state) => ({ llmConfig: config(state.llmConfig) }))
    } else {
      set({ llmConfig: config })
    }
  },

  setTransparencyConfig: (config) => {
    if (typeof config === 'function') {
      set((state) => ({ transparencyConfig: config(state.transparencyConfig) }))
    } else {
      set({ transparencyConfig: config })
    }
  },

  toggleLlm: () => {
    logger.info('[intelligentScoreStore] toggleLlm')
    set((state) => ({
      transparencyConfig: { ...state.transparencyConfig, enableLlm: !state.transparencyConfig.enableLlm },
    }))
  },

  toggleFactorOverride: (factorId) => {
    logger.info(`[intelligentScoreStore] toggleFactorOverride: ${factorId}`)
    set((state) => ({
      transparencyConfig: {
        ...state.transparencyConfig,
        factorOverrides: state.transparencyConfig.factorOverrides?.map((f) =>
          f.factorId === factorId ? { ...f, useLlm: !f.useLlm } : f,
        ),
      },
    }))
  },

  setShowConfig: (show) => {
    if (typeof show === 'function') {
      set((state) => ({ showConfig: show(state.showConfig) }))
    } else {
      set({ showConfig: show })
    }
  },

  setProgress: (step, status) => {
    set((state) => ({
      progress: { ...state.progress, [step]: status },
    }))
  },

  setProgressMessage: (progressMessage) => set({ progressMessage }),

  resetProgress: () => set({ progress: { ...INITIAL_PROGRESS }, progressMessage: '' }),

  setResult: (result) => {
    set({ result })
    withBroadcast(EVENT_NAMES.INTELLIGENT_SCORES_CHANGED, { action: 'setResult' })
  },

  setPreviousResult: (previousResult) => set({ previousResult }),

  setHistory: (history) => {
    set({ history })
    withBroadcast(EVENT_NAMES.INTELLIGENT_SCORES_CHANGED, { action: 'setHistory' })
  },

  setLogs: (logs) => set({ logs }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ loading }),

  clearError: () => set({ error: '' }),

  loadStocks: async () => {
    logger.info('[intelligentScoreStore] loadStocks 开始')
    try {
      const stocks = await loadAllStocksForScoreSelect()
      set({ stocks })
      logger.info(`[intelligentScoreStore] loadStocks 完成: ${stocks.length} 只股票`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intelligentScoreStore] loadStocks 异常: ${message}`)
      set({ error: message })
    }
  },

  loadHistory: async (symbol) => {
    if (!symbol) {
      logger.info('[intelligentScoreStore] loadHistory 跳过: symbol 为空')
      set({ previousResult: undefined, history: [] })
      return
    }

    logger.info(`[intelligentScoreStore] loadHistory 开始: ${symbol}`)
    try {
      const sorted = await loadIntelligentScoreHistory(symbol)
      set({ history: sorted, previousResult: sorted[0] })
      logger.info(`[intelligentScoreStore] loadHistory 完成: ${symbol}, ${sorted.length} 条记录`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intelligentScoreStore] loadHistory 异常: ${symbol}, ${message}`)
      set({ error: message })
    }
  },

  loadLogs: async (symbol) => {
    if (!symbol) {
      logger.info('[intelligentScoreStore] loadLogs 跳过: symbol 为空')
      set({ logs: [] })
      return
    }

    logger.info(`[intelligentScoreStore] loadLogs 开始: ${symbol}`)
    try {
      const logs = await loadResearchLogsForTarget(symbol)
      set({ logs })
      logger.info(`[intelligentScoreStore] loadLogs 完成: ${symbol}, ${logs.length} 条日志`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intelligentScoreStore] loadLogs 异常: ${symbol}, ${message}`)
      set({ error: message })
    }
  },

  runScore: async (input) => {
    const state = get()
    const symbol = input?.symbol ?? state.symbol
    const files = input?.files ?? state.files
    const reportText = input?.reportText ?? state.reportText
    const llmConfig = input?.llmConfig ?? state.llmConfig

    if (!symbol.trim()) {
      logger.info('[intelligentScoreStore] runScore 跳过: symbol 为空')
      set({ error: '请选择或输入股票代码' })
      return
    }

    if (!selectConfigReady(state)) {
      logger.info('[intelligentScoreStore] runScore 跳过: LLM 未配置')
      set({ error: '请先配置 LLM 接口（baseURL、apiKey、model）', showConfig: true })
      return
    }

    logger.info(`[intelligentScoreStore] runScore 开始: symbol=${symbol.trim()}, mode=direct`)

    set({
      loading: true,
      error: '',
      result: undefined,
      progressMessage: '',
      progress: { ...INITIAL_PROGRESS },
    })

    const runInput: RunIntelligentScoreInput = {
      symbol: symbol.trim(),
      files,
      reportText: reportText.trim(),
      llmConfig,
      transparencyConfig: state.transparencyConfig,
    }

    const onProgress: ScoreProgressCallback = ({ step, status, message }) => {
      set((s) => ({
        progress: { ...s.progress, [step]: status },
      }))
      if (message) {
        set({ progressMessage: message })
      }
    }

    try {
      const scoreResult = await runIntelligentScore(runInput, onProgress)
      set({ loading: false })

      if (scoreResult.success && scoreResult.data) {
        set({ result: scoreResult.data })
        const updatedHistory = await loadIntelligentScoreHistory(symbol)
        set({ history: updatedHistory, previousResult: updatedHistory[0] })
        const updatedLogs = await loadResearchLogsForTarget(symbol)
        set({ logs: updatedLogs })
        logger.info(
          `[intelligentScoreStore] runScore 完成: symbol=${symbol.trim()}, overallScore=${scoreResult.data.overallScore}`,
        )
      } else {
        const errorMsg = scoreResult.error ?? '评分失败'
        logger.error(`[intelligentScoreStore] runScore 失败: ${errorMsg}`)
        set({ error: errorMsg })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intelligentScoreStore] runScore 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  loadScoreTrend: async (symbol, period) => {
    if (!symbol) {
      logger.info('[intelligentScoreStore] loadScoreTrend 跳过: symbol 为空')
      set({ trendData: undefined, trendError: null, trendLoading: false })
      return
    }

    logger.info(`[intelligentScoreStore] loadScoreTrend 开始: ${symbol}, period=${period}`)
    set({ trendLoading: true, trendError: null })

    try {
      const res = await loadStockScoreTrend(symbol, period)
      if (res.success) {
        set({ trendData: res.data, trendLoading: false })
        logger.info(`[intelligentScoreStore] loadScoreTrend 完成: ${symbol}`)
      } else {
        set({ trendError: res.error, trendLoading: false })
        logger.error(`[intelligentScoreStore] loadScoreTrend 失败: ${res.error}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intelligentScoreStore] loadScoreTrend 异常: ${symbol}, ${message}`)
      set({ trendError: message, trendLoading: false })
    }
  },

  resetResult: () => {
    logger.info('[intelligentScoreStore] resetResult')
    set({
      result: undefined,
      previousResult: undefined,
      history: [],
      logs: [],
      progress: { ...INITIAL_PROGRESS },
      progressMessage: '',
      error: '',
      trendData: undefined,
      trendLoading: false,
      trendError: null,
    })
    withBroadcast(EVENT_NAMES.INTELLIGENT_SCORES_CHANGED, { action: 'reset' })
  },
}))
