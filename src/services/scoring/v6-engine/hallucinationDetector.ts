/**
 * hallucinationDetector — RAG 增强评分的幻觉检测器
 *
 * 在启用 RAG 增强评分前，必须通过幻觉检测门禁。
 * 检测维度：
 *   1. 引用捏造检测（Fabricated Citation）：LLM 的 citations 是否来自 RAG 上下文
 *   2. 无证据评分调整检测（Unsupported Adjustment）：LLM 调整评分但无引用支撑
 *   3. 矛盾声明检测（Contradictory Claim）：LLM 声明与源文档内容冲突
 *   4. 事实性核实（Factual Verification）：LLM 断言的事实是否可追溯到源文档
 *
 * 门禁标准：
 *   - 引用捏造率 < 5%（≤ 5%）
 *   - 无证据调整率 < 10%（≤ 10%）
 *   - 矛盾声明数 = 0
 *   - 综合幻觉率 < 15%（≤ 15%）
 *   - 以上全部通过 → 门禁绿灯，可启用 RAG
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
*/

import { getLogger } from '@/lib/logger'
import type { RAGSnippet } from './ragRetriever'

const logger = getLogger()

// ─── 类型 ────────────────────────────────────────────────────

/** LLM 返回的引用 */
export interface LLMCitation {
  source: string
  content: string
  url?: string
  date?: string
}

/** LLM 增强结果 */
export interface LLMEnhancementOutput {
  score: number
  summary: string
  rationale: string
  risks: string[]
  citations: LLMCitation[]
}

/** 检测到的幻觉 */
export interface DetectedHallucination {
  type: 'fabricated_citation' | 'unsupported_adjustment' | 'contradictory_claim' | 'unverifiable_fact'
  severity: 'high' | 'medium' | 'low'
  description: string
  evidence: string
  suggestion: string
}

/** 幻觉检测报告 */
export interface HallucinationReport {
  /** 总体是否通过 */
  passed: boolean
  /** 检测到的幻觉总数 */
  totalHallucinations: number
  /** 幻觉详情 */
  hallucinations: DetectedHallucination[]
  /** 各维度统计 */
  metrics: {
    /** 引用捏造数 */
    fabricatedCitations: number
    /** 引用捏造率 */
    fabricatedCitationRate: number
    /** 无证据调整数 */
    unsupportedAdjustments: number
    /** 无证据调整率 */
    unsupportedAdjustmentRate: number
    /** 矛盾声明数 */
    contradictoryClaims: number
    /** 不可核实断言数 */
    unverifiableFacts: number
    /** 综合幻觉率 */
    overallHallucinationRate: number
  }
  /** 总分 */
  totalScore: number
  /** 检测样本数 */
  samplesChecked: number
  /** 检测时间戳 */
  timestamp: number
}

/** 单个样本的幻觉检测输入 */
export interface HallucinationSample {
  /** 股票代码 */
  symbol: string
  /** 评分层 */
  layerId: string
  /** 规则引擎原始评分 */
  ruleScore: number
  /** RAG 检索到的文档片段 */
  ragContext: RAGSnippet[]
  /** LLM 增强输出 */
  llmOutput: LLMEnhancementOutput
}

// ─── 门禁阈值 ────────────────────────────────────────────────

const GATE = {
  /** 引用捏造率上限 */
  maxFabricatedCitationRate: 0.05,
  /** 无证据调整率上限 */
  maxUnsupportedAdjustmentRate: 0.10,
  /** 矛盾声明数上限 */
  maxContradictoryClaims: 0,
  /** 综合幻觉率上限 */
  maxOverallHallucinationRate: 0.15,
}

// ─── 相似度阈值 ──────────────────────────────────────────────

/** 引用内容与源文档的最小相似度（字符级 Jaccard 相似度） */
const MIN_CITATION_SIMILARITY = 0.3

// ============================================================
// 单样本检测
// ============================================================

/**
 * 检测单个样本的幻觉
 */
