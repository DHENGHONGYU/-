/**
 * vectorConsistencyRankingService — Phase 2 · 向量一致性打分
 *
 * 纯函数 sidecar 服务：
 *  ① 不修改 analysisStore 中的原始 scores / candidates / stocks
 *  ② 对当前作用域的输入项（意向候选池或全量标的），计算：
 *       - 研究目标文本 vs 个股采集语料 的余弦相似度（cosineScore, 0~1）
 *       - V6 原始分数归一化到 0~1（除以理论上限 5，做 clip）
 *       - 加权融合：fusedScore = α·v6Norm + (1-α)·cosine  (α 可调，默认 0.70)
 *  ③ 返回排序后的 rankable 列表供 UI 层渲染。
 *
 * 设计约束：
 *  - 零破坏：仅生成可展示的 sidecar 对象，不写回 store。
 *  - 可观测：每个阶段的错误都走 logger 记录并返回 reason 字段。
 *  - 优雅降级：尚未评分的个股 cosineScore=0 且 normalizedV6=0 但仍
 *    会显示为"未评分"条目（fusedScore 由用户可控阈值过滤，默认不隐藏）。
 *
 * @module services/analysis/vectorConsistencyRankingService
 */

import { STORE_NAME } from '@/config/dbConfig'
import { queryList } from '@/data/dataLayerHelpers'
import type { LocalDoc } from '@/data/types'
import type { Stock, V6Score } from '@/data/types'
import type { AnalysisCandidate } from '@/types/modules/analysis.types'
import { getLogger } from '@/lib/logger'
import {
  embedText,
  cosineSimilarity,
} from '@/services/system/localEmbeddingService'

const logger = getLogger()

/** V6 理论最高分（engine 11 层加权合计上限为 5.0） */
export const V6_THEORETICAL_MAX = 5

/** 归一化：输入原始 v6 score → 0~1 */
export function normalizeV6Score(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0
  const clipped = Math.max(0, Math.min(V6_THEORETICAL_MAX, raw))
  return clipped / V6_THEORETICAL_MAX
}

/** 融合分数 */
export function fuseScores(
  normalizedV6: number,
  cosineScore: number,
  alphaV6: number,
): number {
  const a = Number.isFinite(alphaV6) ? Math.max(0, Math.min(1, alphaV6)) : 0.7
  const v = Number.isFinite(normalizedV6) ? Math.max(0, Math.min(1, normalizedV6)) : 0
  const c = Number.isFinite(cosineScore) ? Math.max(0, Math.min(1, cosineScore)) : 0
  return a * v + (1 - a) * c
}

/** 单条 sidecar 排名条目（与原始 store 解耦，不反向修改） */
export interface ConsistencyRankItem {
  symbol: string
  name: string
  /** 来源：intention 候选池 / all 全量 */
  pool: 'intention' | 'all'
  /** 原始 V6 分数（若尚未评分则 undefined，UI 显示"未评分"） */
  rawV6Score?: number
  /** 归一化 V6 分数 — 0~1 */
  normalizedV6: number
  /** 向量余弦相似度 — 0~1（若尚未采集向量化则为 0，UI 给出"需先采集"badge） */
  cosineScore: number
  /** 融合分数 = α·v6Norm + (1-α)·cosine — 0~1 */
  fusedScore: number
  /** V6 占比权重 α（快照：避免 UI 滑杆变化时丢失排序溯源） */
  alphaSnapshot: number
  /** 已在评分队列中？由 UI 填写后用于禁用"立即评分"按钮 */
  scored?: boolean
  /** 行业（从 stocks/candidate 中透传，便于 Badge） */
  industry?: string
}

export type ConsistencyRankingStatus =
  | 'ok'
  | 'empty-candidates'
  | 'embed-failed'
  | 'error'

export interface ConsistencyRankingResult {
  status: ConsistencyRankingStatus
  items: ConsistencyRankItem[]
  reason?: string
  /** 本次执行耗时（ms） */
  elapsedMs: number
  /** 候选总数（用于确认是否正确加载） */
  candidateTotal: number
  /** 已向量化的候选数量（分子） */
  vectorizedCount: number
  /** 已评分（有 V6Score）的候选数量 */
  scoredCount: number
}

/**
 * 计算向量一致性排名（纯函数，无副作用，不改 analysisStore 原始值）。
 *
 * @param researchTarget 研究目标文本（通常来自用户输入）
 * @param candidates 当前作用域候选（intention candidates 或 all stocks）
 * @param scores 现有 V6 评分列表（从 analysisStore.scores 读取，与 candidates 通过 symbol 关联）
 * @param pool 候选来自哪个池，决定返回值中的 pool 字段与 UI 标签
 * @param alphaV6 V6 分数权重 α（∈[0,1]），默认 0.70：即 V6 主导 70% / 向量 30%
 */
