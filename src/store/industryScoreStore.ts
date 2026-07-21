/**
 * @module industryScoreStore
 * @lifecycle @Global
 * @description V4 行业评分页面状态管理。管理行业选择、LLM 配置、
 * 文件上传、评分进度、结果展示及历史记录。
 *
 * @see @/pages/analysis/IndustryScorePage.tsx - 消费此 Store 的行业评分页面
 * @see @/hooks/cabin/useIndustryScorePage.ts - @deprecated，已迁移到本 Store
 *
 * @compliance
 * - 所有数据请求经 Store Action 分发
 * - 核心分支包含 logger.info 打印（带 [industryScoreStore] 前缀）
 * - 遵循现有 Zustand Store 风格
  * @doc [V9-DOC-BACK-010, V9-DOC-BACK-012, V9-DOC-PROJ-002, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { SECTORS_SKILL_RANKED, type SectorSkillAnalysis } from '@/data/sectorSkillData'
import type { IndustryScore, ResearchLog } from '@/data/types'
import { getDefaultLlmConfig, type LlmConfig } from '@/config/llmConfig'
import {
  runIndustryScore,
  type RunIndustryScoreInput,
  type IndustryScoreProgressCallback,
  type IndustryScoreStep,
  type IndustryScoreStepStatus,
} from '@/services/scoring/industryScoreService'
import {
  loadIndustryScoreHistory,
  loadResearchLogsForTarget,
} from '@/services/analysis/scorePageService'
import { getEnabledIndustryFactorNames } from '@/config/scoreFactors'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 常量定义
// ============================================================

/**
 * STEP_LABELS
 */
export const STEP_LABELS: Record<IndustryScoreStep, { label: string; description: string }> = {
  fetchSectorData: { label: '读取行业 SKILL 数据', description: '加载已有行业量化评分' },
  readSupplementaryFiles: { label: '解析补充文件', description: '读取本地上传文件内容' },
  prepareReportText: { label: '整理行业报告', description: '汇总用户输入的分析资料' },
  llmAnalysis: { label: '大模型分析', description: '调用最新大模型进行行业评分推理' },
  parseScore: { label: '解析评分', description: '校验并计算综合分' },
  saveResult: { label: '保存结果', description: '通过 DataBridge 写入数据库' },
}

/**
 * STEP_ORDER
 */
export const STEP_ORDER: IndustryScoreStep[] = [
  'fetchSectorData',
  'readSupplementaryFiles',
  'prepareReportText',
  'llmAnalysis',
  'parseScore',
  'saveResult',
]

/**
 * DIMENSION_ORDER
 */
export const DIMENSION_ORDER = getEnabledIndustryFactorNames()

/**
 * formatIndustryDelta
 * @param current
 * @param previous
 * @returns string
 */
export function formatIndustryDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

const INITIAL_PROGRESS: Record<IndustryScoreStep, IndustryScoreStepStatus['status']> = {
  fetchSectorData: 'pending',
  readSupplementaryFiles: 'pending',
  prepareReportText: 'pending',
  llmAnalysis: 'pending',
  parseScore: 'pending',
  saveResult: 'pending',
}

// ============================================================
// 类型定义
// ============================================================

export interface IndustryScoreState {
  /** 当前选中的行业代码 */
  selectedCode: string
  /** 行业列表（静态数据） */
  sectors: SectorSkillAnalysis[]
  /** 上传的补充文件 */
  files: File[]
  /** 行业分析报告文本 */
  reportText: string
  /** LLM 配置 */
  llmConfig: LlmConfig
  /** 是否展开 LLM 配置面板 */
  showConfig: boolean
  /** 评分进度 */
  progress: Record<IndustryScoreStep, IndustryScoreStepStatus['status']>
  /** 进度提示消息 */
  progressMessage: string
  /** 当前评分结果 */
  result: IndustryScore | undefined
  /** 上一次评分结果 */
  previousResult: IndustryScore | undefined
  /** 评分历史记录 */
  history: IndustryScore[]
  /** 研究日志 */
  logs: ResearchLog[]
  /** 错误信息 */
  error: string
  /** 加载状态 */
  loading: boolean

