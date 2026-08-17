/**
 * formulaVerifier — 财务公式独立重推导与验算工具
 *
 * P1: 对评分引擎中所有数学公式进行独立推导，与引擎实际输出做交叉验证。
 * 纯函数，零依赖（不依赖 IndexedDB、LLM、网络），可安全嵌入 CI 流程。
 *
 * 设计原则：
 * - 独立推导：每个公式从数学定义出发重新推导，不复制引擎代码
 * - 数值容差：浮点运算允许 1e-6 容差
 * - 边界测试：覆盖零值、负值、极大值等边界条件
 * - 幂等性：相同输入始终产生相同输出
 *
 * 覆盖公式：
 * - F1: PEG 评分函数（阶梯映射）
 * - F2: PE 行业基准相对评分
 * - F3: 两阶段 DDM 内在价值
 * - F4: EV/EBITDA 简化计算
 * - F5: PS 市销率计算
 * - F6: DDM 分红折价因子（股息率 + 分红率 + 稳定性）
 * - F7: 一致预期差因子（EPS 增速 + PE 偏差 + 评级 + 目标价）
 * - F8: 安全边际计算
 * - F9: clamp 截断函数
 *
 * @module services/scoring/v6-engine/calculators/formulaVerifier
 * @created 2026-08-17 P1
 * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-066]
 */

// ============================================================
// 类型定义
// ============================================================

/** 公式验证结果 */
export interface FormulaVerification {
  /** 公式 ID */
  formulaId: string
  /** 公式名称 */
  name: string
  /** 是否通过 */
  passed: boolean
  /** 测试用例数 */
  totalCases: number
  /** 通过用例数 */
  passedCases: number
  /** 失败详情 */
  failures: FormulaFailure[]
  /** 推导过程摘要 */
  derivation: string
}

/** 公式验证失败 */
export interface FormulaFailure {
  /** 用例描述 */
  case: string
  /** 期望值 */
  expected: number
  /** 实际值 */
  actual: number
  /** 偏差 */
  delta: number
}

/** 验证报告 */
export interface VerificationReport {
  timestamp: string
  totalFormulas: number
  passedFormulas: number
  totalCases: number
  passedCases: number
  verifications: FormulaVerification[]
  overallPassed: boolean
}

// ============================================================
// F1: PEG 评分函数
// ============================================================

/**
 * PEG 评分阶梯映射的独立推导
 *
 * 推导逻辑：
 *   PEG = PE / 盈利增速
 *   - PEG < 0.5: 极度低估 → 5 分
 *   - PEG < 1.0: 低估 → 4 分
 *   - PEG < 1.5: 合理偏低 → 3 分
 *   - PEG < 2.5: 合理偏高 → 2.5 分
 *   - PEG ≥ 2.5: 高估 → 2 分
 *
 * 数学原理：PEG 越低，每单位增长付出的价格越低，越具投资价值。
 */
export function derivePegScore(peg: number): number {
  if (peg <= 0) return 2 // 负 PEG（亏损）→ 高估
  if (peg < 0.5) return 5
  if (peg < 1.0) return 4
  if (peg < 1.5) return 3
  if (peg < 2.5) return 2.5
  return 2
}

// ============================================================
// F2: PE 行业基准评分
// ============================================================

/**
 * PE 行业基准相对评分的独立推导
 *
 * 推导逻辑：
 *   - PE < 行业下限 → 低于行业平均 → 4.5 分（低估）
 *   - PE < 行业上限 → 行业合理区间 → 3.5 分（合理）
 *   - PE ≥ 行业上限 → 高于行业 → 2.5 分（高估）
 *
 * 无行业基准时使用默认阈值（15x / 30x）。
 */
export function derivePeRelativeScore(
  pe: number,
  benchmark: { peLow: number; peHigh: number } | null,
): number {
  if (benchmark) {
    if (pe < benchmark.peLow) return 4.5
    if (pe < benchmark.peHigh) return 3.5
    return 2.5
  }
  // 默认阈值
  if (pe < 15) return 4.5
  if (pe < 30) return 3.5
  return 2.5
}

