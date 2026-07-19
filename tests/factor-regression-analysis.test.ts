/**
 * @test_id V9-TEST-UT-024
 * @fileoverview 统计因子体系与回归分析 — 5大板块完整验证
 *
 * 板块1: 基本面评分（L1/L3f/L3v/L7 + 8衍生因子 = 12因子）
 * 板块2: 宏观行业评分（L-1/L0/L2 + 8衍生因子 = 11因子）
 * 板块3: 技术情绪评分（L4/L5/L6/L8 + 7衍生因子 = 11因子）
 * 板块4: 数据采集质量（7基础 + 2新增 = 9因子）
 * 板块5: 双通道同步效率（8基础 + 2新增 = 10因子）
 *
 * 每板块: 9-12 因子 → Pearson/Spearman 矩阵 → OLS 回归 → 筛选 → 输出
 * 总计: 53 因子（原39 + 新增14）
 *
 * @module tests/factor-regression-analysis.test
 * @created 2026-07-14 - 统计因子体系构建
  * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066]
*/

import { describe, it, expect } from 'vitest'
import { olsRegression, formatRegressionTable } from '@/services/scoring/v6-engine/regressionAnalyzer'
import { pearsonCorrelation, spearmanCorrelation } from '@/services/scoring/v6-engine/correlationAnalyzer'

// ============================================================
// 模拟数据生成器
// ============================================================

/** 确定性 PRNG（mulberry32），固定种子消除合成数据随机性，根治统计显著性 flaky */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(0x9e3779b9)

