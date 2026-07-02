/**
 * V6 评分引擎配置层 — 零硬编码
 *
 * 所有阈值、权重、公式参数均从此模块注入引擎。
 * 可通过 V6ScoreConfigOverride 运行时覆盖，支持 Backtestable 接口。
 */

// ============================================================
// 权重配置
// ============================================================

/** 各层权重（合计 1.0） */
export interface V6ScoreWeightsConfig {
  lMinus1: number    // L-1 行业评分估值
  l0: number         // L0 STEEP 宏观
  l1: number         // L1 护城河
  l2: number         // L2 竞品格局
  l3f: number        // L3a 财务健康
  l3v: number        // L3b 估值水平
  l4: number         // L4 情景推演
  l5: number         // L5 T-M矩阵
  l6: number         // L6 Hype周期
  l7: number         // L7 第二曲线
  l8: number         // L8 技术筹码
}

/** 默认权重（来自 SKILL v4.3 行业评分映射文档） */
export const DEFAULT_WEIGHTS: V6ScoreWeightsConfig = {
  lMinus1: 0.10,
  l0: 0.08,
  l1: 0.15,
  l2: 0.10,
  l3f: 0.10,
  l3v: 0.08,
  l4: 0.08,
  l5: 0.05,
  l6: 0.07,
  l7: 0.15,
  l8: 0.04,
}

// ============================================================
// 阈值配置
// ============================================================

/** 综合评分阈值 */
export interface V6ScoreThresholdsConfig {
  /** 评级边界 */
  rating: {
    strongBuy: number   // >= 此值 → strong_buy
    buy: number         // >= 此值 → buy
    hold: number        // >= 此值 → hold
    sell: number        // >= 此值 → sell（低于为 strong_sell）
  }
  /** 每层评分范围 */
  layerScore: { min: number; max: number }
  /** 综合评分范围 */
  composite: { min: number; max: number }
}

export const DEFAULT_THRESHOLDS: V6ScoreThresholdsConfig = {
  rating: {
    strongBuy: 4.0,
    buy: 3.0,
    hold: 2.0,
    sell: 1.0,
  },
  layerScore: { min: 0, max: 5 },
  composite: { min: 0, max: 5 },
}

// ============================================================
// 行业基准配置
// ============================================================

/** 行业估值基准 */
export interface IndustryBenchmark {
  sector: string
  /** 关键词匹配列表 */
  keywords: string[]
  /** 合理 PE 区间 */
  peLow: number
  peHigh: number
  /** 合理 PEG */
  peglow: number
  pegHigh: number
  /** 合理 PB 区间 */
  pbLow: number
  pbHigh: number
}

/** 8行业基准库（来自 SKILL L3 估值行业基准库） */
export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  { sector: '化工', keywords: ['化工', '化学', '石化', '新材料'], peLow: 10, peHigh: 20, peglow: 0.5, pegHigh: 1.0, pbLow: 1.5, pbHigh: 3 },
  { sector: '半导体', keywords: ['半导体', '芯片', '集成电路', '晶圆', '封测'], peLow: 30, peHigh: 50, peglow: 1.0, pegHigh: 1.8, pbLow: 3, pbHigh: 5 },
  { sector: '新能源', keywords: ['新能源', '光伏', '风电', '储能', '锂电'], peLow: 15, peHigh: 25, peglow: 0.5, pegHigh: 1.0, pbLow: 2, pbHigh: 4 },
  { sector: '消费', keywords: ['消费', '食品', '饮料', '白酒', '家电', '零售'], peLow: 20, peHigh: 35, peglow: 1.0, pegHigh: 1.5, pbLow: 3, pbHigh: 6 },
  { sector: '金融', keywords: ['银行', '保险', '证券', '金融'], peLow: 5, peHigh: 10, peglow: 0, pegHigh: 0, pbLow: 0.8, pbHigh: 1.2 },
  { sector: '医药', keywords: ['医药', '创新药', 'CXO', '生物', '医疗器械', '中药'], peLow: 25, peHigh: 40, peglow: 0.8, pegHigh: 1.5, pbLow: 3, pbHigh: 5 },
  { sector: '电力设备', keywords: ['电力', '电网', '电气', '变压器', '开关'], peLow: 15, peHigh: 25, peglow: 0.5, pegHigh: 1.0, pbLow: 2, pbHigh: 4 },
  { sector: 'AI/TMT', keywords: ['AI', '人工智能', 'TMT', '软件', '互联网', '云计算', '大数据'], peLow: 30, peHigh: 60, peglow: 1.0, pegHigh: 2.0, pbLow: 3, pbHigh: 6 },
]

// ============================================================
// 财务风险预警配置
// ============================================================

export interface RiskWarningConfig {
  /** 红色预警条件（触发即降1分） */
  red: string[]
  /** 黄色预警条件（触发需标注） */
  yellow: string[]
}

