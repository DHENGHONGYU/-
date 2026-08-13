import type { HotSector } from '@/services/input/hotSectorService'

/** 排序后的板块（附带动态综合评分） */
export type RankedSector = HotSector & { dynamicScore: number }

/** 板块详情（用于批量加入日志） */
export interface SectorDetail {
  code: string
  name: string
  stockSymbols: string[]
}

/** 单板块批量加入结果汇总 */
export interface SectorBatchResult {
  code: string
  added: string[]
  failed: string[]
}

/** 成分股逐项选择明细（用于日志） */
export interface StockSelectionDetail {
  sectorCode: string
  sectorName: string
  symbols: string[]
}

/** 个股加入结果 */
export interface StockAddResult {
  symbol: string
  sectorCode: string
  success: boolean
  error?: string
}