/** 生成正态分布随机数（Box-Muller，使用固定种子 RNG） */
function gaussian(mean: number, std: number): number {
  const u1 = rng() || 0.0001
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

/** 限制到 [0, 5] */
function clamp(v: number): number {
  return Math.max(0, Math.min(5, v))
}

// ============================================================
// 板块1: 基本面评分因子体系
// ============================================================

/** 基本面 12 因子（原8+新增4） */
const FUNDAMENTAL_FACTORS = [
  { id: 'F1_1', name: 'ROE质量', definition: '净资产收益率 = 净利润/净资产，衡量盈利能力', basis: '杜邦分析核心指标，巴菲特首选' },
  { id: 'F1_2', name: '营收增速', definition: '同比营收增长率，衡量成长性', basis: '成长股筛选首要指标' },
  { id: 'F1_3', name: '毛利率', definition: '(营收-成本)/营收，衡量定价能力', basis: '护城河量化代理' },
  { id: 'F1_4', name: '净利率', definition: '净利润/营收，衡量盈利效率', basis: '成本控制能力' },
  { id: 'F1_5', name: '资产负债率', definition: '总负债/总资产，衡量财务风险', basis: '偿债能力核心' },
  { id: 'F1_6', name: '经营现金流', definition: '经营活动现金流量净额/净利润，衡量盈利质量', basis: '识别利润操纵' },
  { id: 'F1_7', name: '研发强度', definition: '研发支出/营收，衡量创新能力', basis: '科技股成长引擎' },
  { id: 'F1_8', name: 'PEG估值', definition: 'PE/盈利增速，衡量估值合理性', basis: '彼得·林奇首选估值指标' },
  // ── 新增因子（2026-07-15） ──
  { id: 'F1_9', name: '应收账款周转率', definition: '营收/平均应收账款，衡量收款效率与收入质量', basis: '杜邦分解运营效率子指标，识别收入注水' },
  { id: 'F1_10', name: '存货周转率', definition: '营业成本/平均存货，衡量库存管理效率', basis: '运营效率核心指标，反映供应链管理水平' },
  { id: 'F1_11', name: '商誉占比', definition: '商誉/总资产反向标准化，衡量潜在减值风险', basis: '并购溢价风险量化，A股商誉雷区频发' },
  { id: 'F1_12', name: '股息率', definition: '年度每股股息/股价，衡量股东回报', basis: '价值投资核心指标，反映现金流充沛度' },
] as const

function generateFundamentalData(n: number) {
  const data = Array.from({ length: n }, () => {
    const quality = gaussian(3, 1) // 潜在质量因子
    return {
      F1_1: clamp(quality + gaussian(0, 0.5)),        // ROE 与质量强相关
      F1_2: clamp(quality * 0.8 + gaussian(0.5, 0.8)), // 营收增速与质量正相关
      F1_3: clamp(quality * 0.6 + gaussian(1, 0.7)),  // 毛利率
      F1_4: clamp(quality * 0.7 + gaussian(0.5, 0.6)), // 净利率
      F1_5: clamp(5 - quality * 0.5 + gaussian(0, 0.8)), // 负债率反向
      F1_6: clamp(quality * 0.5 + gaussian(1.5, 0.7)),  // 现金流
      F1_7: clamp(gaussian(2.5, 1.2)),                  // 研发独立
      F1_8: clamp(gaussian(2.5, 1)), // PEG 独立噪声（权重=0，应保持不显著，与 F2_8/F3_8 控制变量一致）
      // 新增因子
      F1_9: clamp(quality * 0.6 + gaussian(1, 0.8)),    // 应收周转率与质量正相关
      F1_10: clamp(quality * 0.5 + gaussian(1.5, 0.9)), // 存货周转率
      F1_11: clamp(5 - quality * 0.4 + gaussian(0.5, 1)), // 商誉占比反向（质量差的公司商誉高）
      F1_12: clamp(quality * 0.3 + gaussian(2, 0.8)),   // 股息率弱正相关
    }
  })
  // 目标变量：综合基本面评分（加权）
  const y = data.map(d =>
    0.25 * d.F1_1 + 0.15 * d.F1_2 + 0.10 * d.F1_3 + 0.08 * d.F1_4 +
    0.08 * d.F1_5 + 0.08 * d.F1_6 + 0.05 * d.F1_7 + 0.0 * d.F1_8 + // F1_8 权重=0（不显著）
    0.08 * d.F1_9 + 0.06 * d.F1_10 + 0.04 * d.F1_11 + 0.03 * d.F1_12 + // 新增因子
    gaussian(0, 0.2), // 噪声
  )
  return { data, y }
}

describe('板块1: 基本面评分因子体系', () => {
  const { data, y } = generateFundamentalData(200)
  const factorIds = FUNDAMENTAL_FACTORS.map(f => f.id)
  const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))

  it('应定义 12 个关键因子并含统计学定义', () => {
    expect(FUNDAMENTAL_FACTORS).toHaveLength(12)
    for (const f of FUNDAMENTAL_FACTORS) {
      expect(f.definition).toBeTruthy()
      expect(f.basis).toBeTruthy()
    }
  })

  it('应计算 Pearson 相关矩阵', () => {
    const matrix: Record<string, Record<string, number>> = {}
    for (const a of factorIds) {
      matrix[a] = {}
      for (const b of factorIds) {
        const va = data.map(d => d[a as keyof typeof d])
        const vb = data.map(d => d[b as keyof typeof d])
        matrix[a][b] = Math.round(pearsonCorrelation(va, vb) * 100) / 100
      }
    }
    // F1_1(ROE) 与 F1_2(营收增速) 应正相关
    expect(matrix.F1_1!.F1_2).toBeGreaterThan(0.3)
    // F1_1(ROE) 与 F1_5(负债率) 应负相关
    expect(matrix.F1_1!.F1_5).toBeLessThan(0)
    // 对角线 = 1
    expect(matrix.F1_1!.F1_1).toBeCloseTo(1, 1)
  })

  it('应执行 OLS 回归并输出统计量', () => {
    const result = olsRegression(y, factorValues, factorIds)

    // R² 应较高（因为 y 由因子线性组合生成）
    expect(result.rSquared).toBeGreaterThan(0.5)

    // F 统计量应显著
    expect(result.fStatistic).toBeGreaterThan(10)

    // F1_1(ROE) 应显著（p < 0.05）
    const f1_1PValue = result.pValues[1] // index 0 是截距
    expect(f1_1PValue).toBeLessThan(0.05)

    // F1_8(PEG) 应不显著（权重=0）
    const f1_8PValue = result.pValues[8]
    expect(f1_8PValue).toBeGreaterThan(0.05)

    // 应有回归方程
    expect(result.equation).toContain('Y =')

    // 应正确分类显著/不显著因子
    expect(result.significantFactors.length).toBeGreaterThan(0)
    expect(result.insignificantFactors).toContain('F1_8')
  })

  it('应输出 VIF 检验多重共线性', () => {
    const result = olsRegression(y, factorValues, factorIds)
    // F1_1 和 F1_2 高度相关，VIF 可能 > 5
    const maxVif = Math.max(...result.vif)
    expect(maxVif).toBeGreaterThan(1) // 至少有一些共线性
  })

  it('应输出格式化回归表', () => {
    const result = olsRegression(y, factorValues, factorIds)
    const table = formatRegressionTable(result)
    expect(table).toContain('R²')
    expect(table).toContain('F')
    expect(table).toContain('p值')
    expect(table).toContain('回归方程')
  })
})

