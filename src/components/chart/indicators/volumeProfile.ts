/**
 * Volume Profile (成交量分布) 计算引擎
 *
 * 对标 TradingView Volume Profile / Market Profile 指标。
 * 将指定时间段内的成交量按价格区间聚合，显示每个价格水平的成交量分布。
 *
 * 核心概念：
 * - POC (Point of Control): 成交量最大的价格水平
 * - VA (Value Area): 占总量 70% 的价格区间（TradingView 默认）
 * - VAH (Value Area High): VA 上边界
 * - VAL (Value Area Low): VA 下边界
 * - HVN (High Volume Node): 相对高成交量区域
 * - LVN (Low Volume Node): 相对低成交量区域（价格可能快速穿越）
 *
 * 专业用途：
 * - 识别支撑/阻力位：POC 和 VA 边界是强支撑/阻力
 * - 判断突破真伪：突破低成交量区域（LVN）→ 可能是假突破
 * - 评估持仓分布：价格在 VA 内 → 正常波动；价格在 VA 外 → 趋势可能延续
 * - 寻找交易机会：价格回到 POC 附近 → 高概率反转/反弹
 *
 * 计算复杂度：O(N)，适合实时处理。
 *
 * @module components/chart/indicators/volumeProfile
 * @created 2026-08-15
 */

import type { CandlestickChartData } from '../types'
import { getLogger } from '@/lib/logger'
import { CHART_INDICATOR_COLORS } from '@/constants/theme.tokens'

const logger = getLogger()

/** Volume Profile 计算参数 */
export interface VolumeProfileParams {
  /** 价格区间数量（柱数），默认 24 */
  rows?: number
  /** Value Area 百分比（默认 70，即 70% 成交量所在区间） */
  valueAreaPct?: number
  /** 自定义价格范围（可选，不指定则自动计算） */
  priceRange?: { high: number; low: number }
}

/** 单个价格柱 */
export interface VolumeProfileBar {
  /** 价格区间下界 */
  priceLow: number
  /** 价格区间上界 */
  priceHigh: number
  /** 价格区间中心 */
  priceMid: number
  /** 成交量 */
  volume: number
  /** 买入主动量（按收盘>开盘估算） */
  buyVolume: number
  /** 卖出主动量（按收盘<开盘估算） */
  sellVolume: number
  /** 占总成交量比例 */
  volumePct: number
  /** 是否为 POC */
  isPOC: boolean
  /** 是否在 VA 内 */
  isVA: boolean
}

/** Volume Profile 计算结果 */
export interface VolumeProfileResult {
  /** 价格柱列表 */
  bars: VolumeProfileBar[]
  /** POC 价格 */
  poc: number
  /** VAH (Value Area High) */
  vah: number
  /** VAL (Value Area Low) */
  val: number
  /** 总成交量 */
  totalVolume: number
  /** VA 总成交量 */
  vaVolume: number
  /** 价格区间宽度 */
  priceRangeWidth: number
  /** 每柱价格宽度 */
  tickSize: number
}

/** 默认 Volume Profile 参数 */
export const DEFAULT_VOLUME_PROFILE_PARAMS: Required<Omit<VolumeProfileParams, 'priceRange'>> = {
  rows: 24,
  valueAreaPct: 70,
}

/**
 * 计算 Volume Profile
 *
 * @param data K线数据
 * @param params 计算参数
 * @returns Volume Profile 结果
 */
