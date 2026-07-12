import { getSafeString } from '@/lib/safeCoerce'
import { STOCK_SCORE_FACTORS } from './scoreFactors'
import { defaultStorage } from '@/lib/localStorageManager'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface LlmConfig {
  baseURL: string
  apiKey: string
  model: string
  /** 最大输出 token 数 */
  maxTokens?: number
  /** 采样温度 */
  temperature?: number
  /** 请求超时时间（毫秒） */
  timeout?: number
}

export type PartialLlmConfig = Partial<LlmConfig>

/** 单个因子的 LLM 调用覆盖设置 */
export interface LlmFactorOverride {
  /** 因子唯一标识，与 scoreFactors.ts 中的因子名称对齐 */
  factorId: string
  /** 是否允许该因子调用 LLM */
  useLlm: boolean
}

/**
 * 支持 AI 调用透明度的 LLM 配置。
 * 在 {@link LlmConfig} 基础上增加总开关、透明度面板开关以及因子级覆盖。
 */
export interface LlmTransparencyConfig extends LlmConfig {
  /** 各因子是否调用 LLM 的覆盖配置 */
  factorOverrides?: LlmFactorOverride[]
  /** LLM 总开关 */
  enableLlm: boolean
  /** 是否在前端展示 AI 调用透明度面板 */
  showTransparencyPanel: boolean
}

/**
 * 默认启用 LLM 的因子层级索引。
 * 按 scoreFactors.ts 中 STOCK_SCORE_FACTORS.factors 的顺序依次对应 L0 ~ L8。
 */
const DEFAULT_LLM_ENABLED_LAYER_INDICES = new Set([0, 1, 2, 5, 6])

/**
 * 默认 LLM 因子级覆盖配置。
 * - L0/L1/L2/L5/L6 默认使用 LLM
 * - L3/L4/L7/L8 默认不调用 LLM（由规则引擎自动计算）
 * factorId 从 scoreFactors.ts 中的因子名称推导，禁止硬编码因子名称。
 */
export const DEFAULT_LLM_FACTOR_OVERRIDES: LlmFactorOverride[] = STOCK_SCORE_FACTORS.factors.map(
  (factor, index) => ({
    factorId: factor.name,
    useLlm: DEFAULT_LLM_ENABLED_LAYER_INDICES.has(index),
  }),
)

/** LLM 模型预设 */
export interface LlmPreset {
  id: string
  name: string
  provider: string
  baseURL: string
  defaultModel: string
  models: string[]
  contextWindow?: number
  inputPrice?: string
  outputPrice?: string
}

/** 内置模型预设列表 */
export const LLM_MODEL_PRESETS: LlmPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    contextWindow: 1_000_000,
    inputPrice: '$0.14',
    outputPrice: '$0.28',
  },
  {
    id: 'kimi',
    name: 'Kimi K2',
    provider: 'Moonshot',
    baseURL: 'https://api.moonshot.cn',
    defaultModel: 'kimi-k2.7-code',
    models: ['kimi-k2.7-code', 'kimi-k2.7-code-highspeed'],
    contextWindow: 128_000,
    inputPrice: '$0.60',
    outputPrice: '$1.80',
  },
  {
    id: 'qwen',
    name: '通义千问 Qwen',
    provider: 'Alibaba',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    defaultModel: 'qwen3.6-flash',
    models: ['qwen3.6-flash', 'qwen3.6-plus', 'qwen3.6-max-preview'],
    contextWindow: 128_000,
    inputPrice: '$0.40',
    outputPrice: '$1.20',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    provider: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: [
      'Qwen/Qwen2.5-7B-Instruct',
      'deepseek-ai/DeepSeek-V4-Flash',
      'THUDM/GLM-4-9B-Chat',
    ],
    contextWindow: 32_000,
    inputPrice: '$0.42',
    outputPrice: '$0.42',
  },
  {
    id: 'custom',
    name: '自定义',
    provider: '',
    baseURL: '',
    defaultModel: '',
    models: [],
  },
]

/** 默认 LLM Base URL（DeepSeek API 地址），用于 UI placeholder 和默认配置 */
export const DEFAULT_LLM_BASE_URL = 'https://api.deepseek.com'

/** 根据 preset id 获取预设 */
export function getPresetById(id: string): LlmPreset | undefined {
  return LLM_MODEL_PRESETS.find((p) => p.id === id)
}