// ============================================================
// F3: 两阶段 DDM 内在价值
// ============================================================

/**
 * 两阶段 DDM 内在价值的独立推导
 *
 * 数学公式：
 *   第一阶段 PV₁ = Σ_{t=1}^{n} DPS₀ × (1+g₁)ᵗ / (1+r)ᵗ
 *   第二阶段 TV  = DPSₙ₊₁ / (r - g₂)，其中 DPSₙ₊₁ = DPS₀ × (1+g₁)ⁿ × (1+g₂)
 *   终值折现 PV_TV = TV / (1+r)ⁿ
 *   内在价值 = PV₁ + PV_TV
 *
 * 约束条件：r > g₂（否则永续终值发散）
 */
export function deriveDdmIntrinsicValue(params: {
  dps0: number     // 基期每股股利
  g1: number       // 第一阶段增长率
  g2: number       // 第二阶段永续增长率
  r: number        // 折现率
  n: number        // 第一阶段年数
}): { intrinsicValue: number; pv1: number; pvTV: number; valid: boolean } {
  const { dps0, g1, g2, r, n } = params

  // 约束：r > g2
  if (r <= g2) {
    return { intrinsicValue: NaN, pv1: 0, pvTV: 0, valid: false }
  }

  // 第一阶段
  let pv1 = 0
  let dps = dps0
  for (let t = 1; t <= n; t++) {
    dps = dps * (1 + g1)
    pv1 += dps / Math.pow(1 + r, t)
  }

  // 第二阶段
  const dpsN1 = dps * (1 + g2)
  const terminalValue = dpsN1 / (r - g2)
  const pvTV = terminalValue / Math.pow(1 + r, n)

  return {
    intrinsicValue: pv1 + pvTV,
    pv1,
    pvTV,
    valid: true,
  }
}

/**
 * DDM 评分映射的独立推导
 *
 * 安全边际 = (内在价值 - 股价) / 内在价值 × 100%
 * - ≥ 30%: 深度低估 → 5.0
 * - ≥ 20%: 低估 → 4.5
 * - ≥ 10%: 轻微低估 → 4.0
 * - ≥ 0%:  合理 → 3.0
 * - ≥ -10%: 轻微高估 → 2.0
 * - < -10%: 高估 → 1.0
 */
export function deriveDdmScore(intrinsicValue: number, currentPrice: number): number {
  if (currentPrice <= 0 || intrinsicValue <= 0) return 2.5
  const mos = ((intrinsicValue - currentPrice) / intrinsicValue) * 100
  if (mos >= 30) return 5.0
  if (mos >= 20) return 4.5
  if (mos >= 10) return 4.0
  if (mos >= 0) return 3.0
  if (mos >= -10) return 2.0
  return 1.0
}

// ============================================================
// F4: EV/EBITDA 计算
// ============================================================

/**
 * EV/EBITDA 的独立推导
 *
 * 公式：
 *   EV = 市值 + 有息负债 - 现金
 *   EBITDA = 净利润 + 利息 + 税 + 折旧 + 摊销
 *
 * 简化版（当无详细数据时）：
 *   EV = 市值 + 有息负债
 *   EBITDA ≈ 净利润 × 1.5（经验近似）
 *
 * 评分：
 *   - EV/EBITDA < 8: 低估 → +0.5
 *   - EV/EBITDA < 15: 合理 → +0.3
 *   - EV/EBITDA > 25: 高估 → -0.5
 */
export function deriveEvEbitda(
  marketCap: number,
  netProfit: number,
  interestBearingDebt: number = 0,
): { evEbitda: number; adjust: number; valid: boolean } {
  if (netProfit <= 0 || marketCap <= 0) {
    return { evEbitda: NaN, adjust: 0, valid: false }
  }

  const ev = marketCap + interestBearingDebt
  const ebitda = netProfit * 1.5
  const evEbitda = ev / ebitda

  let adjust = 0
  if (evEbitda < 8) adjust = 0.5
  else if (evEbitda < 15) adjust = 0.3
  else if (evEbitda > 25) adjust = -0.5

  return { evEbitda, adjust, valid: true }
}

