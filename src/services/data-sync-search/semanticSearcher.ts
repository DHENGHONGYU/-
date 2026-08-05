/**
 * @fileoverview 轻量语义搜索器
 *
 * 基于 TF-IDF 加权关键词匹配实现语义检索，无需 WASM/模型依赖。
 *
 * 设计决策：
 * - 原方案为向量嵌入（transformers.js / onnxruntime-web），标记为高风险
 *   （WASM 兼容性、首次加载延迟、内存占用）
 * - 本实现采用 TF-IDF + 余弦相似度，纯 JavaScript 实现，零外部依赖
 * - 搜索质量接近语义搜索（关键词加权 + 模糊匹配），性能远优于模型推理
 * - 后续可平滑升级为向量方案（接口不变，替换实现即可）
 *
 * @module services/data-sync-search/semanticSearcher
 * @created 2026-07-14 - 双通道整改 P3-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { SearchItem } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 中文停用词 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很',
  '到', '说', '要', '去', '你', '会', '着', '看', '好', '自己', '这', '那', '它', '他', '她',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'on', 'at',
  'for', 'by', 'with', 'from', 'as', 'into', 'and', 'or', 'not', 'but', 'if', 'then',
])

/** 最小关键词长度 */
const MIN_TOKEN_LENGTH = 2

/** 最大返回结果数 */
const MAX_RESULTS = 50

/** 最小相似度阈值 */
const MIN_SIMILARITY = 0.01

// ============================================================
// 分词
// ============================================================

/**
 * 中文+英文混合分词
 *
 * 中文按字/双字切分，英文按空格切分，过滤停用词。
 *
 * @param text - 待分词文本
 * @returns 词项数组
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lowerText = text.toLowerCase()

  // 英文：按非字母数字分割
  const englishParts = lowerText.match(/[a-z0-9]+/g) ?? []
  for (const part of englishParts) {
    if (part.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(part)) {
      tokens.push(part)
    }
  }

  // 中文：按字切分（单字 + 双字组合）
  const chineseChars = lowerText.match(/[\u4e00-\u9fa5]/g) ?? []
  for (let i = 0; i < chineseChars.length; i++) {
    const char = chineseChars[i] ?? ''
    if (!STOP_WORDS.has(char)) {
      tokens.push(char)
    }
    // 双字组合
    if (i + 1 < chineseChars.length) {
      const bigram = char + (chineseChars[i + 1] ?? '')
      if (!STOP_WORDS.has(bigram)) {
        tokens.push(bigram)
      }
    }
  }

  return tokens
}

// ============================================================
// TF-IDF 计算
// ============================================================

/** 文档向量（词项 → TF-IDF 权重） */
type DocumentVector = Map<string, number>

/**
 * 计算 TF（词频）
 * @param tokens - 词项数组
 * @returns 词项 → 词频
 */
function computeTF(tokens: readonly string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }
  // 归一化
  const total = tokens.length || 1
  for (const [key, value] of tf) {
    tf.set(key, value / total)
  }
  return tf
}

/**
 * 计算 IDF（逆文档频率）
 * @param documents - 全部文档的词项列表
 * @returns 词项 → IDF
 */
