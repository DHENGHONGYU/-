/**
 * 筹码分布计算 + 穿透率（PAS）+ 乖离率（BIAS）+ 获利盘比例（PRO）指标
 *
 * 基于历史 K 线收盘价、成交量和换手率，使用混合衰减法构建筹码分布模型。
 * PAS（Penetration Ability Score）衡量股价穿越筹码分布空间的能力。
 * BIAS（Chip Deviation Rate）衡量股价偏离筹码重心的程度。
 * PRO（Profit Ratio）衡量收盘价下方筹码占比，反映获利盘比例。
 *
 * 衰减模型（v4.1 - G3-B 对齐 CYQ）：
 * - hybrid（默认）：线性时间权重 × 换手率衰减因子
 *   weight_i = linearWeight_i × max(0.1, 1 - turnoverRate_i)
 *   保留时间优先语义 + 叠加成交活跃度语义
 * - linear（回退）：纯线性时间衰减 weight_i = (i+1)/N
 *   当 turnoverRates 未提供时自动回退
 *
 * @module services/scoring/v6-engine/calculators/chipDistribution
 * @doc TASK-03: 补充筹码穿透率（PAS）指标
 * @doc TASK-04: 补充筹码乖离率（BIAS）指标
 * @doc TASK-05: 补充获利盘比例（PRO）指标
 * @doc G3-B: 2026-08-20 换手率衰减对齐 CYQ 算法
 */

import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'

// ============================================================
// 类型定义
// ============================================================

/** 单个价格桶 */
export interface PriceBucket {
  /** 桶下界（含） */
  priceMin: number
  /** 桶上界（不含，最后一桶含） */
  priceMax: number
  /** 该桶内的筹码量（衰减加权后的成交量） */
  chipAmount: number
}

/** 筹码分布结果 */
export interface ChipDistribution {
  /** 价格桶数组 */
  buckets: PriceBucket[]
  /** 桶数量 */
  bucketCount: number
  /** 使用的天数 */
  daysUsed: number
  /** 成交量加权平均价（VWAP） */
  vwap: number | null
  /** 70% 集中度（最集中 30% 价格区间内的筹码占比） */
  concentration70: number | null
  /** 90% 集中度（最集中 10% 价格区间内的筹码占比） */
  concentration90: number | null
  /** 获利盘比例（0-1，低于当前价的筹码占比） */
  profitRatio: number | null
  /** 数据来源 */
  source: 'real' | 'proxy'
  /** 总筹码量 */
  totalChips: number
}

// ============================================================
// 筹码分布计算
// ============================================================

/**
 * 从历史收盘价、成交量和换手率构建筹码分布
 *
 * 算法（G3-B hybrid 混合衰减模型）：
 * 1. 取最近 windowDays 天的收盘价、成交量和换手率
 * 2. 在 [min, max] 价格区间创建 bucketCount 个等宽桶
 * 3. 计算每日权重：
 *    - linearWeight_i = (i + 1) / daysUsed  （线性基础权重，越近越高）
 *    - turnoverFactor_i = max(0.1, 1 - turnoverRate_i)  （换手率衰减因子）
 *    - combinedWeight_i = linearWeight_i × turnoverFactor_i
 *    - normalizedWeight_i = combinedWeight_i / Σ(combinedWeight_j)
 * 4. 将每日成交量按归一化权重分配到对应价格桶
 * 5. 计算 VWAP、集中度、获利盘比例
 *
 * 向后兼容：turnoverRates 未提供时，自动回退到纯线性衰减
 *
 * @param closes 收盘价序列
 * @param volumes 成交量序列
 * @param options 配置选项（含 turnoverRates）
 */

/** 计算当前价格下的获利盘比例（扁平化：将获利盘累积逻辑抽取为独立辅助函数）
 * 命名区别于文末导出 API calcProfitRatio(distribution, currentPrice)，避免 TS2393 冲突 */
function calcProfitRatioFromBuckets(buckets: PriceBucket[], currentPrice: number, totalChips: number): number {
  let profitChips = 0
  for (const b of buckets) {
    if (b.priceMax <= currentPrice) {
      profitChips += b.chipAmount
    } else if (b.priceMin < currentPrice) {
      const ratio = (currentPrice - b.priceMin) / (b.priceMax - b.priceMin)
      profitChips += b.chipAmount * ratio
    }
  }
  return profitChips / totalChips
}

