/**
 * 两阶段 DDM 股利贴现模型
 *
 * 用于 L3v 估值层的深度估值计算，基于历史分红数据预测未来股利。
 *
 * 模型假设：
 * - 第一阶段（高增长期）: 3-5 年，股利按 g1 增长
 * - 第二阶段（永续期）: 此后永续按 g2 增长
 * - 折现率 r = 无风险利率 + 股权风险溢价
 *
 * P0-1 补充：维度15 分红股本数据已采集，此前未消费形成"数据孤岛"
 * P1-1 实现：独立两阶段 DDM 工具函数，可被 L3v 估值层直接调用
 *
 * @module services/scoring/v6-engine/calculators/l3/ddm
 * @created 2026-08-17 P1-1
 * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-066]
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 分红记录 */
export interface DdmDividendRecord {
  /** 除权除息日 */
  exDividendDate: string
  /** 每股派息（税前，元） */
  cashDividendPerShare: number
}

/** DDM 模型输入参数 */
export interface DdmInput {
  /** 当前股价 */
  currentPrice: number
  /** 历史分红记录（近 5 年，按时间倒序） */
  dividendHistory: DdmDividendRecord[]
  /** 总股本（亿股） */
  totalShares: number
  /** 近 3 年分红率（%） */
  payoutRatio3Y: number
  /** 第一阶段增长率（可选，默认从历史推导） */
  g1?: number
  /** 第二阶段永续增长率（可选，默认 3%） */
  g2?: number
  /** 折现率（可选，默认 8%） */
  r?: number
  /** 第一阶段年数（可选，默认 3） */
  stage1Years?: number
}

/** DDM 模型输出 */
export interface DdmOutput {
  /** 每股内在价值 */
  intrinsicValuePerShare: number
  /** 当前股价 */
  currentPrice: number
  /** 安全边际（(内在价值-当前股价)/内在价值，%） */
  marginOfSafety: number
  /** 估值判断 */
  valuation: 'undervalued' | 'fair' | 'overvalued'
  /** DDM 评分（0-5） */
  ddmScore: number
  /** 第一阶段增长率 */
  g1: number
  /** 第二阶段增长率 */
  g2: number
  /** 折现率 */
  r: number
  /** 推导过程 */
  derivation: string[]
}

// ============================================================
// 默认参数
// ============================================================

const DEFAULTS = {
  /** 默认折现率（无风险利率 3% + 股权风险溢价 5%） */
  DISCOUNT_RATE: 0.08,
  /** 默认永续增长率 */
  PERPETUAL_GROWTH: 0.03,
  /** 默认第一阶段年数 */
  STAGE1_YEARS: 3,
  /** 增长率上限（防止异常值） */
  MAX_GROWTH: 0.25,
  /** 增长率下限 */
  MIN_GROWTH: -0.10,
  /** 安全边际阈值：低估 */
  MOS_UNDERVALUED: 20,
  /** 安全边际阈值：高估 */
  MOS_OVERVALUED: -10,
}

// ============================================================
// 核心计算
// ============================================================

/**
 * 从历史分红推导第一阶段增长率
 * 使用近 3 年历史分红数据的 CAGR
 */
