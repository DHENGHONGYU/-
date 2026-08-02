/**
 * @module portfolioMetrics
 * @description 组合风险指标纯函数（跨模块业务计算，位于 lib/utils 白名单目录）。
 *
 * 用途：PortfolioOverviewWidget 从真实权益曲线（equityCurve）计算「最大回撤」与
 * 「夏普比率」，取代原先硬编码的 `0%` / `0.0` 占位（dataflow-bridge-audit B1 / P0）。
 *
 * 设计约束：
 * - 纯函数、无副作用、无外部依赖，便于单元测试与双向验证。
 * - 空曲线或长度 < 2 时返回 0（调用方据此显式展示「数据不足」）。
 * - 夏普比率默认按「每期、未年化」口径计算（periodsPerYear=1），避免除零；
 *   需要年化时传入 periodsPerYear（如日频 252）。
 *
 * @doc [V9-DOC-DATA-032, V9-DOC-PROD-001]
 */

/**
 * 由权益曲线计算最大回撤（百分比，0 表示无回撤）。
 * 最大回撤 = 曲线上任意历史峰值到其后最低点的跌幅最大值。
 */
export function computeMaxDrawdown(equityCurve: number[]): number {
  if (!Array.isArray(equityCurve) || equityCurve.length < 2) return 0
  let peak = equityCurve[0]!
  let maxDrawdown = 0
  for (const v of equityCurve) {
    if (v > peak) peak = v
    if (peak > 0) {
      const drawdown = (peak - v) / peak
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
  }
  return maxDrawdown * 100
}

/**
 * 由权益曲线计算每期收益率序列：r_i = (v_i - v_{i-1}) / v_{i-1}。
 * 前值为 0 时跳过该点（避免除零）。
 */
export function computePeriodReturns(equityCurve: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!
    if (prev !== 0) returns.push((equityCurve[i]! - prev) / prev)
  }
  return returns
}

/**
 * 计算夏普比率（风险调整后收益）。
 * @param equityCurve 权益曲线
 * @param riskFreeRatePerPeriod 每期无风险利率，默认 0
 * @param periodsPerYear 年化系数（日频 252 / 周频 52 / 月频 12），默认 1（未年化）
 * @returns 夏普比率；无波动（std=0）或序列过短时返回 0
 */
export function computeSharpeRatio(
  equityCurve: number[],
  riskFreeRatePerPeriod = 0,
  periodsPerYear = 1,
): number {
  const returns = computePeriodReturns(equityCurve)
  if (returns.length < 2) return 0
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  const perPeriod = (mean - riskFreeRatePerPeriod) / std
  return periodsPerYear === 1 ? perPeriod : perPeriod * Math.sqrt(periodsPerYear)
}