export function calcChipDistribution(
  closes: number[],
  volumes: number[],
  options: {
    windowDays?: number
    bucketCount?: number
    currentPrice?: number
    decayModel?: 'hybrid' | 'linear'
    turnoverRates?: number[]
  } = {},
): ChipDistribution {
  const windowDays = options.windowDays ?? V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIST_WINDOW_DAYS
  const bucketCount = options.bucketCount ?? V6_CALCULATOR_THRESHOLDS.L8_CHIP_DIST_BUCKETS
  const currentPrice = options.currentPrice
  const decayModel = options.decayModel ?? 'hybrid'
  const turnoverRates = options.turnoverRates

  const minLen = Math.min(closes.length, volumes.length)
  const startIdx = Math.max(0, minLen - windowDays)
  const daysUsed = minLen - startIdx

  if (daysUsed < 2) {
    return {
      buckets: [],
      bucketCount,
      daysUsed: 0,
      vwap: null,
      concentration70: null,
      concentration90: null,
      profitRatio: null,
      source: 'proxy',
      totalChips: 0,
    }
  }

  const sliceCloses = closes.slice(startIdx, minLen)
  const sliceVolumes = volumes.slice(startIdx, minLen)
  const sliceTurnoverRates = turnoverRates && turnoverRates.length > 0
    ? turnoverRates.slice(Math.max(0, turnoverRates.length - daysUsed))
    : undefined

  const useHybrid = decayModel === 'hybrid' && sliceTurnoverRates !== undefined

  let priceMin = Infinity
  let priceMax = -Infinity
  for (const c of sliceCloses) {
    if (c < priceMin) priceMin = c
    if (c > priceMax) priceMax = c
  }

  if (priceMin === priceMax) {
    priceMin *= 0.999
    priceMax *= 1.001
  }

  const bucketWidth = (priceMax - priceMin) / bucketCount

  const buckets: PriceBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    priceMin: priceMin + i * bucketWidth,
    priceMax: priceMin + (i + 1) * bucketWidth,
    chipAmount: 0,
  }))

  const rawWeights = new Float64Array(daysUsed)
  for (let i = 0; i < daysUsed; i++) {
    const linearWeight = (i + 1) / daysUsed

    if (useHybrid) {
      const tr = sliceTurnoverRates![i]
      // FALLBACK: 若个别交易日换手率缺失，使用历史日均中位数 0.03 作为显式回退。
      // 该值已在 V6 L8 计分文档中备案；长期应在数据预处理层保证 turnoverRates 完整。
      const MISSING_TURNOVER_FALLBACK = 0.03
      const turnoverFactor = Math.max(0.1, 1 - (tr ?? MISSING_TURNOVER_FALLBACK))
      rawWeights[i] = linearWeight * turnoverFactor
    } else {
      rawWeights[i] = linearWeight
    }
  }

  const totalWeight = useHybrid
    ? rawWeights.reduce((a, b) => a + b, 0)
    : 1

  let totalChips = 0
  let vwapSum = 0

  for (let i = 0; i < daysUsed; i++) {
    const close = sliceCloses[i]!
    const volume = sliceVolumes[i]!
    if (close == null || volume == null || volume <= 0) continue

    const normalizedWeight = useHybrid ? rawWeights[i]! / totalWeight : rawWeights[i]!
    const weightedVolume = volume * normalizedWeight

    let idx = Math.floor((close - priceMin) / bucketWidth)
    idx = Math.min(Math.max(0, idx), bucketCount - 1)

    buckets[idx]!.chipAmount += weightedVolume
    totalChips += weightedVolume
    vwapSum += close * weightedVolume
  }

  if (totalChips === 0) {
    return {
      buckets: [],
      bucketCount,
      daysUsed: 0,
      vwap: null,
      concentration70: null,
      concentration90: null,
      profitRatio: null,
      source: 'proxy',
      totalChips: 0,
    }
  }

  const vwap = vwapSum / totalChips

  const sortedBuckets = [...buckets].sort((a, b) => b.chipAmount - a.chipAmount)
  const threshold70 = totalChips * 0.7
  const threshold90 = totalChips * 0.9
  let cumSum70 = 0
  let count70 = 0
  let cumSum90 = 0
  let count90 = 0
  for (const b of sortedBuckets) {
    cumSum90 += b.chipAmount
    count90++
    if (cumSum90 >= threshold90 && count90 === 1) {
      break
    }
  }
  for (const b of sortedBuckets) {
    cumSum70 += b.chipAmount
    count70++
    if (cumSum70 >= threshold70) break
  }
  const concentration70 = count70 / bucketCount
  const concentration90 = count90 / bucketCount

  let profitRatio: number | null = null
  if (currentPrice !== undefined) {
    profitRatio = calcProfitRatioFromBuckets(buckets, currentPrice, totalChips)
  }

  return {
    buckets,
    bucketCount,
    daysUsed,
    vwap,
    concentration70,
    concentration90,
    profitRatio,
    source: 'real',
    totalChips,
  }
}