export function detectSampleHallucination(sample: HallucinationSample): DetectedHallucination[] {
  const hallucinations: DetectedHallucination[] = []

  // 1. 引用捏造检测
  const fabricated = detectFabricatedCitations(sample.llmOutput.citations, sample.ragContext)
  hallucinations.push(...fabricated)

  // 2. 无证据评分调整检测
  if (sample.llmOutput.score !== sample.ruleScore) {
    const unsupported = detectUnsupportedAdjustment(
      sample.llmOutput.score,
      sample.ruleScore,
      sample.llmOutput.citations,
      sample.llmOutput.rationale,
    )
    if (unsupported) hallucinations.push(unsupported)
  }

  // 3. 矛盾声明检测
  const contradictory = detectContradictoryClaims(
    sample.llmOutput.rationale,
    sample.llmOutput.summary,
    sample.ragContext,
  )
  hallucinations.push(...contradictory)

  // 4. 不可核实断言检测
  const unverifiable = detectUnverifiableFacts(
    sample.llmOutput.rationale,
    sample.llmOutput.summary,
    sample.ragContext,
  )
  hallucinations.push(...unverifiable)

  return hallucinations
}

// ============================================================
// 引用捏造检测
// ============================================================

/**
 * 检测 LLM 返回的引用是否捏造
 *
 * 判断标准：citation 的 content 是否能在 RAG 上下文中找到匹配
 * 使用字符级 Jaccard 相似度 + 关键词匹配
 */
function detectFabricatedCitations(
  citations: LLMCitation[],
  ragContext: RAGSnippet[],
): DetectedHallucination[] {
  const results: DetectedHallucination[] = []

  for (const citation of citations) {
    // 引用内容过短（< 10 字符），无法可靠判断，跳过
    const citationText = citation.content.trim()
    if (citationText.length < 10) continue

    const isGrounded = isCitationGrounded(citation, ragContext)
    if (!isGrounded) {
      results.push({
        type: 'fabricated_citation',
        severity: 'high',
        description: `引用 "${citation.source}" 的内容未在 RAG 检索到的文档中找到匹配`,
        evidence: `citation.content: "${citation.content.slice(0, 100)}..."`,
        suggestion: 'LLM 可能基于训练记忆而非检索文档生成引用，需检查 RAG 检索覆盖度或 prompt 约束',
      })
    }
  }

  return results
}

/**
 * 判断单条引用是否在 RAG 上下文中可追溯
 */
function isCitationGrounded(citation: LLMCitation, ragContext: RAGSnippet[]): boolean {
  if (ragContext.length === 0) return false

  const citationText = citation.content.toLowerCase().trim()
  if (citationText.length < 10) return false // 太短的引用内容无法判断

  for (const snippet of ragContext) {
    const snippetText = snippet.content.toLowerCase()

    // 方法 0: 直接子串包含检查（最可靠）
    if (snippetText.includes(citationText)) return true

    // 方法 1: 字符级 Jaccard 相似度
    const jaccard = charJaccardSimilarity(citationText, snippetText)
    if (jaccard >= MIN_CITATION_SIMILARITY) return true

    // 方法 2: 提取引用中的关键短语（3-5 词），检查是否在文档中出现
    const keyPhrases = extractKeyPhrases(citation.content, 3, 5)
    const matchCount = keyPhrases.filter((phrase) =>
      snippetText.includes(phrase.toLowerCase()),
    ).length

    if (keyPhrases.length > 0 && matchCount / keyPhrases.length >= 0.5) return true
  }

  return false
}

/**
 * 字符级 Jaccard 相似度（基于 bigram）
 */
function charJaccardSimilarity(a: string, b: string): number {
  if (a.length < 3 || b.length < 3) return 0

  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()

  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2))

  let intersection = 0
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++
  }

  const union = bigramsA.size + bigramsB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * 提取文本中的关键短语（n-gram）
 */
function extractKeyPhrases(text: string, minWords: number, maxWords: number): string[] {
  const words = text
    .replace(/[，。、；：！？""''（）【】《》\n\r]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)

  if (words.length < minWords) return []

  const phrases: string[] = []
  for (let n = minWords; n <= Math.min(maxWords, words.length); n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join('')
      if (phrase.length >= 4) phrases.push(phrase)
    }
  }

  // 去重并限制数量
  return [...new Set(phrases)].slice(0, 20)
}

// ============================================================
// 无证据评分调整检测
// ============================================================

/**
 * 检测 LLM 调整评分但无充分证据支撑
 */
