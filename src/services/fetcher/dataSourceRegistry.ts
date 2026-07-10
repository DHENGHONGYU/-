import type { DataSourceProvider, HealthStatus } from './types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * DataSourceRegistry
 */
export class DataSourceRegistry {
  private providers: DataSourceProvider[] = []

  register(provider: DataSourceProvider): void {
    if (this.providers.some(p => p.name === provider.name)) {
      logger.warn(`[DataSourceRegistry] Provider "${provider.name}" already registered, skipping`)
      return
    }
    this.providers.push(provider)
    logger.info(`[DataSourceRegistry] Registered provider: ${provider.name}`)
  }

  async getActiveProvider(): Promise<DataSourceProvider> {
    for (const provider of this.providers) {
      try {
        const health = await provider.healthCheck()
        if (health.status === 'healthy') {
          return provider
        }
        logger.warn(`[DataSourceRegistry] Provider "${provider.name}" is ${health.status}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[DataSourceRegistry] Provider "${provider.name}" healthCheck failed: ${message}`)
      }
    }
    // 全部 unhealthy，返回最后一个（降级策略）
    const fallback = this.providers[this.providers.length - 1]
    if (fallback) {
      logger.warn(`[DataSourceRegistry] All providers unhealthy, falling back to "${fallback.name}"`)
      return fallback
    }
    throw new Error('[DataSourceRegistry] No providers registered')
  }

  getAllProviders(): DataSourceProvider[] {
    return [...this.providers]
  }

  getStatus(): Promise<HealthStatus[]> {
    return Promise.all(this.providers.map(p =>
      p.healthCheck().catch(err => ({
        status: 'unhealthy' as const,
        error: err instanceof Error ? err.message : String(err),
      }))
    ))
  }
}
