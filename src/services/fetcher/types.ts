/**
 * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066]
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  latency?: number
  error?: string
}

export interface DataSourceProvider {
  readonly name: string
  healthCheck(): Promise<HealthStatus>
}
