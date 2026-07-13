import { dataLayer } from '@/data/dataLayer'
import type { NewsArticle, SentimentCache } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type SentimentLabel = 'positive' | 'negative' | 'neutral'
export type SentimentMethod = 'rule' | 'llm' | 'hybrid'

export interface SentimentResult {
  sentiment: SentimentLabel
  confidence: number
  score: number // normalized score in [-1, +1]
}

/** LLM 情感分析时内容截断长度（控制 token 消耗） */
const LLM_CONTENT_MAX_LENGTH = 1500

/** 标题截断长度（控制 token 消耗） */
const LLM_TITLE_MAX_LENGTH = 200

/** 正面情感词典（中文财经为主，不少于 20 个） */
export const POSITIVE_WORDS: string[] = [
  '增长',
  '大涨',
  '涨停',
  '牛市',
  '利好',
  '上升',
  '上涨',
  '反弹',
  '强劲',
  '超预期',
  '盈利',
  '利润',
  '攀升',
  '提升',
  '向好',
  '突破',
  '创新高',
  '复苏',
  '回暖',
  '放量',
  '增持',
  '回购',
  '景气',
  '高分红',
  '净利润增长',
]

/** 负面情感词典（中文财经为主，不少于 20 个） */
export const NEGATIVE_WORDS: string[] = [
  '下跌',
  '暴跌',
  '亏损',
  '利空',
  '下滑',
  '衰退',
  '疲软',
  '走弱',
  '跌停',
  '熊市',
  '重挫',
  '暴雷',
  '风险',
  '下降',
  '回落',
  '萎缩',
  '恶化',
  '恐慌',
  '杀跌',
  '崩盘',
  '减持',
  '裁员',
  '违约',
  '业绩下滑',
  '不及预期',
]

/** 否定词词典 */
export const NEGATION_WORDS: string[] = ['不', '没有', '未', '别', 'not', 'never', 'no', '无', '并非']

/** 程度副词词典（含放大/缩小倍数） */
export const DEGREE_WORDS: Array<{ word: string; multiplier: number }> = [
  { word: '非常', multiplier: 1.5 },
  { word: '极其', multiplier: 1.5 },
  { word: '大幅', multiplier: 1.4 },
  { word: '明显', multiplier: 1.3 },
  { word: '略有', multiplier: 0.7 },
  { word: '轻微', multiplier: 0.6 },
  { word: '特别', multiplier: 1.5 },
  { word: '十分', multiplier: 1.5 },
  { word: '显著', multiplier: 1.4 },
  { word: '稍微', multiplier: 0.5 },
]

const TITLE_WEIGHT = 1.5
const CONTENT_WEIGHT = 1.0
const SENTIMENT_THRESHOLD = 0.1

function hasWindowWord(text: string, position: number, words: string[], windowSize: number): boolean {
  const start = Math.max(0, position - windowSize)
  const slice = text.slice(start, position)
  return words.some((word) => slice.includes(word))
}

function findDegreeMultiplier(
  text: string,
  position: number,
  windowSize: number,
): number {
  const start = Math.max(0, position - windowSize)
  const slice = text.slice(start, position)
  let multiplier = 1
  for (const { word, multiplier: factor } of DEGREE_WORDS) {
    if (slice.includes(word)) {
      multiplier = Math.max(multiplier, factor)
    }
  }
  return multiplier
}

interface RawSentimentResult {
  rawScore: number
  score: number
  confidence: number
  matchCount: number
}

function analyzeTextRaw(text: string): RawSentimentResult {
  if (!text || text.trim().length === 0) {
    return { rawScore: 0, score: 0, confidence: 0, matchCount: 0 }
  }

  let rawScore = 0
  let matchCount = 0

  function scanWords(words: string[], sign: number) {
    const lowerText = text.toLowerCase()
    for (const word of words) {
      const wordLower = word.toLowerCase()
      let position = lowerText.indexOf(wordLower)
      while (position !== -1) {
        let hit = sign
        const degreeMultiplier = findDegreeMultiplier(text, position, 2)
        hit *= degreeMultiplier

        hit *= hasWindowWord(text, position, NEGATION_WORDS, 2) ? -1 : 1

        rawScore += hit
        matchCount++
        position = lowerText.indexOf(wordLower, position + 1)
      }
    }
  }

  scanWords(POSITIVE_WORDS, 1)
  scanWords(NEGATIVE_WORDS, -1)

  const score = Math.max(-1, Math.min(1, Math.tanh(rawScore / 5)))
  const confidence = Math.min(1, 0.3 + matchCount * 0.1 + Math.abs(score) * 0.4)

  return { rawScore, score, confidence, matchCount }
}

