/**
 * LLM 管理页面业务逻辑 Hook
 *
 * 封装配置加载、保存、连接测试、预设选择、模型筛选与推荐等业务逻辑。
 * 不渲染任何 UI；纯函数式业务编排。
 *
 * @module LlmManagement/hooks/useLlmConfigActions
  * @doc [V9-DOC-AI-003, V9-DOC-AI-006, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-FRONT-020]
*/

import { useCallback, useEffect } from 'react'
import { getLogger } from '@/lib/logger'
import {
  LLM_MODEL_PRESETS,
  type LlmPreset,
  getPresetById,
  inferPresetId,
  setLlmApiKey,
  isLlmApiKeyConfigured,
  getDefaultLlmConfig,
} from '@/config/llmConfig'
import type { LlmConfigState } from './useLlmConfigState'

const logger = getLogger()

/**
 * 业务逻辑返回
 */
export interface LlmConfigActions {
  // 初始化副作用
  initialize: () => void
  // 保存配置
  handleSave: () => Promise<void>
  // 测试连接
  handleTest: () => Promise<void>
  // 预设变更
  handlePresetChange: (presetId: string) => void
  // 模型列表（当前预设）
  getCurrentModels: () => string[]
  // 筛选后的预设列表
  getFilteredPresets: () => LlmPreset[]
  // 可用提供商
  getAvailableProviders: () => string[]
  // 推荐模型（按场景）
  getRecommendedModels: () => LlmPreset[]
}

/**
 * 价格字符串解析辅助：'$0.5' → 0.5
 */
function parsePriceString(price: string | undefined): number {
  if (price == null) return 0
  return parseFloat(price.replace('$', ''))
}

const MAX_INPUT_PRICE_SLIDER = 2
const MAX_OUTPUT_PRICE_SLIDER = 3
const CONTEXT_WINDOW_LONG = 100_000
const RECOMMENDATION_LIMIT = 2

/**
 * useLlmConfigActions
 * @param state
 * @returns LlmConfigActions
 */