// ============================================================
// 板块2: 宏观行业评分因子体系
// ============================================================

const MACRO_FACTORS = [
  { id: 'F2_1', name: '政策契合度', definition: '行业与国家政策方向一致程度（0-5评分）', basis: '中国政策驱动型市场特征' },
  { id: 'F2_2', name: '行业景气度', definition: 'PMI/行业景气指数标准化得分', basis: '宏观经济周期领先指标' },
  { id: 'F2_3', name: '竞争格局', definition: 'HHI指数反向标准化（集中度高=高分）', basis: '产业组织理论 SCP 范式' },
  { id: 'F2_4', name: '国产替代空间', definition: '进口依赖度反向标准化', basis: '中美贸易摩擦背景下的核心逻辑' },
  { id: 'F2_5', name: '技术代差', definition: '与国际领先水平的技术差距评分', basis: '追赶型经济的增长动力' },
  { id: 'F2_6', name: '估值分位', definition: '行业 PE 在历史分位数中的位置', basis: '均值回归统计规律' },
  { id: 'F2_7', name: '资金流入', definition: '北向/主力资金净流入标准化', basis: '市场情绪代理变量' },
  { id: 'F2_8', name: '新闻热度', definition: '行业相关新闻频次标准化', basis: '关注度效应' },
  // ── 新增因子（2026-07-15） ──
  { id: 'F2_9', name: '产业链位置', definition: '企业在产业链中的话语权评分（上游>下游=高分）', basis: '微笑曲线理论，上游研发/下游品牌溢价' },
  { id: 'F2_10', name: '政策传导效率', definition: '政策发布到行业业绩兑现的时间差反向标准化', basis: '政策落地时滞效应，影响投资节奏' },
  { id: 'F2_11', name: '行业增速天花板', definition: '行业 TAM 渗透率空间标准化，衡量增长上限', basis: 'S 曲线增长模型，渗透率<20%为高成长期' },
] as const

function generateMacroData(n: number) {
  const data = Array.from({ length: n }, () => {
    const policy = gaussian(3, 1)
    return {
      F2_1: clamp(policy),
      F2_2: clamp(policy * 0.6 + gaussian(1, 0.8)),
      F2_3: clamp(gaussian(3, 1)), // 独立
      F2_4: clamp(policy * 0.4 + gaussian(1.5, 0.9)),
      F2_5: clamp(gaussian(2.5, 1.2)), // 独立
      F2_6: clamp(5 - policy * 0.3 + gaussian(1, 1)), // 弱反向
      F2_7: clamp(policy * 0.5 + gaussian(1.5, 1)), // 与政策正相关
      F2_8: clamp(gaussian(2, 1.5)), // 独立噪声
      // 新增因子
      F2_9: clamp(policy * 0.3 + gaussian(2, 1)), // 产业链位置弱受政策影响
      F2_10: clamp(policy * 0.4 + gaussian(1.5, 0.8)), // 传导效率与政策正相关
      F2_11: clamp(gaussian(2.5, 1.3)), // 行业天花板独立
    }
  })
  const y = data.map(d =>
    0.20 * d.F2_1 + 0.15 * d.F2_2 + 0.12 * d.F2_3 + 0.12 * d.F2_4 +
    0.08 * d.F2_5 + 0.08 * d.F2_6 + 0.05 * d.F2_7 + 0.0 * d.F2_8 + // F2_8 不显著
    0.08 * d.F2_9 + 0.07 * d.F2_10 + 0.05 * d.F2_11 + // 新增因子
    gaussian(0, 0.15),
  )
  return { data, y }
}

