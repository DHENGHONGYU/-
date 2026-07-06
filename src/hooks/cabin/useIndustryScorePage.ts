import { useEffect, useMemo, useState } from 'react'
import { SECTORS_SKILL_RANKED, type SectorSkillAnalysis } from '@/data/sectorSkillData'
import type { IndustryScore, ResearchLog } from '@/data/types'
import { getDefaultLlmConfig, getLlmApiKeyAsync, setLlmApiKey, type LlmConfig } from '@/config/llmConfig'
import {
  runIndustryScore,
  type IndustryScoreProgressCallback,
  type IndustryScoreStep,
  type IndustryScoreStepStatus,
} from '@/services/scoring/industryScoreService'
import {
  loadIndustryScoreHistory,
  loadResearchLogsForTarget,
} from '@/services/analysis/scorePageService'
import { getEnabledIndustryFactorNames } from '@/config/scoreFactors'

export const STEP_LABELS: Record<IndustryScoreStep, { label: string; description: string }> = {
  fetchSectorData: { label: '读取行业 SKILL 数据', description: '加载已有行业量化评分' },
  readSupplementaryFiles: { label: '解析补充文件', description: '读取本地上传文件内容' },
  prepareReportText: { label: '整理行业报告', description: '汇总用户输入的分析资料' },
  llmAnalysis: { label: '大模型分析', description: '调用最新大模型进行行业评分推理' },
  parseScore: { label: '解析评分', description: '校验并计算综合分' },
  saveResult: { label: '保存结果', description: '通过 DataBridge 写入数据库' },
}

export const STEP_ORDER: IndustryScoreStep[] = [
  'fetchSectorData',
  'readSupplementaryFiles',
  'prepareReportText',
  'llmAnalysis',
  'parseScore',
  'saveResult',
]

export const DIMENSION_ORDER = getEnabledIndustryFactorNames()

export function formatIndustryDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

function isConfigReady(config: LlmConfig): boolean {
  return config.baseURL.trim().length > 0 && config.apiKey.trim().length > 0 && config.model.trim().length > 0
}

const INITIAL_PROGRESS: Record<IndustryScoreStep, IndustryScoreStepStatus['status']> = {
  fetchSectorData: 'pending',
  readSupplementaryFiles: 'pending',
  prepareReportText: 'pending',
  llmAnalysis: 'pending',
  parseScore: 'pending',
  saveResult: 'pending',
}

export interface UseIndustryScorePageReturn {
  selectedCode: string
  setSelectedCode: (code: string) => void
  sectors: SectorSkillAnalysis[]
  selectedSector: SectorSkillAnalysis | undefined
  files: File[]
  setFiles: (files: File[]) => void
  reportText: string
  setReportText: (text: string) => void
  llmConfig: LlmConfig
  setLlmConfig: React.Dispatch<React.SetStateAction<LlmConfig>>
  showConfig: boolean
  setShowConfig: React.Dispatch<React.SetStateAction<boolean>>
  configReady: boolean
  progress: Record<IndustryScoreStep, IndustryScoreStepStatus['status']>
  progressMessage: string
  result: IndustryScore | undefined
  previousResult: IndustryScore | undefined
  history: IndustryScore[]
  logs: ResearchLog[]
  error: string
  loading: boolean
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleStart: () => Promise<void>
}

export function useIndustryScorePage(): UseIndustryScorePageReturn {
  const [selectedCode, setSelectedCode] = useState('')
  const [sectors] = useState<SectorSkillAnalysis[]>(SECTORS_SKILL_RANKED)
  const [files, setFiles] = useState<File[]>([])
  const [reportText, setReportText] = useState('')
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(getDefaultLlmConfig())
  const [showConfig, setShowConfig] = useState(false)
  const [progress, setProgress] = useState<Record<IndustryScoreStep, IndustryScoreStepStatus['status']>>(INITIAL_PROGRESS)
  const [progressMessage, setProgressMessage] = useState('')
  const [result, setResult] = useState<IndustryScore | undefined>()
  const [previousResult, setPreviousResult] = useState<IndustryScore | undefined>()
  const [history, setHistory] = useState<IndustryScore[]>([])
  const [logs, setLogs] = useState<ResearchLog[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 异步加载加密存储的 API Key（P0-3 安全修复：禁止明文读取）
  useEffect(() => {
    let mounted = true
    getLlmApiKeyAsync().then((key) => {
      if (mounted && key) {
        setLlmConfig((prev) => ({ ...prev, apiKey: key }))
      }
    })
    return () => { mounted = false }
  }, [])

  // 用户修改 API Key 时自动加密持久化
  useEffect(() => {
    if (llmConfig.apiKey.trim()) {
      setLlmApiKey(llmConfig.apiKey).catch(() => { /* 加密失败不阻塞 UI */ })
    }
  }, [llmConfig.apiKey])

  const selectedSector = useMemo(
    () => sectors.find((s) => s.code === selectedCode),
    [sectors, selectedCode],
  )

  useEffect(() => {
    if (!selectedCode) return
    loadIndustryScoreHistory(selectedCode).then((sorted) => {
      setHistory(sorted)
      setPreviousResult(sorted[0])
    })
    loadResearchLogsForTarget(selectedCode).then(setLogs)
  }, [selectedCode])

  const configReady = useMemo(() => isConfigReady(llmConfig), [llmConfig])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files
    if (!selected) return
    setFiles(Array.from(selected))
  }

  const updateStep = (step: IndustryScoreStep, status: IndustryScoreStepStatus['status'], message?: string): void => {
    setProgress((prev) => ({ ...prev, [step]: status }))
    if (message) setProgressMessage(message)
  }

  const handleStart = async (): Promise<void> => {
    if (!selectedCode) {
      setError('请选择行业/赛道')
      return
    }
    if (!configReady) {
      setError('请先配置 LLM 接口')
      setShowConfig(true)
      return
    }

    setLoading(true)
    setError('')
    setResult(undefined)
    setProgressMessage('')
    setProgress({ ...INITIAL_PROGRESS })

    const onProgress: IndustryScoreProgressCallback = ({ step, status, message }) => {
      updateStep(step, status, message)
    }

    const scoreResult = await runIndustryScore(
      { code: selectedCode, files, reportText: reportText.trim(), llmConfig },
      onProgress,
    )
    setLoading(false)

    if (scoreResult.success && scoreResult.data) {
      setResult(scoreResult.data)
      const updatedHistory = await loadIndustryScoreHistory(selectedCode)
      setHistory(updatedHistory)
      const updatedLogs = await loadResearchLogsForTarget(selectedCode)
      setLogs(updatedLogs)
    } else {
      setError(scoreResult.error ?? '评分失败')
    }
  }

  return {
    selectedCode,
    setSelectedCode,
    sectors,
    selectedSector,
    files,
    setFiles,
    reportText,
    setReportText,
    llmConfig,
    setLlmConfig,
    showConfig,
    setShowConfig,
    configReady,
    progress,
    progressMessage,
    result,
    previousResult,
    history,
    logs,
    error,
    loading,
    handleFileChange,
    handleStart,
  }
}
