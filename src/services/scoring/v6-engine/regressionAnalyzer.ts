/**
 * @fileoverview 多元线性回归分析器（OLS）
 *
 * 实现最小二乘法多元线性回归，输出：
 * - 回归系数（β）
 * - 标准误（SE）
 * - t 统计量与 p 值
 * - R² 与 Adjusted R²
 * - F 统计量与整体 p 值
 * - 方差膨胀因子（VIF）
 *
 * @module services/scoring/v6-engine/regressionAnalyzer
 * @created 2026-07-14 - 统计因子体系构建
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 矩阵运算工具
// ============================================================

/** 矩阵转置 */
function transpose(m: readonly (readonly number[])[]): number[][] {
  if (m.length === 0) return []
  const rows = m.length
  const cols = m[0]?.length ?? 0
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0))
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j]![i] = m[i]![j] ?? 0
    }
  }
  return result
}

/** 矩阵乘法 */
function multiply(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number[][] {
  const rowsA = a.length
  const colsA = a[0]?.length ?? 0
  const colsB = b[0]?.length ?? 0
  const result: number[][] = Array.from({ length: rowsA }, () => new Array(colsB).fill(0))
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0
      for (let k = 0; k < colsA; k++) {
        sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0)
      }
      result[i]![j] = sum
    }
  }
  return result
}

/** 矩阵求逆（高斯-约旦消元法） */
function inverse(m: readonly (readonly number[])[]): number[][] | null {
  const n = m.length
  if (n === 0) return null
  if (m[0]?.length !== n) return null

  // 构造增广矩阵 [A | I]
  const aug: number[][] = m.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])

  // 前向消元
  for (let col = 0; col < n; col++) {
    // 找主元
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]?.[col] ?? 0) > Math.abs(aug[maxRow]?.[col] ?? 0)) {
        maxRow = row
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!]

    const pivot = aug[col]?.[col] ?? 0
    if (Math.abs(pivot) < 1e-12) return null // 奇异矩阵

    for (let j = 0; j < 2 * n; j++) {
      aug[col]![j] = (aug[col]![j] ?? 0) / pivot
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row]?.[col] ?? 0
      for (let j = 0; j < 2 * n; j++) {
        aug[row]![j] = (aug[row]![j] ?? 0) - factor * (aug[col]![j] ?? 0)
      }
    }
  }

  return aug.map(row => row.slice(n))
}

// ============================================================
// 统计分布
// ============================================================

/** Student-t 分布 CDF 近似（使用正态近似当 df > 30） */
function tCDF(t: number, df: number): number {
  if (df > 30) {
    // 正态近似
    return 0.5 * (1 + erf(t / Math.SQRT2))
  }
  // 小样本近似：使用级数展开（简化版）
  const x = df / (df + t * t)
  let sum = 0
  for (let i = 0; i < 50; i++) {
    const term = Math.pow(x, i) * betaFunction(i, df / 2) / betaFunction(i + 0.5, df / 2)
    sum += term
    if (Math.abs(term) < 1e-10) break
  }
  return 0.5 + 0.5 * Math.sign(t) * (1 - 0.5 * sum)
}

/** 误差函数近似（Abramowitz & Stegun） */
function erf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

/** Beta 函数近似（Stirling） */
function betaFunction(a: number, b: number): number {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b))
}

/** Log Gamma 函数（Lanczos 近似） */
function logGamma(x: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]!
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** 计算 p 值（双侧） */
export function computePValue(tStat: number, df: number): number {
  if (Number.isNaN(tStat) || df <= 0) return 1
  const cdf = tCDF(tStat, df)
  return 2 * Math.min(cdf, 1 - cdf)
}

// ============================================================
// 回归分析
// ============================================================

/** 回归结果 */
export interface RegressionResult {
  /** 回归系数（含截距） */
  coefficients: number[]
  /** 系数名称 */
  coefficientNames: string[]
  /** 标准误 */
  standardErrors: number[]
  /** t 统计量 */
  tStatistics: number[]
  /** p 值（双侧） */
  pValues: number[]
  /** R² */
  rSquared: number
  /** Adjusted R² */
  adjustedRSquared: number
  /** F 统计量 */
  fStatistic: number
  /** F 检验 p 值 */
  fPValue: number
  /** 残差 */
  residuals: number[]
  /** 样本数 */
  n: number
  /** 自变量数（不含截距） */
  k: number
  /** AIC */
  aic: number
  /** BIC */
  bic: number
  /** 方差膨胀因子 */
  vif: number[]
  /** 显著因子列表（p < 0.05） */
  significantFactors: string[]
  /** 不显著因子列表（p >= 0.05） */
  insignificantFactors: string[]
  /** 回归方程字符串 */
  equation: string
}