function deriveGrowthRate(history: DdmDividendRecord[]): number {
  if (history.length < 2) {
    return DEFAULTS.PERPETUAL_GROWTH
  }

  // 按时间排序（升序）
  const sorted = [...history].sort(
    (a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime(),
  )

  const valid = sorted.filter(d => d.cashDividendPerShare > 0)
  if (valid.length < 2) {
    return DEFAULTS.PERPETUAL_GROWTH
  }

  // 取最近 3 年数据
  const recent = valid.slice(-3)
  const firstDps = recent[0]?.cashDividendPerShare ?? 0
  const lastDps = recent[recent.length - 1]?.cashDividendPerShare ?? 0
  const years = recent.length - 1

  if (firstDps <= 0 || years <= 0) {
    return DEFAULTS.PERPETUAL_GROWTH
  }

  // CAGR = (last/first)^(1/years) - 1
  const cagr = Math.pow(lastDps / firstDps, 1 / years) - 1

  return Math.max(DEFAULTS.MIN_GROWTH, Math.min(DEFAULTS.MAX_GROWTH, cagr))
}

/**
 * 计算两阶段 DDM 内在价值
 *
 * 第一阶段: PV1 = Σ_{t=1}^{n} DPS₀ × (1+g₁)ᵗ / (1+r)ᵗ
 * 第二阶段: TV = DPSₙ₊₁ / (r - g₂)  →  PV_TV = TV / (1+r)ⁿ
 * 内在价值 = PV1 + PV_TV
 */
function calculateIntrinsicValue(
  dps0: number,
  g1: number,
  g2: number,
  r: number,
  n: number,
): { intrinsicValue: number; derivation: string[] } {
  const derivation: string[] = []
  derivation.push(`基础每股股利 DPS₀ = ${dps0.toFixed(4)} 元`)
  derivation.push(`第一阶段增长率 g₁ = ${(g1 * 100).toFixed(1)}%`)
  derivation.push(`第二阶段永续增长率 g₂ = ${(g2 * 100).toFixed(1)}%`)
  derivation.push(`折现率 r = ${(r * 100).toFixed(1)}%`)
  derivation.push(`第一阶段年数 n = ${n}`)

  // 第一阶段：高增长期股利折现
  let pv1 = 0
  let dps = dps0
  for (let t = 1; t <= n; t++) {
    dps = dps * (1 + g1)
    const pv = dps / Math.pow(1 + r, t)
    pv1 += pv
    derivation.push(`  第${t}年: DPS = ${dps.toFixed(4)}, PV = ${pv.toFixed(4)}`)
  }

  // 第二阶段：永续期终值
  const dpsN1 = dps * (1 + g2) // 第 n+1 年股利
  const terminalValue = dpsN1 / (r - g2) // 永续年金终值
  const pvTV = terminalValue / Math.pow(1 + r, n) // 终值折现

  derivation.push(`永续期: DPSₙ₊₁ = ${dpsN1.toFixed(4)}, 终值 TV = ${terminalValue.toFixed(2)}`)
  derivation.push(`终值折现 PV_TV = ${pvTV.toFixed(2)}`)

  const intrinsicValue = pv1 + pvTV
  derivation.push(`第一阶段 PV₁ = ${pv1.toFixed(2)}`)
  derivation.push(`第二阶段 PV_TV = ${pvTV.toFixed(2)}`)
  derivation.push(`内在价值 = ${intrinsicValue.toFixed(2)}`)

  return { intrinsicValue, derivation }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * DDM 安全边际 → 评分映射（扁平化：早退守卫替代多段 else-if）
 */
function mapDdmScore(marginOfSafety: number): number {
  if (marginOfSafety >= 30) return 5.0
  if (marginOfSafety >= 20) return 4.5
  if (marginOfSafety >= 10) return 4.0
  if (marginOfSafety >= 0) return 3.0
  if (marginOfSafety >= -10) return 2.0
  return 1.0
}

/**
 * 执行两阶段 DDM 估值
 *
 * @param input DDM 模型输入参数
 * @returns DDM 估值结果
 */
export function calculateDdm(input: DdmInput): DdmOutput {
  const r = input.r ?? DEFAULTS.DISCOUNT_RATE
  const g2 = input.g2 ?? DEFAULTS.PERPETUAL_GROWTH
  const stage1Years = input.stage1Years ?? DEFAULTS.STAGE1_YEARS

  // 从历史推导第一阶段增长率
  const g1 = input.g1 ?? deriveGrowthRate(input.dividendHistory)

  // 当前每股股利：取最近一次分红
  const sorted = [...input.dividendHistory].sort(
    (a, b) => new Date(b.exDividendDate).getTime() - new Date(a.exDividendDate).getTime(),
  )
  const latestDps = sorted[0]?.cashDividendPerShare ?? 0

  if (latestDps <= 0) {
    logger.warn('[DDM] 无有效分红数据，无法计算内在价值')
    return {
      intrinsicValuePerShare: input.currentPrice, // 无法估值时返回当前股价
      currentPrice: input.currentPrice,
      marginOfSafety: 0,
      valuation: 'fair',
      ddmScore: 2.5,
      g1,
      g2,
      r,
      derivation: ['无有效分红数据，DDM 无法估值'],
    }
  }

  const { intrinsicValue, derivation } = calculateIntrinsicValue(latestDps, g1, g2, r, stage1Years)

  const currentPrice = input.currentPrice || 1
  const marginOfSafety = ((intrinsicValue - currentPrice) / intrinsicValue) * 100

  let valuation: DdmOutput['valuation'] = 'fair'
  if (marginOfSafety >= DEFAULTS.MOS_UNDERVALUED) {
    valuation = 'undervalued'
  } else if (marginOfSafety <= DEFAULTS.MOS_OVERVALUED) {
    valuation = 'overvalued'
  }

  derivation.push(`当前股价: ${currentPrice.toFixed(2)}`)
  derivation.push(`安全边际: ${marginOfSafety.toFixed(1)}%`)
  derivation.push(`估值判断: ${valuation === 'undervalued' ? '低估' : valuation === 'overvalued' ? '高估' : '合理'}`)

  // DDM 评分映射
  const ddmScore = mapDdmScore(marginOfSafety)

  return {
    intrinsicValuePerShare: Math.round(intrinsicValue * 100) / 100,
    currentPrice,
    marginOfSafety: Math.round(marginOfSafety * 100) / 100,
    valuation,
    ddmScore,
    g1,
    g2,
    r,
    derivation,
  }
}

/**
 * 从 L3v 估值层的 DDM 折价结果生成 DDM 评分
 * 用于 L3v 计算器的 scoreDdmDividend 函数中获取更精确的估值
 *
 * @param currentPrice 当前股价
 * @param dividendHistory 历史分红记录
 * @param totalShares 总股本
 * @param payoutRatio3Y 近 3 年分红率
 * @returns DDM 评分（0-5）
 */
export function getDdmScore(
  currentPrice: number,
  dividendHistory: DdmDividendRecord[],
  totalShares: number,
  payoutRatio3Y: number,
): DdmOutput {
  return calculateDdm({
    currentPrice,
    dividendHistory,
    totalShares,
    payoutRatio3Y,
  })
}