function detectUnsupportedAdjustment(
  llmScore: number,
  ruleScore: number,
  citations: LLMCitation[],
  rationale: string,
): DetectedHallucination | null {
  const delta = Math.abs(llmScore - ruleScore)

  // 微小调整（< 0.3）不严格要求证据
  if (delta < 0.3) return null

  // 有引用 → 视为有证据
  if (citations.length > 0) {
    // 核查引用内容是否与评分调整相关
    const adjustmentDirection = llmScore > ruleScore ? '上调' : '下调'
    const relevantKeywords = [
      '增长', '下降', '改善', '恶化', '提升', '降低',
      '利好', '利空', '超预期', '不及预期', '风险', '机会',
      adjustmentDirection,
    ]

    const hasRelevantCitation = citations.some(
      (c) => relevantKeywords.some((kw) => c.content.includes(kw)),
    )

    if (!hasRelevantCitation) {
      return {
        type: 'unsupported_adjustment',
        severity: 'medium',
        description: `LLM 将评分从 ${ruleScore} 调整为 ${llmScore}（${adjustmentDirection} ${delta.toFixed(2)}），但引用内容与评分方向不相关`,
        evidence: `rationale: "${rationale.slice(0, 100)}..."`,
        suggestion: '引用内容需包含支持评分调整方向的实质性信息',
      }
    }
    return null
  }

  // 无引用 + 大幅调整 → 无证据评分调整
  return {
    type: 'unsupported_adjustment',
    severity: 'high',
    description: `LLM 将评分从 ${ruleScore} 调整为 ${llmScore}（差异 ${delta.toFixed(2)}），但未提供任何引用`,
    evidence: `rationale: "${rationale.slice(0, 100)}..."`,
    suggestion: '要求 LLM 在调整评分时提供至少一条引用，或强化 prompt 中的 citation 约束',
  }
}

// ============================================================
// 矛盾声明检测
// ============================================================

/**
 * 检测 LLM 声明是否与源文档内容矛盾
 *
 * 策略：提取 LLM 声明中的方向性断言（利好/利空/增长/下降），
 *       与 RAG 文档中的情绪标签和核心陈述比对
 */
function detectContradictoryClaims(
  rationale: string,
  summary: string,
  ragContext: RAGSnippet[],
): DetectedHallucination[] {
  const results: DetectedHallucination[] = []
  const combined = `${rationale} ${summary}`

  // 提取 LLM 的方向性断言
  const positiveClaims = extractDirectionalClaims(combined, 'positive')
  const negativeClaims = extractDirectionalClaims(combined, 'negative')

  // 遍历 RAG 文档，检查是否有矛盾
  for (const snippet of ragContext) {
    // 如果文档情绪是 positive，但 LLM 有 negative 声明 → 矛盾
    if (snippet.sentiment === 'positive' && negativeClaims.length > 0) {
      for (const claim of negativeClaims.slice(0, 2)) {
        results.push({
          type: 'contradictory_claim',
          severity: 'medium',
          description: `LLM 声明 "${claim}" 与来源 "${snippet.source}"（情绪:${snippet.sentiment}）可能矛盾`,
          evidence: `文档内容: "${snippet.content.slice(0, 100)}..."`,
          suggestion: '检查 LLM 是否正确解读了源文档，或是否需要扩大 RAG 检索范围',
        })
      }
    }

    // 如果文档情绪是 negative，但 LLM 有 positive 声明 → 矛盾
    if (snippet.sentiment === 'negative' && positiveClaims.length > 0) {
      for (const claim of positiveClaims.slice(0, 2)) {
        results.push({
          type: 'contradictory_claim',
          severity: 'medium',
          description: `LLM 声明 "${claim}" 与来源 "${snippet.source}"（情绪:${snippet.sentiment}）可能矛盾`,
          evidence: `文档内容: "${snippet.content.slice(0, 100)}..."`,
          suggestion: '检查 LLM 是否正确解读了源文档，或是否需要扩大 RAG 检索范围',
        })
      }
    }
  }

  return results
}

/**
 * 提取方向性断言
 */
