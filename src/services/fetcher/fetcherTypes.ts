/**
 * 数据采集模块类型定义
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066]
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

/** 板块轮动评分采集请求（申万二级，对应 Python /api/collect/sectors） */
export interface CollectSectorsRequest {
  topN?: number
}

/** 板块轮动评分单条记录（字段与 RotationSectorScore 对齐） */
export interface CollectSectorScoreItem {
  id: string
  sectorCode: string
  sectorName: string
  swLevel1?: string | null
  swLevel2?: string | null
  swLevel3?: string | null
  scoreDate: string
  f1Jingqi: number
  f2Zijin: number
  f3Guzhi: number
  f4Beta: number
  f5Nengliang: number
  total: number
  resonance: number
  signal: string
  alertLevel: string
  declineType: string
  poolStocks: Array<{ symbol: string; name: string; v6Composite?: number }>
  modelUsed: string
  createdAt: string
}

/** 板块轮动评分采集响应 data 字段 */
export interface CollectSectorsData {
  sectors: CollectSectorScoreItem[]
  scoreDate: string
}

export interface CollectBasicData {
  name?: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  market_cap?: number
  /** 行业（来自 AKShare stock_individual_info_em 行业字段，映射到 Stock.industryCode） */
  industry_code?: string
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
 * 
 * 利润表字段（Income Statement）
 * 资产负债表字段（Balance Sheet）
 * 现金流量表字段（Cash Flow Statement）
 */
export interface CollectFinancialData {
  report_date?: string
  report_type?: 'annual' | 'quarterly' | 'semi-annual'

  revenue?: number
  revenue_yoy?: number
  operating_cost?: number
  operating_cost_yoy?: number
  gross_profit?: number
  gross_margin?: number
  operating_expense?: number
  operating_profit?: number
  operating_profit_yoy?: number
  total_profit?: number
  total_profit_yoy?: number
  net_profit?: number
  net_profit_yoy?: number
  net_margin?: number
  rd_expense?: number
  rd_ratio?: number

  total_assets?: number
  total_assets_yoy?: number
  current_assets?: number
  non_current_assets?: number
  total_liabilities?: number
  total_liabilities_yoy?: number
  current_liabilities?: number
  non_current_liabilities?: number
  net_assets?: number
  net_assets_yoy?: number
  receivables?: number
  receivables_yoy?: number
  inventory?: number
  inventory_yoy?: number
  fixed_assets?: number
  intangible_assets?: number
  goodwill?: number
  interest_bearing_debt?: number
  short_term_debt?: number
  long_term_debt?: number
  shareholder_pledge?: number

  operating_cf?: number
  operating_cf_yoy?: number
  investing_cf?: number
  financing_cf?: number
  net_cf?: number

  eps?: number
  eps_yoy?: number
  diluted_eps?: number
  bps?: number
  inventory_turnover_days?: number
  receivables_turnover_days?: number
  asset_turnover?: number
  roa?: number
  roe?: number
  debt_to_asset_ratio?: number
  current_ratio?: number
  quick_ratio?: number
  dividend_yield?: number
  payout_ratio?: number
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