  // Actions
  /** 设置当前行业代码 */
  setSelectedCode: (code: string) => void
  /** 设置上传文件 */
  setFiles: (files: File[]) => void
  /** 设置报告文本 */
  setReportText: (text: string) => void
  /** 设置 LLM 配置（支持函数式更新） */
  setLlmConfig: (config: LlmConfig | ((prev: LlmConfig) => LlmConfig)) => void
  /** 设置配置面板展开状态（支持函数式更新） */
  setShowConfig: (show: boolean | ((prev: boolean) => boolean)) => void
  /** 更新指定步骤的进度状态 */
  setProgress: (step: IndustryScoreStep, status: IndustryScoreStepStatus['status']) => void
  /** 设置进度提示消息 */
  setProgressMessage: (message: string) => void
  /** 重置进度为初始状态 */
  resetProgress: () => void
  /** 设置当前结果 */
  setResult: (result: IndustryScore | undefined) => void
  /** 设置上一次结果 */
  setPreviousResult: (result: IndustryScore | undefined) => void
  /** 设置历史记录 */
  setHistory: (history: IndustryScore[]) => void
  /** 设置研究日志 */
  setLogs: (logs: ResearchLog[]) => void
  /** 设置错误信息 */
  setError: (error: string) => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 清空错误信息 */
  clearError: () => void