function extractDirectionalClaims(
  text: string,
  direction: 'positive' | 'negative',
): string[] {
  const positivePatterns = [
    /(?:营收|收入|利润|毛利|净利|增长|增速|提升|改善|好转|超预期|利好|突破|创新高)[^。！？\n]{0,30}(?:[。！？\n]|$)/g,
    /(?:同比增长|环比增长|大幅增长|稳健增长|持续增长)[^。！？\n]{0,30}(?:[。！？\n]|$)/g,
  ]

  const negativePatterns = [
    /(?:下滑|下降|减少|亏损|恶化|萎缩|衰退|利空|风险|不及预期|承压|挑战)[^。！？\n]{0,30}(?:[。！？\n]|$)/g,
    /(?:同比下滑|环比下滑|大幅下滑|持续下滑|面临压力)[^。！？\n]{0,30}(?:[。！？\n]|$)/g,
  ]

  const patterns = direction === 'positive' ? positivePatterns : negativePatterns
  const claims: string[] = []

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const claim = match[0].trim()
      if (claim.length >= 8 && claim.length <= 60) {
        claims.push(claim)
      }
    }
  }

  return [...new Set(claims)].slice(0, 5)
}

// ============================================================
// 不可核实断言检测
// ============================================================

/**
 * 检测 LLM 断言的事实是否可追溯到源文档
 */
function detectUnverifiableFacts(
  rationale: string,
  summary: string,
  ragContext: RAGSnippet[],
): DetectedHallucination[] {
  const results: DetectedHallucination[] = []
  const combined = `${rationale} ${summary}`

  // 提取 LLM 中的量化断言
  const quantifiableClaims = extractQuantifiableClaims(combined)

  for (const claim of quantifiableClaims) {
    // 检查该量化断言是否能在 RAG 文档中找到
    const isVerifiable = ragContext.some((snippet) => {
      const snippetText = snippet.content.toLowerCase()
      // 提取数字
      const numbers = claim.match(/\d+(?:\.\d+)?/g)
      if (!numbers || numbers.length === 0) return false
      // 至少有一个数字在文档中匹配
      return numbers.some((num) => snippetText.includes(num))
    })

    if (!isVerifiable) {
      results.push({
        type: 'unverifiable_fact',
        severity: 'low',
        description: `LLM 的量化断言 "${claim}" 在 RAG 检索到的文档中无法核实`,
        evidence: `ragContext 中有 ${ragContext.length} 个文档片段，但均未包含该数据`,
        suggestion: '该断言可能来自 LLM 训练数据，建议标注为"可能基于模型知识，未经检索验证"',
      })
    }
  }

  return results.slice(0, 3) // 限制数量
}

/**
 * 提取量化断言
 */
function extractQuantifiableClaims(text: string): string[] {
  const patterns = [
    /(?:营收|收入|利润|净利润|毛利|市值|PE|PB|ROE|EPS|增长率|增速|目标价)[^\d]{0,10}\d+(?:\.\d+)?[^\d]{0,15}[。！？\n]/g,
    /(?:同比增长|环比增长|下降|下滑|增长)\s*\d+(?:\.\d+)?%/g,
    /(?:达到|超过|突破|为)\s*\d+(?:\.\d+)?[万亿]?/g,
  ]

  const claims: string[] = []
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      claims.push(match[0].trim())
    }
  }

  return [...new Set(claims)].slice(0, 10)
}

// ============================================================
// 批量检测与报告生成
// ============================================================

/**
 * 对多个样本运行幻觉检测，生成综合报告
 */
