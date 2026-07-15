import type { ZodSchema } from 'zod'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** JSON Schema 描述对象（OpenAI / 兼容接口格式） */
export interface JsonSchema {
  name: string
  strict?: boolean
  schema: Record<string, unknown>
}

/** 结构化输出模式 */
export type LlmResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: JsonSchema }

/**
 * 结构化输出选项。
 *
 * 当传入 responseFormat 时，LLM 客户端会在请求体中注入 response_format 字段，
 * 并在返回时将 content 解析为结构化对象；若提供 zodSchema，则进一步做运行时校验。
 */
export interface LlmStructuredOptions<T = unknown> {
  responseFormat: LlmResponseFormat
  zodSchema?: ZodSchema<T>
}

export interface LlmResponse<T = unknown> {
  content: string
  model: string
  usage?: LlmUsage
  /** 结构化输出时的解析结果 */
  parsed?: T
}

export interface LlmStreamChunk {
  content: string
  isDone: boolean
  usage?: LlmUsage
}

export type LlmStreamCallback = (chunk: LlmStreamChunk) => void