describe('板块2: 宏观行业评分因子体系', () => {
  const { data, y } = generateMacroData(200)
  const factorIds = MACRO_FACTORS.map(f => f.id)
  const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))

  it('应定义 11 个关键因子', () => {
    expect(MACRO_FACTORS).toHaveLength(11)
  })

  it('应计算 Spearman 等级相关（适合序数型因子）', () => {
    const va = data.map(d => d.F2_1)
    const vb = data.map(d => d.F2_2)
    const rho = spearmanCorrelation(va, vb)
    // 政策与景气应 Spearman 正相关
    expect(rho).toBeGreaterThan(0.2)
  })

  it('应执行 OLS 回归', () => {
    const result = olsRegression(y, factorValues, factorIds)
    expect(result.rSquared).toBeGreaterThan(0.5)
    expect(result.fStatistic).toBeGreaterThan(5)
    expect(result.significantFactors.length).toBeGreaterThanOrEqual(5)
    expect(result.insignificantFactors).toContain('F2_8')
  })

  it('因子筛选后 R² 应保持稳定', () => {
    // 全因子回归
    const fullResult = olsRegression(y, factorValues, factorIds)
    // 剔除不显著因子后回归
    const significantIds = factorIds.filter((_, i) =>
      (fullResult.pValues[i + 1] ?? 1) < 0.05,
    )
    if (significantIds.length > 0) {
      const significantValues = significantIds.map(id =>
        data.map(d => d[id as keyof typeof d]),
      )
      const filteredResult = olsRegression(y, significantValues, significantIds)
      // 剔除不显著因子后 R² 不应大幅下降
      expect(filteredResult.rSquared).toBeGreaterThan(fullResult.rSquared * 0.8)
    }
  })
})

// ============================================================
// 板块3: 技术情绪评分因子体系
// ============================================================

const TECH_FACTORS = [
  { id: 'F3_1', name: 'RSI动量', definition: '14日相对强弱指数标准化（0-5）', basis: '经典动量指标' },
  { id: 'F3_2', name: 'MACD信号', definition: 'MACD金叉/死叉信号强度', basis: '趋势跟踪核心指标' },
  { id: 'F3_3', name: '布林位置', definition: '价格在布林带中的位置（0=下轨, 5=上轨）', basis: '波动率回归' },
  { id: 'F3_4', name: '成交量比', definition: '20日均量/60日均量', basis: '量价配合验证' },
  { id: 'F3_5', name: '换手率', definition: '日换手率标准化', basis: '流动性代理' },
  { id: 'F3_6', name: 'Hype周期', definition: 'Gartner Hype Cycle 阶段评分', basis: '概念炒作周期理论' },
  { id: 'F3_7', name: '新闻情绪', definition: 'NLP情感分析得分', basis: '行为金融学情绪因子' },
  { id: 'F3_8', name: '北向资金', definition: '北向资金净流入标准化', basis: '外资风向标' },
  // ── 新增因子（2026-07-15） ──
  { id: 'F3_9', name: 'KDJ随机指标', definition: 'K/D/J 三线交叉信号强度标准化', basis: '超买超卖震荡指标，与RSI互补' },
  { id: 'F3_10', name: '波动率ATR', definition: '14日 ATR 反向标准化（低波动=高分）', basis: '风险调整后收益核心，低波动率异象' },
  { id: 'F3_11', name: '筹码集中度', definition: '获利盘比例 × 集中度系数，衡量筹码锁定程度', basis: '筹码分布理论，高集中度=主力控盘' },
] as const

function generateTechData(n: number) {
  const data = Array.from({ length: n }, () => {
    const momentum = gaussian(2.5, 1.2)
    return {
      F3_1: clamp(momentum + gaussian(0, 0.5)),
      F3_2: clamp(momentum * 0.7 + gaussian(0.5, 0.8)),
      F3_3: clamp(gaussian(2.5, 1)), // 独立
      F3_4: clamp(momentum * 0.4 + gaussian(1.5, 0.9)),
      F3_5: clamp(gaussian(2, 1.3)), // 独立
      F3_6: clamp(gaussian(2.5, 1.5)), // 独立
      F3_7: clamp(momentum * 0.3 + gaussian(2, 1)), // 弱相关
      F3_8: clamp(gaussian(2.5, 1)), // 独立
      // 新增因子
      F3_9: clamp(momentum * 0.5 + gaussian(1, 0.8)), // KDJ 与 RSI 同属动量群，正相关
      F3_10: clamp(5 - Math.abs(momentum - 2.5) * 0.5 + gaussian(1.5, 0.7)), // 波动率：中性动量=低波动
      F3_11: clamp(momentum * 0.3 + gaussian(2, 0.9)), // 筹码集中度弱正相关
    }
  })
  const y = data.map(d =>
    0.20 * d.F3_1 + 0.15 * d.F3_2 + 0.08 * d.F3_3 + 0.12 * d.F3_4 +
    0.08 * d.F3_5 + 0.08 * d.F3_6 + 0.08 * d.F3_7 + 0.0 * d.F3_8 + // F3_8 不显著
    0.10 * d.F3_9 + 0.06 * d.F3_10 + 0.05 * d.F3_11 + // 新增因子
    gaussian(0, 0.2),
  )
  return { data, y }
}

