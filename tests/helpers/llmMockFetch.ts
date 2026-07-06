/**
 * @module llmMockFetch
 * @description 全局 LLM mock fetch 工具函数
 *
 * 用途：
 * - 在测试环境中模拟 LLM API 的 fetch 调用，避免真实网络请求
 * - 提供多种 mock 响应模式：成功响应/流式响应/HTTP 错误/网络错误
 * - 记录 fetch 调用历史，支持断言验证
 *
 * 关联文档：docs/implementation/walkthrough-agent-llm-report-20260704.md 第五节问题 3
 * 关联契约：AGENTS.md §6「LLM 调用必须含用户可配置的开关」
 *
 * 使用示例：
 * ```typescript
 * import { mockLlmChatSuccess, restoreFetch, getFetchCallCount } from '../helpers/llmMockFetch'
 *
 * beforeEach(() => {
 *   mockLlmChatSuccess('{"score":4.2}', { model: 'deepseek-v4-flash' })
 * })
 *
 * afterEach(() => {
 *   restoreFetch()
 * })
 *
 * it('应调用 LLM API', async () => {
 *   await callLlmFunction()
 *   expect(getFetchCallCount()).toBe(1)
 * })
 * ```
 */

import { vi } from 'vitest'

// ============================================================
// 类型定义
// ============================================================

/** LLM chat 响应选项 */
export interface LlmChatMockOptions {
  /** 模型名称（默认 deepseek-v4-flash） */
  model?: string
  /** token 使用统计 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  /** 响应延迟（毫秒，用于测试超时） */
  delay?: number
}

/** LLM 流式响应选项 */
export interface LlmStreamMockOptions {
  /** 模型名称 */
  model?: string
  /** 每个 chunk 之间的延迟（毫秒） */
  delay?: number
}

/** fetch 调用记录 */
export interface FetchCallRecord {
  /** 请求 URL */
  url: string
  /** HTTP 方法 */
  method: string
  /** 请求头 */
  headers: Record<string, string>
  /** 请求体（已解析的 JSON 对象或原始值） */
  body: unknown
  /** 调用时间戳 */
  timestamp: number
}

// ============================================================
// 内部状态
// ============================================================

let originalFetch: typeof global.fetch | null = null
let mockFetchFn: ReturnType<typeof vi.fn> | null = null
let callRecords: FetchCallRecord[] = []

// ============================================================
// Mock 安装与记录
// ============================================================

/**
 * 安装 mock fetch（如未安装）
 * 保存原始 fetch，替换 global.fetch 为 mock 函数
 */
function ensureMockInstalled(): void {
  if (originalFetch === null) {
    originalFetch = global.fetch
    mockFetchFn = vi.fn()
    global.fetch = mockFetchFn as unknown as typeof global.fetch
    callRecords = []
  }
}

/**
 * 记录 fetch 调用
 */
function recordCall(url: string, init?: RequestInit): void {
  let body: unknown = undefined
  if (init?.body) {
    try {
      body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    } catch {
      body = init.body
    }
  }

  const headers: Record<string, string> = {}
  if (init?.headers) {
    const h = init.headers
    if (h instanceof Headers) {
      h.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(h)) {
      for (const [key, value] of h) {
        headers[key] = value
      }
    } else {
      Object.assign(headers, h)
    }
  }

  callRecords.push({
    url,
    method: init?.method ?? 'GET',
    headers,
    body,
    timestamp: Date.now(),
  })
}

/**
 * 构造 mock Response 对象
 */
function createMockResponse(
  ok: boolean,
  status: number,
  statusText: string,
  body: unknown,
  contentType: string = 'application/json',
): Response {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok,
    status,
    statusText,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyStr,
  } as Response
}

// ============================================================
// Mock 响应模式
// ============================================================

/**
 * Mock LLM chat 成功响应
 *
 * @param content LLM 返回的文本内容（通常是 JSON 字符串）
 * @param options 响应选项（模型名/token 统计/延迟）
 *
 * @example
 * ```typescript
 * mockLlmChatSuccess(JSON.stringify({ score: 4.2, summary: '增强摘要' }))
 * ```
 */
