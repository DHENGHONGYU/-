/**
 * @fileoverview 行情数据域类型（L1 行情业务域）
 *
 * 包含 K 线、日线行情等类型。
 *
 * @module data/types/types.marketData
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** 单根 K 线 */
export interface KlineBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

/** 日线行情（含历史） */
export interface DailyQuotes {
  symbol: string
  latest: KlineBar
  history: KlineBar[]
  period: string
  adjust: string
  updatedAt: number
}