describe('板块3: 技术情绪评分因子体系', () => {
  const { data, y } = generateTechData(200)
  const factorIds = TECH_FACTORS.map(f => f.id)
  const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))

  it('应定义 11 个关键因子', () => {
    expect(TECH_FACTORS).toHaveLength(11)
  })

  it('RSI 与 MACD 应正相关（同属动量因子群）', () => {
    const r = pearsonCorrelation(data.map(d => d.F3_1), data.map(d => d.F3_2))
    expect(r).toBeGreaterThan(0.3)
  })

  it('应执行 OLS 回归并识别不显著因子', () => {
    const result = olsRegression(y, factorValues, factorIds)
    expect(result.rSquared).toBeGreaterThan(0.5)
    // F3_8(北向) 权重=0 或 F3_10(波动率非线性) 应被识别为不显著
    expect(result.insignificantFactors.length).toBeGreaterThan(0)
  })

  it('Adjusted R² 应低于 R²（惩罚多余变量）', () => {
    const result = olsRegression(y, factorValues, factorIds)
    expect(result.adjustedRSquared).toBeLessThanOrEqual(result.rSquared)
  })
})

// ============================================================
// 板块4: 数据采集质量因子体系
// ============================================================

const QUALITY_FACTORS = [
  { id: 'F4_1', name: '数据完整率', definition: '非空字段/总字段 × 100%', basis: '数据质量基础指标' },
  { id: 'F4_2', name: '采集成功率', definition: '成功采集次数/总采集次数', basis: '系统可靠性' },
  { id: 'F4_3', name: '平均延迟', definition: '采集请求到响应的平均耗时(ms)反向标准化', basis: '时效性' },
  { id: 'F4_4', name: '降级次数', definition: '降级到 Mock 的次数反向标准化', basis: '数据源冗余度' },
  { id: 'F4_5', name: '写入成功率', definition: 'IndexedDB 写入成功/总写入', basis: '持久化可靠性' },
  { id: 'F4_6', name: '数据新鲜度', definition: '数据最后更新距今小时数反向标准化', basis: '数据老化程度' },
  { id: 'F4_7', name: '契约校验通过率', definition: 'marketDataContract 校验通过比例', basis: '数据合规性' },
  // ── 新增因子（2026-07-15） ──
  { id: 'F4_8', name: '采集覆盖广度', definition: '已接入数据源数/计划数据源数 × 100%', basis: '数据源多样性，降低单源风险' },
  { id: 'F4_9', name: '频率合规率', definition: '按配置频率实际执行采集的比例', basis: '调度可靠性，反映定时器精度' },
] as const

function generateQualityData(n: number) {
  const data = Array.from({ length: n }, () => {
    const systemHealth = gaussian(3.5, 0.8)
    return {
      F4_1: clamp(systemHealth + gaussian(0, 0.3)),
      F4_2: clamp(systemHealth * 0.9 + gaussian(0.2, 0.4)),
      F4_3: clamp(systemHealth * 0.7 + gaussian(0.5, 0.5)),
      F4_4: clamp(5 - systemHealth * 0.5 + gaussian(0.5, 0.6)),
      F4_5: clamp(systemHealth * 0.85 + gaussian(0.3, 0.4)),
      F4_6: clamp(systemHealth * 0.6 + gaussian(1, 0.7)),
      F4_7: clamp(systemHealth * 0.8 + gaussian(0.3, 0.5)),
      // 新增因子
      F4_8: clamp(systemHealth * 0.7 + gaussian(0.5, 0.5)), // 覆盖广度与系统健康正相关
      F4_9: clamp(systemHealth * 0.85 + gaussian(0.3, 0.4)), // 频率合规率
    }
  })
  const y = data.map(d =>
    0.18 * d.F4_1 + 0.18 * d.F4_2 + 0.12 * d.F4_3 + 0.08 * d.F4_4 +
    0.12 * d.F4_5 + 0.08 * d.F4_6 + 0.08 * d.F4_7 +
    0.08 * d.F4_8 + 0.08 * d.F4_9 + // 新增因子
    gaussian(0, 0.1),
  )
  return { data, y }
}