export const RISK_WARNINGS: RiskWarningConfig = {
  red: [
    '经营现金流连续两季为负',
    '应收账款增速 > 营收增速50%+',
    '存货周转天数同比延长 > 30天',
    '大股东质押 > 50%',
    '审计非标意见',
  ],
  yellow: [
    '毛利率连续两季下滑',
    '有息负债增速 > 资产增速',
    '商誉/净资产 > 30%',
    '客户集中度TOP5 > 50%',
  ],
}

// ============================================================
// IPC 业绩兑现临界点配置
// ============================================================

export interface IPCConfig {
  /** OCR 阈值 */
  ocr: {
    superStrong: number   // ≥2.5x
    strong: number        // ≥1.5x
    medium: number        // ≥0.8x
    weak: number          // ≥0.3x
    ocrAccelSignal: number // ΔOCR > +0.3
  }
  /** MCE 阈值 */
  mce: {
    trackLevel: number    // ≥10x
    categoryLevel: number // ≥3x
    segmentLevel: number  // ≥1.5x
    decay3m: number       // 0-3月 不打折
    decay6m: number       // 3-6月 ×0.8
    decay12m: number      // 6-12月 ×0.5
  }
  /** TIMS */
  tims: {
    disruptive: number    // 颠覆性创新 1.5-2.0
    significant: number   // 1.2-1.5
    differentiated: number // 1.0-1.2
    follower: number      // 0.8-1.0
    laggard: number       // ≤0.8
  }
  /** IPC 合成权重 */
  ipcWeights: { ocr: number; mce: number; tims: number }
  /** IPC 阶段边界 */
  ipcStages: {
    broken: number        // ≥4.5 临界点已突破
    near: number          // ≥3.5 临界点附近
    before: number        // ≥2.5 临界点前夜
    far: number           // ≥1.5 临界点遥远
  }
}

export const IPC_CONFIG: IPCConfig = {
  ocr: { superStrong: 2.5, strong: 1.5, medium: 0.8, weak: 0.3, ocrAccelSignal: 0.3 },
  mce: { trackLevel: 10, categoryLevel: 3, segmentLevel: 1.5, decay3m: 1.0, decay6m: 0.8, decay12m: 0.5 },
  tims: { disruptive: 1.75, significant: 1.35, differentiated: 1.1, follower: 0.9, laggard: 0.7 },
  ipcWeights: { ocr: 0.35, mce: 0.30, tims: 0.35 },
  ipcStages: { broken: 4.5, near: 3.5, before: 2.5, far: 1.5 },
}

// ============================================================
// 筹码变化度配置
// ============================================================

export const CHIP_LEVELS = [
  'SCD',   // 股东人数变化度
  'PCH',   // 筹码集中度
  'AII',   // 庄家吸筹强度指数
  'MATRIX', // 筹码博弈态势矩阵
  'RSI',   // 筹码相对强弱
  'CCS',   // 筹码系统性风险
  'DIV',   // 散户游资辨识度
  'CSR',   // 筹码结构风险比
] as const

export type ChipLevel = typeof CHIP_LEVELS[number]

// ============================================================
// 置信度配置
// ============================================================

export interface ConfidenceConfig {
  /** 数据来源可信度分级 */
  sourceGrades: Record<string, { grade: string; score: number; description: string }>
  /** ESS 证据充分度评分 */
  ess: { minEvidence: number; sufficientThreshold: number }
}

export const CONFIDENCE_CONFIG: ConfidenceConfig = {
  sourceGrades: {
    A: { grade: 'A', score: 1.0, description: '监管文件/官方公告/审计报告' },
    B: { grade: 'B', score: 0.85, description: '公司公告/行业权威机构' },
    C: { grade: 'C', score: 0.7, description: '第三方研报/券商测算' },
    D: { grade: 'D', score: 0.5, description: '媒体/非官方渠道' },
    E: { grade: 'E', score: 0.3, description: '推断/估计值' },
  },
  ess: { minEvidence: 3, sufficientThreshold: 5 },
}

// ============================================================
// 引擎运行时配置
// ============================================================

export interface V6ScoreEngineConfig {
  weights: V6ScoreWeightsConfig
  thresholds: V6ScoreThresholdsConfig
  ipc: IPCConfig
  confidence: ConfidenceConfig
  industries: IndustryBenchmark[]
  riskWarnings: RiskWarningConfig
  /** 是否启用离线模式 */
  offlineMode: boolean
  /** 是否启用审计追踪 */
  auditEnabled: boolean
  /** 是否启用 LLM 增强 */
  llmEnabled: boolean
}

export const DEFAULT_ENGINE_CONFIG: V6ScoreEngineConfig = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  ipc: IPC_CONFIG,
  confidence: CONFIDENCE_CONFIG,
  industries: INDUSTRY_BENCHMARKS,
  riskWarnings: RISK_WARNINGS,
  offlineMode: true,
  auditEnabled: true,
  llmEnabled: false,
}

/** 部分覆盖配置 */
export type V6ScoreConfigOverride = Partial<V6ScoreEngineConfig>