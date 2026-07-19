/**
 * @doc [V9-DOC-PROJ-003, V9-DOC-BACK-005, V9-DOC-BACK-008, V9-DOC-BACK-010, V9-DOC-ARCH-008]
 */
// 评分因子配置
// 核心因子与维度均为业务自提炼，集中管理以支持后续扩容、权重调优与因子追踪。

export interface ScoreFactor {
  /** 因子唯一标识 */
  key: string
  /** 展示名称 */
  name: string
  /** 权重（总和不必为 1，计算时归一化） */
  weight: number
  /** 因子定义与取数口径 */
  description: string
  /** 主要数据来源 */
  dataSources: string[]
  /** 与 V6/F 技能的映射关系（参考，非绑定） */
  skillMapping: string
  /** 是否启用 */
  enabled: boolean
}

export interface ScoreFactorSet {
  version: string
  updatedAt: string
  factors: ScoreFactor[]
}

/** V6 个股智能评分九维因子（自提炼） */
export const STOCK_SCORE_FACTORS: ScoreFactorSet = {
  version: 'v1.0.0',
  updatedAt: '2026-06-24',
  factors: [
    {
      key: 'valuation',
      name: '估值',
      weight: 1,
      description: 'PE、PB、PS、PEG 相对估值水平。显著低估(PEG<0.5)高分，高估(>1.5)低分。',
      dataSources: ['基础数据 pe / pb', '行业报告估值基准'],
      skillMapping: 'V6 L3b 估值水平 / v6-stock-analysis-model 估值行业基准',
      enabled: true,
    },
    {
      key: 'growth',
      name: '成长',
      weight: 1,
      description: '营收/利润增速、ROE 持续性、行业空间、第二曲线贡献。',
      dataSources: ['基础数据 + 报告', '行业增速'],
      skillMapping: 'V6 L7 第二曲线 / L5 技术成熟度',
      enabled: true,
    },
    {
      key: 'profitability',
      name: '盈利',
      weight: 1,
      description: 'ROE、毛利率、净利率、现金流质量。经营现金流/净利>120%健康。',
      dataSources: ['基础数据 roe', '财报现金流'],
      skillMapping: 'V6 L3a 财务健康',
      enabled: true,
    },
    {
      key: 'quality',
      name: '质量',
      weight: 1,
      description: '资产负债表健康度、治理结构、盈利可持续性。',
      dataSources: ['基础数据 + 报告'],
      skillMapping: 'V6 L1 护城河 / L3a 财务风险预警',
      enabled: true,
    },
    {
      key: 'momentum',
      name: '动量',
      weight: 1,
      description: '近期价格趋势、相对强度、突破形态、技术筹码强度。',
      dataSources: ['基础数据 price', '报告'],
      skillMapping: 'V6 L8 技术筹码',
      enabled: true,
    },
    {
      key: 'volatility',
      name: '波动',
      weight: 1,
      description: '价格波动率、回撤控制、融资余额变化、筹码稳定性。',
      dataSources: ['基础数据 + 报告'],
      skillMapping: 'V6 L8 技术筹码',
      enabled: true,
    },
    {
      key: 'liquidity',
      name: '流动性',
      weight: 1,
      description: '成交量、市值、换手率。成交量/60日均量<60%为洼地。',
      dataSources: ['基础数据 marketCap', '量价数据'],
      skillMapping: 'V6 L8 技术筹码',
      enabled: true,
    },
    {
      key: 'industry',
      name: '行业',
      weight: 1,
      description: '行业景气度、政策支持、竞争格局、国产替代空间。',
      dataSources: ['行业分析报告'],
      skillMapping: 'V6 L-1 行业评分估值 / L0 宏观扫描',
      enabled: true,
    },
    {
      key: 'sentiment',
      name: '情绪',
      weight: 1,
      description: '市场关注度、资金流向、事件催化、Hype 周期位置。',
      dataSources: ['补充资料 + 报告'],
      skillMapping: 'V6 L6 Hype Cycle / L4 情景推演',
      enabled: true,
    },
  ],
}

