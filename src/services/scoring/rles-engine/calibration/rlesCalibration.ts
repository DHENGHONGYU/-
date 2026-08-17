/**
 * RLES 权重标定引擎（Calibration）
 *
 * 把 runBacktest 的 BacktestResult 转化为可决策的「因子有效性判定 + 权重建议」：
 *  - detectedEdge  = 二波命中组 vs 未命中组的均值收益差（验证二波信号是否真带来超额）
 *  - tierEdge      = priority(≥80) vs cautious(<60) 的均值收益差（验证分流是否真区分度）
 *  - ic            = timingScore 与前向收益的 Spearman 秩相关（变量整体预测力）
 *  - verdict       = 综合上述三项的强弱判定
 *  - weightSuggestion = 基于 verdict 给出 WEIGHTS / 加成系数的调整方向
 *
 * 设计来源：deliverables/rles-backtest-calibration.md §5（标定口径）。
 * 数据来源：注入式样本篮（buildSampleBasket）或真实 runLiveBacktest 结果。
 */

import type { BacktestConfig, BacktestResult, BacktestTierStat } from '../rlesBacktest'
import { runBacktest } from '../rlesBacktest'
import type { BasketEntry } from './sampleBasket'
import { buildSampleBasket } from './sampleBasket'

export type CalibrationVerdict = 'strong' | 'moderate' | 'weak' | 'invalid'

export interface CalibrationReport {
  basketName: string
  forwardDays: number
  /** 全样本统计 */
  overallWinRate: number
  overallAvgReturn: number
  ic: number
  /** 二波信号增量有效性 */
  detectedEdge: number
  detectedWinRateEdge: number
  /** tier 分流有效性 */
  tierEdge: number
  /** 二波强度四分位单调性（Q4 均值收益 - Q1 均值收益） */
  quartileMonotonicity: number
  verdict: CalibrationVerdict
  weightSuggestion: string
  raw: BacktestResult
}

function safeGet(arr: BacktestTierStat[] | undefined, bucket: string): BacktestTierStat {
  const found = (arr ?? []).find((b) => b.bucket === bucket)
  return found ?? { bucket, count: 0, winRate: 0, avgReturn: 0, avgSignal: 0 }
}

export function buildCalibrationReport(
  basketName: string,
  result: BacktestResult,
): CalibrationReport {
  const det = result.byDetected.detected
  const not = result.byDetected.notDetected
  const pri = safeGet(result.byTimingTier, 'priority(≥80)')
  const cau = safeGet(result.byTimingTier, 'cautious(<60)')
  const quartiles = result.byStrengthQuartile
  const q4 = quartiles[quartiles.length - 1]
  const q1 = quartiles[0]

  const detectedEdge = det.avgReturn - not.avgReturn
  const detectedWinRateEdge = det.winRate - not.winRate
  const tierEdge = pri.avgReturn - cau.avgReturn
  const quartileMonotonicity = (q4?.avgReturn ?? 0) - (q1?.avgReturn ?? 0)

  // 综合判定
  const icStrong = result.overall.ic >= 0.2
  const icModerate = result.overall.ic >= 0.1
  const edgePositive = detectedEdge > 0 && tierEdge > 0
  const monotonePositive = quartileMonotonicity > 0

  let verdict: CalibrationVerdict
  let weightSuggestion: string
  if (edgePositive && monotonePositive && icStrong) {
    verdict = 'strong'
    weightSuggestion =
      '二波+筹码因子方向正确、分位单调、IC 显著。建议：保持 D3 中 secondWave 加成（+12 强波 / +8 ma5 回踩），' +
      '并将 D3 权重维持 0.40；后续用真实样本回测微调加成系数。'
  } else if (edgePositive && (icModerate || monotonePositive)) {
    verdict = 'moderate'
    weightSuggestion =
      '因子方向正确但区分度/IC 中等。建议：保持二波加成，但将 D3 中 secondWave 权重从 0.13 下调至 0.08 观察，' +
      '并补充真实样本验证后再放开。'
  } else if (edgePositive) {
    verdict = 'weak'
    weightSuggestion =
      '因子方向为正但统计微弱。建议：二波加成减半（+6 强波），以信息列而非强信号呈现，待真实样本增强说服力。'
  } else {
    verdict = 'invalid'
    weightSuggestion =
      '因子未显示正向超额，当前权重假设不被支持。建议：暂停 secondWave 加成（置 0），复核检测器阈值与样本构造，' +
      '或改用真实行情样本重标。'
  }

  return {
    basketName,
    forwardDays: result.forwardDays,
    overallWinRate: result.overall.winRate,
    overallAvgReturn: result.overall.avgReturn,
    ic: result.overall.ic,
    detectedEdge,
    detectedWinRateEdge,
    tierEdge,
    quartileMonotonicity,
    verdict,
    weightSuggestion,
    raw: result,
  }
}

/** 从注入式样本篮运行标定（默认用 buildSampleBasket 多形态代理样本）。 */
export function runCalibration(
  basket?: BasketEntry[],
  config?: BacktestConfig,
  basketName = 'synthetic-multi-shape',
): CalibrationReport {
  const data = basket ?? buildSampleBasket()
  const result = runBacktest(
    data.map((e) => ({ symbol: e.symbol, bars: e.bars })),
    config,
  )
  return buildCalibrationReport(basketName, result)
}

/** 文本化报告（便于日志 / 终端输出） */
export function formatCalibrationReport(r: CalibrationReport): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  const lines = [
    `=== RLES 权重标定报告（${r.basketName}）===`,
    `持有期 forwardDays = ${r.forwardDays}`,
    `全样本：胜率 ${pct(r.overallWinRate)} | 均值收益 ${pct(r.overallAvgReturn)} | IC ${r.ic.toFixed(3)}`,
    `二波增量：均值收益差 ${pct(r.detectedEdge)} | 胜率差 ${pct(r.detectedWinRateEdge)}`,
    `Tier 分流：priority-cautious 均值收益差 ${pct(r.tierEdge)}`,
    `四分位单调：Q4-Q1 均值收益差 ${pct(r.quartileMonotonicity)}`,
    `判定 verdict = ${r.verdict.toUpperCase()}`,
    `权重建议：${r.weightSuggestion}`,
  ]
  return lines.join('\n')
}
