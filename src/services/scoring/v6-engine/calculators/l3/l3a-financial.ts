/**
 * L3a 财务健康计算器
 * 
 * 五维度财务因子：
 * - 营收增长（营收 YoY）
 * - 盈利能力（净利率/净利润）
 * - 现金流质量（经营现金流/净利润）
 * - 订单覆盖（在手订单/营收）
 * 
 * 权重：10%
 * 类型：确定性层（程序直算）
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator, RiskWarningResult, IPCResult } from '../../types'
import { LAYER_LABELS } from '../../types'
import { V6_CALCULATOR_THRESHOLDS } from '@/config/thresholds'
import { RISK_WARNINGS, IPC_CONFIG } from '../../config'
import { safeArrayGet } from '@/utils/precision'
import { clamp, type FinancialDimensionScore } from './utils'

const logger = getLogger()

/**
 * 财务多维度评分
 */
function scoreFinancialDimensions(input: LayerInput): FinancialDimensionScore {
  const { financials: f } = input

  // 营收增长
  let revenueScore = 3
  if (f.revenueYoY !== undefined) {
    if (f.revenueYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_REVENUE_YOY_TIER1) revenueScore = 5
    else if (f.revenueYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_REVENUE_YOY_TIER2) revenueScore = 4
    else if (f.revenueYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_REVENUE_YOY_TIER3) revenueScore = 3
    else if (f.revenueYoY >= 0) revenueScore = 2.5
    else revenueScore = 2
  }

  // 净利润增速
  let netProfitYoYScore = 3
  if (f.netProfitYoY !== undefined) {
    if (f.netProfitYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_PROFIT_YOY_TIER1) netProfitYoYScore = 5
    else if (f.netProfitYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_PROFIT_YOY_TIER2) netProfitYoYScore = 4
    else if (f.netProfitYoY > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_PROFIT_YOY_TIER3) netProfitYoYScore = 3
    else if (f.netProfitYoY >= 0) netProfitYoYScore = 2.5
    else netProfitYoYScore = 2
  }

  // 盈利能力（净利率）
  let profitabilityScore = 3
  if (f.netMargin !== undefined) {
    if (f.netMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_MARGIN_TIER1) profitabilityScore = 5
    else if (f.netMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_MARGIN_TIER2) profitabilityScore = 4
    else if (f.netMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_NET_MARGIN_TIER3) profitabilityScore = 3
    else if (f.netMargin >= 0) profitabilityScore = 2.5
    else profitabilityScore = 2
  } else if (f.netProfit !== undefined && f.netProfit < 0) {
    profitabilityScore = 2
  }

  // 毛利率趋势
  let grossMarginScore = 3
  if (f.grossMargin !== undefined) {
    if (f.grossMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_GROSS_MARGIN_TIER1) grossMarginScore = 5
    else if (f.grossMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_GROSS_MARGIN_TIER2) grossMarginScore = 4
    else if (f.grossMargin > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_GROSS_MARGIN_TIER3) grossMarginScore = 3
    else if (f.grossMargin >= 0) grossMarginScore = 2.5
    else grossMarginScore = 2
  }

  // 研发强度
  let rdRatioScore = 3
  if (f.rdRatio !== undefined) {
    if (f.rdRatio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_RD_RATIO_TIER1) rdRatioScore = 5
    else if (f.rdRatio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_RD_RATIO_TIER2) rdRatioScore = 4
    else if (f.rdRatio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_RD_RATIO_TIER3) rdRatioScore = 3
    else if (f.rdRatio >= 0) rdRatioScore = 2.5
    else rdRatioScore = 2
  }

  // 现金流
  let cashFlowScore = 3
  if (f.operatingCF !== undefined && f.netProfit !== undefined && f.netProfit > 0) {
    const ratio = f.operatingCF / f.netProfit
    if (ratio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_CASH_FLOW_RATIO_TIER1) cashFlowScore = 5
    else if (ratio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_CASH_FLOW_RATIO_TIER2) cashFlowScore = 4
    else if (ratio > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_CASH_FLOW_RATIO_TIER3) cashFlowScore = 3
    else cashFlowScore = 2
  } else if (f.operatingCF !== undefined && f.operatingCF < 0) {
    cashFlowScore = 1.5
  }

  // 订单
  let ordersScore = 3
  if (f.ordersInHand !== undefined && f.revenue !== undefined) {
    const ocr = f.ordersInHand / (f.revenue || 1)
    if (ocr > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_OCR_TIER1) ordersScore = 5
    else if (ocr > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_OCR_TIER2) ordersScore = 4
    else if (ocr > V6_CALCULATOR_THRESHOLDS.L3_FINANCE_OCR_TIER3) ordersScore = 3
    else ordersScore = 2
  } else if (f.newOrders !== undefined && f.newOrders > 0) {
    ordersScore = 3.5
  }

  return {
    revenue: revenueScore,
    netProfitYoY: netProfitYoYScore,
    profitability: profitabilityScore,
    grossMargin: grossMarginScore,
    rdRatio: rdRatioScore,
    cashFlow: cashFlowScore,
    orders: ordersScore,
  }
}