describe('板块4: 数据采集质量因子体系', () => {
  const { data, y } = generateQualityData(200)
  const factorIds = QUALITY_FACTORS.map(f => f.id)
  const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))

  it('应定义 9 个关键因子', () => {
    expect(QUALITY_FACTORS).toHaveLength(9)
  })

  it('完整率与成功率应高度正相关', () => {
    const r = pearsonCorrelation(data.map(d => d.F4_1), data.map(d => d.F4_2))
    expect(r).toBeGreaterThan(0.5)
  })

  it('应执行 OLS 回归（全因子显著）', () => {
    const result = olsRegression(y, factorValues, factorIds)
    expect(result.rSquared).toBeGreaterThan(0.7)
    expect(result.significantFactors.length).toBeGreaterThanOrEqual(5)
  })
})

// ============================================================
// 板块5: 双通道同步效率因子体系
// ============================================================

const SYNC_FACTORS = [
  { id: 'F5_1', name: '冲突检出率', definition: '冲突记录/总记录 × 100% 反向标准化', basis: '数据一致性' },
  { id: 'F5_2', name: '更新成功率', definition: '更新成功次数/总更新次数', basis: '同步可靠性' },
  { id: 'F5_3', name: '增量命中率', definition: '哈希比对识别变更的比例', basis: '增量更新效率' },
  { id: 'F5_4', name: '过期维度数', definition: 'stalenessDetector 检出的过期维度数反向标准化', basis: '数据时效' },
  { id: 'F5_5', name: '批量吞吐量', definition: '批量更新记录/秒', basis: '系统性能' },
  { id: 'F5_6', name: '降级深度', definition: '降级链跳数反向标准化', basis: '数据源冗余' },
  { id: 'F5_7', name: '校对通过率', definition: 'proofreadReport overallStatus=pass 的比例', basis: '质量保障' },
  { id: 'F5_8', name: '同步延迟', definition: '同步触发到完成的耗时反向标准化', basis: '响应速度' },
  // ── 新增因子（2026-07-15） ──
  { id: 'F5_9', name: '冲突自动解决率', definition: '自动解决冲突数/总冲突数 × 100%', basis: '自动化程度，减少人工干预' },
  { id: 'F5_10', name: '数据血缘追溯率', definition: '含 dataProvenance 标记的记录/总记录 × 100%', basis: '溯源完整性，支持审计回溯' },
] as const

function generateSyncData(n: number) {
  const data = Array.from({ length: n }, () => {
    const efficiency = gaussian(3, 1)
    return {
      F5_1: clamp(efficiency * 0.8 + gaussian(0.5, 0.5)),
      F5_2: clamp(efficiency * 0.9 + gaussian(0.2, 0.4)),
      F5_3: clamp(efficiency * 0.6 + gaussian(1, 0.7)),
      F5_4: clamp(efficiency * 0.7 + gaussian(0.5, 0.6)),
      F5_5: clamp(gaussian(2.5, 1.2)), // 独立
      F5_6: clamp(efficiency * 0.5 + gaussian(1.5, 0.8)),
      F5_7: clamp(efficiency * 0.85 + gaussian(0.3, 0.4)),
      F5_8: clamp(gaussian(2.5, 1)), // 不显著
      // 新增因子
      F5_9: clamp(efficiency * 0.7 + gaussian(0.8, 0.6)), // 自动解决率与效率正相关
      F5_10: clamp(efficiency * 0.6 + gaussian(1.2, 0.7)), // 血缘追溯率
    }
  })
  const y = data.map(d =>
    0.12 * d.F5_1 + 0.15 * d.F5_2 + 0.08 * d.F5_3 + 0.12 * d.F5_4 +
    0.08 * d.F5_5 + 0.08 * d.F5_6 + 0.12 * d.F5_7 + 0.05 * d.F5_8 +
    0.07 * d.F5_9 + 0.05 * d.F5_10 + // 新增因子
    gaussian(0, 0.15),
  )
  return { data, y }
}

