export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  latency?: number
  error?: string
}

export interface DataSourceProvider {
  readonly name: string
  healthCheck(): Promise<HealthStatus>
}