/**
 * 风险预警评估
 */
function evaluateRiskWarnings(input: LayerInput): RiskWarningResult {
  const { financials: f } = input
  const redDetails: string[] = []
  const yellowDetails: string[] = []

  // 红色预警
  // 经营现金流连续两季为负
  if (f.operatingCF !== undefined && f.operatingCF < 0) {
    redDetails.push(safeArrayGet(RISK_WARNINGS.red, 0, ''))
  }

  // 应收账款增速 > 营收增速50%+
  if (f.receivables !== undefined && f.revenue !== undefined && f.revenueYoY !== undefined) {
    const arRatio = f.receivables / (f.revenue || 1)
    if (arRatio > V6_CALCULATOR_THRESHOLDS.L3_RISK_AR_RATIO) {
      redDetails.push(safeArrayGet(RISK_WARNINGS.red, 1, ''))
    }
  }

  // 存货周转天数同比延长 > 30天
  if (f.inventoryTurnoverDays !== undefined && f.inventoryTurnoverDays > V6_CALCULATOR_THRESHOLDS.L3_RISK_INVENTORY_DAYS) {
    redDetails.push(safeArrayGet(RISK_WARNINGS.red, 2, ''))
  }

  // 大股东质押 > 50%
  if (f.shareholderPledge !== undefined && f.shareholderPledge > V6_CALCULATOR_THRESHOLDS.L3_RISK_PLEDGE_RATIO) {
    redDetails.push(safeArrayGet(RISK_WARNINGS.red, 3, ''))
  }

  // 审计非标意见
  const opinion = f.auditOpinion ?? ''
  if (opinion.includes('非标准') || opinion.includes('否定意见') || opinion.includes('无法表示') ||
      (opinion.includes('保留意见') && !opinion.includes('无保留意见'))) {
    redDetails.push(safeArrayGet(RISK_WARNINGS.red, 4, ''))
  }

  // 黄色预警
  // 毛利率连续两季下滑
  if (f.grossMargin !== undefined && f.grossMargin < V6_CALCULATOR_THRESHOLDS.L3_RISK_GROSS_MARGIN_LOW) {
    yellowDetails.push(safeArrayGet(RISK_WARNINGS.yellow, 0, ''))
  }

  // 有息负债增速 > 资产增速
  if (f.interestBearingDebt !== undefined && f.netAssets !== undefined && f.interestBearingDebt > f.netAssets * V6_CALCULATOR_THRESHOLDS.L3_RISK_DEBT_ASSET_RATIO) {
    yellowDetails.push(safeArrayGet(RISK_WARNINGS.yellow, 1, ''))
  }

  // 商誉/净资产 > 30%
  if (f.goodwill !== undefined && f.netAssets !== undefined && f.netAssets > 0) {
    if (f.goodwill / f.netAssets > V6_CALCULATOR_THRESHOLDS.L3_RISK_GOODWILL_NET_ASSETS) {
      yellowDetails.push(safeArrayGet(RISK_WARNINGS.yellow, 2, ''))
    }
  }

  // 客户集中度TOP5 > 50%
  if (f.customerConcentration !== undefined && f.customerConcentration > V6_CALCULATOR_THRESHOLDS.L3_RISK_CUSTOMER_CONCENTRATION) {
    yellowDetails.push(safeArrayGet(RISK_WARNINGS.yellow, 3, ''))
  }

  return {
    redCount: redDetails.length,
    yellowCount: yellowDetails.length,
    redDetails,
    yellowDetails,
  }
}