/** 对文本进行规则情感分析 */
export function analyzeText(text: string): SentimentResult {
  const result = analyzeTextRaw(text)
  return {
    sentiment: classifySentiment(result.score),
    confidence: result.confidence,
    score: result.score,
  }
}

/** 根据分数划分情感标签 */
export function classifySentiment(score: number, threshold = SENTIMENT_THRESHOLD): SentimentLabel {
  if (score > threshold) return 'positive'
  if (score < -threshold) return 'negative'
  return 'neutral'
}

/** 分析单篇资讯：标题与正文按权重融合 */
export function analyzeNewsArticle(
  article: Pick<NewsArticle, 'title' | 'content'>,
): SentimentResult {
  const titleResult = analyzeTextRaw(article.title ?? '')
  const contentResult = analyzeTextRaw(article.content ?? '')

  const hasTitle = (article.title ?? '').trim().length > 0
  const hasContent = (article.content ?? '').trim().length > 0

  const totalWeight = (hasTitle ? TITLE_WEIGHT : 0) + (hasContent ? CONTENT_WEIGHT : 0) || 1
  const rawScore =
    (titleResult.rawScore * (hasTitle ? TITLE_WEIGHT : 0) +
      contentResult.rawScore * (hasContent ? CONTENT_WEIGHT : 0)) /
    totalWeight

  const score = Math.max(-1, Math.min(1, Math.tanh(rawScore / 5)))
  const totalMatches = titleResult.matchCount + contentResult.matchCount
  const confidence = Math.min(1, 0.3 + totalMatches * 0.1 + Math.abs(score) * 0.4)

  return {
    sentiment: classifySentiment(score),
    confidence,
    score,
  }
}

/** DJB2 哈希算法种子值 */
const DJB2_HASH_SEED = 5381

