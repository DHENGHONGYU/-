/**
 * 数据采集模块类型定义
 */

export interface CollectBasicRequest {
  symbol: string
}

export interface CollectKlineRequest {
  symbol: string
  period?: 'daily' | 'weekly' | 'monthly'
  adjust?: 'qfq' | 'hfq' | ''
  start_date?: string
  end_date?: string
}

export interface CollectBasicData {
  name?: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  market_cap?: number
}

export interface CollectKlineData {
  latest?: {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    amount: number
  }
  history?: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    amount: number
  }>
}

export interface CollectResponse<T = unknown> {
  success: boolean
  symbol: string
  dimension: string
  data: T | null
  records: number
  error: string | null
  fetched_at: string
}

export interface HealthCheckResponse {
  status: 'ok' | 'error'
  service: string
  version?: string
  error?: string
}