/**
 * IPC 业绩兑现临界点评估
 */
function evaluateIPC(input: LayerInput, l1Score: number, l2Score: number): IPCResult {
  const { financials: f } = input
  const events = input.zeroToOneEvents ?? []
  const cfg = IPC_CONFIG

  // --- OCR 维度 ---
  let ocrScore = 0
  if (f.ordersInHand !== undefined && f.revenue !== undefined && f.revenue > 0) {
    const ocr = f.ordersInHand / f.revenue
    if (ocr >= cfg.ocr.superStrong) ocrScore = 5
    else if (ocr >= cfg.ocr.strong) ocrScore = 4
    else if (ocr >= cfg.ocr.medium) ocrScore = 3
    else if (ocr >= cfg.ocr.weak) ocrScore = 2
    else ocrScore = 1
  }

  // --- MCE 维度 ---
  let mceScore = 0
  if (events.length > 0) {
    for (const evt of events) {
      const mce = evt.mce ?? 1
      // 时效性衰减
      let decay = 1.0
      if (evt.monthsAgo > V6_CALCULATOR_THRESHOLDS.L3_IPC_MONTHS_DECAY_12M) decay = 0
      else if (evt.monthsAgo > V6_CALCULATOR_THRESHOLDS.L3_IPC_MONTHS_DECAY_6M) decay = cfg.mce.decay12m
      else if (evt.monthsAgo > V6_CALCULATOR_THRESHOLDS.L3_IPC_MONTHS_DECAY_3M) decay = cfg.mce.decay6m

      let rawScore = 0
      if (mce >= cfg.mce.trackLevel) rawScore = 5
      else if (mce >= cfg.mce.categoryLevel) rawScore = 4
      else if (mce >= cfg.mce.segmentLevel) rawScore = 3
      else rawScore = 2

      const adjusted = rawScore * decay
      if (adjusted > mceScore) mceScore = adjusted
    }
  }

  // --- TIMS 维度 ---
  let timsScore = 3 // 默认中等
  const sector = (input.stock.sector ?? '').toLowerCase()
  const isTech = sector.includes('芯片') || sector.includes('半导体') || sector.includes('ai') || sector.includes('科技')

  if (isTech && l1Score >= 4) {
    timsScore = 5 // 技术+护城河双强
  } else if (isTech && l1Score >= 3) {
    timsScore = 4
  } else if (l1Score >= 4) {
    timsScore = 4
  } else if (l1Score >= 3) {
    timsScore = 3
  } else {
    timsScore = 2
  }

  // L2 竞品压制：竞品得分 ≤ 2.5 → 市占率上限
  if (l2Score <= V6_CALCULATOR_THRESHOLDS.L3_IPC_L2_SUPPRESS_THRESHOLD && timsScore > 3) {
    timsScore = Math.max(3, timsScore - 1)
  }

  // L1 护城河 ≥ 4 → TIMS 技术迭代系数自动 +0.5
  if (l1Score >= V6_CALCULATOR_THRESHOLDS.L3_IPC_L1_MOAT_BOOST_THRESHOLD && timsScore < 5) {
    timsScore += 0.5
  }

  // --- IPC 综合 ---
  const ipcScore = ocrScore * cfg.ipcWeights.ocr + mceScore * cfg.ipcWeights.mce + timsScore * cfg.ipcWeights.tims

  let stage: IPCResult['stage'] = 'none'
  let stageLabel = '无法判定'
  let l3Bonus = 0

  if (ipcScore >= cfg.ipcStages.broken) {
    stage = 'broken'
    stageLabel = '✅ 临界点已突破 — 订单充裕+事件落地+技术转化，业绩加速确认'
    l3Bonus = 1.0
  } else if (ipcScore >= cfg.ipcStages.near) {
    stage = 'near'
    stageLabel = '🔶 临界点附近（最佳击球区） — 2/3维度共振，业绩拐点在未来1-2季'
    l3Bonus = 0.5
  } else if (ipcScore >= cfg.ipcStages.before) {
    stage = 'before'
    stageLabel = '🔸 临界点前夜 — 单一维度发出信号，需等待第二重确认'
    l3Bonus = 0.0
  } else if (ipcScore >= cfg.ipcStages.far) {
    stage = 'far'
    stageLabel = '🔹 临界点遥远 — 各维度暂无明显信号，业绩兑现路径模糊'
    l3Bonus = -0.5
  } else {
    stage = 'none'
    stageLabel = '⬜ 未到临界点 — 无订单、无事件、无技术优势'
    l3Bonus = -1.0
  }

  return {
    ocrScore: Math.round(ocrScore * 100) / 100,
    mceScore: Math.round(mceScore * 100) / 100,
    timsScore: Math.round(timsScore * 100) / 100,
    ipcScore: Math.round(ipcScore * 100) / 100,
    stage,
    stageLabel,
    l3Bonus,
  }
}

