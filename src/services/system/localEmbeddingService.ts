/**
 * localEmbeddingService — 本地 ONNX 嵌入引擎
 *
 * 基于 @xenova/transformers 在浏览器中运行 ONNX 模型，
 * 将文本转为向量嵌入，不依赖云端推理 API。
 *
 * 模型：Xenova/bge-base-zh-v1.5（~200MB ONNX 量化，首次运行自动下载）
 * 维度：768
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
const EMBEDDING_MODEL_ID = 'Xenova/bge-base-zh-v1.5'
/** 嵌入向量维度（bge-base-zh: 768d） */
const EMBEDDING_DIMENSION = 768

/** 模型下载/加载超时（30s，防止网络中断时无限挂起） */
const MODEL_LOAD_TIMEOUT_MS = 30_000
/** 模型加载最大重试次数（含首次，共 3 次尝试） */
const MODEL_LOAD_MAX_RETRIES = 3

// ============================================================
// 嵌入引擎（懒加载 + 超时重试 + 并发共享）
// ============================================================

let pipelineInstance: Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>> | null = null
let pipelineLoading = false
let pipelineLoadPromise: Promise<void> | null = null

/**
 * 带超时与重试的模型加载核心逻辑
 *
 * 重试策略：指数退避（2s → 4s），最多 MODEL_LOAD_MAX_RETRIES 次。
 * 超时保护：单次 pipeline 调用超过 MODEL_LOAD_TIMEOUT_MS 即视为失败并进入重试。
 *
 * 该函数内部封装完整的重试周期，确保并发调用方共享同一次加载流程
 * （pipeline 仅被调用 N 次重试，而非 M 调用方 × N 次重试）。
 */
async function loadPipelineWithRetry(): Promise<void> {
  const startTime = performance.now()
  logger.info('[LocalEmbedding] 初始化嵌入模型', {
    modelId: EMBEDDING_MODEL_ID,
    maxRetries: MODEL_LOAD_MAX_RETRIES,
    timeoutMs: MODEL_LOAD_TIMEOUT_MS,
  })

  // 动态导入 transformers.js（首次调用时自动下载模型）
  // 使用变量形式绕过 Vite 静态分析，避免预转换失败
  const transformerModule = '@xenova' + '/transformers'
  const { pipeline } = await import(transformerModule)

  let lastErr: unknown
  for (let attempt = 1; attempt <= MODEL_LOAD_MAX_RETRIES; attempt++) {
    try {
      // 单次加载超时保护：pipeline 下载大模型时可能因网络中断无限挂起
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`模型下载超时(${MODEL_LOAD_TIMEOUT_MS}ms)`)),
          MODEL_LOAD_TIMEOUT_MS,
        )
      })
      try {
        pipelineInstance = await Promise.race([
          pipeline('feature-extraction', EMBEDDING_MODEL_ID, { quantized: true }),
          timeoutPromise,
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info('[LocalEmbedding] 嵌入模型就绪', {
        modelId: EMBEDDING_MODEL_ID,
        elapsedSec: elapsed,
        attempt,
      })
      return // 加载成功
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn('[LocalEmbedding] 模型加载失败，准备重试', {
        attempt,
        maxRetries: MODEL_LOAD_MAX_RETRIES,
        error: msg,
      })
      if (attempt < MODEL_LOAD_MAX_RETRIES) {
        // 指数退避：attempt 1 → 2s, attempt 2 → 4s
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // 全部重试耗尽：清空实例（保持 null），抛出聚合错误
  pipelineInstance = null
  const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  logger.error('[LocalEmbedding] 模型加载彻底失败', {
    error: finalMsg,
    attempts: MODEL_LOAD_MAX_RETRIES,
  })
  throw new Error(`嵌入模型加载失败: ${finalMsg}`)
}

/**
 * 获取嵌入 pipeline（懒加载 + 单例 + 超时重试 + 并发共享）
 *
 * 并发语义：多个调用方同时进入时，共享同一个 pipelineLoadPromise，
 * pipeline 仅在重试周期内被调用 MODEL_LOAD_MAX_RETRIES 次（而非 调用方数 × 重试数）。
 * 加载失败后状态清空，下次调用可重新触发加载。
 *
 * @returns pipeline 实例，可用于提取 embeddings
 */
async function getEmbeddingPipeline(): Promise<Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>>> {
  // 1. 已加载 → 直接复用
  if (pipelineInstance) return pipelineInstance

  // 2. 加载中 → 共享正在进行的 pipelineLoadPromise（不重复发起）
  if (pipelineLoading && pipelineLoadPromise) {
    await pipelineLoadPromise
    // 加载成功：pipelineInstance 已设置；加载失败：await 已抛出，不会走到这里
    return pipelineInstance!
  }

  // 3. 首次触发加载
  pipelineLoading = true
  pipelineLoadPromise = loadPipelineWithRetry()

  try {
    await pipelineLoadPromise
  } finally {
    // 加载结束（成功或失败）后清空状态：
    //  - 成功：pipelineInstance 已就绪，后续调用走分支 1
    //  - 失败：pipelineInstance 保持 null，后续调用可重新触发分支 3
    pipelineLoading = false
    pipelineLoadPromise = null
  }

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
