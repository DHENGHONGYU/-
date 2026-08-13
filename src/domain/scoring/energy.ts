/**
 * @fileoverview 成交量能量计算 — 纯数学运算实现
 *
 * 本文件包含纯计算函数 computeTurnoverVolumeEnergy（K线量价 → 能量等级）。
 * 原实现位于 services/scoring/v6-engine/calculators/l7_l8.ts，P1-12 分层合规：纯函数落地 domain 层（从 lib/scoring 迁移），
 * 为满足 audit:layers 的 lib 层「禁止依赖 services」规则，代码在此处落地；
 * services 端改为从本文件 re-export，保持 API 零破坏。
 *
 * 函数性质：纯同步，无副作用，无 IO。
 *
 * @see src/services/scoring/v6-engine/calculators/l7_l8.ts (re-export caller)
 * @doc V9-DOC-BACK-025
 */

import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'

export interface TurnoverVolumeEnergy {
  raw: number
  level: 1 | 2 | 3 | 4 | 5
  label: '冷清能量' | '温和能量' | '活跃能量' | '激进能量' | '爆炸能量'
  positionCapPct: number
  takeProfitPct: number
  stopLossPct: number
}

/**
 * 成交量能量等级（L8 突破交易能量评估）。
 *
 * @param turnover 20 日均换手率（小数，如 3% = 0.03）。若缺失，按 0.001 处理。
 * @param volumeRatio 量比（倍数，如 2.5）。若缺失，按 0.5 处理（缩量）。
 */
export function computeTurnoverVolumeEnergy(
  turnover: number | undefined,
  volumeRatio: number | undefined,
): TurnoverVolumeEnergy {
  const T = V6_CALCULATOR_THRESHOLDS
  const t = turnover ?? 0.001
  const v = volumeRatio ?? 0.5
  const raw = t * v

  let level: 1 | 2 | 3 | 4 | 5
  let label: TurnoverVolumeEnergy['label']
  let positionCapPct: number
  let takeProfitPct: number
  let stopLossPct: number

  if (raw >= T.L8_BREAKOUT_ENERGY_TIER4) {
    level = 5; label = '爆炸能量'
    positionCapPct = T.L8_BREAKOUT_POS_CAP_L5
    takeProfitPct = T.L8_BREAKOUT_TP_L5
    stopLossPct = T.L8_BREAKOUT_SL_L5
  } else if (raw >= T.L8_BREAKOUT_ENERGY_TIER3) {
    level = 4; label = '激进能量'
    positionCapPct = T.L8_BREAKOUT_POS_CAP_L4
    takeProfitPct = T.L8_BREAKOUT_TP_L4
    stopLossPct = T.L8_BREAKOUT_SL_L4
  } else if (raw >= T.L8_BREAKOUT_ENERGY_TIER2) {
    level = 3; label = '活跃能量'
    positionCapPct = T.L8_BREAKOUT_POS_CAP_L3
    takeProfitPct = T.L8_BREAKOUT_TP_L3
    stopLossPct = T.L8_BREAKOUT_SL_L3
  } else if (raw >= T.L8_BREAKOUT_ENERGY_TIER1) {
    level = 2; label = '温和能量'
    positionCapPct = T.L8_BREAKOUT_POS_CAP_L2
    takeProfitPct = T.L8_BREAKOUT_TP_L2
    stopLossPct = T.L8_BREAKOUT_SL_L2
  } else {
    level = 1; label = '冷清能量'
    positionCapPct = T.L8_BREAKOUT_POS_CAP_L1
    takeProfitPct = T.L8_BREAKOUT_TP_L1
    stopLossPct = T.L8_BREAKOUT_SL_L1
  }
  return { raw: Number(raw.toFixed(4)), level, label, positionCapPct, takeProfitPct, stopLossPct }
}