/**
 * 执行多元线性回归（OLS）
 *
 * 模型: Y = β₀ + β₁X₁ + β₂X₂ + ... + βₖXₖ + ε
 *
 * @param y - 因变量数组
 * @param x - 自变量矩阵（每列为一个自变量）
 * @param xNames - 自变量名称
 * @returns 回归分析结果
 */
export function olsRegression(
  y: readonly number[],
  x: readonly (readonly number[])[],
  xNames: readonly string[],
): RegressionResult {
  const n = y.length
  const k = x.length

  if (n < k + 2) {
    throw new Error(`样本不足: n=${n}, k=${k}, 至少需要 ${k + 2} 个样本`)
  }

  logger.info('[olsRegression] 开始回归分析', { n, k, xNames })

  // 构造设计矩阵 X（含截距列）
  const X: number[][] = Array.from({ length: n }, (_, i) => [1, ...x.map(col => col[i] ?? 0)])
  const Y: number[][] = y.map(v => [v])

  // X'X
  const Xt = transpose(X)
  const XtX = multiply(Xt, X)
  const XtXInv = inverse(XtX)

  if (!XtXInv) {
    throw new Error('X\'X 矩阵奇异，可能存在完全多重共线性')
  }

  // X'Y
  const XtY = multiply(Xt, Y)

  // β = (X'X)^{-1} X'Y
  const betaMatrix = multiply(XtXInv, XtY)
  const coefficients = betaMatrix.map(row => row[0] ?? 0)

  // 预测值
  const yHat: number[] = X.map(row =>
    row.reduce((sum, val, j) => sum + val * (coefficients[j] ?? 0), 0),
  )

  // 残差
  const residuals = y.map((yi, i) => yi - (yHat[i] ?? 0))

  // 残差平方和
  const rss = residuals.reduce((sum, r) => sum + r * r, 0)

  // 总平方和
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const tss = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0)

  // R²
  const rSquared = tss > 0 ? 1 - rss / tss : 0

  // Adjusted R²
  const adjustedRSquared = n - k - 1 > 0
    ? 1 - (1 - rSquared) * (n - 1) / (n - k - 1)
    : 0

  // 误差方差估计
  const dfResidual = n - k - 1
  const sigmaSquared = dfResidual > 0 ? rss / dfResidual : 0

  // 系数标准误
  const diagXtXInv = XtXInv.map((row, i) => row[i] ?? 0)
  const standardErrors = diagXtXInv.map(v => Math.sqrt(Math.abs(v) * sigmaSquared))

  // t 统计量
  const tStatistics = coefficients.map((beta, i) =>
    (standardErrors[i] ?? 0) > 0 ? beta / (standardErrors[i] ?? 1) : 0,
  )

  // p 值
  const pValues = tStatistics.map(t => computePValue(t, dfResidual))

  // F 统计量
  const dfModel = k
  const fStatistic = dfResidual > 0 && dfModel > 0
    ? ((tss - rss) / dfModel) / (rss / dfResidual)
    : 0

  // F 检验 p 值（使用大样本正态近似）
  const fPValue = fStatistic > 0
    ? Math.exp(-fStatistic / 2) // 简化近似
    : 1

  // AIC / BIC
  const aic = n * Math.log(rss / n) + 2 * (k + 1)
  const bic = n * Math.log(rss / n) + Math.log(n) * (k + 1)

  // 方差膨胀因子 VIF（直接计算 R²，无递归）
  // VIF_j = 1 / (1 - R²_j)，其中 R²_j 是用其他自变量回归 X_j 的决定系数
  const vif: number[] = []
  for (let j = 0; j < k; j++) {
    const otherX = x.filter((_, idx) => idx !== j)
    if (otherX.length > 0) {
      // 直接计算 R²：用 otherX 回归 x[j]
      const targetX = x[j] ?? []
      const xDesign: number[][] = Array.from({ length: n }, (_, i) =>
        [1, ...otherX.map(col => col[i] ?? 0)],
      )
      const xtDesign = transpose(xDesign)
      const xtxD = multiply(xtDesign, xDesign)
      const xtxInvD = inverse(xtxD)
      if (xtxInvD) {
        const xtyD = multiply(xtDesign, targetX.map(v => [v]))
        const betaD = multiply(xtxInvD, xtyD)
        const yHatD = xDesign.map(row =>
          row.reduce((sum, val, jj) => sum + val * (betaD[jj]?.[0] ?? 0), 0),
        )
        const meanTarget = targetX.reduce((a, b) => a + b, 0) / n
        const ssTotal = targetX.reduce((s, v) => s + (v - meanTarget) ** 2, 0)
        const ssResid = targetX.reduce((s, v, i) => s + (v - (yHatD[i] ?? 0)) ** 2, 0)
        const r2D = ssTotal > 0 ? 1 - ssResid / ssTotal : 0
        vif.push(r2D < 0.99 ? 1 / (1 - r2D) : Infinity)
      } else {
        vif.push(Infinity)
      }
    } else {
      vif.push(1)
    }
  }

  // 显著因子筛选
  const significantFactors: string[] = []
  const insignificantFactors: string[] = []
  for (let i = 0; i < k; i++) {
    if ((pValues[i + 1] ?? 1) < 0.05) {
      significantFactors.push(xNames[i] ?? `x${i}`)
    } else {
      insignificantFactors.push(xNames[i] ?? `x${i}`)
    }
  }

  // 回归方程
  const equationParts = coefficients.map((beta, i) => {
    const name = i === 0 ? '截距' : (xNames[i - 1] ?? `x${i - 1}`)
    const sign = beta >= 0 ? (i === 0 ? '' : ' + ') : ' - '
    return `${sign}${Math.abs(beta).toFixed(4)}×${name}`
  })
  const equation = `Y = ${equationParts.join('')}`

  const result: RegressionResult = {
    coefficients,
    coefficientNames: ['截距', ...xNames],
    standardErrors,
    tStatistics,
    pValues,
    rSquared,
    adjustedRSquared,
    fStatistic,
    fPValue,
    residuals,
    n,
    k,
    aic,
    bic,
    vif,
    significantFactors,
    insignificantFactors,
    equation,
  }

  logger.info('[olsRegression] 回归分析完成', {
    n,
    k,
    rSquared: rSquared.toFixed(4),
    adjustedRSquared: adjustedRSquared.toFixed(4),
    fStatistic: fStatistic.toFixed(2),
    significantCount: significantFactors.length,
  })

  return result
}

