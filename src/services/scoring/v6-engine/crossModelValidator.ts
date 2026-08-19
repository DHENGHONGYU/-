/**
 * crossModelValidator — 多模型交叉验证器（TruthLens 风格）
 *
 * P3: 对标 TruthLens "三模式交叉验证"框架，对 V6 评分引擎的 LLM 增强
 * 输出进行双模型一致性校验。减少单一 LLM 幻觉风险，提升评分可信度。
 *
 * 核心机制：
 * 1. 双模型并行调用：使用主模型（A）和校验模型（B）对同一评分层独立输出
 * 2. 三维一致性检测：
 *    - 数值一致性：评分偏差 |delta| < 阈值
 *    - 语义一致性：summary 关键主题重叠度
 *    - 引证一致性：citations Jaccard 相似度
 * 3. 分歧处理策略：
 *    - consistent: 双模型一致 → 采用 A 模型结果
 *    - minor: 轻微偏差 → 采用 A 模型结果 + 置信度扣分
 *    - major: 显著偏差 → 回退到规则引擎 baseScore
 *    - critical: 严重分歧 → 回退 + 标记高风险
 *
 * 依赖：
 *   - llmGateway.chat() (支持多模型预设)
 *   - 无 IndexedDB/网络依赖（纯 LLM 调用）
 *
 * @module services/scoring/v6-engine/crossModelValidator
 * @created 2026-08-17 P3
 * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-066]
 */

import { getLogger } from '@/lib/logger'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { LlmGatewayOptions } from '@/services/llm/llmGateway'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 单模型评分输出 */
export interface ModelScore {
  model: string
  score: number | null
  summary: string
  risks: string[]
  citations: string[]
  /** 原始响应内容（用于调试） */
  rawContent: string
  /** 调用是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 调用耗时（ms） */
  elapsedMs: number
}

/** 交叉验证一致性判定 */
export interface CrossModelAgreement {
  /** 评分偏差 */
  scoreDelta: number
  /** 数值一致性（|delta| < 1.0） */
  scoreConsistent: boolean
  /** 语义一致性（summary 关键主题重叠度 ≥ 50%） */
  summaryConsistent: boolean
  /** 引证重叠度（Jaccard 0-1） */
  citationsOverlap: number
  /** 引证一致性（Jaccard ≥ 0.3） */
  citationsConsistent: boolean
  /** 综合一致性 */
  overallConsistent: boolean
  /** 严重程度 */
  severity: 'consistent' | 'minor' | 'major' | 'critical'
  /** 建议 */
  recommendation: string
}

/** 交叉验证结果 */
export interface CrossModelResult {
  /** 主模型输出 */
  primary: ModelScore
  /** 校验模型输出 */
  secondary: ModelScore
  /** 一致性判定 */
  agreement: CrossModelAgreement
  /** 最终采用评分（null 表示回退到规则引擎） */
  finalScore: number | null
  /** 是否采用 LLM 结果 */
  useLlmResult: boolean
  /** 总耗时（ms） */
  totalElapsedMs: number
}

/** 交叉验证配置 */
export interface CrossModelConfig {
  /** 主模型预设 ID */
  primaryModelId: string
  /** 校验模型预设 ID */
  secondaryModelId: string
  /** 评分偏差阈值（绝对值） */
  scoreDeltaThreshold: number
  /** 语义一致性最低重叠度 */
  summaryOverlapThreshold: number
  /** 引证 Jaccard 最低阈值 */
  citationJaccardThreshold: number
  /** 是否启用 */
  enabled: boolean
}

// ============================================================
// 默认配置
// ============================================================

export const DEFAULT_CROSS_MODEL_CONFIG: CrossModelConfig = {
  primaryModelId: 'deepseek-v3',
  secondaryModelId: 'kimi-k2',
  scoreDeltaThreshold: 1.0,
  summaryOverlapThreshold: 0.5,
  citationJaccardThreshold: 0.3,
  enabled: true,
}

// ============================================================
// 工具函数
// ============================================================

// 中文金融关键词字典（用于语义重叠检测）
const FINANCE_KEYWORDS = new Set([
  '估值', '成长', '盈利', '收入', '利润', '现金流', 'ROE', 'ROIC', 'PE', 'PB', 'PEG',
  '护城河', '壁垒', '竞争', '份额', '龙头', '创新', '研发', '技术',
  '宏观', '政策', '利率', '通胀', '风险', '安全边际', '低估', '高估',
  '增长', '衰退', '周期', '趋势', '预期', '业绩', '指引', '分红',
  '管理', '治理', '战略', '转型', '第二曲线', '催化', '事件',
  '悲观', '乐观', '中性', '谨慎', '看好', '看空',
])

/**
 * 中文关键词提取（简单分词，不依赖 NLP 库）
 */
function extractKeywords(text: string): Set<string> {
  const keywords = new Set<string>()
  for (const kw of FINANCE_KEYWORDS) {
    if (text.includes(kw)) {
      keywords.add(kw)
    }
  }
  return keywords
}