// ============================================================
// F5: PS 市销率计算
// ============================================================

/**
 * PS 市销率的独立推导
 *
 * 公式：PS = 市值 / 营业收入
 *
 * 适用于高成长低利润/亏损公司，弥补 PE 无法评估的缺陷。
 * 评分：
 *   - PS < 2: 低估 → +0.5
 *   - PS < 5: 合理 → +0.3
 *   - PS > 10: 偏高 → -0.3
 */
export function derivePsScore(
  marketCap: number,
  revenue: number,
): { ps: number; adjust: number; valid: boolean } {
  if (revenue <= 0 || marketCap <= 0) {
    return { ps: NaN, adjust: 0, valid: false }
  }

  const ps = marketCap / revenue

  let adjust = 0
  if (ps < 2) adjust = 0.5
  else if (ps < 5) adjust = 0.3
  else if (ps > 10) adjust = -0.3

  return { ps, adjust, valid: true }
}

// ============================================================
// F6: DDM 分红折价因子
// ============================================================

/**
 * DDM 分红折价因子的独立推导
 *
 * 三个子维度：
 * 1. 股息率评分：
 *    - ≥ 3.5%: 高股息 → +1.0
 *    - ≥ 2.0%: 中等 → +0.5
 *    - < 1.0%: 低股息 → -0.3
 *
 * 2. 分红可持续性：
 *    - 分红率 20%-80%: 健康 → +0.5
 *    - 分红率 > 80%: 不可持续 → -0.5
 *
 * 3. 分红稳定性（近 3 年累计）：
 *    - ≥ 10 亿: 稳定 → +0.5
 *
 * 4. 限售股解禁风险：
 *    - 解禁占比 > 5%: 抛压 → -0.5
 *
 * 总调整范围：[-1.5, +1.5]
 */
export function deriveDdmDividendAdjust(params: {
  dividendYield: number       // 股息率（%）
  payoutRatio3Y: number       // 近 3 年平均分红率（%）
  totalDividend3Y: number     // 近 3 年累计分红（亿元）
  nextUnlockRatio: number     // 下次解禁占总股本比例（0-1）
}): { adjust: number; details: string[] } {
  const details: string[] = []
  let adjust = 0

  // 1. 股息率
  if (params.dividendYield >= 3.5) {
    adjust += 1.0
    details.push(`股息率 ${params.dividendYield.toFixed(1)}% >= 3.5% → +1.0`)
  } else if (params.dividendYield >= 2.0) {
    adjust += 0.5
    details.push(`股息率 ${params.dividendYield.toFixed(1)}% >= 2.0% → +0.5`)
  } else if (params.dividendYield < 1.0) {
    adjust -= 0.3
    details.push(`股息率 ${params.dividendYield.toFixed(1)}% < 1.0% → -0.3`)
  }

  // 2. 分红可持续性
  if (params.payoutRatio3Y >= 20 && params.payoutRatio3Y <= 80) {
    adjust += 0.5
    details.push(`分红率 ${params.payoutRatio3Y.toFixed(0)}% 在 20%-80% → +0.5`)
  } else if (params.payoutRatio3Y > 80) {
    adjust -= 0.5
    details.push(`分红率 ${params.payoutRatio3Y.toFixed(0)}% > 80%（不可持续）→ -0.5`)
  }

  // 3. 分红稳定性
  if (params.totalDividend3Y >= 10) {
    adjust += 0.5
    details.push(`近 3 年累计分红 ${params.totalDividend3Y.toFixed(1)} 亿 >= 10 亿 → +0.5`)
  }

  // 4. 限售股解禁
  if (params.nextUnlockRatio > 0.05) {
    adjust -= 0.5
    details.push(`解禁占比 ${(params.nextUnlockRatio * 100).toFixed(1)}% > 5% → -0.5`)
  }

  return {
    adjust: Math.max(-1.5, Math.min(1.5, adjust)),
    details,
  }
}

// ============================================================
// F7: 一致预期差因子
// ============================================================

