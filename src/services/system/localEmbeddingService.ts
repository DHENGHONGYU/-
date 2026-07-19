/**
 * localEmbeddingService — 本地 ONNX 嵌入引擎
 *
 * 基于 @xenova/transformers 在浏览器中运行 ONNX 模型，
 * 将文本转为向量嵌入，不依赖云端推理 API。
 *
 * 模型：Xenova/all-MiniLM-L6-v2（~23MB，首次运行自动下载）
 * 维度：384
 * 位置：浏览器 IndexedDB 缓存模型文件
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型
// ============================================================

export interface EmbeddingResult {
  success: true
  vector: number[]
  dimension: number
  modelId: string
}

export interface EmbeddingError {
  success: false
  error: string
  modelId: string
}

export type EmbeddingResponse = EmbeddingResult | EmbeddingError

export interface TextChunk {
  id: string
  text: string
  metadata?: Record<string, string>
}

export interface ChunkEmbedding extends TextChunk {
  vector: number[]
}

// ============================================================
// 配置
// ============================================================

/** 嵌入模型 ID（HuggingFace 上的 Xenova/ONNX 转换模型） */
const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
/** 嵌入向量维度 */
const EMBEDDING_DIMENSION = 384

// ============================================================
// 嵌入引擎（懒加载）
// ============================================================

let pipelineInstance: Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>> | null = null
let pipelineLoading = false
let pipelineLoadPromise: Promise<void> | null = null

/**
 * 获取嵌入 pipeline（懒加载 + 单例）
 * @returns pipeline 实例，可用于提取 embeddings
 */
async function getEmbeddingPipeline(): Promise<Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>>> {
  if (pipelineInstance) return pipelineInstance

  if (pipelineLoading && pipelineLoadPromise) {
    await pipelineLoadPromise
    return pipelineInstance!
  }

  pipelineLoading = true
  pipelineLoadPromise = (async () => {
    const startTime = performance.now()
    logger.info('[LocalEmbedding] 初始化嵌入模型', { modelId: EMBEDDING_MODEL_ID })

    try {
      // 动态导入 transformers.js（首次调用时自动下载模型）
      const { pipeline } = await import('@xenova/transformers')
      pipelineInstance = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
        quantized: true, // 使用量化版本（更小更快）
      })
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info('[LocalEmbedding] 嵌入模型就绪', { modelId: EMBEDDING_MODEL_ID, elapsedSec: elapsed })
    } catch (err) {
      pipelineLoading = false
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[LocalEmbedding] 模型加载失败', { error: msg })
      throw new Error(`嵌入模型加载失败: ${msg}`)
    }
  })()

  await pipelineLoadPromise
  pipelineLoading = false
  return pipelineInstance!
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 对单段文本生成嵌入向量
 * @param text 输入文本
 * @param pooling 'mean'（默认）| 'cls'
 * @returns 嵌入结果
 */
export async function embedText(
  text: string,
  pooling: 'mean' | 'cls' = 'mean',
): Promise<EmbeddingResponse> {
  try {
    const startTime = performance.now()
    const pipe = await getEmbeddingPipeline()

    const result = await pipe(text, { pooling } as never)

    // transformers.js 返回 Tensor，通过 as 安全提取
    const tensorData = result as unknown as { data: number[]; dims: number[] }
    const vector = Array.from(tensorData.data)
    const elapsed = ((performance.now() - startTime) * 1000).toFixed(0)

    logger.info('[LocalEmbedding] 嵌入完成', {
      textLength: text.length,
      dimension: vector.length,
      elapsedMs: elapsed,
    })

    return {
      success: true,
      vector,
      dimension: EMBEDDING_DIMENSION,
      modelId: EMBEDDING_MODEL_ID,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[LocalEmbedding] 嵌入失败', { error: msg })
    return { success: false, error: msg, modelId: EMBEDDING_MODEL_ID }
  }
}

/**
 * 对多段文本批量生成嵌入向量
 * @param chunks 文本块列表
 * @returns 带向量的文本块列表
 */
export async function embedChunks(chunks: TextChunk[]): Promise<ChunkEmbedding[]> {
  if (chunks.length === 0) return []

  const results: ChunkEmbedding[] = []

  for (const chunk of chunks) {
    const response = await embedText(chunk.text)
    if (response.success) {
      results.push({ ...chunk, vector: response.vector })
    } else {
      logger.warn('[LocalEmbedding] 块嵌入失败，跳过', { chunkId: chunk.id, error: response.error })
    }
  }

  return results
}

// ============================================================
// 余弦相似度
// ============================================================

/**
 * 计算两个向量的余弦相似度
 * @param a 向量 A
 * @param b 向量 B
 * @returns [-1, 1] 相似度，维度不一致返回 0
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    logger.warn('[LocalEmbedding] 向量维度不一致', { lenA: a.length, lenB: b.length })
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as number
    const bi = b[i] as number
    dotProduct += ai * bi
    normA += ai * ai
    normB += bi * bi
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * 在向量列表中查找最相似的 top-k
 * @param queryVector 查询向量
 * @param candidates 候选向量列表（带 id）
 * @param topK 返回前 K 个
 * @returns 排序后的相似度结果
 */
export function findTopK(
  queryVector: number[],
  candidates: { id: string; vector: number[] }[],
  topK: number = 5,
): { id: string; score: number }[] {
  const scored = candidates
    .map((c) => ({
      id: c.id,
      score: cosineSimilarity(queryVector, c.vector),
    }))
    .filter((c) => c.score > 0.3) // 相似度阈值过滤
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK)
}

/**
 * 获取模型状态（用于 UI 展示是否已加载）
 */
export function getEmbeddingStatus(): {
  loaded: boolean
  loading: boolean
  modelId: string
} {
  return {
    loaded: pipelineInstance !== null,
    loading: pipelineLoading,
    modelId: EMBEDDING_MODEL_ID,
  }
}