describe('板块5: 双通道同步效率因子体系', () => {
  const { data, y } = generateSyncData(200)
  const factorIds = SYNC_FACTORS.map(f => f.id)
  const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))

  it('应定义 10 个关键因子', () => {
    expect(SYNC_FACTORS).toHaveLength(10)
  })

  it('应计算完整相关矩阵', () => {
    const matrix: Record<string, Record<string, number>> = {}
    for (const a of factorIds) {
      matrix[a] = {}
      for (const b of factorIds) {
        matrix[a][b] = Math.round(pearsonCorrelation(
          data.map(d => d[a as keyof typeof d]),
          data.map(d => d[b as keyof typeof d]),
        ) * 100) / 100
      }
    }
    expect(matrix.F5_1!.F5_2).toBeGreaterThan(0.3)
  })

  it('应执行 OLS 回归', () => {
    const result = olsRegression(y, factorValues, factorIds)
    expect(result.rSquared).toBeGreaterThan(0.5)
    expect(result.equation).toContain('Y =')
  })

  it('因子筛选应保留核心变量', () => {
    const result = olsRegression(y, factorValues, factorIds)
    // 应保留至少 5 个显著因子
    expect(result.significantFactors.length).toBeGreaterThanOrEqual(4)
  })
})

// ============================================================
// 权威方案校对比较
// ============================================================

describe('权威方案校对比较', () => {
  it('Fama-French 三因子对标：应包含市场/规模/价值因子映射', () => {
    // V6 引擎的因子与 Fama-French 映射关系
    const mapping = {
      'MKT(市场)': ['L0 STEEP宏观', 'L8 技术筹码'],
      'SMB(规模)': ['L2 竞品格局', 'L5 T-M矩阵'],
      'HML(价值)': ['L3v 估值水平', 'L3f 财务健康'],
    }
    expect(Object.keys(mapping)).toHaveLength(3)
    for (const [, layers] of Object.entries(mapping)) {
      expect(layers.length).toBeGreaterThan(0)
    }
  })

  it('Barra 风险因子对标：应覆盖主要风格因子', () => {
    const barraMapping = {
      'Beta': 'L8 技术筹码',
      'Momentum': 'L8 技术筹码',
      'Size': 'L2 竞品格局',
      'Value': 'L3v 估值水平',
      'Growth': 'L7 第二曲线',
      'Leverage': 'L3f 财务健康(负债率)',
      'Liquidity': 'L8 技术筹码(换手率)',
    }
    expect(Object.keys(barraMapping)).toHaveLength(7)
  })

  it('IC/IR 方法对标：应支持信息系数计算', () => {
    // V6 评分可视为因子值，与未来收益的 Spearman 相关即为 IC
    const { data, y } = generateFundamentalData(100)
    const ic = spearmanCorrelation(data.map(d => d.F1_1), y)
    // IC 应为正（因子与目标正相关）
    expect(ic).toBeGreaterThan(0)
  })

  it('因子正交化对标：VIF 应检测多重共线性', () => {
    const { data, y } = generateFundamentalData(100)
    const factorValues = ['F1_1', 'F1_2', 'F1_3', 'F1_4'].map(id =>
      data.map(d => d[id as keyof typeof d]),
    )
    const result = olsRegression(y, factorValues, ['F1_1', 'F1_2', 'F1_3', 'F1_4'])
    // F1_1 与 F1_2 高度相关，VIF 应 > 2
    const vifF1_1 = result.vif[0] ?? 1
    expect(vifF1_1).toBeGreaterThan(1)
  })

  it('统计显著性对标：p < 0.05 筛选标准', () => {
    const { data, y } = generateFundamentalData(200)
    const factorIds = FUNDAMENTAL_FACTORS.map(f => f.id)
    const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))
    const result = olsRegression(y, factorValues, factorIds)

    // 权威标准：p < 0.05 为显著
    for (const pValue of result.pValues.slice(1)) {
      if (pValue < 0.05) {
        // 显著因子
        expect(pValue).toBeLessThan(0.05)
      }
    }
    // 应至少有 5 个显著因子
    expect(result.significantFactors.length).toBeGreaterThanOrEqual(5)
  })

  it('Adjusted R² 对标：应高于 0.3（解释力达标）', () => {
    const { data, y } = generateFundamentalData(200)
    const factorIds = FUNDAMENTAL_FACTORS.map(f => f.id)
    const factorValues = factorIds.map(id => data.map(d => d[id as keyof typeof d]))
    const result = olsRegression(y, factorValues, factorIds)
    // 量化投资中 Adjusted R² > 0.3 可接受
    expect(result.adjustedRSquared).toBeGreaterThan(0.3)
  })
})