export async function buildConsistencyRanking(
  researchTarget: string,
  candidates: Array<{ symbol: string; name: string; industry?: string } | AnalysisCandidate | Stock>,
  scores: V6Score[],
  pool: 'intention' | 'all',
  alphaV6 = 0.7,
): Promise<ConsistencyRankingResult> {
  const startedAt = performance.now()

  // 1) 候选为空 — 快速返回
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      status: 'empty-candidates',
      items: [],
      reason: pool === 'intention'
        ? '意向候选池为空，请先在输入舱录入并采集标的。'
        : '暂无任何标的，请先在输入舱录入。',
      elapsedMs: Math.round(performance.now() - startedAt),
      candidateTotal: 0,
      vectorizedCount: 0,
      scoredCount: 0,
    }
  }

  // 2) 构建 symbol → score 查询索引（O(n) 构建 O(1) 查找，避免循环内 Array.find）
  const scoreBySymbol = new Map<string, V6Score>(
    scores.filter((s) => s?.symbol).map((s) => [s.symbol, s] as const),
  )

  // 3) 嵌入研究目标（嵌入失败并不阻断 — 允许 α=1 纯 V6 排序）
  let queryVector: number[] | null = null
  let embedError: string | null = null
  const trimmed = (researchTarget ?? '').trim()
  if (trimmed.length > 0) {
    const embedRes = await embedText(trimmed)
    if (embedRes.success && embedRes.vector?.length) {
      queryVector = embedRes.vector
    } else {
      embedError = !embedRes.success
        ? (embedRes as { error?: string }).error ?? '嵌入失败'
        : '空向量'
      logger.warn('[ConsistencyRanking] 研究目标嵌入失败', {
        error: embedError,
        queryLength: trimmed.length,
      })
    }
  }

  // 4) 批量读取候选对应的 `collected:{symbol}` 向量（一次 IO，避免 N 次 queryGet）
  let cosineBySymbol = new Map<string, number>()
  let vectorizedCount = 0
  try {
    const candidateSymbolSet = new Set(candidates.map((c) => c.symbol).filter(Boolean))
    if (queryVector && candidateSymbolSet.size > 0) {
      // 读取所有已向量的 docs（localDocs），按 symbol 过滤出候选范围内的
      const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
      for (const doc of allDocs) {
        if (!doc?.id?.startsWith('collected:') || !doc.embedding?.length) continue
        const sym = doc.id.slice('collected:'.length)
        if (!sym || !candidateSymbolSet.has(sym)) continue
        const score = cosineSimilarity(queryVector, doc.embedding)
        cosineBySymbol.set(sym, score)
        vectorizedCount++
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[ConsistencyRanking] 向量读取失败', { error: msg })
    cosineBySymbol = new Map()
  }

  // 5) 为每个候选构建 sidecar 排名条目
  let scoredCount = 0
  const items: ConsistencyRankItem[] = candidates.map((raw) => {
    const { symbol, name } = raw as { symbol: string; name: string }
    const industry =
      (raw as { industry?: string }).industry ??
      (raw as Partial<Stock>).sector ??
      undefined

    const v6 = scoreBySymbol.get(symbol)
    const normalizedV6 = normalizeV6Score(v6?.score)
    if (v6) scoredCount++

    const cosineScore = Number.isFinite(queryVector?.length) ? cosineBySymbol.get(symbol) ?? 0 : 0
    // 当无研究目标时不做融合（也不假装向量有分数），fused 直接等于 normalizedV6 原始排序
    const fusedAlpha = trimmed.length > 0 ? alphaV6 : 1
    const fusedScore = fuseScores(normalizedV6, cosineScore, fusedAlpha)

    return {
      symbol,
      name: name ?? symbol,
      pool,
      rawV6Score: v6?.score,
      normalizedV6,
      cosineScore,
      fusedScore,
      alphaSnapshot: fusedAlpha,
      scored: !!v6,
      industry,
    } as ConsistencyRankItem
  })

  // 6) 按 fusedScore 降序排序（稳定：同分时再比较 cosine → normalizedV6 → symbol 字母序）
  items.sort((a, b) => {
    const d = b.fusedScore - a.fusedScore
    if (d !== 0) return d
    const dc = b.cosineScore - a.cosineScore
    if (dc !== 0) return dc
    const dv = b.normalizedV6 - a.normalizedV6
    if (dv !== 0) return dv
    return a.symbol.localeCompare(b.symbol)
  })

  const status: ConsistencyRankingStatus = embedError && cosineBySymbol.size === 0
    ? 'embed-failed'
    : 'ok'
  const reason: string | undefined = embedError
    ? `研究目标嵌入失败（${embedError}），当前按纯 V6 分数排序。`
    : undefined

  const elapsedMs = Math.round(performance.now() - startedAt)

  logger.info('[ConsistencyRanking] 构建完成', {
    queryLength: trimmed.length,
    pool,
    alphaV6,
    candidates: candidates.length,
    vectorizedCount,
    scoredCount,
    status,
    elapsedMs,
  })

  return {
    status,
    items,
    reason,
    elapsedMs,
    candidateTotal: candidates.length,
    vectorizedCount,
    scoredCount,
  }
}
