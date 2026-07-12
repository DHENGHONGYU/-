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

export interface CollectFinancialRequest {
  symbol: string
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

/**
 * 财务数据采集响应（与Python端FinancialCollectData对齐）
 */
export interface CollectFinancialData {
  report_date?: string
  revenue?: number
  revenue_yoy?: number
  net_profit?: number
  net_profit_yoy?: number
  gross_margin?: number
  net_margin?: number
  operating_cf?: number
  rd_ratio?: number
  receivables?: number
  inventory_turnover_days?: number
  interest_bearing_debt?: number
  goodwill?: number
  net_assets?: number
  shareholder_pledge?: number
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
