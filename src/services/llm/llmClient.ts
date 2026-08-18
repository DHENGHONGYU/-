/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-027, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033]
 */
import { getDefaultLlmConfig, getLlmApiKeyAsync, inferPresetId, getPresetById, type LlmConfig, type LlmApiStyle } from '@/config/llmConfig'
import type { LlmMessage, LlmResponse, LlmUsage, LlmStreamCallback, LlmStreamChunk, LlmStructuredOptions } from './llmTypes'
import { getLogger } from '@/lib/logger'
import { isValidLlmBaseURL } from '@/lib/validation'

const logger = getLogger()

// P0-02: 流式请求空闲超时阈值（毫秒），收到每个 chunk 后重置
const STREAM_IDLE_TIMEOUT_MS = 30000

/** 安全地截断 API Key 用于日志输出，仅显示前8后4位 */
function maskApiKey(key: string): string {
  if (!key || key.length <= 12) return '***'
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

/** 根据预设 ID 推断 API 风格，默认 openai-compatible */
function resolveApiStyle(presetId: string): LlmApiStyle {
  const preset = getPresetById(presetId)
  return preset?.apiStyle ?? 'openai-compatible'
}

/** 构建请求端点和头信息，支持多种 API 协议风格 */
interface RequestComponents {
  endpoint: string
  headers: Record<string, string>
  extraBody: Record<string, unknown>
}

function buildRequestComponents(
  baseURL: string,
  apiKey: string,
  presetId: string,
): RequestComponents {
  const apiStyle = resolveApiStyle(presetId)
  const normalizedURL = normalizeBaseURL(baseURL)

  switch (apiStyle) {
    case 'anthropic':
      return {
        endpoint: `${normalizedURL}/v1/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        extraBody: {},
      }
    case 'gemini':
      return {
        endpoint: `${normalizedURL}/v1beta/models`,
        headers: {
          'Content-Type': 'application/json',
        },
        extraBody: {},
      }
    case 'openai-compatible':
    default:
      return {
        endpoint: `${normalizedURL}/v1/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        extraBody: {},
      }
  }
}

/**
 * LlmConfigError
 */
export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmConfigError'
  }
}

/**
 * LlmApiError
 */
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

/**
 * 去除 LLM（尤其弱模型如混元）常包裹的 markdown 代码围栏，便于安全解析 JSON。
 * 弱模型常返回 ```json ... ``` 或 ``` ... ``` 包裹的内容，需先剥离再解析。
 */
function stripJsonFences(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1]!.trim()
  return content.trim()
}

/**
 * 安全解析 JSON，失败时返回 undefined（不抛异常）。
 * 用于混元等弱模型返回非标准 / 截断 JSON 时的确定性兜底。
 */
export function safeParseJson<T = unknown>(content: string): T | undefined {
  try {
    return JSON.parse(stripJsonFences(content)) as T
  } catch {
    return undefined
  }
}

function parseStructuredContent<T>(content: string, structured?: LlmStructuredOptions<T>): T | undefined {
  if (!structured) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFences(content))
  } catch (err) {
    logger.warn('[llmClient] 结构化输出 JSON 解析失败', { error: err, contentPreview: content.slice(0, 200) })
    throw new LlmApiError(`结构化输出 JSON 解析失败: ${content.slice(0, 100)}`)
  }

  if (structured.zodSchema) {
    const result = structured.zodSchema.safeParse(parsed)
    if (!result.success) {
      logger.warn('[llmClient] 结构化输出 Schema 校验失败', { issues: result.error.issues })
      throw new LlmApiError(`结构化输出 Schema 校验失败: ${result.error.issues.map((i) => i.message).join('; ')}`)
    }
    return result.data
  }

  return parsed as T
}

function parseResponse<T>(raw: RawResponse, structured?: LlmStructuredOptions<T>): LlmResponse<T> {
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

  const parsed = structured ? parseStructuredContent(content, structured) : undefined

  return {
    content,
    model: typeof raw.model === 'string' ? raw.model : 'unknown',
    usage: parseUsage(raw.usage),
    parsed,
  }
}

/**
 * chat
 *
 * @param messages LLM 消息列表
 * @param override LLM 配置覆盖
 * @param structured 结构化输出选项（可选）
 */
