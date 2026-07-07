/**
 * @fileoverview 股票基础域类型（L1 股票业务域）
 *
 * 包含股票、股票数据质量、财务报告、股票池分组元数据等类型。
 *
 * @module data/types/types.stock
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 */

import type { DataSource, ResearchStatus } from '@/config/dbConfig'

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
 */
export interface FinancialReport {
  symbol: string
  reportDate: string
  revenue?: number
  revenueYoY?: number
  netProfit?: number
  netProfitYoY?: number
  grossMargin?: number
  netMargin?: number
  operatingCF?: number
  rdRatio?: number
  receivables?: number
  inventoryTurnoverDays?: number
  interestBearingDebt?: number
  goodwill?: number
  netAssets?: number
  shareholderPledge?: number
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
  researchStatus: ResearchStatus
  source: DataSource
  dataVersion: number
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
 * 架构导航：PoolGroup 业务实体定义
 * ====================================
 *
 * `PoolGroup`（含 status/label/stocks/options 字段的完整业务实体）
 * 定义在 services 层，未包含在 data/types/ 中。
 *
 * 权威源：`src/services/stockpool/stockpoolService.ts`
 *
 * 未迁移至 data/types/ 的原因：
 * - `PoolGroup.options` 字段类型为 `PoolTransitionOption[]`
 * - `PoolTransitionOption` 定义在 `src/core/poolTransitionEngine`
 * - 迁移会导致 data 层反向依赖 core 层，违反 AGENTS.md 分层规则
 *
 * 引用方应直接从 services 层导入：
 * ```typescript
 * import type { PoolGroup } from '@/services/stockpool/stockpoolService'
 * ```
 *
 * @see src/services/stockpool/stockpoolService.ts (PoolGroup 定义)
 * @see src/core/poolTransitionEngine.ts (PoolTransitionOption 定义)
 * @see src/components/pool/usePoolDataFromStore.ts (唯一类型引用方)
 */