/** 根据 baseURL 推断 preset id */
export function inferPresetId(baseURL: string): string {
  if (!baseURL) return 'custom'
  for (const preset of LLM_MODEL_PRESETS) {
    if (preset.id === 'custom') continue
    if (preset.baseURL && baseURL.startsWith(preset.baseURL)) return preset.id
  }
  return 'custom'
}

/** localStorage 中加密存储 LLM API Key 的 key 名 */
const LLM_API_KEY_STORAGE = 'llm_api_key'

/**
 * 读取加密存储的 LLM API Key。
 * 使用 localStorageManager.getEncrypted 解密，失败返回空字符串。
 * 同步接口（内部使用缓存值），用于 getDefaultLlmConfig。
 */
let cachedApiKey: string = ''
let apiKeyCacheInit = false

function getCachedApiKey(): string {
  if (apiKeyCacheInit) {
    return cachedApiKey
  }
  apiKeyCacheInit = true
  // 同步读取：localStorageManager.getEncrypted 是异步的，这里读取原始 localStorage 条目判断是否存在
  // 真正的解密在 getLlmApiKeyAsync 中进行
  try {
    const fullKey = `app:${LLM_API_KEY_STORAGE}`
    const raw = localStorage.getItem(fullKey)
    if (raw && raw.includes('"__encrypted":true')) {
      // 存在加密条目，标记为已配置（实际值由异步方法读取）
      cachedApiKey = '__encrypted_pending__'
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return cachedApiKey
}

/**
 * 异步读取加密存储的 LLM API Key。
 * 在需要实际使用 Key 时调用（如 llmClient.chat 前）。
 */
export async function getLlmApiKeyAsync(): Promise<string> {
  try {
    const key = await defaultStorage.getEncrypted<string>(LLM_API_KEY_STORAGE)
    cachedApiKey = getSafeString(key)
    apiKeyCacheInit = true
    return cachedApiKey
  } catch (err) {
    logger.warn('[llmConfig] 读取加密 API Key 失败', { error: err })
    return ''
  }
}

/**
 * 异步保存 LLM API Key 到加密存储。
 * 用户在 UI 配置页输入 Key 后调用此方法。
 */
export async function setLlmApiKey(key: string): Promise<void> {
  if (!key.trim()) {
    await defaultStorage.remove(LLM_API_KEY_STORAGE)
    cachedApiKey = ''
    apiKeyCacheInit = true
    logger.info('[llmConfig] 已清除 LLM API Key')
    return
  }
  await defaultStorage.setEncrypted(LLM_API_KEY_STORAGE, key.trim())
  cachedApiKey = key.trim()
  apiKeyCacheInit = true
  logger.info('[llmConfig] LLM API Key 已加密保存')
}

/**
 * 检查 LLM API Key 是否已配置（同步，用于 UI 状态判断）。
 * 仅检查加密条目是否存在，不实际解密。
 */
export function isLlmApiKeyConfigured(): boolean {
  try {
    const fullKey = `app:${LLM_API_KEY_STORAGE}`
    const raw = localStorage.getItem(fullKey)
    return !!(raw && raw.includes('"__encrypted":true'))
  } catch {
    return false
  }
}

export function isLlmConfigured(config: PartialLlmConfig): config is LlmConfig {
  return !!(
    config.baseURL?.trim() &&
    config.apiKey?.trim() &&
    config.model?.trim()
  )
}

export function getDefaultLlmConfig(): LlmConfig {
  const cachedKey = getCachedApiKey()
  return {
    baseURL: import.meta.env.VITE_LLM_BASE_URL ?? DEFAULT_LLM_BASE_URL,
    // P0-01 安全修复：API Key 从加密 localStorage 读取，不再从 VITE_ 环境变量读取
    apiKey: cachedKey === '__encrypted_pending__' ? '' : cachedKey,
    model: import.meta.env.VITE_LLM_MODEL ?? 'deepseek-v4-flash',
  }
}

/**
 * 获取默认的 LLM 透明度配置。
 * 继承 {@link getDefaultLlmConfig} 的模型连接字段，并默认关闭 LLM 总开关与透明度面板，
 * 同时注入 {@link DEFAULT_LLM_FACTOR_OVERRIDES} 作为初始因子级覆盖。
 */
export function getDefaultLlmTransparencyConfig(): LlmTransparencyConfig {
  return {
    ...getDefaultLlmConfig(),
    enableLlm: false,
    showTransparencyPanel: false,
    factorOverrides: DEFAULT_LLM_FACTOR_OVERRIDES,
  }
}