/** 生成内容哈希（稳定、可复现） */
export function hashContent(content: string): string {
  let hash = DJB2_HASH_SEED
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 优先读取情感缓存 */
export async function getSentimentFromCache(
  contentHash: string,
): Promise<SentimentCache | undefined> {
  return dataLayer.sentimentCache.getByContentHash(contentHash)
}

/**
 * 优先读取情感缓存；否则分析并写入缓存。
 *
 * @returns 情感结果与内容哈希
 */
export async function getOrAnalyzeSentiment(
  content: string,
  method: SentimentCache['method'] = 'rule',
): Promise<SentimentResult & { contentHash: string }> {
  const contentHash = hashContent(content)
  const cached = await getSentimentFromCache(contentHash)
  if (cached) {
    return {
      sentiment: cached.sentiment,
      confidence: cached.confidence,
      score: cached.sentiment === 'positive' ? 0.5 : cached.sentiment === 'negative' ? -0.5 : 0,
      contentHash,
    }
  }

  const result = analyzeText(content)
  const cacheEntry: SentimentCache = {
    id: `sent_${contentHash}`,
    contentHash,
    sentiment: result.sentiment,
    confidence: result.confidence,
    method,
    analyzedAt: Date.now(),
  }

  await dataLayer.sentimentCache.save(cacheEntry)
  return { ...result, contentHash }
}

// ============================================================
// LLM 增强情绪分析（v6.0 新增）
// ============================================================

/**
 * 使用 LLM 分析文本情绪
 * @param title 文章标题
 * @param content 文章内容
 * @returns LLM 情感分析结果；LLM 不可用时返回 null
 */
export async function analyzeWithLLM(
  title: string,
  content: string,
): Promise<SentimentResult | null> {
  try {
    const { chat } = await import('@/services/llm/llmGateway')

    const prompt = `你是一名金融情绪分析师。请分析以下新闻/资讯的情绪倾向。

标题: ${title.slice(0, LLM_TITLE_MAX_LENGTH)}
内容: ${content.slice(0, LLM_CONTENT_MAX_LENGTH)}

请严格按 JSON 格式返回（不包含其他文本）：
{"sentiment": "positive"|"negative"|"neutral", "score": 0.0~1.0, "confidence": 0.0~1.0, "reason": "简要理由"}

其中 score 在 [-1, 1] 范围（正=积极，负=消极），confidence 在 [0, 1] 范围。`

    const response = await chat([
      { role: 'system', content: '你是一个金融NLP工具，只输出JSON。' },
      { role: 'user', content: prompt },
    ], { model: 'deepseek-chat', baseURL: '', apiKey: '' })

    // 从回复中提取 JSON
    const text = response.content
    const jsonMatch = text.match(/\{[\s\S]*?"sentiment"[\s\S]*?"confidence"[\s\S]*?\}/)
    if (!jsonMatch) {
      logger.warn('[SentimentAnalyzer] LLM 返回非 JSON 格式', { snippet: text.slice(0, 100) })
      return null
    }

    const parsed = JSON.parse(jsonMatch[0]) as { sentiment: string; score: number; confidence: number; reason?: string }

    if (!['positive', 'negative', 'neutral'].includes(parsed.sentiment)) {
      return null
    }

    const score = Math.max(-1, Math.min(1, parsed.score))
    const confidence = Math.max(0, Math.min(1, parsed.confidence))

    logger.info('[SentimentAnalyzer] LLM 分析完成', {
      sentiment: parsed.sentiment,
      score,
      confidence,
      reason: parsed.reason?.slice(0, 50),
    })

    return {
      sentiment: parsed.sentiment as SentimentLabel,
      confidence,
      score,
    }
  } catch (err) {
    logger.warn('[SentimentAnalyzer] LLM 分析失败，降级', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * 混合分析：优先使用 LLM（置信度高时采用），否则回退词典规则
 * @param title 文章标题
 * @param content 文章内容
 * @returns 情感分析结果（含来源方法标记）
 */
export async function hybridAnalyze(
  title: string,
  content: string,
): Promise<SentimentResult & { method: SentimentMethod }> {
  // Step 1: 尝试 LLM 分析
  const llmResult = await analyzeWithLLM(title, content)

  if (llmResult && llmResult.confidence >= 0.6) {
    return { ...llmResult, method: 'llm' }
  }

  // Step 2: 回退词典规则
  const ruleResult = analyzeNewsArticle({ title, content })

  if (llmResult && llmResult.confidence >= 0.3) {
    // 低置信 LLM 结果与规则结果加权混合
    const blendedScore = llmResult.score * 0.4 + ruleResult.score * 0.6
    const blendedConfidence = Math.max(llmResult.confidence, ruleResult.confidence)
    return {
      sentiment: classifySentiment(blendedScore),
      score: blendedScore,
      confidence: blendedConfidence,
      method: 'hybrid',
    }
  }

  return { ...ruleResult, method: 'rule' }
}

// ============================================================
// 时间一致性检查
// ============================================================

export interface TimeConsistencyResult {
  consistent: boolean
  delta: number
  warning?: string
}

/**
 * 检查同一内容的两次情感分析是否随时间一致
 * @param earlier 较早的分析结果
 * @param later 较晚的分析结果
 * @param maxDelta 允许的最大分数变化（绝对值）
 * @returns 一致性检查结果
 */
export function checkTimeConsistency(
  earlier: { score: number; timestamp: number },
  later: { score: number; timestamp: number },
  maxDelta: number = 0.3,
): TimeConsistencyResult {
  const delta = Math.abs(later.score - earlier.score)
  const timeGapMs = later.timestamp - earlier.timestamp
  const timeGapHours = timeGapMs / (1000 * 60 * 60)

  if (delta > maxDelta) {
    return {
      consistent: false,
      delta,
      warning: `情感分数在 ${timeGapHours.toFixed(1)} 小时内变化 ${delta.toFixed(2)}（阈值 ${maxDelta}），可能受新信息影响`,
    }
  }

  return { consistent: true, delta }
}
