/**
 * 八域资料体系 - 评分证据服务
 *
 * 管理评分证据链的 CRUD 操作，包括：
 * - 证据保存（单条/批量）
 * - 证据查询（按层、按资料条目、按股票）
 * - 证据删除（单条、按层清除、按股票全清）
 * - 证据覆盖率计算
 * - 自动从资料条目构建证据链
 *
 * @module services/profile/scoreEvidenceService
 * @created 2026-07-21
 * @doc [V9-DOC-DATA-031]
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope, queryByIndex, queryGet } from '@/data/dataLayerHelpers'
import type {
  ScoreEvidence,
  ScoreLayerId,
  SentimentLabel,
  StockProfile,
} from '@/data/types/types.profile'
import { DOMAIN_META } from '@/data/types/types.profile'
import { listProfileItemsBySymbol } from './profileService'

const logger = getLogger()

// ============================================================
// 写入操作
// ============================================================

/**
 * 保存单条证据
 */
export async function saveScoreEvidence(evidence: Omit<ScoreEvidence, 'id'> & { id?: string }): Promise<ScoreEvidence> {
  const now = Date.now()
  const id = evidence.id ?? makeEvidenceId(evidence.symbol, evidence.layer, evidence.evidenceType, now)

  const finalEvidence: ScoreEvidence = {
    ...evidence,
    id,
    createdAt: evidence.createdAt ?? now,
  }

  await sendWriteEnvelope('saveScoreEvidence', finalEvidence, 'analyzer')
  return finalEvidence
}

/**
 * 批量保存证据
 */
export async function bulkSaveScoreEvidence(
  evidences: Array<Omit<ScoreEvidence, 'id'> & { id?: string }>,
): Promise<{ saved: number }> {
  if (evidences.length === 0) return { saved: 0 }

  const now = Date.now()
  const finalEvidences: ScoreEvidence[] = evidences.map((e, i) => ({
    ...e,
    id: e.id ?? makeEvidenceId(e.symbol, e.layer, e.evidenceType, now + i),
    createdAt: e.createdAt ?? now,
  }))

  await sendWriteEnvelope('bulkSaveScoreEvidence', finalEvidences, 'analyzer')
  return { saved: finalEvidences.length }
}

/**
 * 生成证据 ID
 */
function makeEvidenceId(symbol: string, layer: ScoreLayerId, evidenceType: string, timestamp: number): string {
  return `${symbol}_${layer}_${evidenceType}_${timestamp}`
}

// ============================================================
// 查询操作
// ============================================================

/**
 * 根据 ID 获取单条证据
 */
export async function getScoreEvidence(id: string): Promise<ScoreEvidence | undefined> {
  return queryGet<ScoreEvidence>(STORE_NAME.scoreEvidence, id)
}

/**
 * 按股票列出所有证据
 */
export async function listEvidenceBySymbol(symbol: string): Promise<ScoreEvidence[]> {
  return queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-symbol', symbol)
}

/**
 * 按层列出证据
 */
export async function listEvidenceByLayer(symbol: string, layer: ScoreLayerId): Promise<ScoreEvidence[]> {
  const evidence = await queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-symbol-layer', [symbol, layer])
  return evidence.sort((a, b) => b.weight - a.weight) // 按权重降序
}

/**
 * 按资料条目查找关联证据
 */
export async function listEvidenceByProfileItem(profileItemId: string): Promise<ScoreEvidence[]> {
  return queryByIndex<ScoreEvidence>(STORE_NAME.scoreEvidence, 'by-profile-item', profileItemId)
}

/**
 * 获取证据概览（按层分组的统计）
 */
export async function getEvidenceOverview(symbol: string): Promise<{
  total: number
  byLayer: Record<ScoreLayerId, number>
  coverage: number
}> {
  const evidence = await listEvidenceBySymbol(symbol)
  const layers = Object.keys(DOMAIN_META).flatMap((d) => DOMAIN_META[d as keyof typeof DOMAIN_META].layers)
  const uniqueLayers = new Set(layers)

  const byLayer: Record<string, number> = {}
  for (const layer of uniqueLayers) {
    byLayer[layer] = evidence.filter((e) => e.layer === layer).length
  }

  // 覆盖率：有证据的层数 / 总层数
  const layersWithEvidence = Object.values(byLayer).filter((c) => c > 0).length
  const coverage = uniqueLayers.size > 0 ? layersWithEvidence / uniqueLayers.size : 0

  return {
    total: evidence.length,
    byLayer: byLayer as Record<ScoreLayerId, number>,
    coverage,
  }
}

// ============================================================
// 删除操作
// ============================================================

/**
 * 删除单条证据
 */
export async function deleteScoreEvidence(id: string): Promise<void> {
  await sendWriteEnvelope('deleteScoreEvidence', { id }, 'analyzer')
}

/**
 * 清除某只股票某层的所有证据（评分更新时调用）
 *
 * 在重新生成某层证据前调用，避免证据堆积重复。
 */
export async function clearEvidenceByLayer(symbol: string, layer: ScoreLayerId): Promise<number> {
  const evidence = await listEvidenceByLayer(symbol, layer)
  for (const e of evidence) {
    await sendWriteEnvelope('deleteScoreEvidence', { id: e.id }, 'analyzer')
  }
  logger.info(`[scoreEvidence] 清除层证据`, { symbol, layer, count: evidence.length })
  return evidence.length
}

/**
 * 清除某只股票的所有证据（全量重建时调用）
 */
