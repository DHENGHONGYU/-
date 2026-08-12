/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066, V9-DOC-BACK-023]
 */
import type { BacktestStrategy, BacktestResult } from '@/types/modules/backtest.types'

export interface BacktestEngineConfig {
  strategy: BacktestStrategy
  startDate: string
  endDate: string
  initialCapital: number
  commissionRate: number
  slippage: number
  maxPositionPct: number
}

export interface VirtualOrder {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  price: number
  quantity: number
  date: string
  commission: number
}

export interface VirtualPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
}

export interface BacktestEngineResult {
  trades: VirtualOrder[]
  positions: VirtualPosition[]
  dailyValues: { date: string; totalValue: number; cash: number }[]
  metrics: BacktestResult
}

export interface BacktestEvent {
  symbol: string
  direction: 'buy' | 'sell'
  date: string
  price: number
  confidence: number
  source: 'signal' | 'order'
  strategy?: string
}

export interface InternalPosition {
  quantity: number
  avgCost: number
}