export function computeVolumeProfile(
  data: CandlestickChartData[],
  params: VolumeProfileParams = {},
): VolumeProfileResult {
  const { rows, valueAreaPct, priceRange } = {
    ...DEFAULT_VOLUME_PROFILE_PARAMS,
    ...params,
  }

  logger.info('[VolumeProfile] 开始计算', {
    dataLength: data.length,
    rows,
    valueAreaPct,
  })

  if (data.length === 0 || data.every(d => (d.volume ?? 0) === 0)) {
    logger.warn('[VolumeProfile] 数据为空或成交量为零')
    return emptyResult()
  }

  // 确定价格范围
  let high = priceRange?.high ?? -Infinity
  let low = priceRange?.low ?? Infinity

  if (!priceRange) {
    for (const d of data) {
      if (d.high > high) high = d.high
      if (d.low < low) low = d.low
    }
  }

  if (high <= low) {
    logger.warn('[VolumeProfile] 价格范围无效')
    return emptyResult()
  }

  const tickSize = (high - low) / rows
  const bars: VolumeProfileBar[] = []

  // 初始化价格柱
  for (let i = 0; i < rows; i++) {
    bars.push({
      priceLow: low + i * tickSize,
      priceHigh: low + (i + 1) * tickSize,
      priceMid: low + (i + 0.5) * tickSize,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      volumePct: 0,
      isPOC: false,
      isVA: false,
    })
  }

  // 聚合成交量
  let totalVolume = 0
  for (const d of data) {
    const vol = d.volume ?? 0
    if (vol === 0) continue

    // 将 K 线的价格范围映射到对应的柱
    // 使用典型价格 (high+low+close)/3 作为主要分配依据
    const typicalPrice = (d.high + d.low + d.close) / 3
    const barIndex = Math.min(
      Math.floor((typicalPrice - low) / tickSize),
      rows - 1,
    )

    if (barIndex >= 0) {
      bars[barIndex]!.volume += vol
      totalVolume += vol

      // 估算买卖方向
      if (d.close >= d.open) {
        bars[barIndex]!.buyVolume += vol
      } else {
        bars[barIndex]!.sellVolume += vol
      }
    }
  }

  if (totalVolume === 0) {
    return emptyResult()
  }

  // 计算百分比
  for (const bar of bars) {
    bar.volumePct = (bar.volume / totalVolume) * 100
  }

  // 找 POC（最大成交量柱）
  let pocIndex = 0
  let maxVolume = 0
  for (let i = 0; i < bars.length; i++) {
    if (bars[i]!.volume > maxVolume) {
      maxVolume = bars[i]!.volume
      pocIndex = i
    }
  }
  const poc = bars[pocIndex]!.priceMid
  bars[pocIndex]!.isPOC = true

  // 计算 Value Area（从 POC 向上下扩展，直到累计占比达到 valueAreaPct%）
  const vaTarget = totalVolume * (valueAreaPct / 100)
  let vaVolume = bars[pocIndex]!.volume
  let vaHighIndex = pocIndex
  let vaLowIndex = pocIndex

  while (vaVolume < vaTarget) {
    const canExpandUp = vaHighIndex < bars.length - 1
    const canExpandDown = vaLowIndex > 0

    if (!canExpandUp && !canExpandDown) break

    const upVol = canExpandUp ? bars[vaHighIndex + 1]!.volume : 0
    const downVol = canExpandDown ? bars[vaLowIndex - 1]!.volume : 0

    if (upVol >= downVol && canExpandUp) {
      vaHighIndex++
      vaVolume += upVol
    } else if (canExpandDown) {
      vaLowIndex--
      vaVolume += downVol
    } else {
      vaHighIndex++
      vaVolume += upVol
    }
  }

  // 标记 VA 范围
  for (let i = vaLowIndex; i <= vaHighIndex; i++) {
    bars[i]!.isVA = true
  }

  const vah = bars[vaHighIndex]!.priceHigh
  const val = bars[vaLowIndex]!.priceLow

  logger.info('[VolumeProfile] 计算完成', {
    rows,
    totalVolume: totalVolume.toLocaleString('zh-CN'),
    poc: poc.toFixed(2),
    vah: vah.toFixed(2),
    val: val.toFixed(2),
    vaVolumePct: ((vaVolume / totalVolume) * 100).toFixed(1),
    tickSize: tickSize.toFixed(3),
  })

  return {
    bars,
    poc,
    vah,
    val,
    totalVolume,
    vaVolume,
    priceRangeWidth: high - low,
    tickSize,
  }
}

/** 空结果 */
function emptyResult(): VolumeProfileResult {
  return {
    bars: [],
    poc: 0,
    vah: 0,
    val: 0,
    totalVolume: 0,
    vaVolume: 0,
    priceRangeWidth: 0,
    tickSize: 0,
  }
}

/**
 * Volume Profile 颜色配置
 * 暗色主题，对标 TradingView Volume Profile 配色
 */
export const VOLUME_PROFILE_COLORS = {
  /** 柱体颜色（VA 内） */
  barVA: 'rgba(96, 165, 250, 0.65)',
  /** 柱体颜色（VA 外） */
  barOutside: 'rgba(96, 165, 250, 0.25)',
  /** POC 线颜色 */
  poc: CHART_INDICATOR_COLORS.amber,
  /** VAH 线颜色 */
  vah: 'rgba(239, 83, 80, 0.5)',
  /** VAL 线颜色 */
  val: 'rgba(38, 166, 154, 0.5)',
  /** 买入量颜色 */
  buyVolume: 'rgba(239, 83, 80, 0.4)',
  /** 卖出量颜色 */
  sellVolume: 'rgba(38, 166, 154, 0.4)',
} as const