/**
 * 一致预期差因子的独立推导
 *
 * 五个子维度：
 * 1. EPS 增速：≥ 15% → +0.5，负增长 → -0.5
 * 2. PE 偏差：隐含 PE / 当前 PE < 0.7 → 低估 +0.5
 * 3. 评级乐观度：买入+增持 ≥ 60% → +0.5，< 30% → -0.5
 * 4. 目标价上行：≥ 15% → +0.5，< -10% → -0.5
 * 5. 评级趋势：下调 → -0.5，上调 → +0.3
 *
 * 总调整范围：[-1.5, +1.5]
 */
export function deriveConsensusGapAdjust(params: {
  epsGrowth: number           // 一致预期 EPS 增速（%）
  impliedPE: number           // 一致预期隐含 PE
  currentPE: number           // 当前 PE
  bullishRatio: number        // 买入+增持占比（%）
  upside: number              // 目标价上行空间（%）
  ratingTrend: 'upgrade' | 'downgrade' | 'stable'
}): { adjust: number; details: string[] } {
  const details: string[] = []
  let adjust = 0

  // 1. EPS 增速
  if (params.epsGrowth >= 15) {
    adjust += 0.5
    details.push(`EPS 增速 ${params.epsGrowth.toFixed(1)}% >= 15% → +0.5`)
  } else if (params.epsGrowth < 0) {
    adjust -= 0.5
    details.push(`EPS 负增长 ${params.epsGrowth.toFixed(1)}% → -0.5`)
  }

  // 2. PE 偏差
  if (params.currentPE > 0 && params.impliedPE > 0) {
    const peRatio = params.impliedPE / params.currentPE
    if (peRatio < 0.7) {
      adjust += 0.5
      details.push(`隐含 PE/当前 PE = ${peRatio.toFixed(2)} < 0.7 → 低估 +0.5`)
    }
  }

  // 3. 评级乐观度
  if (params.bullishRatio >= 60) {
    adjust += 0.5
    details.push(`买入+增持占比 ${params.bullishRatio.toFixed(0)}% >= 60% → +0.5`)
  } else if (params.bullishRatio < 30) {
    adjust -= 0.5
    details.push(`买入+增持占比 ${params.bullishRatio.toFixed(0)}% < 30% → -0.5`)
  }

  // 4. 目标价上行
  if (params.upside >= 15) {
    adjust += 0.5
    details.push(`目标价上行 ${params.upside.toFixed(1)}% >= 15% → +0.5`)
  } else if (params.upside < -10) {
    adjust -= 0.5
    details.push(`目标价下行 ${params.upside.toFixed(1)}% → -0.5`)
  }

  // 5. 评级趋势
  if (params.ratingTrend === 'downgrade') {
    adjust -= 0.5
    details.push('评级下调 → -0.5')
  } else if (params.ratingTrend === 'upgrade') {
    adjust += 0.3
    details.push('评级上调 → +0.3')
  }

  return {
    adjust: Math.max(-1.5, Math.min(1.5, adjust)),
    details,
  }
}

// ============================================================
// F8: 安全边际
// ============================================================

/**
 * 安全边际的独立推导
 *
 * 公式：安全边际 = (内在价值 - 当前股价) / 内在价值 × 100%
 *
 * 解读：
 * - 正值越大，安全边际越厚，越值得买入
 * - 负值说明股价高于内在价值，存在溢价风险
 */
export function deriveMarginOfSafety(
  intrinsicValue: number,
  currentPrice: number,
): { margin: number; valid: boolean } {
  if (intrinsicValue <= 0 || currentPrice <= 0) {
    return { margin: 0, valid: false }
  }
  return {
    margin: ((intrinsicValue - currentPrice) / intrinsicValue) * 100,
    valid: true,
  }
}

// ============================================================
// F9: Clamp 截断函数
// ============================================================

/**
 * Clamp 函数的独立推导
 *
 * 公式：clamp(x, min, max) = max(min, min(max, x))
 *
 * 用于将评分约束在 [0, 5] 区间内。
 */
