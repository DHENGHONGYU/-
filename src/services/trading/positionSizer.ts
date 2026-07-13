import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import type { SignalDirection } from '@/config/tradingConfig'

export interface PositionSizingInput {
  direction: SignalDirection
  price: number
  portfolioValue: number
  currentHoldingShares?: number
  currentHoldingValue?: number
  currentTotalPositionValue?: number
  winRate?: number
  profitLossRatio?: number
}

export interface PositionSizingResult {
  action: 'buy' | 'sell' | 'hold'
  targetShares: number
  targetValue: number
  positionPct: number
  kellyPct: number
  roundedDown: boolean
  cappedBy: 'single' | 'total' | 'min' | 'max' | 'none'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 计算目标仓位
 *
 * 买入：使用 Kelly 公式半凯利（fraction Kelly）得到仓位比例，
 *       再按整手取整，并受单笔/总仓位上限约束。
 * 卖出：若当前有持仓则建议全部卖出。
 */
export function calculatePosition(input: PositionSizingInput): PositionSizingResult {
  const config = getEffectiveTradingConfig()
  const kelly = config.kelly
  const risk = config.risk

  const holdingShares = input.currentHoldingShares ?? 0
  const holdingValue = input.currentHoldingValue ?? holdingShares * input.price
  const totalPositionValue = input.currentTotalPositionValue ?? holdingValue

  if (input.direction === 'sell') {
    return {
      action: 'sell',
      targetShares: holdingShares,
      targetValue: holdingValue,
      positionPct: input.portfolioValue > 0 ? holdingValue / input.portfolioValue : 0,
      kellyPct: 0,
      roundedDown: false,
      cappedBy: 'none',
    }
  }

  if (input.direction !== 'buy' || input.price <= 0 || input.portfolioValue <= 0) {
    return {
      action: 'hold',
      targetShares: 0,
      targetValue: 0,
      positionPct: 0,
      kellyPct: 0,
      roundedDown: false,
      cappedBy: 'none',
    }
  }

  const winRate = input.winRate ?? kelly.defaultWinRate
  const profitLossRatio = input.profitLossRatio ?? kelly.defaultProfitLossRatio

  // Kelly % = W - (1 - W) / R
  const kellyPct = profitLossRatio > 0 ? winRate - (1 - winRate) / profitLossRatio : 0
  let positionPct = kelly.fraction * kellyPct
  positionPct = clamp(positionPct, kelly.minPositionPct / 100, kelly.maxPositionPct / 100)

  let cappedBy: PositionSizingResult['cappedBy'] = 'none'

  const maxSingleValue = (risk.maxSinglePositionPct / 100) * input.portfolioValue
  const remainingSingle = Math.max(0, maxSingleValue - holdingValue)
  const maxTotalValue = (risk.maxTotalPositionPct / 100) * input.portfolioValue
  const remainingTotal = Math.max(0, maxTotalValue - totalPositionValue)

  let targetValue = positionPct * input.portfolioValue

  // 1. 单笔仓位上限
  if (targetValue > remainingSingle) {
    targetValue = remainingSingle
    cappedBy = 'single'
  }

  // 2. 总仓位上限
  if (targetValue > remainingTotal) {
    targetValue = remainingTotal
    cappedBy = 'total'
  }

  // 3. 最小仓位阈值（若建议仓位小于最小仓位，则归零）
  if (targetValue < (kelly.minPositionPct / 100) * input.portfolioValue) {
    return {
      action: 'hold',
      targetShares: 0,
      targetValue: 0,
      positionPct: 0,
      kellyPct,
      roundedDown: false,
      cappedBy: targetValue === 0 && cappedBy !== 'none' ? cappedBy : 'min',
    }
  }

  // 4. 按整手取整
  const rawShares = Math.floor(targetValue / input.price)
  const roundedShares = Math.floor(rawShares / kelly.roundLot) * kelly.roundLot
  const roundedValue = roundedShares * input.price
  const roundedDown = roundedShares < rawShares

  if (roundedShares === 0) {
    return {
      action: 'hold',
      targetShares: 0,
      targetValue: 0,
      positionPct: 0,
      kellyPct,
      roundedDown,
      cappedBy: 'min',
    }
  }

  return {
    action: 'buy',
    targetShares: roundedShares,
    targetValue: roundedValue,
    positionPct: roundedValue / input.portfolioValue,
    kellyPct,
    roundedDown,
    cappedBy,
  }
}
