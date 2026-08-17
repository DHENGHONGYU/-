/**
 * V6 评分引擎配置层 — 零硬编码
 *
 * 所有阈值、权重、公式参数均从此模块注入引擎。
 * 可通过 V6ScoreConfigOverride 运行时覆盖，支持 Backtestable 接口。
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-PROJ-053]
*/

import type {
  V6ScoreWeightsConfig,
  V6ScoreThresholdsConfig,
  IndustryBenchmark,
  RiskWarningConfig,
  IPCConfig,
  ConfidenceConfig,
  V6ScoreEngineConfig,
  RAGConfig,
  ChipLevel,
} from '@/types/modules/engine.types'

// Re-export types for backward compatibility
export type {
  V6ScoreWeightsConfig,
  V6ScoreThresholdsConfig,
  IndustryBenchmark,
  RiskWarningConfig,
  IPCConfig,
  ConfidenceConfig,
  V6ScoreEngineConfig,
  RAGConfig,
  ChipLevel,
}

// ============================================================
// 权重配置
// ============================================================

/**
 * 默认权重（v2.0 区分度增强版）
 *
 * v1.0 → v2.0 调整依据（解决 20 只穿行测试"19 hold / 1 sell，无 buy"集中度问题）：
 *   1. 数据缺失层（L0 STEEP 宏观、L4 情景推演）在无财务/行业数据时返回≈3分中性，
 *      是拉向中心的主要原因 → 降低其权重（L0:0.08→0.04，L4:0.08→0.04）。
 *   2. 有真实数据支撑且可跨股票区分的层（L3v 估值水平、L8 技术筹码）
 *      真实 PE/PB/K 线能反映估值高低与趋势 → 提高权重（L3v:0.08→0.14，L8:0.04→0.10）。
 *   3. L1/L7 在离线模式下仍返回中性分（无护城河/第二曲线主观判断数据）→
 *      适度下调（L1:0.15→0.12，L7:0.15→0.12），但仍保留作为长期维度占位。
 *   4. L-1 行业估值在有行业基准时可提供区分 → 由 0.10→0.11。
 *   5. 其余层权重小幅调整，总和保持 1.00。
 *
 * 调整前后权重对比：
 *   Layer  | v1.0 | v2.0 | 变化
 *   lMinus1| 0.10 | 0.11 | +0.01
 *   l0     | 0.08 | 0.04 | -0.04
 *   l1     | 0.15 | 0.12 | -0.03
 *   l2     | 0.10 | 0.10 | 0
 *   l3f    | 0.10 | 0.10 | 0
 *   l3v    | 0.08 | 0.14 | +0.06
 *   l4     | 0.08 | 0.04 | -0.04
 *   l5     | 0.05 | 0.05 | 0
 *   l6     | 0.07 | 0.06 | -0.01
 *   l7     | 0.15 | 0.12 | -0.03
 *   l8     | 0.04 | 0.10 | +0.06
 *   合计    | 1.00 | 1.00 | 0
 */
export const DEFAULT_WEIGHTS: V6ScoreWeightsConfig = {
  lMinus1: 0.11,
  l0: 0.04,
  l1: 0.12,
  l2: 0.10,
  l3f: 0.10,
  l3v: 0.14,
  l4: 0.04,
  l5: 0.05,
  l6: 0.06,
  l7: 0.12,
  l8: 0.10,
}

// ============================================================
// 阈值配置
// ============================================================

/**
 * DEFAULT_THRESHOLDS
 *
 * v1.0 → v2.0 评级阈值下移（解决"评分集中在 2.0–2.6，buy≥3.0 永远达不到"问题）：
 *   v1.0  strongBuy≥4.0 / buy≥3.0 / hold≥2.0 / sell≥1.0  → 所有 2.0+ 都 hold，
 *           仅 1.94 那只（隆基绿能）刚好低于 hold 阈值落 sell，区分度极差。
 *   v2.0  strongBuy≥3.5 / buy≥2.6 / hold≥1.7 / sell≥0.9
 *         → 让评分分布在 1.7-2.6 的股票能落入 buy / sell / hold 三段，
 *           20 只股票预期：3-5 只 buy，8-12 只 hold，2-4 只 sell。
 *         → 仍保持 strongBuy 严格（需≥3.5），对应深度基本面都优秀的标的。
 */
export const DEFAULT_THRESHOLDS: V6ScoreThresholdsConfig = {
  rating: {
    strongBuy: 3.5,
    buy: 2.6,
    hold: 1.7,
    sell: 0.9,
  },
  layerScore: { min: 0, max: 5 },
  composite: { min: 0, max: 5 },
}

// ============================================================
// 行业基准配置
// ============================================================

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

/**
 * RISK_WARNINGS
 */
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

/**
 * IPC_CONFIG
 */
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

/**
 * CHIP_LEVELS
 */
export const CHIP_LEVELS = [
  'SCD',   // 股东人数变化度
  'PCH',   // 筹码集中度
  'AII',   // 庄家吸筹强度指数
  'MATRIX', // 筹码博弈态势矩阵
  'RSI',   // 筹码相对强弱
  'CCS',   // 筹码系统性风险
  'DIV',   // 散户游资辨识度
  'CSR',   // 筹码结构风险比
  'PAS',   // 筹码穿透率（TASK-03）
  'BIAS',  // 筹码乖离率（TASK-04）
  'PRO',   // 获利盘比例（TASK-05）
] as const

// ============================================================
// 置信度配置
// ============================================================

/**
 * CONFIDENCE_CONFIG
 */
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
// RAG 增强评分配置
// ============================================================

/**
 * DEFAULT_RAG_CONFIG
 *
 * RAG（检索增强生成）配置：在 LLM 评分时，从向量数据库检索
 * 与当前股票和评分层最相关的研报/公告/新闻片段，注入 LLM prompt。
 *
 * 依赖：localEmbeddingService (bge-base-zh-v1.5) + HNSW 索引
 * 检索范围：profile_items 中有 content 的条目
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  /** Phase 1 完成：RAG Config Gate 已就位。默认关闭，联调时设为 true 启用 */
  enabled: true,
  /** 检索 top-K 文档数 */
  topK: 5,
  /** 向量相似度最低阈值（0-1），低于此值的文档不纳入上下文 */
  minSimilarity: 0.4,
  /** 每个文档片段最大字符数（截断超长内容） */
  maxChunkChars: 2000,
  /** 所有上下文总字符数上限（防止 prompt 超长） */
  maxTotalChars: 6000,
  /** 可检索的资料类型 */
  itemTypes: ['research_report', 'notice', 'news', 'industry_report', 'financial_report'],
}

// ============================================================
// 引擎运行时配置
// ============================================================

/**
 * DEFAULT_ENGINE_CONFIG
 */
export const DEFAULT_ENGINE_CONFIG: V6ScoreEngineConfig = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  ipc: IPC_CONFIG,
  confidence: CONFIDENCE_CONFIG,
  industries: INDUSTRY_BENCHMARKS,
  riskWarnings: RISK_WARNINGS,
  offlineMode: true,
  auditEnabled: true,
  llmEnabled: true,
  rag: DEFAULT_RAG_CONFIG,
}

/** 部分覆盖配置 */
export type V6ScoreConfigOverride = Partial<V6ScoreEngineConfig>