/**
 * 格式化回归结果为 Markdown 表格
 */
export function formatRegressionTable(result: RegressionResult): string {
  const lines: string[] = []
  lines.push('| 变量 | 系数(β) | 标准误 | t统计量 | p值 | 显著性 | VIF |')
  lines.push('|------|---------|--------|---------|-----|--------|-----|')

  for (let i = 0; i < result.coefficients.length; i++) {
    const name = result.coefficientNames[i] ?? ''
    const beta = result.coefficients[i] ?? 0
    const se = result.standardErrors[i] ?? 0
    const t = result.tStatistics[i] ?? 0
    const p = result.pValues[i] ?? 1
    const vif = i > 0 ? (result.vif[i - 1] ?? 0).toFixed(2) : '—'
    const sig = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : p < 0.1 ? '.' : ''
    lines.push(`| ${name} | ${beta.toFixed(4)} | ${se.toFixed(4)} | ${t.toFixed(3)} | ${p.toFixed(4)} | ${sig} | ${vif} |`)
  }

  lines.push('')
  lines.push(`**R²** = ${result.rSquared.toFixed(4)} | **Adjusted R²** = ${result.adjustedRSquared.toFixed(4)}`)
  lines.push(`**F** = ${result.fStatistic.toFixed(2)} | **F p值** = ${result.fPValue.toFixed(4)}`)
  lines.push(`**AIC** = ${result.aic.toFixed(2)} | **BIC** = ${result.bic.toFixed(2)}`)
  lines.push(`**样本数** n = ${result.n} | **自变量数** k = ${result.k}`)
  lines.push(`**显著因子** (${result.significantFactors.length}): ${result.significantFactors.join(', ') || '无'}`)
  lines.push(`**不显著因子** (${result.insignificantFactors.length}): ${result.insignificantFactors.join(', ') || '无'}`)
  lines.push('')
  lines.push(`**回归方程**: ${result.equation}`)
  lines.push('')
  lines.push('> 显著性: *** p<0.001 | ** p<0.01 | * p<0.05 | . p<0.1')

  return lines.join('\n')
}
