/**
 * @doc [V9-DOC-AI-017, V9-DOC-AI-033, V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
 */
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
 * 全部 9 个因子默认启用 LLM（L0 估值 / L1 成长 / L2 盈利 / L3 质量 / L4 动量 / L5 波动 / L6 流动性 / L7 行业 / L8 情绪）。
 */
const DEFAULT_LLM_ENABLED_LAYER_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8])

/**
 * 默认 LLM 因子级覆盖配置。
 * - L0~L8 全部默认使用 LLM
 * factorId 从 scoreFactors.ts 中的因子名称推导，禁止硬编码因子名称。
 */
export const DEFAULT_LLM_FACTOR_OVERRIDES: LlmFactorOverride[] = STOCK_SCORE_FACTORS.factors.map(
  (factor, index) => ({
    factorId: factor.name,
    useLlm: DEFAULT_LLM_ENABLED_LAYER_INDICES.has(index),
  }),
)

/** API 风格类型 — 不同供应商的 API 协议差异 */
export type LlmApiStyle = 'openai-compatible' | 'anthropic' | 'gemini'

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
  /** API 协议风格，默认 openai-compatible */
  apiStyle?: LlmApiStyle
  /** 使用注意事项（如需要代理、特殊配置等） */
  notes?: string
}

/** 内置模型预设列表 */
export const LLM_MODEL_PRESETS: LlmPreset[] = [
  // —— 国内模型 ——
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
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
    models: ['kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k3'],
    contextWindow: 262_144,
    inputPrice: '$0.74',
    outputPrice: '$3.50',
  },
  {
    id: 'qwen',
    name: '通义千问 Qwen',
    provider: 'Alibaba',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    defaultModel: 'qwen3.6-flash',
    models: ['qwen3.6-flash', 'qwen3.6-plus', 'qwen3.6-max-preview'],
    contextWindow: 1_000_000,
    inputPrice: '$0.50',
    outputPrice: '$3.00',
  },
  {
    id: 'tencent-hunyuan',
    name: '腾讯混元',
    provider: 'Tencent',
    baseURL: 'https://tokenhub.tencentmaas.com/v1',
    defaultModel: 'hy3',
    models: ['hy3', 'hy-mt2-pro', 'hy-mt2-plus', 'hunyuan-role-latest'],
    contextWindow: 256_000,
    inputPrice: '$0.28',
    outputPrice: '$1.12',
  },
  {
    id: 'bytedance-doubao',
    name: 'TRAE 豆包',
    provider: 'ByteDance',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-ultra', 'doubao-lite-32k'],
    contextWindow: 128_000,
    inputPrice: '$0.56',
    outputPrice: '$1.40',
  },
  {
    id: 'baidu-ernie',
    name: '百度文心一言',
    provider: 'Baidu',
    baseURL: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ERNIE-4.5-Turbo',
    models: ['ERNIE-4.5-Turbo', 'ERNIE-Speed-8K', 'ERNIE-Speed-128K'],
    contextWindow: 128_000,
    inputPrice: '$0.11',
    outputPrice: '$0.28',
  },
  {
    id: 'zhipu-glm',
    name: '智谱 GLM',
    provider: 'Zhipu AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5-turbo',
    models: ['glm-5', 'glm-5-turbo', 'glm-4-flashx', 'glm-4-flash'],
    contextWindow: 128_000,
    inputPrice: '$0.70',
    outputPrice: '$2.10',
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
      'meta-llama/Llama-3.3-70B-Instruct',
    ],
    contextWindow: 128_000,
    inputPrice: '$0.42',
    outputPrice: '$0.42',
  },
  // —— 境外模型 ——
  {
    id: 'openai',
    name: 'OpenAI GPT',
    provider: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    contextWindow: 1_000_000,
    inputPrice: '$2.50',
    outputPrice: '$10.00',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'Anthropic',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3.5-sonnet',
    models: ['claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-opus-4.8'],
    contextWindow: 200_000,
    inputPrice: '$3.00',
    outputPrice: '$15.00',
    apiStyle: 'anthropic',
    notes: '使用 /v1/messages 端点和 x-api-key 认证。如需 OpenAI 兼容接口，请使用代理服务（如 OneAPI）。',
  },
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    provider: 'Google',
    baseURL: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-3-pro-preview', 'gemini-3.5-flash'],
    contextWindow: 1_000_000,
    inputPrice: '$2.00',
    outputPrice: '$12.00',
    apiStyle: 'gemini',
    notes: '使用 ?key= 查询参数认证和不同的请求体格式。如需 OpenAI 兼容接口，请使用代理服务（如 Google AI Studio）。',
  },
  {
    id: 'xai-grok',
    name: 'xAI Grok',
    provider: 'xAI',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    models: ['grok-4', 'grok-4.5', 'grok-3-mini'],
    contextWindow: 256_000,
    inputPrice: '$2.00',
    outputPrice: '$6.00',
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

// ============================================================
// LLM API Key 安全轮换（对齐 secretConfig.ts 的 Tushare/Qwen 机制）
// ============================================================

/** 默认密钥 TTL：30 天（毫秒） */
const LLM_SECRET_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 密钥元数据接口 */
export interface LlmSecretMeta {
  /** 密钥写入时间戳 (ms) */
  setAt: number
  /** 最后一次验证时间戳 (ms)，用于记录用户确认密钥仍然有效的时间 */
  lastVerifiedAt: number
}

function getMetaStorageKey(secretKey: string): string {
  return `${secretKey}_meta`
}

function readMeta(secretKey: string): LlmSecretMeta | null {
  try {
    const fullKey = `app:${getMetaStorageKey(secretKey)}`
    const raw = localStorage.getItem(fullKey)
    if (!raw) return null
    return JSON.parse(raw) as LlmSecretMeta
  } catch {
    return null
  }
}

function writeMeta(secretKey: string, meta: LlmSecretMeta): void {
  const fullKey = `app:${getMetaStorageKey(secretKey)}`
  localStorage.setItem(fullKey, JSON.stringify(meta))
}

function removeMeta(secretKey: string): void {
  try {
    const fullKey = `app:${getMetaStorageKey(secretKey)}`
    localStorage.removeItem(fullKey)
  } catch {
    // silent
  }
}

/**
 * 检查 LLM API Key 是否已超过 TTL（默认 30 天），建议轮换。
 * 未配置时返回 false（未配置不算过期，由 isLlmApiKeyConfigured 判断）。
 */
export function isLlmApiKeyExpired(ttlMs: number = LLM_SECRET_TTL_MS): boolean {
  if (!isLlmApiKeyConfigured()) return false
  const meta = readMeta(LLM_API_KEY_STORAGE)
  if (!meta) return false
  return Date.now() - meta.setAt > ttlMs
}

/**
 * 获取 LLM API Key 的存活天数（自写入起）。
 * 未配置或无元数据时返回 0。
 */
export function getLlmApiKeyAgeDays(): number {
  const meta = readMeta(LLM_API_KEY_STORAGE)
  if (!meta) return 0
  return Math.floor((Date.now() - meta.setAt) / (24 * 60 * 60 * 1000))
}

/**
 * 获取 LLM API Key 距离上次验证的天数。
 * 未验证过返回 -1。
 */
export function getLlmApiKeyDaysSinceVerification(): number {
  const meta = readMeta(LLM_API_KEY_STORAGE)
  if (!meta || meta.lastVerifiedAt === meta.setAt) return -1
  return Math.floor((Date.now() - meta.lastVerifiedAt) / (24 * 60 * 60 * 1000))
}

/**
 * 标记 LLM API Key 已验证（用户确认密钥仍然有效，或连接测试成功）。
 */
export function markLlmApiKeyVerified(): void {
  const meta = readMeta(LLM_API_KEY_STORAGE)
  if (!meta) return
  meta.lastVerifiedAt = Date.now()
  writeMeta(LLM_API_KEY_STORAGE, meta)
  logger.info('[llmConfig] LLM API Key 已标记为已验证')
}

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
    if (raw?.includes('"__encrypted":true')) {
      // 存在加密条目，标记为已配置（实际值由异步方法读取）
      cachedApiKey = '__encrypted_pending__'
    }
  } catch { console.warn('[llmConfig.ts] localStorage 不可用时忽略, using fallback') }
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
    defaultStorage.remove(LLM_API_KEY_STORAGE)
    removeMeta(LLM_API_KEY_STORAGE)
    cachedApiKey = ''
    apiKeyCacheInit = true
    logger.info('[llmConfig] 已清除 LLM API Key')
    return
  }
  const now = Date.now()
  await defaultStorage.setEncrypted(LLM_API_KEY_STORAGE, key.trim())
  writeMeta(LLM_API_KEY_STORAGE, { setAt: now, lastVerifiedAt: now })
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
    return !!raw?.includes('"__encrypted":true')
  } catch (err) { console.warn('[llmConfig.ts]', err);
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
    model: import.meta.env.VITE_LLM_MODEL ?? 'deepseek-chat',
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