// ============================================================
// 穿透率（PAS）计算
// ============================================================

/**
 * 计算筹码穿透率（Penetration Ability Score）
 *
 * PAS = 当日成交量 / 穿越价格区间内的筹码总量
 *
 * - PAS > 0：股价向上穿越，解套筹码增多
 * - PAS < 0：股价向下穿越，套牢筹码增多
 * - |PAS| 越大，穿透力越强
 *
 * @param distribution 筹码分布
 * @param currentPrice 当日收盘价
 * @param prevClose 前一日收盘价
 * @param dailyVolume 当日成交量
 * @returns 穿透率（带符号），无分布数据时返回 null
 */
export function calcPAS(
  distribution: ChipDistribution,
  currentPrice: number,
  prevClose: number,
  dailyVolume: number,
): number | null {
  if (distribution.buckets.length === 0 || distribution.totalChips === 0) {
    return null
  }

  if (currentPrice === prevClose || dailyVolume <= 0) {
    return 0
  }

  const priceLow = Math.min(currentPrice, prevClose)
  const priceHigh = Math.max(currentPrice, prevClose)

  let crossedChips = 0
  for (const bucket of distribution.buckets) {
    if (bucket.priceMax <= priceLow || bucket.priceMin >= priceHigh) {
      continue
    }

    const overlapMin = Math.max(bucket.priceMin, priceLow)
    const overlapMax = Math.min(bucket.priceMax, priceHigh)
    const overlapRatio = overlapMin < overlapMax
      ? (overlapMax - overlapMin) / (bucket.priceMax - bucket.priceMin)
      : 0

    crossedChips += bucket.chipAmount * overlapRatio
  }

  if (crossedChips === 0) {
    return 0
  }

  const pas = dailyVolume / crossedChips

  return currentPrice > prevClose ? pas : -pas
}

/**
 * 将 PAS 值映射到 0-5 分
 *
 * 评分逻辑：
 * - PAS > 0.3 → 5 分（强突破，主力控盘）
 * - 0.1 < PAS ≤ 0.3 → 3 分（正常穿透）
 * - 0 < PAS ≤ 0.1 → 2 分（弱突破，上方压力）
 * - -0.1 ≤ PAS ≤ 0 → 2 分（弱下跌穿透）
 * - -0.3 ≤ PAS < -0.1 → 1.5 分（中等下跌穿透）
 * - PAS < -0.3 → 1 分（强下跌穿透，套牢盘增多）
 */
export function pasToScore(pas: number | null): number | null {
  if (pas === null) return null

  const strong = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PAS_STRONG
  const weak = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PAS_WEAK

  if (pas > strong) return 5
  if (pas > weak) return 3
  if (pas > 0) return 2
  if (pas >= -weak) return 2
  if (pas >= -strong) return 1.5
  return 1
}

// ============================================================
// 乖离率（BIAS）计算
// ============================================================

/**
 * 计算成交量加权平均价（VWAP）
 *
 * VWAP = Σ(close × volume) / Σ(volume)
 *
 * @param closes 收盘价序列
 * @param volumes 成交量序列
 * @returns VWAP，数据不足时返回 null
 */
