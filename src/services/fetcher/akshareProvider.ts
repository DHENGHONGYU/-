/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
 */
import type { DataSourceProvider, HealthStatus } from './types'
import { checkFetcherHealth } from './fetcherClient'

/**
 * AkShare 数据采集服务 Provider
 * 包装现有的 fetcherClient，提供 healthCheck 能力用于 DataSourceRegistry 自动降级
 *
 * @implements DataSourceProvider
 */
export class AkshareProvider implements DataSourceProvider {
  readonly name = 'akshare'

  async healthCheck(): Promise<HealthStatus> {
    try {
      const result = await checkFetcherHealth()
      if (result.ok) {
        return { status: 'healthy' }
      }
      return { status: 'unhealthy', error: result.error }
    } catch (err) {
      return {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