  // 业务 Actions
  /** 加载指定行业的历史评分 */
  loadHistory: (code: string) => Promise<void>
  /** 加载指定行业的研究日志 */
  loadLogs: (code: string) => Promise<void>
  /** 运行行业智能评分 */
  runScore: (input?: Partial<RunIndustryScoreInput> & { code?: string }) => Promise<void>
  /** 重置结果及关联状态（保留输入态 selectedCode/files/llmConfig） */
  resetResult: () => void
  /** 重置 store 到初始空状态（含输入态），用于登出/切换账户 */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState: Omit<
  IndustryScoreState,
  | 'setSelectedCode'
  | 'setFiles'
  | 'setReportText'
  | 'setLlmConfig'
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
  | 'loadHistory'
  | 'loadLogs'
  | 'runScore'
  | 'resetResult'
  | 'reset'
> = {
  selectedCode: '',
  sectors: SECTORS_SKILL_RANKED,
  files: [],
  reportText: '',
  llmConfig: getDefaultLlmConfig(),
  showConfig: false,
  progress: { ...INITIAL_PROGRESS },
  progressMessage: '',
  result: undefined,
  previousResult: undefined,
  history: [],
  logs: [],
  error: '',
  loading: false,
}

// ============================================================
// Computed Selectors
// ============================================================

/** 基于 selectedCode 和 sectors 计算当前选中的行业 */
export function selectSelectedSector(state: IndustryScoreState): SectorSkillAnalysis | undefined {
  return state.sectors.find((s) => s.code === state.selectedCode)
}

/** 基于 llmConfig 计算配置是否就绪 */
export function selectConfigReady(state: IndustryScoreState): boolean {
  const { baseURL, apiKey, model } = state.llmConfig
  return baseURL.trim().length > 0 && apiKey.trim().length > 0 && model.trim().length > 0
}

// ============================================================
// Store
// ============================================================

/**
 * useIndustryScoreStore
 */
export const useIndustryScoreStore = create<IndustryScoreState>((set, get) => ({
  ...initialState,

  setSelectedCode: (selectedCode) => {
    logger.info(`[industryScoreStore] setSelectedCode: ${selectedCode}`)
    set({ selectedCode })
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
    withBroadcast(EVENT_NAMES.INDUSTRY_SCORES_CHANGED, { action: 'setResult' })
  },

  setPreviousResult: (previousResult) => set({ previousResult }),

  setHistory: (history) => {
    set({ history })
    withBroadcast(EVENT_NAMES.INDUSTRY_SCORES_CHANGED, { action: 'setHistory' })
  },

  setLogs: (logs) => set({ logs }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ loading }),

  clearError: () => set({ error: '' }),

  loadHistory: async (code) => {
    if (!code) {
      logger.info('[industryScoreStore] loadHistory 跳过: code 为空')
      set({ previousResult: undefined, history: [] })
      return
    }

    logger.info(`[industryScoreStore] loadHistory 开始: ${code}`)
    try {
      const sorted = await loadIndustryScoreHistory(code)
      set({ history: sorted, previousResult: sorted[0] })
      logger.info(`[industryScoreStore] loadHistory 完成: ${code}, ${sorted.length} 条记录`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[industryScoreStore] loadHistory 异常: ${code}, ${message}`)
      set({ error: message })
    }
  },

  loadLogs: async (code) => {
    if (!code) {
      logger.info('[industryScoreStore] loadLogs 跳过: code 为空')
      set({ logs: [] })
      return
    }

    logger.info(`[industryScoreStore] loadLogs 开始: ${code}`)
    try {
      const logs = await loadResearchLogsForTarget(code)
      set({ logs })
      logger.info(`[industryScoreStore] loadLogs 完成: ${code}, ${logs.length} 条日志`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[industryScoreStore] loadLogs 异常: ${code}, ${message}`)
      set({ error: message })
    }
  },

  runScore: async (input) => {
    const state = get()
    const code = input?.code ?? state.selectedCode
    const files = input?.files ?? state.files
    const reportText = input?.reportText ?? state.reportText
    const llmConfig = input?.llmConfig ?? state.llmConfig

    if (!code.trim()) {
      logger.info('[industryScoreStore] runScore 跳过: code 为空')
      set({ error: '请选择行业/赛道' })
      return
    }

    if (!selectConfigReady(state)) {
      logger.info('[industryScoreStore] runScore 跳过: LLM 未配置')
      set({ error: '请先配置 LLM 接口（baseURL、apiKey、model）', showConfig: true })
      return
    }

    logger.info(`[industryScoreStore] runScore 开始: code=${code.trim()}, mode=direct`)

    set({
      loading: true,
      error: '',
      result: undefined,
      progressMessage: '',
      progress: { ...INITIAL_PROGRESS },
    })

    const runInput: RunIndustryScoreInput = {
      code: code.trim(),
      files,
      reportText: reportText.trim(),
      llmConfig,
    }

    const onProgress: IndustryScoreProgressCallback = ({ step, status, message }) => {
      set((s) => ({
        progress: { ...s.progress, [step]: status },
      }))
      if (message) {
        set({ progressMessage: message })
      }
    }

    try {
      const scoreResult = await runIndustryScore(runInput, onProgress)
      set({ loading: false })

      if (scoreResult.success && scoreResult.data) {
        set({ result: scoreResult.data })
        const updatedHistory = await loadIndustryScoreHistory(code)
        set({ history: updatedHistory, previousResult: updatedHistory[0] })
        const updatedLogs = await loadResearchLogsForTarget(code)
        set({ logs: updatedLogs })
        logger.info(
          `[industryScoreStore] runScore 完成: code=${code.trim()}, overallScore=${scoreResult.data.overallScore}`,
        )
      } else {
        const errorMsg = scoreResult.error ?? '评分失败'
        logger.error(`[industryScoreStore] runScore 失败: ${errorMsg}`)
        set({ error: errorMsg })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[industryScoreStore] runScore 异常: ${message}`)
      set({ loading: false, error: message })
    }
  },

  resetResult: () => {
    logger.info('[industryScoreStore] resetResult')
    set({
      result: undefined,
      previousResult: undefined,
      history: [],
      logs: [],
      progress: { ...INITIAL_PROGRESS },
      progressMessage: '',
      error: '',
    })
    withBroadcast(EVENT_NAMES.INDUSTRY_SCORES_CHANGED, { action: 'reset' })
  },

  reset: () => {
    logger.info('[industryScoreStore] reset')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.INDUSTRY_SCORES_CHANGED, { action: 'reset' })
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeIndustryScores: (() => void) | undefined

/**
 * initIndustryScoreStoreSubscriptions
 */
export function initIndustryScoreStoreSubscriptions(): () => void {
  destroyIndustryScoreStoreSubscriptions()
  logger.info('[industryScoreStore] 初始化 DataBridge industry_scores 频道订阅')

  _unsubscribeIndustryScores = dataBridge.subscribe(
    'industry_scores',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveIndustryScores) {
        logger.info('[industryScoreStore] DataBridge event received: saveIndustryScores', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroyIndustryScoreStoreSubscriptions()
}

/**
 * destroyIndustryScoreStoreSubscriptions
 * @returns void
 */
export function destroyIndustryScoreStoreSubscriptions(): void {
  if (_unsubscribeIndustryScores) {
    _unsubscribeIndustryScores()
    _unsubscribeIndustryScores = undefined
  }
}
