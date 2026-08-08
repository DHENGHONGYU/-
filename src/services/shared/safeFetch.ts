/**
 * @fileoverview 共享 safeFetch 工具 — 统一 HTTP 请求超时、错误处理与日志
 *
 * 替代以下 5 个文件中的内联 AbortController + fetch 模式：
 * - tushareProvider.ts
 * - multiSourceFetcher.ts
 * - crawlerProvider.ts
 * - llmSearchAgent.ts
 * - RestCollector.ts（通过 BaseCollector 的 AbortController）
 *
 * 设计原则：
 * - null-safe：网络错误/超时返回 null，由调用方决定降级策略
 * - 可配超时：默认取自 config/timeouts.ts，各调用方可自定义
 * - 支持外部 Signal：兼容 BaseCollector 的 abortController 模式
 * - requireOk 选项：部分调用方要求非 ok 响应也返回 null
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
 */

import { getLogger } from '@/lib/logger'
import { DATA_COLLECTION_TIMEOUT_MS } from '@/config/timeouts'

const logger = getLogger()

export interface SafeFetchOptions {
  /** 超时毫秒数（默认取自 config/timeouts.ts 的 DATA_COLLECTION_TIMEOUT_MS） */
  timeoutMs?: number
  /** 标准 RequestInit（method, headers, body 等） */
  init?: RequestInit
  /** 为 true 时，非 ok 响应也返回 null（默认 false） */
  requireOk?: boolean
  /** 外部 AbortSignal（如 BaseCollector 的 abortController.signal） */
  signal?: AbortSignal
}

/**
 * 安全 fetch — 带超时、错误处理与日志。
 *
 * 网络错误、超时、或（可选）非 ok 响应时返回 null。
 * 调用方根据返回值决定降级策略。
 *
 * @param url 请求 URL
 * @param options 配置选项
 * @param logPrefix 日志前缀（如 '[tushareProvider]'）
 * @returns Response 或 null
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
  logPrefix = '[safeFetch]',
): Promise<Response | null> {
  const { timeoutMs = DATA_COLLECTION_TIMEOUT_MS, init, requireOk = false, signal: externalSignal } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // 若提供外部 Signal，链接到内部 controller
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })

    if (requireOk && !response.ok) {
      logger.warn(`${logPrefix} HTTP ${response.status}: ${url}`)
      return null
    }

    return response
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
    logger.warn(`${logPrefix} fetch 失败`, {
      url,
      aborted,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timer)
  }
}
