/**
 * @module mcp/core/elicitation
 * @description MCP Elicitation 管理器 — Server 向用户请求交互式输入
 * @created 2026-07-04
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-002, V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-PROJ-003]
*/

import type { ElicitationRequest, ElicitationResponse } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 用户输入处理器类型 */
type ElicitationHandler = (request: ElicitationRequest) => Promise<ElicitationResponse>

/** Elicitation 管理器 — 单例模式 */
export class ElicitationManager {
  private handler: ElicitationHandler | null = null
  private pendingRequests = new Map<
    string,
    {
      resolve: (response: ElicitationResponse) => void
      reject: (error: Error) => void
      timeout: ReturnType<typeof setTimeout>
    }
  >()

  /** 注册用户输入处理器 */
  setHandler(handler: ElicitationHandler): void {
    this.handler = handler
    logger.info('[ElicitationManager] Handler registered')
  }

  /** 发起交互式请求 */
  async request(request: ElicitationRequest): Promise<ElicitationResponse> {
    const requestId = `elicitation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    logger.info('[ElicitationManager] Request initiated', { requestId, message: request.message })

    if (!this.handler) {
      logger.error('[ElicitationManager] No handler registered')
      throw new Error('Elicitation handler not configured')
    }

    const timeoutMs = request.timeout ?? 30000

    return new Promise<ElicitationResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        logger.info('[ElicitationManager] Request timed out', { requestId })
        reject(new Error(`Elicitation request timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      this.handler!(request)
        .then((response) => {
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          logger.info('[ElicitationManager] Response received', { requestId, action: response.action })
          resolve(response)
        })
        .catch((error) => {
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          logger.error('[ElicitationManager] Handler error', { requestId, error: String(error) })
          reject(error instanceof Error ? error : new Error(String(error)))
        })
    })
  }

  /** 获取待处理请求数 */
  getPendingCount(): number {
    return this.pendingRequests.size
  }
}

export const elicitationManager = new ElicitationManager()