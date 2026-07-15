/**
 * @fileoverview 统计计算基础库
 *
 * 提供 Pearson/Spearman 相关系数等纯统计函数，
 * 从 scoring/v6-engine/correlationAnalyzer 提取，
 * 供 output/、scoring/、data-sync-search/ 等模块复用。
 *
 * 遵循 AGENTS.md 分层规则：
 * - lib/ 仅可依赖 core/ 和 config/
 * - 禁止依赖 services/、store/、pages/、components/
 *
 * @module lib/statistics
 * @created 2026-07-15 - 消除跨服务依赖（P0 修复）
 */

/**
 * 计算 Pearson 相关系数
 *
 * r = Σ[(x-x̄)(y-ȳ)] / √[Σ(x-x̄)² · Σ(y-ȳ)²]
 *
 * @param x - 数组 X
 * @param y - 数组 Y
 * @returns Pearson r ∈ [-1, 1]，样本不足返回 0
 *
 * @example
 * pearsonCorrelation([1,2,3], [2,4,6]) // → 1 (完全正相关)
 */
export function pearsonCorrelation(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (let i = 0; i < n; i++) {
    const xi = x[i] ?? 0
    const yi = y[i] ?? 0
    sumX += xi
    sumY += yi
    sumXY += xi * yi
    sumX2 += xi * xi
    sumY2 += yi * yi
  }

  const numerator = n * sumXY - sumX * sumY
  const denomX = n * sumX2 - sumX * sumX
  const denomY = n * sumY2 - sumY * sumY
  const denominator = Math.sqrt(denomX * denomY)

  // Math.sqrt 无精度风险（正定二次型 ≥ 0）
  // denomX/denomY 在方差非零时为正，为零时 r 为 0（常数数组）
  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * 计算等级（排名）
 *
 * 相同值取平均等级（处理 ties）。
 *
 * @param values - 数值数组
 * @returns 等级数组（1-based）
 */
function computeRanks(values: readonly number[]): number[] {
  const indexed = values.map((v, i) => ({ value: v, index: i }))
  indexed.sort((a, b) => a.value - b.value)

  const ranks = new Array(values.length).fill(0)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1]?.value === indexed[i]?.value) {
      j++
    }
    const avgRank = (i + j) / 2 + 1 // 1-based 平均等级
    for (let k = i; k <= j; k++) {
      const idx = indexed[k]?.index
      if (idx !== undefined) ranks[idx] = avgRank
    }
    i = j + 1
  }
  return ranks
}

/**
 * 计算 Spearman 等级相关系数
 *
 * ρ = pearsonCorrelation(rank(x), rank(y))
 *
 * @param x - 数组 X
 * @param y - 数组 Y
 * @returns Spearman ρ ∈ [-1, 1]
 *
 * @example
 * spearmanCorrelation([1,2,3], [10,20,30]) // → 1 (完全单调正相关)
 */
export function spearmanCorrelation(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0

  const rankX = computeRanks(x.slice(0, n))
  const rankY = computeRanks(y.slice(0, n))
  return pearsonCorrelation(rankX, rankY)
}