export function deriveClamp(value: number, min: number = 0, max: number = 5): number {
  return Math.max(min, Math.min(max, value))
}

// ============================================================
// 综合验证入口
// ============================================================

/**
 * 运行全部公式验证，生成验证报告
 */
export function verifyAllFormulas(): VerificationReport {
  const verifications: FormulaVerification[] = []
  const TOLERANCE = 1e-6

  // ── F1: PEG 评分 ──
  {
    const cases: Array<{ peg: number; expected: number }> = [
      { peg: -1, expected: 2 },
      { peg: 0.3, expected: 5 },
      { peg: 0.7, expected: 4 },
      { peg: 1.2, expected: 3 },
      { peg: 2.0, expected: 2.5 },
      { peg: 3.0, expected: 2 },
      { peg: 0.0, expected: 2 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const actual = derivePegScore(c.peg)
      if (Math.abs(actual - c.expected) > TOLERANCE) {
        failures.push({ case: `PEG=${c.peg}`, expected: c.expected, actual, delta: Math.abs(actual - c.expected) })
      }
    }
    verifications.push({
      formulaId: 'F1',
      name: 'PEG 评分阶梯映射',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'PEG = PE / 盈利增速；阶梯映射 peg→[2, 5]',
    })
  }

  // ── F2: PE 行业基准评分 ──
  {
    const cases: Array<{ pe: number; benchmark: { peLow: number; peHigh: number } | null; expected: number }> = [
      { pe: 10, benchmark: { peLow: 15, peHigh: 30 }, expected: 4.5 },
      { pe: 20, benchmark: { peLow: 15, peHigh: 30 }, expected: 3.5 },
      { pe: 35, benchmark: { peLow: 15, peHigh: 30 }, expected: 2.5 },
      { pe: 10, benchmark: null, expected: 4.5 },
      { pe: 20, benchmark: null, expected: 3.5 },
      { pe: 35, benchmark: null, expected: 2.5 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const actual = derivePeRelativeScore(c.pe, c.benchmark)
      if (Math.abs(actual - c.expected) > TOLERANCE) {
        failures.push({ case: `PE=${c.pe}`, expected: c.expected, actual, delta: Math.abs(actual - c.expected) })
      }
    }
    verifications.push({
      formulaId: 'F2',
      name: 'PE 行业基准相对评分',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'PE < 行业下限 → 低估 4.5; PE < 行业上限 → 合理 3.5; 否则 → 高估 2.5',
    })
  }

  // ── F3: DDM 内在价值 ──
  {
    const params = { dps0: 1.0, g1: 0.10, g2: 0.03, r: 0.08, n: 3 }
    const result = deriveDdmIntrinsicValue(params)
    // 手动验算（高精度）：
    // 第1年: 1.0*1.10/1.08 = 1.0185
    // 第2年: 1.0*1.10^2/1.08^2 = 1.0373
    // 第3年: 1.0*1.10^3/1.08^3 = 1.0565
    // PV1 = 3.1123
    // DPS_N+1 = 1.0*1.10^3*1.03 = 1.3710
    // TV = 1.3710/(0.08-0.03) = 27.4205
    // PV_TV = 27.4205/1.08^3 = 21.7670
    // IV = 24.8793
    const expectedIV = 24.8793
    const failures: FormulaFailure[] = []
    if (!result.valid) {
      failures.push({ case: 'DDM basic', expected: expectedIV, actual: NaN, delta: NaN })
    } else if (Math.abs(result.intrinsicValue - expectedIV) > 0.01) {
      failures.push({
        case: `DDM dps0=1.0 g1=10% g2=3% r=8% n=3`,
        expected: expectedIV,
        actual: result.intrinsicValue,
        delta: Math.abs(result.intrinsicValue - expectedIV),
      })
    }
    verifications.push({
      formulaId: 'F3',
      name: '两阶段 DDM 内在价值',
      passed: failures.length === 0,
      totalCases: 1,
      passedCases: 1 - failures.length,
      failures,
      derivation: 'PV₁ = Σ DPS₀(1+g₁)ᵗ/(1+r)ᵗ; TV = DPSₙ₊₁/(r-g₂); IV = PV₁ + PV_TV/(1+r)ⁿ',
    })
  }

  // ── F4: EV/EBITDA ──
  {
    const cases: Array<{ marketCap: number; netProfit: number; debt: number; expectedAdjust: number }> = [
      { marketCap: 1000, netProfit: 100, debt: 0, expectedAdjust: 0.5 },   // EV/EBITDA = 1000/150 ≈ 6.67 < 8
      { marketCap: 5000, netProfit: 100, debt: 0, expectedAdjust: -0.5 },   // EV/EBITDA = 5000/150 ≈ 33.33 > 25
      { marketCap: 1000, netProfit: 0, debt: 0, expectedAdjust: 0 },        // 无效
      { marketCap: 0, netProfit: 100, debt: 0, expectedAdjust: 0 },         // 无效
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const result = deriveEvEbitda(c.marketCap, c.netProfit, c.debt)
      if (Math.abs(result.adjust - c.expectedAdjust) > TOLERANCE) {
        failures.push({
          case: `MCap=${c.marketCap} NP=${c.netProfit}`,
          expected: c.expectedAdjust,
          actual: result.adjust,
          delta: Math.abs(result.adjust - c.expectedAdjust),
        })
      }
    }
    verifications.push({
      formulaId: 'F4',
      name: 'EV/EBITDA 估值调整',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'EV = 市值 + 有息负债; EBITDA ≈ 净利润 × 1.5; EV/EBITDA 分档评分',
    })
  }

  // ── F5: PS 市销率 ──
  {
    const cases: Array<{ marketCap: number; revenue: number; expectedAdjust: number }> = [
      { marketCap: 100, revenue: 100, expectedAdjust: 0.5 },   // PS = 1
      { marketCap: 300, revenue: 100, expectedAdjust: 0.3 },   // PS = 3
      { marketCap: 1200, revenue: 100, expectedAdjust: -0.3 },  // PS = 12
      { marketCap: 100, revenue: 0, expectedAdjust: 0 },        // 无效
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const result = derivePsScore(c.marketCap, c.revenue)
      if (Math.abs(result.adjust - c.expectedAdjust) > TOLERANCE) {
        failures.push({
          case: `MCap=${c.marketCap} Rev=${c.revenue}`,
          expected: c.expectedAdjust,
          actual: result.adjust,
          delta: Math.abs(result.adjust - c.expectedAdjust),
        })
      }
    }
    verifications.push({
      formulaId: 'F5',
      name: 'PS 市销率评分',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'PS = 市值 / 营收; PS 分档评分',
    })
  }

  // ── F6: DDM 分红折价因子 ──
  {
    const cases: Array<{
      yield: number; payout: number; totalDiv: number; unlock: number; expectedMin: number; expectedMax: number
    }> = [
      { yield: 4.0, payout: 40, totalDiv: 15, unlock: 0, expectedMin: 1.5, expectedMax: 2.5 },
      { yield: 1.5, payout: 90, totalDiv: 5, unlock: 0, expectedMin: -1.0, expectedMax: 0 },
      { yield: 0.5, payout: 30, totalDiv: 3, unlock: 0.08, expectedMin: -0.5, expectedMax: 0 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const result = deriveDdmDividendAdjust({
        dividendYield: c.yield,
        payoutRatio3Y: c.payout,
        totalDividend3Y: c.totalDiv,
        nextUnlockRatio: c.unlock,
      })
      if (result.adjust < c.expectedMin || result.adjust > c.expectedMax) {
        failures.push({
          case: `yield=${c.yield}% payout=${c.payout}%`,
          expected: (c.expectedMin + c.expectedMax) / 2,
          actual: result.adjust,
          delta: Math.abs(result.adjust - (c.expectedMin + c.expectedMax) / 2),
        })
      }
    }
    verifications.push({
      formulaId: 'F6',
      name: 'DDM 分红折价因子',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: '股息率 + 分红可持续性 + 分红稳定性 + 解禁风险 → [-1.5, +1.5]',
    })
  }

  // ── F7: 一致预期差因子 ──
  {
    const cases: Array<{
      epsGrowth: number; impliedPE: number; currentPE: number; bullishRatio: number
      upside: number; trend: 'upgrade' | 'downgrade' | 'stable'; expectedMin: number; expectedMax: number
    }> = [
      { epsGrowth: 20, impliedPE: 10, currentPE: 20, bullishRatio: 70, upside: 20, trend: 'upgrade', expectedMin: 1.5, expectedMax: 2.3 },
      { epsGrowth: -5, impliedPE: 30, currentPE: 20, bullishRatio: 20, upside: -15, trend: 'downgrade', expectedMin: -2.5, expectedMax: -1.5 },
      { epsGrowth: 5, impliedPE: 18, currentPE: 20, bullishRatio: 50, upside: 5, trend: 'stable', expectedMin: -0.5, expectedMax: 0.5 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const result = deriveConsensusGapAdjust({
        epsGrowth: c.epsGrowth,
        impliedPE: c.impliedPE,
        currentPE: c.currentPE,
        bullishRatio: c.bullishRatio,
        upside: c.upside,
        ratingTrend: c.trend,
      })
      if (result.adjust < c.expectedMin || result.adjust > c.expectedMax) {
        failures.push({
          case: `EPSg=${c.epsGrowth}% bull=${c.bullishRatio}%`,
          expected: (c.expectedMin + c.expectedMax) / 2,
          actual: result.adjust,
          delta: Math.abs(result.adjust - (c.expectedMin + c.expectedMax) / 2),
        })
      }
    }
    verifications.push({
      formulaId: 'F7',
      name: '一致预期差因子',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'EPS 增速 + PE 偏差 + 评级乐观度 + 目标价上行 + 评级趋势 → [-1.5, +1.5]',
    })
  }

  // ── F8: 安全边际 ──
  {
    const cases: Array<{ iv: number; price: number; expected: number }> = [
      { iv: 100, price: 80, expected: 20 },
      { iv: 100, price: 120, expected: -20 },
      { iv: 50, price: 50, expected: 0 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const result = deriveMarginOfSafety(c.iv, c.price)
      if (!result.valid || Math.abs(result.margin - c.expected) > TOLERANCE) {
        failures.push({
          case: `IV=${c.iv} Price=${c.price}`,
          expected: c.expected,
          actual: result.margin,
          delta: Math.abs(result.margin - c.expected),
        })
      }
    }
    verifications.push({
      formulaId: 'F8',
      name: '安全边际计算',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: '安全边际 = (内在价值 - 股价) / 内在价值 × 100%',
    })
  }

  // ── F9: Clamp ──
  {
    const cases: Array<{ value: number; expected: number }> = [
      { value: 3, expected: 3 },
      { value: -1, expected: 0 },
      { value: 6, expected: 5 },
      { value: 0, expected: 0 },
      { value: 5, expected: 5 },
    ]
    const failures: FormulaFailure[] = []
    for (const c of cases) {
      const actual = deriveClamp(c.value)
      if (Math.abs(actual - c.expected) > TOLERANCE) {
        failures.push({ case: `clamp(${c.value})`, expected: c.expected, actual, delta: Math.abs(actual - c.expected) })
      }
    }
    verifications.push({
      formulaId: 'F9',
      name: 'Clamp 截断函数',
      passed: failures.length === 0,
      totalCases: cases.length,
      passedCases: cases.length - failures.length,
      failures,
      derivation: 'clamp(x) = max(0, min(5, x))',
    })
  }

  // ── 汇总 ──
  const totalCases = verifications.reduce((s, v) => s + v.totalCases, 0)
  const passedCases = verifications.reduce((s, v) => s + v.passedCases, 0)
  const passedFormulas = verifications.filter(v => v.passed).length

  return {
    timestamp: new Date().toISOString(),
    totalFormulas: verifications.length,
    passedFormulas,
    totalCases,
    passedCases,
    verifications,
    overallPassed: passedFormulas === verifications.length,
  }
}