export function mockLlmChatSuccess(
  content: string,
  options: LlmChatMockOptions = {},
): void {
  ensureMockInstalled()

  const response = {
    id: `chatcmpl-mock-${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model: options.model ?? 'deepseek-v4-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: options.usage?.promptTokens ?? 100,
      completion_tokens: options.usage?.completionTokens ?? 50,
      total_tokens: options.usage?.totalTokens ?? 150,
    },
  }

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)
    if (options.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay))
    }
    return createMockResponse(true, 200, 'OK', response)
  })
}

/**
 * Mock LLM streaming 成功响应（SSE 格式）
 *
 * @param chunks 文本块数组（按顺序输出）
 * @param options 响应选项
 *
 * @example
 * ```typescript
 * mockLlmStreamSuccess(['Hello', ' ', 'World'])
 * ```
 */
export function mockLlmStreamSuccess(
  chunks: string[],
  options: LlmStreamMockOptions = {},
): void {
  ensureMockInstalled()

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)

    const encoder = new TextEncoder()
    const model = options.model ?? 'deepseek-v4-flash'

    const sseChunks: Uint8Array[] = chunks.map((content, index) => {
      const isLast = index === chunks.length - 1
      const data = {
        model,
        choices: [
          {
            delta: isLast ? {} : { content },
            finish_reason: isLast ? 'stop' : null,
          },
        ],
      }
      return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
    })
    sseChunks.push(encoder.encode('data: [DONE]\n\n'))

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of sseChunks) {
          if (options.delay) {
            await new Promise((resolve) => setTimeout(resolve, options.delay))
          }
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    } as Response
  })
}

/**
 * Mock LLM HTTP 错误响应
 *
 * @param status HTTP 状态码（如 400/401/403/429/500/502）
 * @param message 错误消息
 *
 * @example
 * ```typescript
 * mockLlmHttpError(429, 'Rate limit exceeded')
 * ```
 */
export function mockLlmHttpError(status: number, message: string): void {
  ensureMockInstalled()

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)
    return createMockResponse(false, status, message, {
      error: { message },
    })
  })
}

/**
 * Mock LLM 网络错误（fetch 抛出异常）
 *
 * @param message 错误消息（默认 'Network error'）
 *
 * @example
 * ```typescript
 * mockLlmNetworkError('ECONNREFUSED')
 * ```
 */
export function mockLlmNetworkError(message: string = 'Network error'): void {
  ensureMockInstalled()

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)
    throw new Error(message)
  })
}

/**
 * Mock LLM 超时（fetch 返回永不 resolve 的 Promise）
 *
 * @example
 * ```typescript
 * mockLlmTimeout()
 * ```
 */
export function mockLlmTimeout(): void {
  ensureMockInstalled()

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)
    return new Promise<Response>(() => {
      // 永不 resolve，模拟超时
    })
  })
}

/**
 * Mock 自定义响应（用于复杂场景）
 *
 * @param handler 自定义处理函数，接收 (url, init)，返回 Response 或 Promise<Response>
 *
 * @example
 * ```typescript
 * mockLlmCustomResponse((url, init) => {
 *   const body = JSON.parse(init?.body as string)
 *   if (body.messages[0].content.includes('error')) {
 *     return createMockResponse(false, 400, 'Bad Request', { error: { message: 'Invalid request' } })
 *   }
 *   return createMockResponse(true, 200, 'OK', { choices: [{ message: { content: 'OK' } }] })
 * })
 * ```
 */
export function mockLlmCustomResponse(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): void {
  ensureMockInstalled()

  mockFetchFn!.mockImplementation(async (url: string, init?: RequestInit) => {
    recordCall(url, init)
    return handler(url, init)
  })
}

// ============================================================
// 调用记录查询
// ============================================================

/**
 * 获取 fetch 调用次数
 */
export function getFetchCallCount(): number {
  return callRecords.length
}

/**
 * 获取所有 fetch 调用记录（只读）
 */
export function getFetchCalls(): readonly FetchCallRecord[] {
  return callRecords
}

/**
 * 获取最后一次 fetch 调用记录
 */
export function getLastFetchCall(): FetchCallRecord | undefined {
  return callRecords[callRecords.length - 1]
}

/**
 * 获取第 N 次 fetch 调用记录（从 0 开始）
 */
export function getFetchCall(index: number): FetchCallRecord | undefined {
  return callRecords[index]
}

/**
 * 验证最后一次 fetch 调用的请求体是否包含指定字段
 *
 * @param field 请求体字段名
 * @param expectedValue 期望值（可选，不传只验证字段存在）
 */
export function expectLastFetchBodyToContain<T = unknown>(
  field: string,
  expectedValue?: T,
): void {
  const lastCall = getLastFetchCall()
  if (!lastCall) {
    throw new Error('No fetch call recorded')
  }
  const body = lastCall.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw new Error(`Last fetch body is not an object: ${JSON.stringify(body)}`)
  }
  if (!(field in body)) {
    throw new Error(`Last fetch body does not contain field "${field}": ${JSON.stringify(body)}`)
  }
  if (expectedValue !== undefined && body[field] !== expectedValue) {
    throw new Error(
      `Last fetch body field "${field}" expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(body[field])}`,
    )
  }
}

// ============================================================
// 重置与恢复
// ============================================================

/**
 * 重置 mock 调用记录（不恢复 fetch）
 * 用于在同一测试用例内多次 mock 不同响应时清空调用历史
 */
export function resetFetchMock(): void {
  callRecords = []
  if (mockFetchFn) {
    mockFetchFn.mockClear()
  }
}

/**
 * 恢复原始 fetch
 * 必须在 afterEach 中调用，避免污染后续测试
 */
export function restoreFetch(): void {
  if (originalFetch !== null) {
    global.fetch = originalFetch
    originalFetch = null
    mockFetchFn = null
    callRecords = []
  }
}

// ============================================================
// 便捷工具
// ============================================================

/**
 * 创建一个完整的 LLM mock 响应对象（用于自定义 handler）
 */
export function createLlmResponse(
  content: string,
  options: LlmChatMockOptions = {},
): unknown {
  return {
    id: `chatcmpl-mock-${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model: options.model ?? 'deepseek-v4-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: options.usage?.promptTokens ?? 100,
      completion_tokens: options.usage?.completionTokens ?? 50,
      total_tokens: options.usage?.totalTokens ?? 150,
    },
  }
}
