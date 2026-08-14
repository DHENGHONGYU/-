/**
 * @fileoverview 股票基础域类型（L1 股票业务域）
 *
 * 包含股票、股票数据质量、财务报告、股票池分组元数据等类型。
 *
 * @module data/types/types.stock
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
  * @doc [V9-DOC-QA-066]
*/

import type { DataSource } from '@/config/dbConfig'
import type { PoolStatus, PoolType } from '@/types/modules/pool.types'

/** 股票录入来源：hot-sector=来源一（热门板块核心标的）/ manual=来源二（自定义检索） */
export type ScreenSource = 'hot-sector' | 'manual'

/** 股票数据质量标记 */
export interface StockDataQuality {
  basic: boolean
  kline: boolean
  finance: boolean
  lastChecked?: number
}

/**
 * 财务分析报告（IndexedDB存储结构）
 * 用于支撑V6评分引擎L3a/L3v层的财务数据需求
 * 
 * 利润表字段（Income Statement）
 * 资产负债表字段（Balance Sheet）
 * 现金流量表字段（Cash Flow Statement）
 * 财务比率（Financial Ratios）
 */
export interface FinancialReport {
  symbol: string
  reportDate: string
  reportType?: 'annual' | 'quarterly' | 'semi-annual'

  revenue?: number
  revenueYoY?: number
  operatingCost?: number
  operatingCostYoY?: number
  grossProfit?: number
  grossMargin?: number
  operatingExpense?: number
  operatingProfit?: number
  operatingProfitYoY?: number
  totalProfit?: number
  totalProfitYoY?: number
  netProfit?: number
  netProfitYoY?: number
  netMargin?: number
  rdExpense?: number
  rdRatio?: number

  totalAssets?: number
  totalAssetsYoY?: number
  currentAssets?: number
  nonCurrentAssets?: number
  totalLiabilities?: number
  totalLiabilitiesYoY?: number
  currentLiabilities?: number
  nonCurrentLiabilities?: number
  netAssets?: number
  netAssetsYoY?: number
  receivables?: number
  receivablesYoY?: number
  inventory?: number
  inventoryYoY?: number
  fixedAssets?: number
  intangibleAssets?: number
  goodwill?: number
  interestBearingDebt?: number
  shortTermDebt?: number
  longTermDebt?: number
  shareholderPledge?: number

  operatingCF?: number
  operatingCFYoY?: number
  investingCF?: number
  financingCF?: number
  netCF?: number

  eps?: number
  epsYoY?: number
  dilutedEps?: number
  bps?: number
  inventoryTurnoverDays?: number
  receivablesTurnoverDays?: number
  assetTurnover?: number
  roa?: number
  roe?: number
  debtToAssetRatio?: number
  currentRatio?: number
  quickRatio?: number
  dividendYield?: number
  payoutRatio?: number

  updatedAt: number
}

/** 股票主数据 */
export interface Stock {
  symbol: string
  name: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  marketCap?: number
  /**
   * 股票池类型（三分拆后）。
   * - intention: 意向候选池
   * - research: 研究精选池
   * - position: 持仓池
   */
  pool?: PoolType
  /**
   * 研究状态（三分拆后类型扩展为 PoolStatus）。
   * 字段名保留 researchStatus 以兼容现有索引与历史数据。
   */
  researchStatus: PoolStatus
  source: DataSource
  dataVersion: number
  /** 录入来源（hot-sector/manual），用于来源溯源与过滤 */
  screenSource?: ScreenSource
  dataQuality?: StockDataQuality
  ingestedAt?: number
  updatedAt?: number
  /**
   * 行业代码，用于主题映射与组合集中度控制。
   * 建议采用申万/中信等行业分类编码。
   */
  industryCode?: string
  /**
   * 主题标签，一只股票可同时属于多个主题。
   * 例如：['第四次工业革命稀缺核心资源', 'AI算力']。
   */
  theme?: string[]
  /**
   * 板块/ Sector 名称，用于展示与粗略分组。
   */
  sector?: string
  /**
   * 股票池分组名称，用户自定义的展示/筛选维度。
   * 未指定时由业务层回退为默认分组。
   */
  group?: string
  // ── 阶段 A-3：数据血缘（采集降级可见性） ──
  /**
   * 数据血缘标识：'real' = 真实数据源 / 'mock' = Mock 降级数据 / 'unknown' = 未标注
   * UI 侧显示降级徽章，避免 Mock 数据被误用为真实信号
   */
  dataProvenance?: 'real' | 'mock' | 'unknown'
  /** 实际数据源标识（tencent/sina/netease/akshare/mock/unknown） */
  dataSource?: 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock' | 'unknown'
  // ── 三分拆后持仓字段（仅 position 池使用） ──
  quantity?: number
  avgCost?: number
  currentPrice?: number
}

/**
 * 股票池分组元数据，用于 UI 展示分组选择器。
 *
 * 注意：此为纯数据元数据（仅 name 字段），与业务实体 PoolGroup 不同。
 */
export interface PoolGroupMeta {
  name: string
}

/**
 * 架构导航：PoolLane 业务实体定义
 * ====================================
 *
 * `PoolLane`（含 status/label/items/options 字段的完整业务实体）
 * 定义在 types/modules/pool.types.ts 中。
 *
 * 引用方应直接导入：
 * ```typescript
 * import type { PoolLane } from '@/types/modules/pool.types'
 * ```
 *
 * @see src/types/modules/pool.types.ts (PoolLane 定义)
 * @see src/core/poolTransitionEngine.ts (PoolTransitionTarget 定义)
 * @see src/components/organisms/pool/usePoolDataFromStore.ts (类型引用方)
 */