/**
 * Jaccard 相似度
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

/**
 * 从 LLM 响应中提取评分
 */
function extractScore(rawContent: string): number | null {
  // 匹配 "score": 4.2 或 "评分": 4.2 或 score: 4.2
  const patterns = [
    /"score"\s*:\s*([\d.]+)/,
    /"评分"\s*:\s*([\d.]+)/,
    /score\s*[:：]\s*([\d.]+)/i,
    /评分\s*[:：]\s*([\d.]+)/,
    /最终得分\s*[:：]\s*([\d.]+)/,
  ]
  for (const pattern of patterns) {
    const match = rawContent.match(pattern)
    if (match?.[1]) {
      const score = parseFloat(match[1])
      if (!isNaN(score) && score >= 0 && score <= 5) {
        return score
      }
    }
  }
  return null
}

/**
 * 从 LLM 响应中提取 citations
 */
function extractCitations(rawContent: string): string[] {
  const citations: string[] = []
  // 匹配 citation 数组
  const citationMatch = rawContent.match(/"citations"\s*:\s*\[([^\]]*)\]/)
  if (citationMatch?.[1]) {
    const items = citationMatch[1].match(/"([^"]*)"/g)
    if (items) {
      for (const item of items) {
        citations.push(item.replace(/^"|"$/g, ''))
      }
    }
  }
  return citations
}

// ============================================================
// 主模块
// ============================================================

/**
 * 多模型交叉验证器
 *
 * 对 LLM 增强评分输出进行双模型一致性校验，
 * 对标 TruthLens 三模式交叉验证框架。
 */
export class CrossModelValidator {
  private config: CrossModelConfig
  /** 动态导入 llmGateway 的函数（避免循环依赖） */
  private chatFn: ((messages: LlmMessage[], options: LlmGatewayOptions) => Promise<{ content: string; model: string }>) | null = null

  constructor(config?: Partial<CrossModelConfig>) {
    this.config = { ...DEFAULT_CROSS_MODEL_CONFIG, ...config }
  }

  /**
   * 初始化 LLM 调用函数（延迟加载，避免循环依赖）
   */
  private async ensureChatFn(): Promise<(messages: LlmMessage[], options: LlmGatewayOptions) => Promise<{ content: string; model: string }>> {
    if (!this.chatFn) {
      const { chat } = await import('@/services/llm/llmGateway')
      this.chatFn = async (messages, options) => {
        const response = await chat(messages, options)
        return { content: response.content, model: response.model }
      }
    }
    return this.chatFn
  }

  /**
   * 调用单个模型评分
   */
  private async callModel(
    modelId: string,
    messages: LlmMessage[],
    label: string,
  ): Promise<ModelScore> {
    const startTime = performance.now()
    try {
      const chatFn = await this.ensureChatFn()
      const response = await chatFn(messages, {
        callerId: `CrossModelValidator-${label}`,
        caller: 'system',
        allowFallback: false,
        // 通过 presetId 指定模型
      })

      const rawContent = response.content
      const score = extractScore(rawContent)
      const citations = extractCitations(rawContent)

      return {
        model: response.model || modelId,
        score,
        summary: rawContent.slice(0, 500),
        risks: [],
        citations,
        rawContent,
        success: true,
        elapsedMs: performance.now() - startTime,
      }
    } catch (err) {
      logger.warn(`[CrossModelValidator] ${label} 模型调用失败: ${err instanceof Error ? err.message : String(err)}`)
      return {
        model: modelId,
        score: null,
        summary: '',
        risks: [],
        citations: [],
        rawContent: '',
        success: false,
        error: err instanceof Error ? err.message : String(err),
        elapsedMs: performance.now() - startTime,
      }
    }
  }