export async function chat<T = unknown>(
  messages: LlmMessage[],
  override?: Partial<LlmConfig>,
  structured?: LlmStructuredOptions<T>,
): Promise<LlmResponse<T>> {
  const config = buildConfig(override)
  // P0-01: 异步从加密 localStorage 读取 API Key
  if (!config.apiKey) {
    config.apiKey = await getLlmApiKeyAsync()
  }
  assertConfig(config)

  const presetId = inferPresetId(config.baseURL)
  const { endpoint, headers } = buildRequestComponents(config.baseURL, config.apiKey, presetId)

  // 🔍 Log Node 1: Config resolution
  logger.debug('[llmClient] chat() 配置解析完成', {
    preset: presetId,
    apiStyle: resolveApiStyle(presetId),
    baseURL: config.baseURL,
    model: config.model,
    endpoint,
    messageCount: messages.length,
    hasApiKey: !!config.apiKey,
    apiKeyPreview: maskApiKey(config.apiKey),
    temperature: config.temperature ?? 0.2,
    maxTokens: config.maxTokens ?? 'unset',
    timeout: config.timeout ?? 'unset',
  })

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.2,
  }
  if (config.maxTokens !== undefined) {
    body.max_tokens = config.maxTokens
  }
  if (structured?.responseFormat) {
    body.response_format = structured.responseFormat
  }

  const controller = new AbortController()
  const timeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null
  let requestStartTs = 0

  try {
    // 🔍 Log Node 2: Pre-fetch
    requestStartTs = performance.now()
    logger.debug('[llmClient] chat() 发送请求', {
      preset: presetId,
      apiStyle: resolveApiStyle(presetId),
      method: 'POST',
      endpoint,
      bodyKeys: Object.keys(body),
      signalAborted: controller.signal.aborted,
      requestBody: JSON.stringify(body).slice(0, 500),
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const ttfbMs = Math.round(performance.now() - requestStartTs)

    // 🔍 Log Node 3: Post-fetch
    logger.debug('[llmClient] chat() 收到响应', {
      preset: presetId,
      statusCode: response.status,
      ok: response.ok,
      ttfbMs,
      contentType: response.headers?.get?.('content-type') ?? 'unknown',
    })

    // P0-03: 非 ok 响应时保护 response.json() 解析
    if (!response.ok) {
      const message = await parseErrorMessageFromResponse(response)
      // 🔍 Log Node 4a: HTTP error
      logger.error('[llmClient] chat() HTTP 错误响应', {
        preset: presetId,
        statusCode: response.status,
        ttfbMs,
        errorMessage: message,
      })
      throw new LlmApiError(`LLM 请求失败: ${message}`, response.status)
    }

    const raw = (await response.json()) as RawResponse
    const result = parseResponse(raw, structured)

    const totalMs = Math.round(performance.now() - requestStartTs)
    logger.debug('[llmClient] chat() 解析成功', {
      preset: presetId,
      responseModel: result.model,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      } : null,
      contentLength: result.content.length,
      ttfbMs,
      totalMs,
      responseContent: result.content.slice(0, 300),
    })

    return result
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - requestStartTs)
    // 🔍 Log Node 4b: Error path
    logger.error('[llmClient] chat() 请求异常', {
      preset: presetId,
      model: config.model,
      endpoint,
      elapsedMs,
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
      isAbort: err instanceof DOMException && err.name === 'AbortError',
      statusCode: err instanceof LlmApiError ? err.statusCode : undefined,
    })

    if (err instanceof LlmApiError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LlmApiError('LLM 请求超时')
    }
    throw new LlmApiError(`LLM 请求失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
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

function parseErrorMessageFromResponse(response: Response): Promise<string> {
  return response
    .json()
    .then((raw) => {
      const errRaw = raw as RawResponse
      return errRaw.error?.message ?? `HTTP ${response.status} ${response.statusText}`.trim()
    })
    .catch(() => {
      logger.warn('[llmClient] LLM 错误响应非 JSON 格式', {
        status: response.status,
        contentType: response.headers?.get?.('content-type'),
      })
      return `HTTP ${response.status} ${response.statusText}`.trim()
    })
}

/**
 * 处理单条 SSE 流数据行（被 processStreamLines 循环调用）。
 * 返回 false 表示遇到 [DONE]，调用方应终止循环；其余情况返回 true 继续。
 */
function processOneStreamLine(
  line: string,
  callback: LlmStreamCallback,
  state: { isFinished: boolean },
): boolean {
  if (line.trim().length === 0) return true
  if (!line.startsWith('data: ')) return true

  const dataStr = line.slice(6)
  if (dataStr === '[DONE]') {
    if (!state.isFinished) {
      callback({ content: '', isDone: true })
    }
    return false
  }

  try {
    const chunkRaw = JSON.parse(dataStr) as RawStreamResponse
    const chunk = parseStreamChunk(chunkRaw)
    if (!chunk) return true
    callback(chunk)
    if (chunk.isDone) {
      state.isFinished = true
    }
  } catch (parseErr) {
    logger.warn('[llmClient] Failed to parse stream chunk', { error: parseErr })
  }
  return true
}

function processStreamLines(
  lines: string[],
  callback: LlmStreamCallback,
  state: { isFinished: boolean },
): void {
  for (const line of lines) {
    if (!processOneStreamLine(line, callback, state)) return
  }
}

/**
 * 持续读取流式响应体并逐行解析（被 streamingChat 调用），封装读循环以降低嵌套深度。
 */
async function pumpStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  callback: LlmStreamCallback,
  state: { isFinished: boolean },
  resetIdleTimer: () => void,
): Promise<void> {
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    resetIdleTimer()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    processStreamLines(lines, callback, state)
  }
}

/**
 * streamingChat
 */
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

  const presetId = inferPresetId(config.baseURL)
  const { endpoint, headers } = buildRequestComponents(config.baseURL, config.apiKey, presetId)

  // 🔍 Log Node 1: Config resolution
  logger.debug('[llmClient] streamingChat() 配置解析完成', {
    preset: presetId,
    apiStyle: resolveApiStyle(presetId),
    baseURL: config.baseURL,
    model: config.model,
    endpoint,
    messageCount: messages.length,
    hasApiKey: !!config.apiKey,
    apiKeyPreview: maskApiKey(config.apiKey),
    temperature: config.temperature ?? 0.2,
    maxTokens: config.maxTokens ?? 'unset',
    timeout: config.timeout ?? 'unset',
  })

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
  const clearIdleTimer = (): void => {
    if (idleTimer) clearTimeout(idleTimer)
  }
  const resetIdleTimer = (): void => {
    clearIdleTimer()
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS)
  }
  resetIdleTimer()

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let requestStartTs = 0

  try {
    // 🔍 Log Node 2: Pre-fetch
    requestStartTs = performance.now()
    logger.debug('[llmClient] streamingChat() 发送请求', {
      preset: presetId,
      apiStyle: resolveApiStyle(presetId),
      method: 'POST',
      endpoint,
      stream: true,
      bodyKeys: Object.keys(body),
      requestBody: JSON.stringify(body).slice(0, 500),
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const ttfbMs = Math.round(performance.now() - requestStartTs)

    // 🔍 Log Node 3: Post-fetch
    logger.debug('[llmClient] streamingChat() 收到响应头', {
      preset: presetId,
      statusCode: response.status,
      ok: response.ok,
      ttfbMs,
      contentType: response.headers?.get?.('content-type') ?? 'unknown',
    })

    // P0-03: 非 ok 响应时保护 response.json() 解析
    if (!response.ok) {
      const message = await parseErrorMessageFromResponse(response)
      // 🔍 Log Node 4a: HTTP error
      logger.error('[llmClient] streamingChat() HTTP 错误响应', {
        preset: presetId,
        statusCode: response.status,
        ttfbMs,
        errorMessage: message,
      })
      throw new LlmApiError(`LLM 请求失败: ${message}`, response.status)
    }

    reader = response.body?.getReader() ?? null
    if (!reader) {
      throw new LlmApiError('LLM 流式响应 body 为空')
    }

    const decoder = new TextDecoder()
    const state = { isFinished: false }
    const streamStartTs = performance.now()

    logger.debug('[llmClient] streamingChat() 开始接收流数据', {
      preset: presetId,
      ttfbMs,
    })

    await pumpStream(reader, decoder, callback, state, resetIdleTimer)

    const streamDrainMs = Math.round(performance.now() - streamStartTs)
    const totalMs = Math.round(performance.now() - requestStartTs)
    logger.debug('[llmClient] streamingChat() 流传输完成', {
      preset: presetId,
      ttfbMs,
      streamDrainMs,
      totalMs,
      isFinished: state.isFinished,
    })
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - requestStartTs)
    // 🔍 Log Node 4b: Error path
    logger.error('[llmClient] streamingChat() 请求异常', {
      preset: presetId,
      model: config.model,
      endpoint,
      elapsedMs,
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
      isAbort: err instanceof DOMException && err.name === 'AbortError',
      statusCode: err instanceof LlmApiError ? err.statusCode : undefined,
    })

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
    clearIdleTimer()
    controller.abort()
    if (reader) {
      reader.releaseLock()
    }
  }
}
