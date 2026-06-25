import { getDefaultLlmConfig, type LlmConfig } from '@/config/llmConfig'
import type { LlmMessage, LlmResponse, LlmUsage } from './llmTypes'

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmConfigError'
  }
}

export class LlmApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmApiError'
  }
}

function buildConfig(override?: Partial<LlmConfig>): LlmConfig {
  const defaults = getDefaultLlmConfig()
  return {
    baseURL: override?.baseURL ?? defaults.baseURL,
    apiKey: override?.apiKey ?? defaults.apiKey,
    model: override?.model ?? defaults.model,
  }
}

function assertConfig(config: LlmConfig): void {
  if (!config.baseURL.trim()) {
    throw new LlmConfigError('LLM baseURL 未配置，请在 .env 或页面配置中设置 VITE_LLM_BASE_URL')
  }
  if (!config.apiKey.trim()) {
    throw new LlmConfigError('LLM apiKey 未配置，请在 .env 或页面配置中设置 VITE_LLM_API_KEY')
  }
  if (!config.model.trim()) {
    throw new LlmConfigError('LLM model 未配置，请在 .env 或页面配置中设置 VITE_LLM_MODEL')
  }
}

function normalizeBaseURL(baseURL: string): string {
  return baseURL.replace(/\/$/, '')
}

interface RawChoice {
  message?: {
    content?: string
  }
  finish_reason?: string
}

interface RawUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface RawResponse {
  choices?: RawChoice[]
  model?: string
  usage?: RawUsage
  error?: {
    message: string
  }
}

function parseUsage(raw: RawUsage | undefined): LlmUsage | undefined {
  if (!raw) return undefined
  const prompt = raw.prompt_tokens
  const completion = raw.completion_tokens
  const total = raw.total_tokens
  if (
    typeof prompt !== 'number' ||
    typeof completion !== 'number' ||
    typeof total !== 'number'
  ) {
    return undefined
  }
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
  }
}

function parseResponse(raw: RawResponse): LlmResponse {
  if (raw.error && typeof raw.error.message === 'string') {
    throw new LlmApiError(`LLM API 错误: ${raw.error.message}`)
  }

  const choices = raw.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new LlmApiError('LLM API 返回空 choices')
  }

  const content = choices[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0) {
    throw new LlmApiError('LLM API 返回空内容')
  }

  return {
    content,
    model: typeof raw.model === 'string' ? raw.model : 'unknown',
    usage: parseUsage(raw.usage),
  }
}

export async function chat(
  messages: LlmMessage[],
  override?: Partial<LlmConfig>,
): Promise<LlmResponse> {
  const config = buildConfig(override)
  assertConfig(config)

  const endpoint = `${normalizeBaseURL(config.baseURL)}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.2,
    }),
  })

  const raw = (await response.json()) as RawResponse

  if (!response.ok) {
    const message = raw.error?.message ?? `HTTP ${response.status}`
    throw new LlmApiError(`LLM 请求失败: ${message}`)
  }

  return parseResponse(raw)
}