/**
 * L3a 财务健康计算器
 */
export const L3aFinancialCalculator: LayerCalculator = {
  layerId: 'l3f' as const,

  async calculate(input: LayerInput): Promise<LayerScore> {
    const { stock, config } = input
    const weight = config.weights.l3f
    const risks: string[] = []
    const evidence: string[] = []

    try {
      // 1. 多维度评分（7维度）
      const dims = scoreFinancialDimensions(input)
      const baseScore = (dims.revenue + dims.netProfitYoY + dims.profitability + dims.grossMargin + dims.rdRatio + dims.cashFlow + dims.orders) / 7

      evidence.push(
        `营收增长: ${dims.revenue}/5`,
        `净利润增速: ${dims.netProfitYoY}/5`,
        `盈利: ${dims.profitability}/5`,
        `毛利率: ${dims.grossMargin}/5`,
        `研发强度: ${dims.rdRatio}/5`,
        `现金流: ${dims.cashFlow}/5`,
        `订单: ${dims.orders}/5`,
      )

      // 2. 风险预警
      const riskResult = evaluateRiskWarnings(input)
      const riskPenalty = riskResult.redCount * V6_CALCULATOR_THRESHOLDS.L3_FINANCE_RISK_RED_PENALTY + riskResult.yellowCount * V6_CALCULATOR_THRESHOLDS.L3_FINANCE_RISK_YELLOW_PENALTY
      risks.push(...riskResult.redDetails.map((r: string) => `[红色预警] ${r}`))
      risks.push(...riskResult.yellowDetails.map((r: string) => `[黄色预警] ${r}`))

      // 3. IPC 临界点（需要 L1/L2 得分，这里用默认值）
      const ipc = evaluateIPC(input, 3, 3)

      // 最终得分
      const score = clamp(baseScore - riskPenalty + ipc.l3Bonus)

      logger.info(`[L3a] ${stock.symbol}: base=${baseScore.toFixed(2)}, risk=${riskPenalty.toFixed(2)}, ipc=${ipc.ipcScore.toFixed(2)}(+${ipc.l3Bonus}), score=${score.toFixed(2)}`)

      const summaryParts: string[] = [
        `财务五维均值 ${baseScore.toFixed(1)}/5`,
        riskResult.redCount > 0 ? `红色预警 ${riskResult.redCount} 项` : '',
        riskResult.yellowCount > 0 ? `黄色预警 ${riskResult.yellowCount} 项` : '',
        ipc.stage !== 'none' ? `${ipc.stageLabel}` : '',
      ]
      const summary = summaryParts.filter(Boolean).join(' | ')

      if (ipc.stage !== 'none') {
        evidence.push(`IPC: OCR=${ipc.ocrScore}, MCE=${ipc.mceScore}, TIMS=${ipc.timsScore}, IPC=${ipc.ipcScore}, 阶段=${ipc.stage}`)
      }

      return {
        layerId: 'l3f',
        layerName: LAYER_LABELS.l3f ?? 'L3a 财务健康',
        score: Math.round(score * 100) / 100,
        summary,
        risks,
        evidence,
        weight,
        weightedScore: score * weight,
        dataSources: ['财报API', '行情数据', '公司公告'],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[L3a] ${stock.symbol}: 计算失败: ${msg}`)
      return {
        layerId: 'l3f',
        layerName: LAYER_LABELS.l3f ?? 'L3a 财务健康',
        score: 0,
        summary: `财务评分计算失败: ${msg}`,
        risks: [],
        evidence: [],
        weight,
        weightedScore: 0,
        dataSources: [],
      }
    }
  },
}
