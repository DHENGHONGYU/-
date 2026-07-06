/**
 * @module services/llm/llmGateway
 * @description LLM 网关（L3 服务层）
 *
 * 将直接执行外部 HTTP 的 llmClient 封装为更高层网关，
 * 使 trading/scoring/analysis 等 L4 应用层不再直接依赖 L6 外部客户端。
 * 网关负责：配置校验、调用审计、错误降级、Token 统计。
 */

import { getLogger } from '@/lib/logger'
import { generateId } from '@/data/db'
import { chat as rawChat, streamingChat as rawStreamingChat, LlmApiError } from '@/services/llm/llmClient'
import type { LlmConfig } from '@/config/llmConfig'
import type { LlmMessage, LlmResponse, LlmStreamCallback } from '@/services/llm/llmTypes'

const logger = getLogger()

export interface LlmGatewayOptions extends Partial<LlmConfig> {
  /** 业务调用方标识，用于审计日志 */
  caller?: string
  /** 是否允许失败时静默降级（返回空内容而非抛错） */
  allowFallback?: boolean
}

export interface LlmGatewayResult {
  /** 本次调用 traceId */
  traceId: string
  /** 调用结果 */
  response: LlmResponse
  /** 是否经过 LLM（false 表示降级） */
  usedLlm: boolean
}

/**
 * 通过网关调用 LLM 非流式聊天。
 *
 * @param messages LLM 消息列表
 * @param options 网关选项
 * @returns LLM 响应
 */
export async function chat(messages: LlmMessage[], options: LlmGatewayOptions = {}): Promise<LlmResponse> {
  const traceId = `llm-${Date.now()}-${generateId().slice(0, 8)}`
  const caller = options.caller ?? 'unknown'
  const startTime = performance.now()

  logger.info(`[LLMGateway] chat called by ${caller}`, { traceId, messageCount: messages.length })

  try {
    const response = await rawChat(messages, options)
    const duration = Math.round(performance.now() - startTime)
    logger.info(`[LLMGateway] chat completed`, {
      traceId,
      caller,
      durationMs: duration,
      model: response.model,
      totalTokens: response.usage?.totalTokens,
    })
    return response
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[LLMGateway] chat failed`, { traceId, caller, durationMs: duration, error: message })

    if (options.allowFallback) {
      return {
        content: '',
        model: 'fallback',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }
    }

    if (err instanceof LlmApiError) {
      throw err
    }
    throw new LlmApiError(`LLM Gateway error: ${message}`)
  }
}

/**
 * 通过网关调用 LLM 流式聊天。
 *
 * @param messages LLM 消息列表
 * @param callback 流式回调
 * @param options 网关选项
 */
export async function streamingChat(
  messages: LlmMessage[],
  callback: LlmStreamCallback,
  options: LlmGatewayOptions = {},
): Promise<void> {
  const traceId = `llm-stream-${Date.now()}-${generateId().slice(0, 8)}`
  const caller = options.caller ?? 'unknown'
  const startTime = performance.now()

  logger.info(`[LLMGateway] streamingChat called by ${caller}`, { traceId, messageCount: messages.length })

  const wrappedCallback: LlmStreamCallback = (chunk) => {
    if (chunk.isDone) {
      const duration = Math.round(performance.now() - startTime)
      logger.info(`[LLMGateway] streamingChat completed`, { traceId, caller, durationMs: duration })
    }
    callback(chunk)
  }

  try {
    await rawStreamingChat(messages, wrappedCallback, options)
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[LLMGateway] streamingChat failed`, { traceId, caller, durationMs: duration, error: message })

    if (options.allowFallback) {
      wrappedCallback({ content: '', isDone: true, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
      return
    }

    if (err instanceof LlmApiError) {
      throw err
    }
    throw new LlmApiError(`LLM Gateway streaming error: ${message}`)
  }
}

// 重新导出底层错误类型，方便调用方捕获
export { LlmApiError, LlmConfigError } from '@/services/llm/llmClient'