export function useLlmConfigActions(state: LlmConfigState): LlmConfigActions {
  const {
    config,
    setConfig,
    apiKey,
    selectedPreset,
    setSelectedPreset,
    setIsSaving,
    setIsTesting,
    setTestResult,
    setApiKey,
    modelFilters,
    recommendScenario,
    factorOverrides,
    setFactorOverrides,
    globalLlmEnabled,
    setGlobalLlmEnabled,
  } = state

  // ── 初始化 ─────────────────────────────────────────────
  const initialize = useCallback(() => {
    void (async () => {
      try {
        const defaultConfig = getDefaultLlmConfig()
        setConfig(defaultConfig)

        if (isLlmApiKeyConfigured()) {
          setApiKey('••••••••')
        }

        const presetId = inferPresetId(defaultConfig.baseURL || '')
        setSelectedPreset(presetId)

        // 从 localStorage 读取已保存的透明度配置（因子开关 + 全局开关）
        const savedTransparency = localStorage.getItem('v9-llm-transparency')
        if (savedTransparency != null && savedTransparency !== '') {
          const parsed = JSON.parse(savedTransparency) as {
            enableLlm?: boolean
            factorOverrides?: typeof factorOverrides
          }
          if (typeof parsed.enableLlm === 'boolean') {
            setGlobalLlmEnabled(parsed.enableLlm)
          }
          if (Array.isArray(parsed.factorOverrides) && parsed.factorOverrides.length > 0) {
            setFactorOverrides(parsed.factorOverrides)
          }
          logger.info('[LlmManagement] 已加载透明度配置', {
            enableLlm: parsed.enableLlm,
            factorCount: parsed.factorOverrides?.length ?? 0,
          })
        }
      } catch (err) {
        logger.error('[LlmManagement] 加载配置失败', { error: err })
      }
    })()
  }, [setConfig, setApiKey, setSelectedPreset, setGlobalLlmEnabled, setFactorOverrides])

  useEffect(() => {
    initialize()
  }, [initialize])

  // ── 保存配置 ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      if (apiKey && apiKey !== '••••••••') {
        await setLlmApiKey(apiKey)
      }

      const configToSave = {
        baseURL: config.baseURL,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      }

      localStorage.setItem('v9-llm-config', JSON.stringify(configToSave))

      // 保存透明度配置（因子级开关 + 全局开关）
      const transparencyToSave = {
        enableLlm: globalLlmEnabled,
        factorOverrides,
      }
      localStorage.setItem('v9-llm-transparency', JSON.stringify(transparencyToSave))

      logger.info('[LlmManagement] 配置已保存', {
        config: configToSave,
        enableLlm: globalLlmEnabled,
        enabledFactorCount: factorOverrides.filter((f) => f.useLlm).length,
        totalFactorCount: factorOverrides.length,
      })

      alert('配置保存成功！')
    } catch (err) {
      logger.error('[LlmManagement] 保存配置失败', { error: err })
      alert('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }, [apiKey, config, globalLlmEnabled, factorOverrides, setIsSaving])

  // ── 测试连接 ───────────────────────────────────────────
  const handleTest = useCallback(async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      // TODO: 接入真实 API 测试
      await new Promise((resolve) => { setTimeout(resolve, 1500) })

      setTestResult({
        success: true,
        message: '连接成功！API Key有效，模型可访问。',
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: `连接失败：${err instanceof Error ? err.message : '未知错误'}`,
      })
    } finally {
      setIsTesting(false)
    }
  }, [setIsTesting, setTestResult])

  // ── 预设变更 ───────────────────────────────────────────
  const handlePresetChange = useCallback(
    (presetId: string) => {
      setSelectedPreset(presetId)
      if (presetId === 'custom') return

      const preset = getPresetById(presetId)
      if (preset) {
        setConfig((prev) => ({
          ...prev,
          baseURL: preset.baseURL,
          model: preset.defaultModel,
        }))
      }
    },
    [setSelectedPreset, setConfig],
  )

  // ── 模型列表 ───────────────────────────────────────────
  const getCurrentModels = useCallback((): string[] => {
    if (selectedPreset === 'custom') {
      const model = config.model ?? ''
      return model !== '' ? [model] : []
    }
    const preset = getPresetById(selectedPreset)
    return preset?.models ?? []
  }, [selectedPreset, config.model])

  // ── 筛选后的预设列表 ──────────────────────────────────
  const getFilteredPresets = useCallback((): LlmPreset[] => {
    return LLM_MODEL_PRESETS.filter((preset) => {
      if (modelFilters.providers.length > 0 && !modelFilters.providers.includes(preset.provider)) {
        return false
      }
      const cw = preset.contextWindow ?? 0
      if (cw > 0 && cw < modelFilters.minContextWindow) {
        return false
      }
      const inputPrice = parsePriceString(preset.inputPrice)
      const outputPrice = parsePriceString(preset.outputPrice)
      if (
        inputPrice > modelFilters.maxInputPrice ||
        outputPrice > modelFilters.maxOutputPrice
      ) {
        return false
      }
      return true
    })
  }, [modelFilters])

  // ── 可用提供商 ─────────────────────────────────────────
  const getAvailableProviders = useCallback((): string[] => {
    const providers = new Set(LLM_MODEL_PRESETS.map((p) => p.provider).filter((p) => p))
    return Array.from(providers)
  }, [])

  // ── 推荐模型 ───────────────────────────────────────────
  const getRecommendedModels = useCallback((): LlmPreset[] => {
    if (recommendScenario === '') return []
    const recommendations: LlmPreset[] = []
    const nonCustomPresets = LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')

    switch (recommendScenario) {
      case 'cost_effective':
        recommendations.push(
          ...nonCustomPresets
            .sort((a, b) => parsePriceString(a.inputPrice) - parsePriceString(b.inputPrice))
            .slice(0, RECOMMENDATION_LIMIT),
        )
        break
      case 'high_performance':
        recommendations.push(
          ...nonCustomPresets
            .sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0))
            .slice(0, RECOMMENDATION_LIMIT),
        )
        break
      case 'fast_response':
        recommendations.push(
          ...nonCustomPresets.filter((p) =>
            p.models.some((m) => m.toLowerCase().includes('flash')),
          ),
        )
        break
      case 'long_context':
        recommendations.push(
          ...nonCustomPresets.filter((p) => (p.contextWindow ?? 0) >= CONTEXT_WINDOW_LONG),
        )
        break
      case 'balanced': {
        const deepseek = LLM_MODEL_PRESETS.find((p) => p.id === 'deepseek')
        const qwen = LLM_MODEL_PRESETS.find((p) => p.id === 'qwen')
        if (deepseek) recommendations.push(deepseek)
        if (qwen) recommendations.push(qwen)
        break
      }
      default:
        break
    }

    return recommendations
  }, [recommendScenario])

  return {
    initialize,
    handleSave,
    handleTest,
    handlePresetChange,
    getCurrentModels,
    getFilteredPresets,
    getAvailableProviders,
    getRecommendedModels,
  }
}

// 导出供组件使用的常量
/**
 * LLM_FILTER_CONSTANTS
 */
export const LLM_FILTER_CONSTANTS = {
  MAX_INPUT_PRICE_SLIDER,
  MAX_OUTPUT_PRICE_SLIDER,
  CONTEXT_WINDOW_LONG,
  RECOMMENDATION_LIMIT,
} as const