export function calcVWAP(closes: number[], volumes: number[]): number | null {
  const minLen = Math.min(closes.length, volumes.length)
  if (minLen < 1) return null

  let totalPV = 0
  let totalV = 0
  for (let i = 0; i < minLen; i++) {
    const close = closes[i]
    const volume = volumes[i]
    if (close == null || volume == null || volume <= 0) continue
    totalPV += close * volume
    totalV += volume
  }

  if (totalV === 0) return null
  return totalPV / totalV
}

/**
 * 计算筹码乖离率（Chip Deviation Rate）
 *
 * bias = (currentPrice - vwap) / vwap
 *
 * - bias > 0：股价高于筹码重心（获利盘偏多）
 * - bias < 0：股价低于筹码重心（套牢盘偏多）
 * - |bias| 越大，偏离度越高，风险越大
 *
 * @param vwap 筹码加权均价
 * @param currentPrice 当前股价
 * @returns 乖离率（小数，如 0.05 表示 5%），无数据时返回 null
 */
export function calcBias(vwap: number | null, currentPrice: number): number | null {
  if (vwap === null || vwap <= 0 || currentPrice <= 0) return null
  return (currentPrice - vwap) / vwap
}

/**
 * 将乖离率映射到 0-5 分
 *
 * 评分逻辑（基于绝对值，正负偏离同等对待）：
 * - |bias| < 5% → 5 分（安全，股价贴近筹码重心）
 * - 5% ≤ |bias| < 15% → 3 分（需关注，偏离较大）
 * - |bias| ≥ 15% → 1 分（高风险止盈信号，严重偏离）
 */
export function biasToScore(bias: number | null): number | null {
  if (bias === null) return null

  const absBias = Math.abs(bias)
  const danger = V6_CALCULATOR_THRESHOLDS.L8_CHIP_BIAS_DANGER
  const normal = V6_CALCULATOR_THRESHOLDS.L8_CHIP_BIAS_NORMAL

  if (absBias < normal) return 5
  if (absBias < danger) return 3
  return 1
}

// ============================================================
// 获利盘比例（PRO）计算
// ============================================================

/**
 * 计算获利盘比例（Profit Ratio）
 *
 * 获利盘比例 = 收盘价下方筹码占比
 * 基于筹码分布，累加收盘价下方所有桶的筹码量（含部分穿越桶的按比例计算）
 *
 * - ratio 接近 1：绝大多数筹码在当前价下方，获利盘多，止盈风险高
 * - ratio 接近 0：绝大多数筹码在当前价上方，套牢盘重，反弹压力大
 * - ratio 在 0.4~0.6：健康均衡
 *
 * @param distribution 筹码分布
 * @param currentPrice 当前股价
 * @returns 获利盘比例（0-1），无数据时返回 null
 */
export function calcProfitRatio(
  distribution: ChipDistribution,
  currentPrice: number,
): number | null {
  if (distribution.buckets.length === 0 || distribution.totalChips === 0) {
    return null
  }

  let profitChips = 0
  for (const bucket of distribution.buckets) {
    if (bucket.priceMax <= currentPrice) {
      profitChips += bucket.chipAmount
    } else if (bucket.priceMin < currentPrice) {
      const ratio = (currentPrice - bucket.priceMin) / (bucket.priceMax - bucket.priceMin)
      profitChips += bucket.chipAmount * ratio
    }
  }

  return profitChips / distribution.totalChips
}

/**
 * 将获利盘比例映射到 0-5 分
 *
 * 评分逻辑：
 * - 40% ≤ ratio ≤ 60% → 5 分（健康均衡）
 * - 20% ≤ ratio < 40% 或 60% < ratio ≤ 80% → 3 分（偏向）
 * - ratio < 20% 或 ratio > 80% → 1 分（极端值风险）
 */
export function profitToScore(ratio: number | null): number | null {
  if (ratio === null) return null

  const high = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_HIGH
  const low = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_LOW
  const midLow = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_MID_LOW
  const midHigh = V6_CALCULATOR_THRESHOLDS.L8_CHIP_PROFIT_MID_HIGH

  if (ratio >= midLow && ratio <= midHigh) return 5
  if ((ratio >= low && ratio < midLow) || (ratio > midHigh && ratio <= high)) return 3
  return 1
}