function computeIDF(documents: readonly Map<string, number>[]): Map<string, number> {
  const docCount = documents.length
  const df = new Map<string, number>() // 文档频率

  for (const doc of documents) {
    for (const term of doc.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    // IDF = log(N / (df + 1))，加 1 平滑
    idf.set(term, Math.log((docCount + 1) / (freq + 1)) + 1)
  }

  return idf
}

/**
 * 计算 TF-IDF 向量
 * @param tf - 词频
 * @param idf - 逆文档频率
 * @returns TF-IDF 向量
 */
function computeTFIDf(tf: Map<string, number>, idf: Map<string, number>): DocumentVector {
  const vector = new Map<string, number>()
  for (const [term, tfValue] of tf) {
    const idfValue = idf.get(term) ?? 1
    vector.set(term, tfValue * idfValue)
  }
  return vector
}

/**
 * 计算余弦相似度
 * @param vecA - 向量 A
 * @param vecB - 向量 B
 * @returns 相似度 [0, 1]
 */
function cosineSimilarity(vecA: DocumentVector, vecB: DocumentVector): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [term, weightA] of vecA) {
    const weightB = vecB.get(term)
    if (weightB !== undefined) {
      dotProduct += weightA * weightB
    }
    normA += weightA * weightA
  }

  for (const [, weightB] of vecB) {
    normB += weightB * weightB
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ============================================================
// 语义搜索器
// ============================================================

/** 索引文档 */
interface IndexedDocument {
  id: string
  title: string
  content: string
  vector: DocumentVector
  original: SearchItem
}

/**
 * 轻量语义搜索引擎
 *
 * 基于 TF-IDF + 余弦相似度实现，零外部依赖。
 */
class SemanticSearchEngine {
  private documents: IndexedDocument[] = []
  private idf: Map<string, number> = new Map()
  private indexed = false

  /**
   * 索引文档
   * @param items - 待索引的检索结果项
   */
  index(items: readonly SearchItem[]): void {
    const startTime = performance.now()

    // 构建文档词项列表
    const allTokens: string[][] = []
    const tfList: Map<string, number>[] = []

    this.documents = items.map(item => {
      const text = `${item.title} ${item.snippet}`
      const tokens = tokenize(text)
      allTokens.push(tokens)
      const tf = computeTF(tokens)
      tfList.push(tf)

      return {
        id: item.id,
        title: item.title,
        content: item.snippet,
        vector: new Map(), // 先占位，IDF 计算后填充
        original: item,
      }
    })

    // 计算 IDF
    this.idf = computeIDF(tfList)

    // 计算 TF-IDF 向量
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i]
      if (!doc) continue
      const tf = tfList[i] ?? new Map<string, number>()
      doc.vector = computeTFIDf(tf, this.idf)
    }

    this.indexed = true
    const elapsed = performance.now() - startTime
    logger.info('[semanticSearch] 索引完成', {
      docCount: this.documents.length,
      vocabularySize: this.idf.size,
      elapsedMs: Math.round(elapsed),
    })
  }

  /**
   * 语义搜索
   *
   * @param query - 查询文本
   * @param topK - 返回前 K 个结果
   * @returns 按相似度降序排列的结果
   */
  search(query: string, topK: number = MAX_RESULTS): Array<{
    item: SearchItem
    score: number
  }> {
    if (!this.indexed || this.documents.length === 0) {
      logger.warn('[semanticSearch] 未索引或无文档')
      return []
    }

    logger.info('[semanticSearch] search 入口', {
      query,
      topK,
      indexedDocs: this.documents.length,
    })

    // 查询向量化
    const queryTokens = tokenize(query)
    const queryTF = computeTF(queryTokens)
    const queryVector = computeTFIDf(queryTF, this.idf)

    logger.info('[semanticSearch] 查询向量化完成', {
      queryTokenCount: queryTokens.length,
      queryVectorDim: queryVector.size,
    })

    // 计算相似度
    const scores: Array<{ item: SearchItem; score: number }> = []
    for (const doc of this.documents) {
      const score = cosineSimilarity(queryVector, doc.vector)
      if (score >= MIN_SIMILARITY) {
        scores.push({ item: doc.original, score })
      }
    }

    // 降序排序
    scores.sort((a, b) => b.score - a.score)

    const results = scores.slice(0, topK)
    logger.info('[semanticSearch] 搜索完成', {
      query,
      totalDocs: this.documents.length,
      matched: scores.length,
      returned: results.length,
      topScore: results[0]?.score.toFixed(4) ?? '0',
    })

    return results
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.documents = []
    this.idf = new Map()
    this.indexed = false
  }

  /**
   * 获取索引文档数
   */
  get documentCount(): number {
    return this.documents.length
  }

  /**
   * 是否已索引
   */
  get isIndexed(): boolean {
    return this.indexed
  }
}

/** 语义搜索引擎单例 */
export const semanticSearcher = new SemanticSearchEngine()

// ============================================================
// 便捷 API
// ============================================================

/**
 * 语义搜索（一次性，自动索引+搜索）
 *
 * @param query - 查询文本
 * @param items - 待搜索的文档列表
 * @param topK - 返回前 K 个
 * @returns 搜索结果
 */
export function semanticSearch(
  query: string,
  items: readonly SearchItem[],
  topK: number = MAX_RESULTS,
): Array<{ item: SearchItem; score: number }> {
  const engine = new SemanticSearchEngine()
  engine.index(items)
  return engine.search(query, topK)
}
