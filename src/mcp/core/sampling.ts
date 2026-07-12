import type { SamplingRequest, SamplingResponse } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export class SamplingHandler {
  private modelProvider: ((request: SamplingRequest) => Promise<SamplingResponse>) | null = null

  setModelProvider(provider: (request: SamplingRequest) => Promise<SamplingResponse>): void {
    logger.info('[SamplingHandler] Model provider registered')
    this.modelProvider = provider
  }

  async createMessage(request: SamplingRequest): Promise<SamplingResponse> {
    if (!this.modelProvider) {
      logger.error('[SamplingHandler] No model provider registered')
      throw new Error('Sampling model provider not configured')
    }
    logger.info('[SamplingHandler] createMessage called', {
      modelHints: request.modelPreferences?.hints?.map((h) => h.name),
      maxTokens: request.maxTokens,
    })
    try {
      const response = await this.modelProvider(request)
      logger.info('[SamplingHandler] createMessage completed', { model: response.model })
      return response
    } catch (error) {
      logger.error('[SamplingHandler] createMessage failed', { error: String(error) })
      throw error
    }
  }
}

export const samplingHandler = new SamplingHandler()