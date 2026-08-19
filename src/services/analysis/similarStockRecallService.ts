/**
 * similarStockRecallService — 相似股票语义召回服务（Phase 1）
 *
 * 基于采集阶段写入的 `collected:{symbol}` 向量，对用户输入的研究
 * 主题/方向文本做 ONNX 嵌入 → HNSW 余弦相似度 TopK 召回 → 从
 * IndexedDB stocks store 补足股票名称/行业等基础信息 → 返回结构化
 * 结果供 UI 层渲染或后续评分链路消费。
 *
 * 设计原则：
 *  ① 零破坏性 — 不修改任何已有评分/筛选流程，仅作为辅助入口。
 *  ② 可观测 — 嵌入失败、索引未就绪、召回为空等全部走 logger，
 *     UI 层通过 status 字段给出温和提示，而非报错。
 *  ③ 向后兼容 — 向量库中若暂无 collected:* 向量（历史未触发采集
 *     向量化）则返回空列表，并给出「请先在输入舱完成采集+向量化」
 *     的 reason，UI 可据此渲染兜底引导。
 *
 * 数据链路：
 *   userQuery
 *     ↓ (embedText via bge-base-zh-v1.5, 768d)
 *   queryVector
 *     ↓ (getStorageFor('vector').searchVectors, HNSW or full-scan fallback)
 *   [{id:'collected:600519.SH', score:0.78}]
 *     ↓ (parse symbol from id, hydrate from STORE_NAME.stocks)
 *   [{symbol, name, industry, similarityScore, source}]
 *
 * @module services/analysis/similarStockRecallService
 */

import { STORE_NAME } from '@/config/dbConfig'
import { queryGet } from '@/data/dataLayerHelpers'
import { getLogger } from '@/lib/logger'
import { embedText } from '@/services/system/localEmbeddingService'
import { getStorageFor } from '@/services/storage/storageFactory'
import type { Stock } from '@/data/types/types.stock'
import type {
  VectorProvider,
  VectorSearchResult,
} from '@/services/storage/storageProvider'

const logger = getLogger()

/** 单条召回结果 */
export interface SimilarStockRecallItem {
  /** 股票代码，如 600519.SH */
  symbol: string
  /** 股票名称，如 贵州茅台 */
  name: string
  /** 行业，从 stocks store 中取；缺失则为 '' */
  industry: string
  /** 余弦相似度（0~1），越高越匹配 */
  similarityScore: number
  /** 来源标签（便于 UI Badge 展示），固定为 'semantic-recall' */
  source: 'semantic-recall'
}

/** 召回执行状态（UI 据此渲染不同的提示/兜底） */
export type RecallStatus =
  | 'ok' // 正常，结果列表可能为空
  | 'empty-query' // 输入为空
  | 'embed-failed' // 嵌入失败（ONNX 未就绪/模型下载失败等）
  | 'empty-index' // 向量索引中暂无 collected:* 文档
  | 'error' // 异常，已记录错误日志

export interface SimilarStockRecallResult {
  status: RecallStatus
  items: SimilarStockRecallItem[]
  /** 人类可读的状态说明，用于 UI 辅助文案（非必须） */
  reason?: string
  /** 原始 topK 命中数（未过滤 stocks store 前），便于调试 */
  rawHits?: number
  /** 整个召回耗时（ms） */
  elapsedMs: number
}

// ============================================================
// 主入口
// ============================================================

/**
 * 基于语义描述召回意向池/研究池中已采集并向量化的相似股票。
 *
 * @param queryText 研究主题/方向，例如"新能源高股息"、"半导体国产替代"
 * @param topK 最大召回数（默认 5）
 * @param minScore 最低余弦相似度阈值（默认 0.35，高于 VectorProvider 的 0.3）
 * @returns 结构化召回结果
 */