export async function clearAllEvidence(symbol: string): Promise<number> {
  const evidence = await listEvidenceBySymbol(symbol)
  for (const e of evidence) {
    await sendWriteEnvelope('deleteScoreEvidence', { id: e.id }, 'analyzer')
  }
  logger.info(`[scoreEvidence] 清除全部证据`, { symbol, count: evidence.length })
  return evidence.length
}

/**
 * 清除旧版本证据（保留最新 N 个评分版本的证据）
 */
export async function clearOldVersionEvidence(symbol: string, keepVersions = 3): Promise<number> {
  const evidence = await listEvidenceBySymbol(symbol)

  // 收集所有版本号
  const versions = new Set<number>()
  for (const e of evidence) {
    if (e.scoreVersion) {
      versions.add(e.scoreVersion)
    }
  }

  // 找出要删除的旧版本
  const sortedVersions = Array.from(versions).sort((a, b) => b - a)
  const versionsToDelete = sortedVersions.slice(keepVersions)

  if (versionsToDelete.length === 0) return 0

  let deleted = 0
  for (const e of evidence) {
    if (e.scoreVersion && versionsToDelete.includes(e.scoreVersion)) {
      await sendWriteEnvelope('deleteScoreEvidence', { id: e.id }, 'analyzer')
      deleted++
    }
  }

  logger.info(`[scoreEvidence] 清除旧版本证据`, {
    symbol,
    keepVersions,
    deletedVersions: versionsToDelete.length,
    deletedCount: deleted,
  })

  return deleted
}

// ============================================================
// 证据权重重新计算
// ============================================================

/**
 * 重新计算某层证据的权重（归一化）
 *
 * 当证据列表变化后调用，确保所有权重之和合理。
 */
export async function recalculateLayerWeights(symbol: string, layer: ScoreLayerId): Promise<void> {
  const evidence = await listEvidenceByLayer(symbol, layer)
  if (evidence.length === 0) return

  // 计算总权重
  const totalWeight = evidence.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight === 0) return

  // 归一化到总和为 1（但保留相对比例）
  const updated = evidence.map((e) => ({
    ...e,
    weight: Math.min(1, e.weight / totalWeight),
  }))

  for (const e of updated) {
    await sendWriteEnvelope('saveScoreEvidence', e, 'analyzer')
  }

  logger.info(`[scoreEvidence] 重新计算层权重`, { symbol, layer, count: evidence.length })
}

// ============================================================
// 自动构建证据链
// ============================================================

/**
 * 从资料条目自动构建某层的证据
 *
 * 简单策略：将该层对应域的高质量资料条目转换为证据。
 */
export async function autoBuildLayerEvidence(
  symbol: string,
  layer: ScoreLayerId,
  options: { minQuality?: number; maxEvidence?: number } = {},
): Promise<ScoreEvidence[]> {
  const { minQuality = 50, maxEvidence = 10 } = options

  // 找到该层对应的域
  let domain: string | null = null
  for (const [d, meta] of Object.entries(DOMAIN_META)) {
    if (meta.layers.includes(layer)) {
      domain = d
      break
    }
  }

  if (!domain) {
    logger.warn(`[scoreEvidence] 未找到层对应的域`, { layer })
    return []
  }

  // 获取该域的资料条目
  const items = await listProfileItemsBySymbol(symbol)
  const domainItems = items.filter((i) => i.domain === domain && (i.qualityScore ?? 0) >= minQuality)

  // 转换为证据
  const evidence: ScoreEvidence[] = domainItems.slice(0, maxEvidence).map((item, index) => ({
    id: makeEvidenceId(symbol, layer, 'profile_item', Date.now() + index),
    symbol,
    layer,
    evidenceType: 'profile_item',
    title: item.title,
    description: item.summary,
    weight: (item.qualityScore ?? 50) / 100 * (item.evidenceWeight ?? 0.5),
    confidence: (item.qualityScore ?? 50) / 100,
    sentiment: item.sentiment as SentimentLabel,
    profileItemId: item.id,
    source: item.source,
    createdAt: Date.now(),
  }))

  // 归一化权重
  const totalWeight = evidence.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight > 0) {
    for (const e of evidence) {
      e.weight = e.weight / totalWeight
    }
  }

  // 保存
  await bulkSaveScoreEvidence(evidence)

  logger.info(`[scoreEvidence] 自动构建层证据`, {
    symbol,
    layer,
    domain,
    count: evidence.length,
  })

  return evidence
}

/**
 * 自动构建所有层的证据
 */
export async function autoBuildAllEvidence(symbol: string): Promise<Record<string, number>> {
  const layers: ScoreLayerId[] = ['l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8']
  const result: Record<string, number> = {}

  for (const layer of layers) {
    try {
      const evidence = await autoBuildLayerEvidence(symbol, layer)
      result[layer] = evidence.length
    } catch (err) {
      logger.warn(`[scoreEvidence] 构建层证据失败`, {
        symbol,
        layer,
        error: err instanceof Error ? err.message : String(err),
      })
      result[layer] = 0
    }
  }

  // 更新资料包统计
  const overview = await getEvidenceOverview(symbol)
  const { getOrCreateProfile } = await import('./profileService')
  const profile = await getOrCreateProfile(symbol)

  const updated: StockProfile = {
    ...profile,
    totalEvidence: overview.total,
    layerEvidenceCounts: overview.byLayer as any,
    evidenceCoverage: overview.coverage,
    lastUpdatedAt: Date.now(),
  }

  await sendWriteEnvelope('saveStockProfile', updated, 'analyzer')

  return result
}
