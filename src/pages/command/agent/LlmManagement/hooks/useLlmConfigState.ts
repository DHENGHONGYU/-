/**
 * LLM 管理页面状态管理 Hook
 *
 * 集中管理 LlmManagementPage 的所有 useState 状态：
 * - LLM 配置、API Key、模型预设选择
 * - 保存/测试的 loading 状态
 * - 因子控制覆盖与全局开关
 * - 使用统计（模拟数据）
 * - 模型筛选条件与推荐场景
 *
 * @module LlmManagement/hooks/useLlmConfigState
  * @doc [V9-DOC-AI-003, V9-DOC-AI-006, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-FRONT-020]
*/

import { useState } from 'react'
import type { LlmConfig, LlmFactorOverride } from '@/config/llmConfig'
import { DEFAULT_LLM_FACTOR_OVERRIDES } from '@/config/llmConfig'

/**
 * 模型筛选条件
 */
export interface ModelFilters {
  minContextWindow: number
  maxInputPrice: number
  maxOutputPrice: number
  providers: string[]
}

/**
 * 使用统计（待接入真实后端）
 */
export interface UsageStats {
  todayCalls: number
  monthCalls: number
  tokenUsage: { input: number; output: number; total: number }
  costEstimate: number
  callsByFactor: Record<string, number>
  callsByModel: Record<string, number>
}

/**
 * 测试结果
 */
export interface TestResult {
  success: boolean
  message: string
}

export interface LlmConfigState {
  // 基础配置
  config: Partial<LlmConfig>
  setConfig: React.Dispatch<React.SetStateAction<Partial<LlmConfig>>>

  // API Key
  apiKey: string
  setApiKey: React.Dispatch<React.SetStateAction<string>>
  showApiKey: boolean
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>

  // Tushare Token（数据源密钥）
  tushareToken: string
  setTushareToken: React.Dispatch<React.SetStateAction<string>>
  showTushareToken: boolean
  setShowTushareToken: React.Dispatch<React.SetStateAction<boolean>>

  // Qwen API Key（辅助 LLM 密钥）
  qwenApiKey: string
  setQwenApiKey: React.Dispatch<React.SetStateAction<string>>
  showQwenApiKey: boolean
  setShowQwenApiKey: React.Dispatch<React.SetStateAction<boolean>>

  // 预设选择
  selectedPreset: string
  setSelectedPreset: React.Dispatch<React.SetStateAction<string>>

  // 保存/测试状态
  isSaving: boolean
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>
  isTesting: boolean
  setIsTesting: React.Dispatch<React.SetStateAction<boolean>>
  testResult: TestResult | null
  setTestResult: React.Dispatch<React.SetStateAction<TestResult | null>>

  // 当前 Tab
  activeTab: string
  setActiveTab: React.Dispatch<React.SetStateAction<string>>

  // 因子控制
  factorOverrides: LlmFactorOverride[]
  setFactorOverrides: React.Dispatch<React.SetStateAction<LlmFactorOverride[]>>
  globalLlmEnabled: boolean
  setGlobalLlmEnabled: React.Dispatch<React.SetStateAction<boolean>>

  // 使用统计（模拟）
  usageStats: UsageStats

  // 模型筛选
  modelFilters: ModelFilters
  setModelFilters: React.Dispatch<React.SetStateAction<ModelFilters>>

  // 模型推荐场景
  recommendScenario: string
  setRecommendScenario: React.Dispatch<React.SetStateAction<string>>
}

/**
 * 初始化所有 useState，提取自原 LlmManagementPage 顶部
 */
export function useLlmConfigState(): LlmConfigState {
  const [config, setConfig] = useState<Partial<LlmConfig>>({})
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [tushareToken, setTushareToken] = useState('')
  const [showTushareToken, setShowTushareToken] = useState(false)
  const [qwenApiKey, setQwenApiKey] = useState('')
  const [showQwenApiKey, setShowQwenApiKey] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [activeTab, setActiveTab] = useState('config')

  const [factorOverrides, setFactorOverrides] = useState<LlmFactorOverride[]>(DEFAULT_LLM_FACTOR_OVERRIDES)
  const [globalLlmEnabled, setGlobalLlmEnabled] = useState(true)

  const [usageStats] = useState<UsageStats>({
    todayCalls: 0,
    monthCalls: 0,
    tokenUsage: { input: 0, output: 0, total: 0 },
    costEstimate: 0,
    callsByFactor: {},
    callsByModel: {},
  })

  const [modelFilters, setModelFilters] = useState<ModelFilters>({
    minContextWindow: 0,
    maxInputPrice: Number.POSITIVE_INFINITY,
    maxOutputPrice: Number.POSITIVE_INFINITY,
    providers: [],
  })

  const [recommendScenario, setRecommendScenario] = useState<string>('')

  return {
    config,
    setConfig,
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    tushareToken,
    setTushareToken,
    showTushareToken,
    setShowTushareToken,
    qwenApiKey,
    setQwenApiKey,
    showQwenApiKey,
    setShowQwenApiKey,
    selectedPreset,
    setSelectedPreset,
    isSaving,
    setIsSaving,
    isTesting,
    setIsTesting,
    testResult,
    setTestResult,
    activeTab,
    setActiveTab,
    factorOverrides,
    setFactorOverrides,
    globalLlmEnabled,
    setGlobalLlmEnabled,
    usageStats,
    modelFilters,
    setModelFilters,
    recommendScenario,
    setRecommendScenario,
  }
}
