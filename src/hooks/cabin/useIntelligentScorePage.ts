import { useEffect, useMemo, useState } from 'react'
import type { IntelligentScore, ResearchLog, Stock } from '@/data/types'
import { getDefaultLlmConfig, type LlmConfig } from '@/config/llmConfig'
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
import { getEnabledStockFactorNames } from '@/config/scoreFactors'

export const STEP_LABELS: Record<ScoreStep, { label: string; description: string }> = {
  fetchBasicData: { label: '读取基础数据', description: '从数据采集层获取标的字段' },
  readSupplementaryFiles: { label: '解析补充文件', description: '读取本地上传文件内容' },
  prepareReportText: { label: '整理行业报告', description: '汇总用户输入的分析资料' },
  llmAnalysis: { label: '大模型分析', description: '调用最新大模型进行评分推理' },
  parseScore: { label: '解析评分', description: '校验并计算综合分' },
  saveResult: { label: '保存结果', description: '通过 DataBridge 写入数据库' },
}

export const STEP_ORDER: ScoreStep[] = [
  'fetchBasicData',
  'readSupplementaryFiles',
  'prepareReportText',
  'llmAnalysis',
  'parseScore',
  'saveResult',
]

export const DIMENSION_ORDER = getEnabledStockFactorNames()

export function formatIntelligentDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

function isConfigReady(config: LlmConfig): boolean {
  return config.baseURL.trim().length > 0 && config.apiKey.trim().length > 0 && config.model.trim().length > 0
}

const INITIAL_PROGRESS: Record<ScoreStep, ScoreStepStatus['status']> = {
  fetchBasicData: 'pending',
  readSupplementaryFiles: 'pending',
  prepareReportText: 'pending',
  llmAnalysis: 'pending',
  parseScore: 'pending',
  saveResult: 'pending',
}

export interface UseIntelligentScorePageReturn {
  symbol: string
  setSymbol: (symbol: string) => void
  stocks: Stock[]
  files: File[]
  setFiles: (files: File[]) => void
  reportText: string
  setReportText: (text: string) => void
  llmConfig: LlmConfig
  setLlmConfig: React.Dispatch<React.SetStateAction<LlmConfig>>
  showConfig: boolean
  setShowConfig: React.Dispatch<React.SetStateAction<boolean>>
  configReady: boolean
  progress: Record<ScoreStep, ScoreStepStatus['status']>
  progressMessage: string
  result: IntelligentScore | undefined
  previousResult: IntelligentScore | undefined
  history: IntelligentScore[]
  logs: ResearchLog[]
  error: string
  loading: boolean
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleStart: () => Promise<void>
}

export function useIntelligentScorePage(): UseIntelligentScorePageReturn {
  const [symbol, setSymbol] = useState('')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [reportText, setReportText] = useState('')
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(getDefaultLlmConfig())
  const [showConfig, setShowConfig] = useState(false)
  const [progress, setProgress] = useState<Record<ScoreStep, ScoreStepStatus['status']>>(INITIAL_PROGRESS)
  const [progressMessage, setProgressMessage] = useState('')
  const [result, setResult] = useState<IntelligentScore | undefined>()
  const [previousResult, setPreviousResult] = useState<IntelligentScore | undefined>()
  const [history, setHistory] = useState<IntelligentScore[]>([])
  const [logs, setLogs] = useState<ResearchLog[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAllStocksForScoreSelect()
      .then(setStocks)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  useEffect(() => {
    if (!symbol) {
      setPreviousResult(undefined)
      setHistory([])
      setLogs([])
      return
    }
    loadIntelligentScoreHistory(symbol).then((sorted) => {
      setHistory(sorted)
      setPreviousResult(sorted[0])
    })
    loadResearchLogsForTarget(symbol).then(setLogs)
  }, [symbol])

  const configReady = useMemo(() => isConfigReady(llmConfig), [llmConfig])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files
    if (!selected) return
    setFiles(Array.from(selected))
  }

  const updateStep = (step: ScoreStep, status: ScoreStepStatus['status'], message?: string): void => {
    setProgress((prev) => ({ ...prev, [step]: status }))
    if (message) setProgressMessage(message)
  }

  const handleStart = async (): Promise<void> => {
    if (!symbol.trim()) {
      setError('请选择或输入股票代码')
      return
    }
    if (!configReady) {
      setError('请先配置 LLM 接口（baseURL、apiKey、model）')
      setShowConfig(true)
      return
    }

    setLoading(true)
    setError('')
    setResult(undefined)
    setProgressMessage('')
    setProgress({ ...INITIAL_PROGRESS })

    const input: RunIntelligentScoreInput = {
      symbol: symbol.trim(),
      files,
      reportText: reportText.trim(),
      llmConfig,
    }

    const onProgress: ScoreProgressCallback = ({ step, status, message }) => {
      updateStep(step, status, message)
    }

    const scoreResult = await runIntelligentScore(input, onProgress)
    setLoading(false)

    if (scoreResult.success && scoreResult.data) {
      setResult(scoreResult.data)
      const updatedHistory = await loadIntelligentScoreHistory(symbol)
      setHistory(updatedHistory)
      const updatedLogs = await loadResearchLogsForTarget(symbol)
      setLogs(updatedLogs)
    } else {
      setError(scoreResult.error ?? '评分失败')
    }
  }

  return {
    symbol,
    setSymbol,
    stocks,
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