export function runHallucinationSuite(samples: HallucinationSample[]): HallucinationReport {
  const allHallucinations: DetectedHallucination[] = []
  let totalSamplesWithCitations = 0
  let totalSamplesWithAdjustment = 0

  for (const sample of samples) {
    const hallucinations = detectSampleHallucination(sample)
    allHallucinations.push(...hallucinations)

    if (sample.llmOutput.citations.length > 0) totalSamplesWithCitations++
    if (sample.llmOutput.score !== sample.ruleScore) totalSamplesWithAdjustment++
  }

  // 分类统计
  const fabricatedCitations = allHallucinations.filter((h) => h.type === 'fabricated_citation')
  const unsupportedAdjustments = allHallucinations.filter((h) => h.type === 'unsupported_adjustment')
  const contradictoryClaims = allHallucinations.filter((h) => h.type === 'contradictory_claim')
  const unverifiableFacts = allHallucinations.filter((h) => h.type === 'unverifiable_fact')

  // 计算率
  const fabricatedCitationRate = totalSamplesWithCitations > 0
    ? fabricatedCitations.length / totalSamplesWithCitations
    : 0
  const unsupportedAdjustmentRate = totalSamplesWithAdjustment > 0
    ? unsupportedAdjustments.length / totalSamplesWithAdjustment
    : 0
  const overallHallucinationRate = samples.length > 0
    ? allHallucinations.length / (samples.length * 4)
    : 0

  // 门禁判断
  const passed =
    fabricatedCitationRate <= GATE.maxFabricatedCitationRate &&
    unsupportedAdjustmentRate <= GATE.maxUnsupportedAdjustmentRate &&
    contradictoryClaims.length <= GATE.maxContradictoryClaims &&
    overallHallucinationRate <= GATE.maxOverallHallucinationRate

  // 计算总分（100 分制）
  let totalScore = 100
  totalScore -= fabricatedCitations.length * 15
  totalScore -= unsupportedAdjustments.length * 20
  totalScore -= contradictoryClaims.length * 10
  totalScore -= unverifiableFacts.length * 5
  totalScore = Math.max(0, totalScore)

  const report: HallucinationReport = {
    passed,
    totalHallucinations: allHallucinations.length,
    hallucinations: allHallucinations,
    metrics: {
      fabricatedCitations: fabricatedCitations.length,
      fabricatedCitationRate: Math.round(fabricatedCitationRate * 10000) / 100,
      unsupportedAdjustments: unsupportedAdjustments.length,
      unsupportedAdjustmentRate: Math.round(unsupportedAdjustmentRate * 10000) / 100,
      contradictoryClaims: contradictoryClaims.length,
      unverifiableFacts: unverifiableFacts.length,
      overallHallucinationRate: Math.round(overallHallucinationRate * 10000) / 100,
    },
    totalScore,
    samplesChecked: samples.length,
    timestamp: Date.now(),
  }

  logger.info('[HallucinationDetector] 检测完成', {
    passed,
    totalScore,
    totalHallucinations: allHallucinations.length,
    samplesChecked: samples.length,
    fabricatedCitationRate: `${report.metrics.fabricatedCitationRate}%`,
    unsupportedAdjustmentRate: `${report.metrics.unsupportedAdjustmentRate}%`,
  })

  return report
}

/**
 * 格式化报告为可读文本
 */
export function formatHallucinationReport(report: HallucinationReport): string {
  const lines = [
    `========================================`,
    `  RAG 幻觉检测报告`,
    `========================================`,
    `检测时间: ${new Date(report.timestamp).toISOString()}`,
    `样本数: ${report.samplesChecked}`,
    `门禁结果: ${report.passed ? '通过' : '未通过'}`,
    `总分: ${report.totalScore}/100`,
    ``,
    `── 指标明细 ──`,
    `引用捏造: ${report.metrics.fabricatedCitations} 条 (${report.metrics.fabricatedCitationRate}%)`,
    `无证据调整: ${report.metrics.unsupportedAdjustments} 条 (${report.metrics.unsupportedAdjustmentRate}%)`,
    `矛盾声明: ${report.metrics.contradictoryClaims} 条`,
    `不可核实断言: ${report.metrics.unverifiableFacts} 条`,
    `综合幻觉率: ${report.metrics.overallHallucinationRate}%`,
    ``,
    `── 门禁标准 ──`,
    `引用捏造率 ≤ ${GATE.maxFabricatedCitationRate * 100}%: ${report.metrics.fabricatedCitationRate <= GATE.maxFabricatedCitationRate * 100 ? '通过' : '未通过'}`,
    `无证据调整率 ≤ ${GATE.maxUnsupportedAdjustmentRate * 100}%: ${report.metrics.unsupportedAdjustmentRate <= GATE.maxUnsupportedAdjustmentRate * 100 ? '通过' : '未通过'}`,
    `矛盾声明 = 0: ${report.metrics.contradictoryClaims === 0 ? '通过' : '未通过'}`,
    `综合幻觉率 ≤ ${GATE.maxOverallHallucinationRate * 100}%: ${report.metrics.overallHallucinationRate <= GATE.maxOverallHallucinationRate * 100 ? '通过' : '未通过'}`,
  ]

  if (report.hallucinations.length > 0) {
    lines.push(``, `── 幻觉详情 ──`)
    for (let i = 0; i < report.hallucinations.length; i++) {
      const h = report.hallucinations[i]!
      lines.push(
        `[${i + 1}] [${h.severity.toUpperCase()}] ${h.type}`,
        `    描述: ${h.description}`,
        `    证据: ${h.evidence}`,
        `    建议: ${h.suggestion}`,
        ``,
      )
    }
  }

  lines.push(`========================================`)
  return lines.join('\n')
}