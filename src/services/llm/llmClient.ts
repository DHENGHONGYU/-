import { getDefaultLlmConfig, getLlmApiKeyAsync, type LlmConfig } from '@/config/llmConfig'
import type { LlmMessage, LlmResponse, LlmUsage, LlmStreamCallback, LlmStreamChunk } from './llmTypes'
import { getLogger } from '@/lib/logger'
import { isValidLlmBaseURL } from '@/utils/dataValidation'

const logger = getLogger()

// P0-02: 流式请求空闲超时阈值（毫秒），收到每个 chunk 后重置
const STREAM_IDLE_TIMEOUT_MS = 30000

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmConfigError'
  }
}

export class LlmApiError extends Error {
  /** HTTP 状态码（可选，用于错误分类） */
  readonly statusCode?: number
  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'LlmApiError'
    this.statusCode = statusCode
  }
}

function buildConfig(override?: Partial<LlmConfig>): LlmConfig {
  const defaults = getDefaultLlmConfig()
  return {
    baseURL: override?.baseURL ?? defaults.baseURL,
    apiKey: override?.apiKey ?? defaults.apiKey,
    model: override?.model ?? defaults.model,
    maxTokens: override?.maxTokens ?? defaults.maxTokens,
    temperature: override?.temperature ?? defaults.temperature,
    timeout: override?.timeout ?? defaults.timeout,
  }
}

function assertConfig(config: LlmConfig): void {
  if (!config.baseURL.trim()) {
    throw new LlmConfigError('LLM baseURL 未配置，请在 .env 或页面配置中设置 VITE_LLM_BASE_URL')
  }
  // XSS-003: 校验 baseURL 协议白名单，禁止 javascript:/data:/vbscript: 等危险协议
  if (!isValidLlmBaseURL(config.baseURL)) {
    throw new LlmConfigError('LLM baseURL 协议非法，仅允许 http:// 或 https://')
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
  // P0-01: 异步从加密 localStorage 读取 API Key
  if (!config.apiKey) {
    config.apiKey = await getLlmApiKeyAsync()
  }
  assertConfig(config)

  const endpoint = `${normalizeBaseURL(config.baseURL)}/v1/chat/completions`

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.2,
  }
  if (config.maxTokens !== undefined) {
    body.max_tokens = config.maxTokens
  }

  const controller = new AbortController()
  const timeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (timeoutId) clearTimeout(timeoutId)

    // P0-03: 非 ok 响应时保护 response.json() 解析
    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`.trim()
      try {
        const raw = (await response.json()) as RawResponse
        if (raw.error?.message) {
          message = raw.error.message
        }
      } catch {
        // 响应体非 JSON（如 nginx 502 HTML 错误页），保留默认 HTTP 状态消息
        logger.warn('[llmClient] LLM 错误响应非 JSON 格式', {
          status: response.status,
          contentType: response.headers.get('content-type'),
        })
      }
      throw new LlmApiError(`LLM 请求失败: ${message}`, response.status)
    }

    const raw = (await response.json()) as RawResponse
    return parseResponse(raw)
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err instanceof LlmApiError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LlmApiError('LLM 请求超时')
    }
    throw new LlmApiError(`LLM 请求失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

interface RawStreamChoice {
  delta?: {
    content?: string
  }
  finish_reason?: string
}

interface RawStreamResponse {
  choices?: RawStreamChoice[]
  model?: string
  usage?: RawUsage
  error?: {
    message: string
  }
}

function parseStreamChunk(raw: RawStreamResponse): LlmStreamChunk | null {
  if (raw.error && typeof raw.error.message === 'string') {
    throw new LlmApiError(`LLM API 错误: ${raw.error.message}`)
  }

  const choices = raw.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return null
  }

  const delta = choices[0]?.delta
  const finishReason = choices[0]?.finish_reason

  if (finishReason === 'stop') {
    return {
      content: '',
      isDone: true,
      usage: parseUsage(raw.usage),
    }
  }

  const content = delta?.content ?? ''
  if (content.length === 0) {
    return null
  }

  return {
    content,
    isDone: false,
  }
}

export async function streamingChat(
  messages: LlmMessage[],
  callback: LlmStreamCallback,
  override?: Partial<LlmConfig>,
): Promise<void> {
  const config = buildConfig(override)
  // P0-01: 异步从加密 localStorage 读取 API Key
  if (!config.apiKey) {
    config.apiKey = await getLlmApiKeyAsync()
  }
  assertConfig(config)

  const endpoint = `${normalizeBaseURL(config.baseURL)}/v1/chat/completions`

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.2,
    stream: true,
  }
  if (config.maxTokens !== undefined) {
    body.max_tokens = config.maxTokens
  }

  // P0-02: 增加 AbortController + 总超时 + 空闲超时
  const controller = new AbortController()
  const totalTimeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const resetIdleTimer = (): void => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS)
  }
  resetIdleTimer()

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    // P0-03: 非 ok 响应时保护 response.json() 解析
    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`.trim()
      try {
        const errRaw = (await response.json()) as RawResponse
        if (errRaw.error?.message) {
          message = errRaw.error.message
        }
      } catch {
        // 响应体非 JSON（如 nginx 502 HTML 错误页），保留默认 HTTP 状态消息
        logger.warn('[llmClient] LLM 流式错误响应非 JSON 格式', {
          status: response.status,
          contentType: response.headers.get('content-type'),
        })
      }
      throw new LlmApiError(`LLM 请求失败: ${message}`, response.status)
    }

    reader = response.body?.getReader() ?? null
    if (!reader) {
      throw new LlmApiError('LLM 流式响应 body 为空')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let isFinished = false

    while (true) {
      const { done, value } = await reader.read()
      resetIdleTimer() // P0-02: 每次读取后重置空闲定时器

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.trim().length === 0) continue
        if (!line.startsWith('data: ')) continue

        const dataStr = line.slice(6)
        if (dataStr === '[DONE]') {
          if (!isFinished) {
            callback({ content: '', isDone: true })
          }
          return
        }

        try {
          const chunkRaw = JSON.parse(dataStr) as RawStreamResponse
          const chunk = parseStreamChunk(chunkRaw)
          if (chunk) {
            callback(chunk)
            if (chunk.isDone) {
              isFinished = true
            }
          }
        } catch (parseErr) {
          logger.warn('[llmClient] Failed to parse stream chunk', { error: parseErr })
        }
      }
    }
  } catch (err) {
    // P0-02: 识别 AbortError（总超时或空闲超时）
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LlmApiError('LLM 流式请求超时或被中止')
    }
    if (err instanceof LlmApiError) {
      throw err
    }
    throw new LlmApiError(`LLM 流式请求失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    // P0-02: 清理所有定时器并主动释放
    if (totalTimeoutId) clearTimeout(totalTimeoutId)
    if (idleTimer) clearTimeout(idleTimer)
    controller.abort()
    if (reader) {
      reader.releaseLock()
    }
  }
}
