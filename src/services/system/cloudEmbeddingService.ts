/**
 * cloudEmbeddingService — 云端 Embedding 服务前端层
 *
 * 通过 HTTP API 调用后端 FastAPI embedding 服务（backend/embedding_service.py），
 * 替代 @xenova/transformers 浏览器内 ONNX 推理。
 *
 * 优势：
 *   - 前端 bundle 减少 108 MB（@xenova/transformers + onnxruntime-web/node）
 *   - 首次加载无需下载模型（~23MB），改善首屏体验
 *   - 批量推理效率更高（单次 HTTP 请求处理多段文本）
 *
 * 接口契约：与 localEmbeddingService.ts 完全兼容，可无缝切换。
 * 模型：all-MiniLM-L6-v2（384 维，与本地 Xenova 模型一致）
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033]
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型（与 localEmbeddingService 保持一致）
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

/** 后端 embedding API 基础路径（通过 Vite proxy 转发到 localhost:8001） */
const EMBEDDING_API_BASE = '/api/embed'
/** 嵌入向量维度（与后端 all-MiniLM-L6-v2 一致） */
const EMBEDDING_DIMENSION = 384
/** 嵌入模型 ID */
const EMBEDDING_MODEL_ID = 'all-MiniLM-L6-v2'
/** 请求超时（ms）— 首次请求需加载模型，给足时间 */
const REQUEST_TIMEOUT = 60_000

// ============================================================
// 内部 HTTP 工具
// ============================================================

/** 后端 /api/embed 响应格式 */
interface EmbedApiResponse {
  success: boolean
  vectors: number[][]
  dimension: number
  modelId: string
  elapsed_ms: number
}

/**
 * 调用后端 embedding API
 * @param texts 待嵌入的文本数组
 * @returns 向量数组（与输入文本一一对应）
 */
async function callEmbedApi(texts: string[]): Promise<EmbedApiResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const res = await fetch(EMBEDDING_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`embedding API ${res.status}: ${errBody}`)
    }

    return (await res.json()) as EmbedApiResponse
  } finally {
    clearTimeout(timeout)
  }
}

// ============================================================
// 核心函数（与 localEmbeddingService 接口兼容）
// ============================================================

/**
 * 对单段文本生成嵌入向量
 * @param text 输入文本
 * @param pooling 仅为接口兼容，云端已默认 mean pooling
 * @returns 嵌入结果
 */
export async function embedText(
  text: string,
  _pooling: 'mean' | 'cls' = 'mean',
): Promise<EmbeddingResponse> {
  try {
    const startTime = performance.now()
    const data = await callEmbedApi([text])
    const vector = data.vectors[0] ?? []
    const elapsed = (performance.now() - startTime).toFixed(0)

    logger.info('[CloudEmbedding] 嵌入完成', {
      textLength: text.length,
      dimension: vector.length,
      elapsedMs: elapsed,
    })

    // 更新状态缓存
    cachedStatus = { loaded: true, loading: false, modelId: EMBEDDING_MODEL_ID }

    return {
      success: true,
      vector,
      dimension: EMBEDDING_DIMENSION,
      modelId: EMBEDDING_MODEL_ID,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[CloudEmbedding] 嵌入失败', { error: msg })
    return { success: false, error: msg, modelId: EMBEDDING_MODEL_ID }
  }
}

/**
 * 对多段文本批量生成嵌入向量
 *
 * 性能优势：单次 HTTP 请求处理所有文本（本地版逐条调用）
 * @param chunks 文本块列表
 * @returns 带向量的文本块列表
 */
export async function embedChunks(chunks: TextChunk[]): Promise<ChunkEmbedding[]> {
  if (chunks.length === 0) return []

  try {
    const texts = chunks.map((c) => c.text)
    const data = await callEmbedApi(texts)

    const results: ChunkEmbedding[] = []
    chunks.forEach((chunk, i) => {
      const vector = data.vectors[i]
      if (vector) {
        results.push({ ...chunk, vector })
      } else {
        logger.warn('[CloudEmbedding] 块嵌入缺失向量，跳过', { chunkId: chunk.id })
      }
    })

    logger.info('[CloudEmbedding] 批量嵌入完成', {
      total: chunks.length,
      success: results.length,
    })

    return results
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[CloudEmbedding] 批量嵌入失败', { error: msg, total: chunks.length })
    // 降级：逐条重试（提高容错性）
    logger.info('[CloudEmbedding] 降级为逐条嵌入')
    const results: ChunkEmbedding[] = []
    for (const chunk of chunks) {
      const resp = await embedText(chunk.text)
      if (resp.success) {
        results.push({ ...chunk, vector: resp.vector })
      }
    }
    return results
  }
}

// ============================================================
// 余弦相似度（纯计算，与本地版逻辑一致）
// ============================================================

/**
 * 计算两个向量的余弦相似度
 * @param a 向量 A
 * @param b 向量 B
 * @returns [-1, 1] 相似度，维度不一致返回 0
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    logger.warn('[CloudEmbedding] 向量维度不一致', { lenA: a.length, lenB: b.length })
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

// ============================================================
// 模型状态（同步接口，与 localEmbeddingService 兼容）
// ============================================================

/** 本地状态缓存（通过 embedText 调用结果隐式更新） */
let cachedStatus: { loaded: boolean; loading: boolean; modelId: string } = {
  loaded: false,
  loading: false,
  modelId: EMBEDDING_MODEL_ID,
}

/**
 * 获取模型状态（同步，与 localEmbeddingService 接口兼容）
 *
 * 注意：云端服务的模型加载状态在后端维护，
 * 此处返回的是最近一次 embedText 调用后的缓存状态。
 * 如需实时状态，调用 checkEmbeddingHealth()。
 */
export function getEmbeddingStatus(): {
  loaded: boolean
  loading: boolean
  modelId: string
} {
  return cachedStatus
}

/**
 * 异步检查后端健康状态（可选，用于 UI 实时展示）
 * 调用后会更新 getEmbeddingStatus() 的缓存。
 */
export async function checkEmbeddingHealth(): Promise<{
  loaded: boolean
  loading: boolean
  modelId: string
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)

    const res = await fetch(`${EMBEDDING_API_BASE}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      cachedStatus = { loaded: false, loading: false, modelId: EMBEDDING_MODEL_ID }
      return cachedStatus
    }

    const data = (await res.json()) as {
      status: string
      model_loaded: boolean
      model_loading: boolean
      model_id: string
    }

    cachedStatus = {
      loaded: data.model_loaded,
      loading: data.model_loading,
      modelId: data.model_id,
    }
    return cachedStatus
  } catch {
    cachedStatus = { loaded: false, loading: false, modelId: EMBEDDING_MODEL_ID }
    return cachedStatus
  }
}