/** V4 行业评分七维因子（自提炼） */
export const INDUSTRY_SCORE_FACTORS: ScoreFactorSet = {
  version: 'v1.0.0',
  updatedAt: '2026-06-24',
  factors: [
    {
      key: 'policyAlignment',
      name: '政策契合度',
      weight: 1,
      description: '与十五五规划、国家战略、地方政策的匹配程度。',
      dataSources: ['SKILL planAlignment / policySupport', '政策文件'],
      skillMapping: 'sector-analysis-framework 政策环境',
      enabled: true,
    },
    {
      key: 'scarcity',
      name: '稀缺性',
      weight: 1,
      description: '资源/技术/产能的全球稀缺程度与不可替代性。',
      dataSources: ['SKILL-C structuralScarcity', 'SKILL-A scarcityValue'],
      skillMapping: 'SKILL-C / SKILL-A 稀缺价值',
      enabled: true,
    },
    {
      key: 'localization',
      name: '国产替代空间',
      weight: 1,
      description: '关键环节的进口依赖度与自主可控潜力。',
      dataSources: ['SKILL-C localizationBarrier', '国产化率数据'],
      skillMapping: 'sector-analysis-framework 外部竞争/国产替代',
      enabled: true,
    },
    {
      key: 'techAdvancement',
      name: '技术先进性',
      weight: 1,
      description: '技术迭代速度、代际差距、范式转换机会。',
      dataSources: ['SKILL-C techAdvancement', 'SKILL-N techMigration'],
      skillMapping: 'sector-analysis-framework 技术跃迁',
      enabled: true,
    },
    {
      key: 'prosperity',
      name: '行业景气度',
      weight: 1,
      description: '下游需求、产能周期、订单/出货量趋势。',
      dataSources: ['SKILL-N downstream / rotationSignal', '下游市场数据'],
      skillMapping: 'sector-analysis-framework 下游市场',
      enabled: true,
    },
    {
      key: 'valuation',
      name: '估值吸引力',
      weight: 1,
      description: '相对历史与全球同行的估值水平。',
      dataSources: ['SKILL-N fundValuation', '板块PE/PB/PEG'],
      skillMapping: 'sector-analysis-framework 基金估值',
      enabled: true,
    },
    {
      key: 'sentiment',
      name: '情绪热度',
      weight: 1,
      description: '资金关注度、主题热度、成交量/融资余额变化。',
      dataSources: ['SKILL-N rotationSignal', '资金面数据'],
      skillMapping: 'sector-analysis-framework 板块轮动信号',
      enabled: true,
    },
  ],
}

export function getEnabledStockFactorNames(): string[] {
  return STOCK_SCORE_FACTORS.factors.filter((f) => f.enabled).map((f) => f.name)
}

export function getEnabledIndustryFactorNames(): string[] {
  return INDUSTRY_SCORE_FACTORS.factors.filter((f) => f.enabled).map((f) => f.name)
}

export function getStockFactorByName(name: string): ScoreFactor | undefined {
  return STOCK_SCORE_FACTORS.factors.find((f) => f.name === name)
}

export function getIndustryFactorByName(name: string): ScoreFactor | undefined {
  return INDUSTRY_SCORE_FACTORS.factors.find((f) => f.name === name)
}

interface FactorWeight {
  name: string
  weight: number
  enabled?: boolean
}

/** 计算加权综合分（仅对非 null 有效分数归一化加权） */
export function calculateWeightedScore(
  scores: Array<{ name: string; score: number | null }>,
  factors: FactorWeight[],
): number | null {
  const valid = scores
    .map((s) => {
      const factor = factors.find((f) => f.name === s.name && (f.enabled ?? true))
      if (!factor || s.score === null) return null
      return { score: s.score, weight: factor.weight }
    })
    .filter((item): item is { score: number; weight: number } => item !== null)

  if (valid.length === 0) return null

  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return null

  const weightedSum = valid.reduce((sum, item) => sum + item.score * item.weight, 0)
  return Math.round((weightedSum / totalWeight) * 100) / 100
}
