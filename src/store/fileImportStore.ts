/**
 * @fileoverview 文件导入状态 Store
 * @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。
 *
 * 管理本地文件采集模块的状态，包括：
 * - 上传文件列表与校验结果
 * - 差异分析结果
 * - 校对报告
 * - 导入进度
 *
 * @module store/fileImportStore
 * @created 2026-07-14 - 双通道整改 P2-1
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type {
  DiffAnalysisResult,
  FileImportProofreadReport,
  FileValidationResult,
  HashComparisonResult,
} from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 文件导入步骤 */
type ImportStep = 'idle' | 'uploading' | 'validating' | 'parsing' | 'diffing' | 'reviewing' | 'importing' | 'complete' | 'error'

/** 文件导入 Store 状态 */
interface FileImportState {
  // 当前步骤
  step: ImportStep
  progress: number

  // 当前文件信息
  currentFileName: string | null
  currentFileHash: string | null

  // 校验结果
  validationResult: FileValidationResult | null

  // 差异分析
  diffResult: DiffAnalysisResult | null
  hashComparison: HashComparisonResult | null

  // 校对报告
  proofreadReport: FileImportProofreadReport | null

  // 历史报告
  reportHistory: FileImportProofreadReport[]

  // 错误信息
  errorMessage: string | null

  // 操作
  setStep: (step: ImportStep) => void
  setProgress: (progress: number) => void
  setFileInfo: (fileName: string, fileHash: string) => void
  setValidationResult: (result: FileValidationResult) => void
  setDiffResult: (diff: DiffAnalysisResult, hash: HashComparisonResult) => void
  setProofreadReport: (report: FileImportProofreadReport) => void
  setError: (message: string) => void
  reset: () => void
}

/** 初始状态 */
const initialState = {
  step: 'idle' as ImportStep,
  progress: 0,
  currentFileName: null,
  currentFileHash: null,
  validationResult: null,
  diffResult: null,
  hashComparison: null,
  proofreadReport: null,
  reportHistory: [] as FileImportProofreadReport[],
  errorMessage: null,
}

/**
 * 文件导入 Store
 */
export const useFileImportStore = create<FileImportState>((set) => ({
  ...initialState,

  setStep: (step) => {
    set({ step })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setStep', step })
    logger.info('[fileImportStore] 步骤变更', { step })
  },

  setProgress: (progress) => {
    set({ progress: Math.max(0, Math.min(100, progress)) })
  },

  setFileInfo: (fileName, fileHash) => {
    set({ currentFileName: fileName, currentFileHash: fileHash })
  },

  setValidationResult: (result) => {
    set({ validationResult: result })
    logger.info('[fileImportStore] 校验结果已设置', {
      valid: result.valid,
      errors: result.errors.length,
      warnings: result.warnings.length,
    })
  },

  setDiffResult: (diff, hash) => {
    set({ diffResult: diff, hashComparison: hash })
    logger.info('[fileImportStore] 差异分析已设置', {
      newRecords: diff.summary.newRecords,
      conflicts: diff.summary.conflictRecords,
      changedRecords: hash.changedRecords.length,
    })
  },

  setProofreadReport: (report) => {
    set((state) => ({
      proofreadReport: report,
      reportHistory: [report, ...state.reportHistory].slice(0, 50),
    }))
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setReport', reportId: report.meta.reportId })
    logger.info('[fileImportStore] 校对报告已设置', {
      reportId: report.meta.reportId,
      status: report.summary.overallStatus,
    })
  },

  setError: (message) => {
    set({ step: 'error', errorMessage: message })
    logger.error('[fileImportStore] 错误', { message })
  },

  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'reset' })
    logger.info('[fileImportStore] 状态已重置')
  },
}))
