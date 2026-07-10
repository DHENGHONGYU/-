/**
 * LLM 配置组件（可复用）
 *
 * 支持模型预设快速选择 + 自定义配置。
 * 可折叠，支持受控模式。
 * 显示模型信息（上下文窗口、价格）。
 *
 * 使用示例：
 *   <LLMConfigWidget
 *     value={llmConfig}
 *     onChange={setLlmConfig}
 *     configReady={configReady}
 *     className="..."
 *   />
 */

import { useState, useMemo, memo } from 'react'
import { LLM_MODEL_PRESETS, getPresetById, inferPresetId, DEFAULT_LLM_BASE_URL, type PartialLlmConfig } from '@/config/llmConfig'
import { Input } from '@/components/ui/Input'
import {
  isValidLlmBaseURL,
  isValidLlmApiKey,
  isValidLlmModel,
} from '@/utils/dataValidation'

interface Props {
  /** 当前 LLM 配置 */
  value: PartialLlmConfig
  /** 配置变更回调 */
  onChange: (config: PartialLlmConfig) => void
  /** 配置是否可用（baseURL + apiKey 非空） */
  configReady: boolean
  /** 是否显示配置不可用提示 */
  showWarning?: boolean
  /** 额外 className */
  className?: string
}

/** 校验单个字段并返回错误提示（无错返回空串） */
function validateField(field: 'baseURL' | 'apiKey' | 'model', value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '' // 非空校验由 configReady 负责
  switch (field) {
    case 'baseURL':
      return isValidLlmBaseURL(trimmed) ? '' : 'URL 格式非法，仅允许 http:// 或 https://'
    case 'apiKey':
      return isValidLlmApiKey(trimmed) ? '' : 'API Key 仅允许字母、数字、._-/，长度 8-256'
    case 'model':
      return isValidLlmModel(trimmed) ? '' : '模型名仅允许字母、数字、._-/:，长度 1-128'
    default:
      return ''
  }
}

/**
 * LLMConfigWidget
 */
export const LLMConfigWidget = memo(function LLMConfigWidget({
  value,
  onChange,
  configReady,
  showWarning = true,
  className,
}: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  // 根据 baseURL 推断当前预设
  const currentPresetId = inferPresetId(value.baseURL ?? '')

  // 获取当前预设及其模型信息
  const currentPreset = useMemo(() => getPresetById(currentPresetId), [currentPresetId])
  const modelOptions = currentPreset?.models ?? []

  // 输入校验错误信息（仅展示用户已输入字段的错误）
  const baseURLError = value.baseURL ? validateField('baseURL', value.baseURL) : ''
  const apiKeyError = value.apiKey ? validateField('apiKey', value.apiKey) : ''
  const modelError = value.model ? validateField('model', value.model) : ''

  // 格式化上下文窗口
  const contextStr = useMemo(() => {
    if (!currentPreset?.contextWindow) return null
    const w = currentPreset.contextWindow
    if (w >= 1_000_000) return `${(w / 1_000_000).toFixed(0)}M`
    if (w >= 1_000) return `${(w / 1_000).toFixed(0)}K`
    return String(w)
  }, [currentPreset])

  // 价格信息
  const priceInfo = useMemo(() => {
    if (!currentPreset?.inputPrice) return null
    return `${currentPreset.inputPrice}/${currentPreset.outputPrice}`
  }, [currentPreset])

  function handlePresetChange(presetId: string) {
    const preset = getPresetById(presetId)
    if (preset) {
      onChange({
        baseURL: preset.baseURL,
        model: preset.defaultModel,
        apiKey: '', // 需要用户填写
      })
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">大模型配置</label>
          {/* 状态指示 */}
          {configReady && value.model && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {value.model}
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 rounded-md border p-3">
          {/* 预设选择 */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">模型预设</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={currentPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {LLM_MODEL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.provider ? ` (${p.provider})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Base URL</label>
            <Input
              placeholder={DEFAULT_LLM_BASE_URL}
              value={value.baseURL ?? ''}
              onChange={(e) => onChange({ ...value, baseURL: e.target.value })}
              aria-invalid={!!baseURLError}
            />
            {baseURLError && (
              <p className="text-xs text-destructive">{baseURLError}</p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={value.apiKey ?? ''}
              onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
              aria-invalid={!!apiKeyError}
            />
            {apiKeyError && (
              <p className="text-xs text-destructive">{apiKeyError}</p>
            )}
          </div>

          {/* Model 选择 */}
          {modelOptions.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">模型</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={modelOptions.includes(value.model ?? '') ? value.model : ''}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
              >
                <option value="" disabled>
                  -- 请选择模型 --
                </option>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {/* 自定义模型输入（当选择了"请选择模型"或不在列表中时显示） */}
              {!modelOptions.includes(value.model ?? '') && (
                <Input
                  placeholder="或输入自定义模型 ID"
                  value={value.model ?? ''}
                  onChange={(e) => onChange({ ...value, model: e.target.value })}
                  aria-invalid={!!modelError}
                />
              )}
              {modelError && (
                <p className="text-xs text-destructive">{modelError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">模型</label>
              <Input
                placeholder="如 deepseek-v4-flash"
                value={value.model ?? ''}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
                aria-invalid={!!modelError}
              />
              {modelError && (
                <p className="text-xs text-destructive">{modelError}</p>
              )}
            </div>
          )}

          {/* 模型信息摘要 */}
          {currentPreset && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {contextStr && <span>上下文: {contextStr} tokens</span>}
              {priceInfo && <span>价格: ${priceInfo} /M tokens</span>}
              <span>供应商: {currentPreset.provider}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            支持 OpenAI 兼容接口（/v1/chat/completions）。推荐 DeepSeek V4 / Kimi K2.7 / 通义千问 Qwen3.6 / 硅基流动。
          </p>
        </div>
      )}

      {showWarning && !configReady && (
        <p className="text-xs text-destructive">LLM 未配置，请填写 Base URL 与 API Key</p>
      )}
    </div>
  )
})