export async function searchSimilarStocks(
  queryText: string,
  topK = 5,
  minScore = 0.35,
): Promise<SimilarStockRecallResult> {
  const startedAt = performance.now()
  const trimmed = (queryText ?? '').trim()

  if (trimmed.length === 0) {
    return {
      status: 'empty-query',
      items: [],
      reason: '请输入要查询的研究主题',
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }

  // Step 1: 嵌入查询文本
  const embedRes = await embedText(trimmed)
  // 分两段判别：success=false（有 error 字段） vs success=true 但 vector 为空（无 error 字段）
  // 避免 TS 判别并集在复合条件下无法窄化出 error 字段（TS2339）
  if (!embedRes.success) {
    logger.warn('[SimilarStockRecall] 查询嵌入失败', {
      queryLength: trimmed.length,
      error: embedRes.error,
    })
    return {
      status: 'embed-failed',
      items: [],
      reason: '嵌入服务暂不可用（ONNX 模型可能仍在加载），请稍后重试',
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }
  if (!embedRes.vector?.length) {
    logger.warn('[SimilarStockRecall] 查询嵌入空向量', { queryLength: trimmed.length })
    return {
      status: 'embed-failed',
      items: [],
      reason: '嵌入未产出向量，请稍后重试或更换查询词',
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }

  // Step 2: 向量 TopK 检索
  let vectorHits: VectorSearchResult[] = []
  try {
    const baseProvider = await getStorageFor('vector')
    // 对 morphology='vector' 桶，实现端是 VectorProvider。StorageProvider 基类
    // 未暴露 searchVectors/upsertVectors，故此处用子接口断言（结构兼容，TSV 验证）。
    const vectorProvider = baseProvider as VectorProvider
    const res = await vectorProvider.searchVectors({
      vector: embedRes.vector,
      topK: Math.max(topK, 1),
      minScore,
    })
    if (!res.success) {
      logger.warn('[SimilarStockRecall] 向量检索错误', { error: res.error })
      return {
        status: 'error',
        items: [],
        reason: `向量检索失败：${res.error ?? '未知错误'}`,
        elapsedMs: Math.round(performance.now() - startedAt),
      }
    }
    vectorHits = res.data.filter((r: VectorSearchResult) => r.id.startsWith('collected:'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[SimilarStockRecall] 向量检索异常', { error: msg })
    return {
      status: 'error',
      items: [],
      reason: `向量检索异常：${msg}`,
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }

  if (vectorHits.length === 0) {
    return {
      status: 'empty-index',
      items: [],
      reason: '尚未匹配到已向量化的标的，请先在输入舱完成采集（采集后会自动向量化）',
      rawHits: 0,
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }

  // Step 3: 由 docId 解析 symbol，补足 stocks store 中的 name/industry
  const enriched: SimilarStockRecallItem[] = []
  for (const hit of vectorHits) {
    const symbol = hit.id.slice('collected:'.length)
    if (!symbol) continue

    let name = ''
    let industry = ''
    try {
      const stock = await queryGet<Stock>(STORE_NAME.stocks, symbol)
      if (stock) {
        name = stock.name ?? symbol
        industry = (stock as Stock & { industry?: string }).industry ?? ''
      } else {
        name = symbol
      }
    } catch (_e) {
      // stocks store 读取失败不阻塞结果，退化为只显示代码
      name = symbol
    }

    enriched.push({
      symbol,
      name,
      industry,
      similarityScore: Number(hit.score.toFixed(4)),
      source: 'semantic-recall',
    })
  }

  const items = enriched.slice(0, topK)

  logger.info('[SimilarStockRecall] 召回完成', {
    query: trimmed,
    topK,
    minScore,
    rawHits: vectorHits.length,
    returned: items.length,
    elapsedMs: Math.round(performance.now() - startedAt),
  })

  return {
    status: 'ok',
    items,
    rawHits: vectorHits.length,
    elapsedMs: Math.round(performance.now() - startedAt),
  }
}