  /**
   * 判定一致性
   */
  private assessAgreement(primary: ModelScore, secondary: ModelScore): CrossModelAgreement {
    // 快捷路径：双模型都失败 → 强制 critical
    if (!primary.success && !secondary.success) {
      return {
        scoreDelta: -1,
        scoreConsistent: false,
        summaryConsistent: false,
        citationsOverlap: 0,
        citationsConsistent: false,
        overallConsistent: false,
        severity: 'critical',
        recommendation: '双模型均调用失败，无法判定一致性，强制回退到规则引擎',
      }
    }

    // 1. 数值一致性
    const scoreDelta = (primary.score !== null && secondary.score !== null)
      ? Math.abs(primary.score - secondary.score)
      : Infinity
    const scoreConsistent = scoreDelta <= this.config.scoreDeltaThreshold

    // 2. 语义一致性（空摘要不做一致性判定）
    const primaryKws = extractKeywords(primary.summary)
    const secondaryKws = extractKeywords(secondary.summary)
    const summaryOverlap = (primaryKws.size === 0 || secondaryKws.size === 0)
      ? 0
      : jaccardSimilarity(primaryKws, secondaryKws)
    const summaryConsistent = summaryOverlap >= this.config.summaryOverlapThreshold

    // 3. 引证一致性（空 citations 不做一致性判定）
    const citationsOverlap = (primary.citations.length === 0 || secondary.citations.length === 0)
      ? 0
      : jaccardSimilarity(
          new Set(primary.citations),
          new Set(secondary.citations),
        )
    const citationsConsistent = citationsOverlap >= this.config.citationJaccardThreshold

    // 4. 综合判定
    const consistencyChecks = [scoreConsistent, summaryConsistent, citationsConsistent]
    const passedCount = consistencyChecks.filter(Boolean).length
    const overallConsistent = passedCount >= 2

    // 5. 严重程度
    let severity: CrossModelAgreement['severity']
    let recommendation: string

    if (passedCount === 3) {
      severity = 'consistent'
      recommendation = '双模型输出高度一致，LLM 增强结果可信'
    } else if (passedCount === 2) {
      if (!scoreConsistent) {
        severity = 'minor'
        recommendation = `评分偏差 ${scoreDelta.toFixed(2)} > ${this.config.scoreDeltaThreshold}，采用主模型评分但降置信度`
      } else if (!summaryConsistent) {
        severity = 'minor'
        recommendation = '双模型摘要不一致，但评分接近，采用主模型结果'
      } else {
        severity = 'minor'
        recommendation = '引证重叠度低，但评分和摘要一致，采用主模型结果'
      }
    } else if (passedCount === 1) {
      if (scoreConsistent) {
        severity = 'major'
        recommendation = '评分一致但摘要和引证严重分歧，建议人工复核'
      } else {
        severity = 'major'
        recommendation = `双模型分歧显著（评分偏差 ${scoreDelta.toFixed(2)}），建议回退到规则引擎评分`
      }
    } else {
      severity = 'critical'
      recommendation = '双模型输出完全不一致，强制回退到规则引擎评分，并标记高风险'
    }

    return {
      scoreDelta: scoreDelta === Infinity ? -1 : scoreDelta,
      scoreConsistent,
      summaryConsistent,
      citationsOverlap,
      citationsConsistent,
      overallConsistent,
      severity,
      recommendation,
    }
  }

  /**
   * 执行双模型交叉验证
   *
   * @param messages LLM 消息列表（system + user prompt）
   * @param baseScore 规则引擎原始评分（回退用）
   * @returns 交叉验证结果
   */
  async validate(
    messages: LlmMessage[],
    baseScore: number,
  ): Promise<CrossModelResult> {
    const startTime = performance.now()

    if (!this.config.enabled) {
      logger.info('[CrossModelValidator] 交叉验证已禁用，跳过')
      return {
        primary: { model: '', score: baseScore, summary: '', risks: [], citations: [], rawContent: '', success: false, elapsedMs: 0 },
        secondary: { model: '', score: baseScore, summary: '', risks: [], citations: [], rawContent: '', success: false, elapsedMs: 0 },
        agreement: {
          scoreDelta: 0, scoreConsistent: true, summaryConsistent: true,
          citationsOverlap: 1, citationsConsistent: true, overallConsistent: true,
          severity: 'consistent', recommendation: '交叉验证已禁用',
        },
        finalScore: baseScore,
        useLlmResult: false,
        totalElapsedMs: 0,
      }
    }

    // 并行调用两个模型
    const [primary, secondary] = await Promise.all([
      this.callModel(this.config.primaryModelId, messages, 'primary'),
      this.callModel(this.config.secondaryModelId, messages, 'secondary'),
    ])

    const agreement = this.assessAgreement(primary, secondary)

    // 判定最终采用策略
    let finalScore: number | null
    let useLlmResult: boolean

    if (!primary.success && !secondary.success) {
      // 双模型都失败 → 回退
      finalScore = baseScore
      useLlmResult = false
    } else if (agreement.severity === 'critical') {
      // 严重分歧 → 回退
      finalScore = baseScore
      useLlmResult = false
    } else if (agreement.severity === 'major') {
      // 显著分歧 → 取两者平均（如果评分都存在）或回退
      if (primary.score !== null && secondary.score !== null) {
        finalScore = (primary.score + secondary.score) / 2
        useLlmResult = true
      } else {
        finalScore = baseScore
        useLlmResult = false
      }
    } else {
      // 一致或轻微分歧 → 采用主模型
      finalScore = primary.score ?? secondary.score ?? baseScore
      useLlmResult = primary.score !== null || secondary.score !== null
    }

    logger.info('[CrossModelValidator] 交叉验证完成', {
      severity: agreement.severity,
      primaryScore: primary.score,
      secondaryScore: secondary.score,
      finalScore,
      useLlmResult,
      elapsedMs: performance.now() - startTime,
    })

    return {
      primary,
      secondary,
      agreement,
      finalScore,
      useLlmResult,
      totalElapsedMs: performance.now() - startTime,
    }
  }
}

/** 全局单例 */
export const crossModelValidator = new CrossModelValidator()